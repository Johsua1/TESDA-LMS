-- ===========================================================================
-- 022_super_admin_mfa.sql
-- ---------------------------------------------------------------------------
-- 1. Promote the designated Super Admin account
--       institutehytglobal@gmail.com
-- 2. Demote any other Super Admin left over from the original seed.
-- 3. Harden the legacy admin RPCs so they require Super Admin + MFA (AAL2).
-- 4. Expose a small MFA status RPC.
--
-- IMPORTANT: no password is ever written here. The Auth account must already
-- exist (create it with scripts/create-super-admin.mjs, the Dashboard, or the
-- create-user Edge Function). This migration only links the profile.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 + 2. Designated Super Admin
-- ---------------------------------------------------------------------------
do $$
declare
  v_email text := 'institutehytglobal@gmail.com';
  v_uid   uuid;
  v_has_provider_id boolean;
begin
  select id into v_uid from auth.users where lower(email) = v_email limit 1;

  if v_uid is null then
    raise notice '[022] Auth user % does not exist yet. Create it, then re-run this migration to link the Super Admin profile.', v_email;
    return;
  end if;

  -- Ensure the profile exists and is a full Super Admin.
  insert into public.profiles (id, auth_user_id, role, email, name, status, is_activated, mfa_enforced, data)
  values (
    'sa-hyt', v_uid, 'admin', v_email, 'Super Administrator', 'active', true, true,
    jsonb_build_object('position', 'Super Administrator', 'since', to_char(now(), 'YYYY-MM-DD'))
  )
  on conflict (id) do update
    set auth_user_id = excluded.auth_user_id,
        role         = 'admin',
        email        = v_email,
        status       = 'active',
        is_activated = true,
        mfa_enforced = true,
        updated_at   = now();

  -- If a profile already exists for this auth user under a different id, fix it.
  update public.profiles
     set role = 'admin', status = 'active', is_activated = true, mfa_enforced = true, updated_at = now()
   where auth_user_id = v_uid;

  -- Demote every other account that still holds a Super Admin role.
  update public.profiles
     set role = 'trainee', status = 'inactive', is_activated = false, mfa_enforced = false, updated_at = now()
   where role in ('admin', 'super_admin')
     and lower(coalesce(email, '')) <> v_email;

  raise notice '[022] Super Admin linked to profile for %.', v_email;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Harden the legacy admin RPCs (Super Admin + AAL2 required)
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_user(
  p_email    text,
  p_password text,
  p_role     text,
  p_id       text,
  p_name     text,
  p_data     jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid             uuid := gen_random_uuid();
  v_has_provider_id boolean;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can create accounts.' using errcode = '42501';
  end if;

  perform public.require_mfa();

  if coalesce(p_email, '') = '' then
    raise exception 'Email is required.';
  end if;
  if coalesce(p_password, '') = '' then
    raise exception 'Password is required.';
  end if;
  if p_role not in ('super_admin', 'admin', 'trainer', 'trainee') then
    raise exception 'Invalid role: %', p_role;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', p_role, 'name', p_name),
    '', '', '', ''
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into v_has_provider_id;

  if v_has_provider_id then
    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  else
    insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_uid::text, v_uid,
            jsonb_build_object('sub', v_uid::text, 'email', lower(p_email)),
            'email', now(), now(), now());
  end if;

  insert into public.profiles (id, auth_user_id, role, email, name, data, status, is_activated)
  values (p_id, v_uid, p_role, lower(p_email), p_name, coalesce(p_data, '{}'::jsonb),
          case when p_role = 'trainer' then 'pending_activation' else 'active' end,
          case when p_role = 'trainer' then false else true end)
  on conflict (id) do update
    set auth_user_id = excluded.auth_user_id,
        role         = excluded.role,
        email        = excluded.email,
        name         = excluded.name,
        data         = excluded.data,
        updated_at   = now();

  perform public.write_audit(
    'ACCOUNT_CREATED', p_role, p_id,
    jsonb_build_object('email', lower(p_email), 'role', p_role)
  );

  return p_id;
end $$;

create or replace function public.admin_delete_user(p_id text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_uid uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can delete accounts.' using errcode = '42501';
  end if;

  perform public.require_mfa();

  if p_id = public.current_profile_id() then
    raise exception 'You cannot delete your own account.' using errcode = '42501';
  end if;

  select auth_user_id into v_uid from public.profiles where id = p_id;

  perform public.write_audit('ACCOUNT_DELETED', 'account', p_id, jsonb_build_object('auth_user_id', v_uid));

  delete from public.profiles where id = p_id;
  if v_uid is not null then
    delete from auth.users where id = v_uid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. MFA status RPC
-- ---------------------------------------------------------------------------
create or replace function public.admin_mfa_status()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'is_super_admin',     public.is_super_admin(),
    'mfa_enforced',       coalesce((select mfa_enforced from public.profiles where auth_user_id = auth.uid() limit 1), false),
    'mfa_enrolled',       public.has_verified_mfa_factor(),
    'current_aal',        public.current_aal(),
    'mfa_satisfied',      public.mfa_satisfied(),
    'can_manage_trainers', public.is_super_admin() and public.mfa_satisfied()
  )
$$;

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
revoke all on function public.admin_create_user(text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.admin_delete_user(text) from public, anon;
revoke all on function public.admin_mfa_status() from public, anon;

grant execute on function public.admin_create_user(text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.admin_delete_user(text) to authenticated;
grant execute on function public.admin_mfa_status() to authenticated;
