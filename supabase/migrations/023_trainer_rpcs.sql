-- ===========================================================================
-- 023_trainer_rpcs.sql
-- ---------------------------------------------------------------------------
-- Trainer-management RPCs. Every RPC:
--   * derives the caller from auth.uid() (never trusts the frontend),
--   * requires is_super_admin() AND MFA (AAL2) via require_super_admin_mfa(),
--   * is transactional (a plpgsql function is a single transaction), so a
--     failure leaves no partially created trainer,
--   * writes an audit_logs row.
--
-- The *_record / *_sent functions are internal helpers callable only by the
-- service_role (used by the Edge Functions). They are revoked from clients.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Shared guard
-- ---------------------------------------------------------------------------
create or replace function public.require_super_admin_mfa()
returns void
language plpgsql
stable
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can perform this operation.' using errcode = '42501';
  end if;
  perform public.require_mfa();
end $$;

revoke all on function public.require_super_admin_mfa() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal: create the auth user (+ identity). Returns the new auth uid.
-- ---------------------------------------------------------------------------
create or replace function public._create_auth_user(p_email text, p_password text, p_meta jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid := gen_random_uuid();
  v_has_provider_id boolean;
begin
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
    coalesce(p_meta, '{}'::jsonb),
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

  return v_uid;
end $$;

revoke all on function public._create_auth_user(text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal: write profile + assignments + invitation + audit atomically.
-- Callable by the Super Admin RPC and (via service_role) the Edge Functions.
-- ---------------------------------------------------------------------------
create or replace function public.admin_finalize_trainer(
  p_auth_user_id     uuid,
  p_trainer_id       text,
  p_email            text,
  p_full_name        text,
  p_position         text,
  p_specialization_id uuid,
  p_address          text,
  p_phone            text,
  p_programs         text[],
  p_actor_profile_id text,
  p_invitation_status text default 'pending',
  p_expires_at       timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email      text := lower(trim(coalesce(p_email, '')));
  v_trainer_id text := coalesce(nullif(p_trainer_id, ''), 'tr-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_program    text;
  v_inv_id     uuid;
  v_expires    timestamptz := coalesce(p_expires_at, now() + interval '7 days');
  v_spec_name  text;
  v_assigned   text[] := '{}';
begin
  if v_email = '' then
    raise exception 'Email is required.';
  end if;

  if p_specialization_id is not null then
    select name into v_spec_name from public.specializations where id = p_specialization_id and is_active;
    if v_spec_name is null then
      raise exception 'Unknown or inactive specialization.';
    end if;
  end if;

  insert into public.profiles (
    id, auth_user_id, role, email, name, first_name, last_name,
    position, specialization, specialization_id, address, phone,
    status, is_activated, mfa_enforced, data
  ) values (
    v_trainer_id, p_auth_user_id, 'trainer', v_email,
    coalesce(nullif(trim(p_full_name), ''), v_email),
    nullif(split_part(coalesce(p_full_name, ''), ' ', 1), ''),
    nullif(trim(substr(coalesce(p_full_name, ''), length(split_part(coalesce(p_full_name, ''), ' ', 1)) + 1)), ''),
    p_position, v_spec_name, p_specialization_id, p_address, p_phone,
    'pending_activation', false, false,
    jsonb_build_object(
      'position', p_position,
      'specialization', v_spec_name,
      'address', p_address,
      'phone', p_phone,
      'programs', coalesce(p_programs, '{}'),
      'since', to_char(now(), 'YYYY-MM-DD')
    )
  );

  -- Program assignments
  if p_programs is not null then
    foreach v_program in array p_programs loop
      if not exists (select 1 from public.programs where id = v_program) then
        raise exception 'Unknown program: %', v_program;
      end if;
      insert into public.trainer_programs (trainer_id, program_id, assigned_by, status)
      values (v_trainer_id, v_program, p_actor_profile_id, 'active')
      on conflict (trainer_id, program_id) do update set status = 'active';
      v_assigned := array_append(v_assigned, v_program);
    end loop;
  end if;

  -- Invitation record
  insert into public.trainer_invitations (trainer_id, email, invitation_status, provider, expires_at, created_by, metadata)
  values (v_trainer_id, v_email, coalesce(p_invitation_status, 'pending'), 'supabase_auth', v_expires, p_actor_profile_id,
          jsonb_build_object('programs', coalesce(p_programs, '{}')))
  returning id into v_inv_id;

  -- Audit
  perform public.write_audit('TRAINER_CREATED', 'trainer', v_trainer_id,
    jsonb_build_object('email', v_email, 'position', p_position, 'specialization', v_spec_name, 'programs', v_assigned),
    p_actor_profile_id);

  return jsonb_build_object(
    'trainer_id', v_trainer_id,
    'email', v_email,
    'invitation_id', v_inv_id,
    'invitation_status', coalesce(p_invitation_status, 'pending'),
    'expires_at', v_expires
  );
end $$;

-- Client RPC calls it as a definer; service_role calls it directly.
revoke all on function public.admin_finalize_trainer(uuid, text, text, text, text, uuid, text, text, text[], text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_finalize_trainer(uuid, text, text, text, text, uuid, text, text, text[], text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- admin_create_trainer(...)  -- browser-callable (anon key), Super Admin + MFA
--   Creates the auth account with a securely generated temporary password,
--   the trainer profile (pending_activation), the program assignments and the
--   invitation record. Returns the temp password ONCE to the authenticated
--   Super Admin (it is never persisted in plaintext).
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_trainer(
  p_full_name         text,
  p_email             text,
  p_position          text default null,
  p_specialization_id uuid default null,
  p_address           text default null,
  p_phone             text default null,
  p_programs          text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email    text := lower(trim(coalesce(p_email, '')));
  v_temp     text;
  v_uid      uuid;
  v_result   jsonb;
begin
  perform public.require_super_admin_mfa();

  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid email address is required.';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Full name is required.';
  end if;

  -- Uniqueness (profiles.email is UNIQUE; auth.users is the source of truth).
  if exists (select 1 from public.profiles where lower(email) = v_email)
     or exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'An account with email % already exists.', v_email;
  end if;

  v_temp := public.generate_temp_password(12);
  v_uid  := public._create_auth_user(
              v_email, v_temp,
              jsonb_build_object('role', 'trainer', 'name', p_full_name, 'must_set_password', true)
            );

  v_result := public.admin_finalize_trainer(
    v_uid, null, v_email, p_full_name, p_position, p_specialization_id,
    p_address, p_phone, coalesce(p_programs, '{}'), public.current_profile_id(),
    'pending', now() + interval '7 days'
  );

  return v_result || jsonb_build_object('temp_password', v_temp);
end $$;

-- ---------------------------------------------------------------------------
-- admin_update_trainer(...)  -- edit profile fields + reconcile assignments
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_trainer(
  p_trainer_id        text,
  p_full_name         text default null,
  p_position          text default null,
  p_specialization_id uuid default null,
  p_address           text default null,
  p_phone             text default null,
  p_programs          text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    text := public.current_profile_id();
  v_spec     text;
  v_program  text;
  v_removed  text[];
  v_added    text[];
begin
  perform public.require_super_admin_mfa();

  if not exists (select 1 from public.profiles where id = p_trainer_id and role = 'trainer') then
    raise exception 'Trainer % not found.', p_trainer_id;
  end if;

  if p_specialization_id is not null then
    select name into v_spec from public.specializations where id = p_specialization_id and is_active;
    if v_spec is null then
      raise exception 'Unknown or inactive specialization.';
    end if;
  end if;

  update public.profiles
     set name            = coalesce(nullif(trim(p_full_name), ''), name),
         first_name      = coalesce(nullif(split_part(coalesce(p_full_name, ''), ' ', 1), ''), first_name),
         last_name       = coalesce(nullif(trim(substr(coalesce(p_full_name, ''), length(split_part(coalesce(p_full_name, ''), ' ', 1)) + 1)), ''), last_name),
         position        = coalesce(p_position, position),
         specialization  = coalesce(v_spec, specialization),
         specialization_id = coalesce(p_specialization_id, specialization_id),
         address         = coalesce(p_address, address),
         phone           = coalesce(p_phone, phone),
         updated_at      = now()
   where id = p_trainer_id;

  if p_programs is not null then
    -- Programs to remove
    select array_agg(program_id) into v_removed
      from public.trainer_programs
     where trainer_id = p_trainer_id
       and program_id <> all (p_programs);

    delete from public.trainer_programs
     where trainer_id = p_trainer_id
       and program_id <> all (p_programs);

    -- Programs to add / keep
    foreach v_program in array p_programs loop
      if not exists (select 1 from public.programs where id = v_program) then
        raise exception 'Unknown program: %', v_program;
      end if;
      insert into public.trainer_programs (trainer_id, program_id, assigned_by, status)
      values (p_trainer_id, v_program, v_actor, 'active')
      on conflict (trainer_id, program_id) do update set status = 'active', assigned_by = v_actor;
    end loop;

    select coalesce(array_agg(program_id), '{}') into v_added
      from public.trainer_programs where trainer_id = p_trainer_id;

    if v_removed is not null and array_length(v_removed, 1) > 0 then
      perform public.write_audit('TRAINER_PROGRAM_REMOVED', 'trainer', p_trainer_id,
        jsonb_build_object('programs', v_removed));
    end if;
    perform public.write_audit('TRAINER_PROGRAM_ASSIGNED', 'trainer', p_trainer_id,
      jsonb_build_object('programs', v_added));
  end if;

  perform public.write_audit('TRAINER_UPDATED', 'trainer', p_trainer_id,
    jsonb_build_object('position', p_position, 'specialization', v_spec));

  return public.admin_get_trainer(p_trainer_id);
end $$;

-- ---------------------------------------------------------------------------
-- admin_set_trainer_status(...)  -- activate / suspend / deactivate
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_trainer_status(
  p_trainer_id text,
  p_status     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  perform public.require_super_admin_mfa();

  if p_status not in ('active', 'inactive', 'suspended', 'pending_activation') then
    raise exception 'Invalid status: %', p_status;
  end if;

  if not exists (select 1 from public.profiles where id = p_trainer_id and role = 'trainer') then
    raise exception 'Trainer % not found.', p_trainer_id;
  end if;

  update public.profiles
     set status       = p_status,
         is_activated = (p_status = 'active'),
         updated_at   = now()
   where id = p_trainer_id;

  v_action := case p_status
                when 'suspended' then 'TRAINER_SUSPENDED'
                when 'inactive'  then 'TRAINER_DEACTIVATED'
                when 'active'    then 'TRAINER_REACTIVATED'
                else 'TRAINER_UPDATED'
              end;

  perform public.write_audit(v_action, 'trainer', p_trainer_id, jsonb_build_object('status', p_status));

  return public.admin_get_trainer(p_trainer_id);
end $$;

-- ---------------------------------------------------------------------------
-- admin_resend_trainer_invitation(...)  -- revoke previous, issue a new one
-- ---------------------------------------------------------------------------
create or replace function public.admin_resend_trainer_invitation(p_trainer_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  text := public.current_profile_id();
  v_email  text;
  v_status text;
  v_id     uuid;
  v_exp    timestamptz := now() + interval '7 days';
begin
  perform public.require_super_admin_mfa();

  select email, status into v_email, v_status
    from public.profiles where id = p_trainer_id and role = 'trainer';

  if v_email is null then
    raise exception 'Trainer % not found.', p_trainer_id;
  end if;
  if v_status = 'active' then
    raise exception 'Trainer % has already activated their account.', p_trainer_id;
  end if;

  -- Invalidate any live invitation.
  update public.trainer_invitations
     set invitation_status = 'revoked', used_at = now()
   where trainer_id = p_trainer_id and used_at is null;

  insert into public.trainer_invitations (trainer_id, email, invitation_status, provider, expires_at, created_by)
  values (p_trainer_id, lower(v_email), 'pending', 'supabase_auth', v_exp, v_actor)
  returning id into v_id;

  perform public.write_audit('TRAINER_INVITATION_RESENT', 'trainer', p_trainer_id,
    jsonb_build_object('email', lower(v_email), 'expires_at', v_exp));

  return jsonb_build_object('trainer_id', p_trainer_id, 'email', lower(v_email),
                            'invitation_id', v_id, 'expires_at', v_exp);
end $$;

-- ---------------------------------------------------------------------------
-- admin_get_trainer(...)  -- read model for the Super Admin UI / contract
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_trainer(p_trainer_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'name', p.name,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'position', p.position,
    'specialization', p.specialization,
    'specialization_id', p.specialization_id,
    'address', p.address,
    'phone', p.phone,
    'status', p.status,
    'is_activated', p.is_activated,
    'role', p.role,
    'created_at', p.created_at,
    'programs', coalesce((
      select jsonb_agg(jsonb_build_object('id', tp.program_id, 'status', tp.status, 'assigned_at', tp.assigned_at)
                       order by tp.program_id)
        from public.trainer_programs tp
       where tp.trainer_id = p.id and tp.status = 'active'
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ti.id, 'status', ti.invitation_status, 'sent_at', ti.sent_at,
               'expires_at', ti.expires_at, 'activated_at', ti.activated_at, 'created_at', ti.created_at)
               order by ti.created_at desc)
        from public.trainer_invitations ti
       where ti.trainer_id = p.id
    ), '[]'::jsonb)
  )
  from public.profiles p
 where p.id = p_trainer_id
   and p.role = 'trainer'
   and (public.is_super_admin() or p.id = public.current_profile_id())
$$;

-- ---------------------------------------------------------------------------
-- Service-role helpers used by the Edge Functions
-- ---------------------------------------------------------------------------
create or replace function public.admin_mark_invitation_sent(
  p_invitation_id uuid,
  p_status        text default 'sent',
  p_provider      text default 'supabase_auth'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trainer_invitations
     set invitation_status = case when p_status in ('sent','failed') then p_status else invitation_status end,
         sent_at = now(),
         provider = coalesce(p_provider, provider)
   where id = p_invitation_id;
end $$;

create or replace function public.admin_resend_invitation_record(
  p_trainer_id       text,
  p_actor_profile_id text,
  p_expires_at       timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_id    uuid;
  v_exp   timestamptz := coalesce(p_expires_at, now() + interval '7 days');
begin
  select email into v_email from public.profiles where id = p_trainer_id and role = 'trainer';
  if v_email is null then
    raise exception 'Trainer % not found.', p_trainer_id;
  end if;

  update public.trainer_invitations
     set invitation_status = 'revoked', used_at = now()
   where trainer_id = p_trainer_id and used_at is null;

  insert into public.trainer_invitations (trainer_id, email, invitation_status, provider, expires_at, created_by)
  values (p_trainer_id, lower(v_email), 'pending', 'supabase_auth', v_exp, p_actor_profile_id)
  returning id into v_id;

  perform public.write_audit('TRAINER_INVITATION_RESENT', 'trainer', p_trainer_id,
    jsonb_build_object('email', lower(v_email), 'expires_at', v_exp), p_actor_profile_id);

  return jsonb_build_object('trainer_id', p_trainer_id, 'email', lower(v_email),
                            'invitation_id', v_id, 'expires_at', v_exp);
end $$;

revoke all on function public.admin_mark_invitation_sent(uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_resend_invitation_record(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_mark_invitation_sent(uuid, text, text) to service_role;
grant execute on function public.admin_resend_invitation_record(text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- GRANTS (client-callable RPCs self-check authorization internally)
-- ---------------------------------------------------------------------------
revoke all on function public.admin_create_trainer(text, text, text, uuid, text, text, text[]) from public, anon;
revoke all on function public.admin_update_trainer(text, text, text, uuid, text, text, text[]) from public, anon;
revoke all on function public.admin_set_trainer_status(text, text)                                 from public, anon;
revoke all on function public.admin_resend_trainer_invitation(text)                                from public, anon;
revoke all on function public.admin_get_trainer(text)                                              from public, anon;

grant execute on function public.admin_create_trainer(text, text, text, uuid, text, text, text[])      to authenticated;
grant execute on function public.admin_update_trainer(text, text, text, uuid, text, text, text[])      to authenticated;
grant execute on function public.admin_set_trainer_status(text, text)                                  to authenticated;
grant execute on function public.admin_resend_trainer_invitation(text)                                 to authenticated;
grant execute on function public.admin_get_trainer(text)                                               to authenticated;
