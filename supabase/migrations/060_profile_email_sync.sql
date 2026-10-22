-- ============================================================================
-- 060_profile_email_sync.sql
-- Keep public.profiles.email in step with the Supabase Auth email.
--
-- `email` is a protected profile column, so a client upsert that changes it
-- raised 42501 (surfaced as "Failed to update your profile"). The Profile page
-- now changes the address through supabase.auth.updateUser({ email }) and this
-- trigger mirrors the new address into public.profiles.
-- Safe to re-run.
-- ============================================================================

set check_function_bodies = false;

-- Allow the auth-sync trigger below to write the email column. The flag is set
-- transaction-locally right before that single UPDATE and reset afterwards, so
-- direct client writes stay blocked.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.profile_email_sync', true) = 'on' then
    return new;
  end if;

  -- service_role / definer context has no JWT -> allow (Edge Functions).
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  -- Super Admins may change anything.
  if public.is_super_admin() then
    return new;
  end if;

  -- A trainer may self-activate their own account (pending_activation -> active).
  -- This is the ONLY protected change they are allowed to make to their own row.
  if new.id = old.id
     and old.auth_user_id = auth.uid()
     and old.status = 'pending_activation'
     and new.status = 'active'
     and old.is_activated = false
     and new.is_activated = true
     and new.role = old.role
     and new.mfa_enforced is not distinct from old.mfa_enforced
     and new.email is not distinct from old.email
     and new.specialization_id is not distinct from old.specialization_id then
    return new;
  end if;

  if new.role            is distinct from old.role
     or new.status            is distinct from old.status
     or new.is_activated      is distinct from old.is_activated
     or new.mfa_enforced      is distinct from old.mfa_enforced
     or new.email             is distinct from old.email
     or new.specialization_id is distinct from old.specialization_id then
    raise exception 'You are not allowed to change protected profile fields (role, status, activation, email, specialization).'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is distinct from old.email then
    perform set_config('app.profile_email_sync', 'on', true);

    update public.profiles
       set email = new.email,
           updated_at = now()
     where auth_user_id = new.id;

    perform set_config('app.profile_email_sync', 'off', true);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_profile_email();
