-- ===========================================================================
-- 025_trainer_email_metadata.sql
-- ---------------------------------------------------------------------------
-- Store the temporary password in the new trainer's user_metadata so the
-- branded Supabase Auth "Reset Password" email can render it via
-- {{ .Data.temp_password }}.
--
-- Why: the trainer onboarding email is delivered through Supabase Auth's
-- mailer (the project's configured Gmail SMTP), which only exposes
-- auth.users.user_metadata to the template. Putting the temp password there
-- lets the email show the same "login email + temporary password" the Super
-- Admin sees in the UI.
--
-- Scope: only TRAINER accounts receive the extra metadata field; every other
-- role keeps its previous metadata untouched. The value is the account's own
-- short-lived temporary password (the trainer changes it on first sign-in),
-- so it is not a privilege escalation surface.
--
-- This only redefines admin_create_user(); the signature is unchanged, so no
-- GRANT changes are needed.
-- ===========================================================================

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
    jsonb_build_object('role', p_role, 'name', p_name)
      || case
           when p_role = 'trainer'
             then jsonb_build_object('temp_password', p_password, 'must_set_password', true)
           else '{}'::jsonb
         end,
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
