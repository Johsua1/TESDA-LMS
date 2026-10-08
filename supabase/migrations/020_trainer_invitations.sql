-- ===========================================================================
-- 020_trainer_invitations.sql
-- ---------------------------------------------------------------------------
-- Trainer invitation / activation.
--
-- SECURITY
--   We deliberately lean on Supabase Auth's own secure invitation + password
--   recovery links. The raw activation link is generated server-side by the
--   Auth Admin API and is NEVER stored here. If a custom token were ever
--   required, only its SHA-256 hash would live in `token_hash` -- never the
--   raw value.
--
--   This table is the audit/state trail for invitations:
--     invitation_status : pending | sent | activated | expired | revoked | failed
--     sent_at / expires_at / activated_at
-- ===========================================================================

create table if not exists public.trainer_invitations (
  id                uuid primary key default gen_random_uuid(),
  trainer_id        text not null references public.profiles(id) on delete cascade,
  email             text not null,
  token_hash        text,                       -- only if a custom token is used
  invitation_status text not null default 'pending',
  provider          text not null default 'supabase_auth',
  expires_at        timestamptz,
  sent_at           timestamptz,
  used_at           timestamptz,
  activated_at      timestamptz,
  created_by        text references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  metadata          jsonb not null default '{}'::jsonb
);

do $$
begin
  alter table public.trainer_invitations
    add constraint trainer_invitations_status_check
    check (invitation_status in ('pending','sent','activated','expired','revoked','failed'));
exception when duplicate_object then null;
end $$;

create index if not exists trainer_invitations_trainer_idx on public.trainer_invitations (trainer_id);
create index if not exists trainer_invitations_email_idx   on public.trainer_invitations (lower(email));

-- At most ONE live (unused, not revoked) invitation per trainer at a time.
create unique index if not exists trainer_invitations_active_unique
  on public.trainer_invitations (trainer_id)
  where used_at is null and invitation_status in ('pending', 'sent');

alter table public.trainer_invitations enable row level security;

-- RLS: Super Admin sees everything; a trainer may see their own invitation rows.
drop policy if exists trainer_invitations_select on public.trainer_invitations;
create policy trainer_invitations_select on public.trainer_invitations
  for select to authenticated
  using (public.is_super_admin() or trainer_id = public.current_profile_id());

-- All writes happen through SECURITY DEFINER functions / Edge Functions only.
-- (No insert/update/delete policy => no direct client writes.)

-- ---------------------------------------------------------------------------
-- Activation: when a pending trainer confirms their email or sets a password,
-- flip the profile to active. This runs on auth.users UPDATE so it works even
-- though the existing frontend has no dedicated activation screen.
-- ---------------------------------------------------------------------------
create or replace function public.handle_auth_user_activation()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile_id text;
begin
  -- Activation signals: email just confirmed, or password just (re)set.
  if (new.email_confirmed_at is not null and old.email_confirmed_at is null)
     or (new.encrypted_password is distinct from old.encrypted_password) then

    select id into v_profile_id
      from public.profiles
     where auth_user_id = new.id
       and status = 'pending_activation'
     limit 1;

    if v_profile_id is not null then
      update public.profiles
         set status = 'active', is_activated = true, updated_at = now()
       where id = v_profile_id;

      update public.trainer_invitations
         set invitation_status = 'activated',
             used_at = now(),
             activated_at = now()
       where trainer_id = v_profile_id
         and used_at is null;

      insert into public.audit_logs (user_id, actor_profile_id, action, target_type, target_id, metadata)
      values (new.id, v_profile_id, 'TRAINER_ACTIVATED', 'trainer', v_profile_id,
              jsonb_build_object('email', new.email));
    end if;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_activation on auth.users;
create trigger on_auth_user_activation
  after update on auth.users
  for each row execute function public.handle_auth_user_activation();

-- ---------------------------------------------------------------------------
-- activate_my_account()
--   Fallback the frontend may call immediately after a trainer sets their own
--   password. Idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.activate_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1;

  if v_profile.id is null then
    raise exception 'No profile is linked to the current account.' using errcode = '42501';
  end if;

  if v_profile.role <> 'trainer' then
    raise exception 'Only trainer accounts can be activated through this endpoint.' using errcode = '42501';
  end if;

  if v_profile.status <> 'pending_activation' then
    return jsonb_build_object('ok', true, 'status', v_profile.status, 'already_active', true);
  end if;

  update public.profiles
     set status = 'active', is_activated = true, updated_at = now()
   where id = v_profile.id;

  update public.trainer_invitations
     set invitation_status = 'activated', used_at = now(), activated_at = now()
   where trainer_id = v_profile.id and used_at is null;

  insert into public.audit_logs (user_id, actor_profile_id, action, target_type, target_id, metadata)
  values (auth.uid(), v_profile.id, 'TRAINER_ACTIVATED', 'trainer', v_profile.id,
          jsonb_build_object('self_service', true));

  return jsonb_build_object('ok', true, 'status', 'active');
end $$;

grant execute on function public.activate_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
grant select on public.trainer_invitations to authenticated;
