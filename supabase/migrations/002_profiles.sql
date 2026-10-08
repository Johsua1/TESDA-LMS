-- ===========================================================================
-- 002_profiles.sql
-- ---------------------------------------------------------------------------
-- Extends the existing public.profiles table with the trainer / administrator
-- profile fields required by the trainer-management feature.
--
-- DESIGN NOTE
--   The existing LMS stores a display name in `name` and a free-form bag in
--   `data jsonb`. Those are kept untouched so the current frontend keeps
--   working. The columns added here are the authoritative, first-class fields.
--
-- ROLE VALUES
--   The existing frontend hard-codes the Super Admin role string as 'admin'
--   (see src/config/navigation.js -> roleMeta.admin). To avoid breaking it we
--   keep 'admin' as the stored value for the Super Admin and accept
--   'super_admin' as an equivalent alias everywhere in the backend.
--
-- Idempotent: safe to run repeatedly.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists first_name        text;
alter table public.profiles add column if not exists last_name         text;
alter table public.profiles add column if not exists phone             text;
alter table public.profiles add column if not exists address           text;
alter table public.profiles add column if not exists date_of_birth     date;
alter table public.profiles add column if not exists profile_image_url text;
alter table public.profiles add column if not exists position          text;
alter table public.profiles add column if not exists specialization    text;   -- display value
alter table public.profiles add column if not exists specialization_id uuid;   -- FK added in 019
alter table public.profiles add column if not exists status            text;
alter table public.profiles add column if not exists is_activated      boolean;
alter table public.profiles add column if not exists mfa_enforced      boolean not null default false;
alter table public.profiles add column if not exists last_login_at     timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Backfill existing rows so the NOT NULL / CHECK constraints can be added
-- ---------------------------------------------------------------------------
update public.profiles
   set first_name = coalesce(first_name, nullif(split_part(coalesce(name, ''), ' ', 1), ''))
 where first_name is null;

update public.profiles
   set last_name = coalesce(
         last_name,
         nullif(trim(substr(coalesce(name, ''), length(split_part(coalesce(name, ''), ' ', 1)) + 1)), '')
       )
 where last_name is null;

update public.profiles set status       = 'active' where status is null;
update public.profiles set is_activated = true     where is_activated is null;

-- Any existing Super Admin must be active + activated.
update public.profiles
   set status = 'active', is_activated = true
 where role in ('admin', 'super_admin')
   and (status <> 'active' or is_activated is not true);

alter table public.profiles alter column status       set default 'active';
alter table public.profiles alter column status       set not null;
alter table public.profiles alter column is_activated set default true;
alter table public.profiles alter column is_activated set not null;

-- ---------------------------------------------------------------------------
-- 3. Constraints
-- ---------------------------------------------------------------------------
do $$
begin
  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('super_admin', 'admin', 'trainer', 'trainee'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_status_check
    check (status in ('pending_activation', 'active', 'inactive', 'suspended'));
exception when duplicate_object then null;
end $$;

-- Normalise emails to lower-case (profiles.email already has a UNIQUE index).
update public.profiles set email = lower(email) where email <> lower(email);

-- ---------------------------------------------------------------------------
-- 4. updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Protect privileged columns from self-service updates
--    A trainer / trainee may edit their own profile, but must never be able to
--    change role, status, activation, email or the controlled specialization.
--    Super Admins and the service_role (Edge Functions) bypass the guard.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
end $$;

drop trigger if exists profiles_protect_privileged on public.profiles;
create trigger profiles_protect_privileged
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();
