-- ===========================================================================
-- 017_functions.sql
-- ---------------------------------------------------------------------------
-- Authorization + identity helper functions.
--
-- All of these are SECURITY DEFINER and read `public.profiles` directly so that
-- RLS policies never recurse into the very table they are protecting. The
-- functions are owned by the schema owner (postgres) which is the table owner,
-- so RLS is bypassed inside them.
--
-- The current user is ALWAYS derived from auth.uid() (the verified JWT), never
-- from anything the frontend sends.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- current_profile_id() -> the caller's public.profiles.id (text), or null
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1
$$;

-- ---------------------------------------------------------------------------
-- current_role() -> the caller's role (text), or null
-- (kept for backwards compatibility with the original schema)
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1
$$;

-- ---------------------------------------------------------------------------
-- get_current_user_role() -> explicit alias used by the trainer feature
-- ---------------------------------------------------------------------------
create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
    from public.profiles
   where auth_user_id = auth.uid()
   limit 1
$$;

-- ---------------------------------------------------------------------------
-- is_super_admin()
--   auth.uid() -> profiles.id -> role in ('admin','super_admin')
--   AND the account is active and activated.
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles
     where auth_user_id = auth.uid()
       and role in ('admin', 'super_admin')
       and status = 'active'
       and is_activated = true
  )
$$;

-- ---------------------------------------------------------------------------
-- current_aal() -> the Authenticator Assurance Level of the current session.
--   'aal1' = password only, 'aal2' = password + verified MFA factor.
-- ---------------------------------------------------------------------------
create or replace function public.current_aal()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1')
$$;

-- ---------------------------------------------------------------------------
-- mfa_satisfied() -> true when the session reached AAL2 (MFA completed).
-- ---------------------------------------------------------------------------
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
as $$
  select public.current_aal() = 'aal2'
$$;

-- ---------------------------------------------------------------------------
-- has_verified_mfa_factor() -> does the caller have an enrolled + verified MFA
-- factor (Supabase Auth TOTP)?
-- ---------------------------------------------------------------------------
create or replace function public.has_verified_mfa_factor()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
      from auth.mfa_factors
     where user_id = auth.uid()
       and status = 'verified'
  )
$$;

-- ---------------------------------------------------------------------------
-- require_mfa() -> raises unless the session is at AAL2.
-- Used by every sensitive Super Admin RPC / Edge Function.
-- ---------------------------------------------------------------------------
create or replace function public.require_mfa()
returns void
language plpgsql
stable
as $$
begin
  if not public.mfa_satisfied() then
    raise exception 'Multi-factor authentication is required for this operation. Complete the MFA challenge and try again.'
      using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- is_super_admin_mfa() -> Super Admin AND AAL2. The gate for sensitive actions.
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin_mfa()
returns boolean
language sql
stable
as $$
  select public.is_super_admin() and public.mfa_satisfied()
$$;

-- ---------------------------------------------------------------------------
-- is_active_trainer() -> role = trainer AND status = active AND activated.
-- A suspended / pending trainer is never "active".
-- ---------------------------------------------------------------------------
create or replace function public.is_active_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles
     where auth_user_id = auth.uid()
       and role = 'trainer'
       and status = 'active'
       and is_activated = true
  )
$$;

-- ---------------------------------------------------------------------------
-- is_trainer_assigned_to_program(program_id)
--   true when the caller is an active trainer assigned to the program through
--   trainer_programs (authoritative), or is the program's primary trainer.
--
--   plpgsql (not sql) on purpose: `trainer_programs` is created in a later
--   migration, and plpgsql defers relation resolution to first execution.
-- ---------------------------------------------------------------------------
create or replace function public.is_trainer_assigned_to_program(p_program_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_trainer() then
    return false;
  end if;

  return exists (
      select 1
        from public.trainer_programs tp
       where tp.trainer_id = public.current_profile_id()
         and tp.program_id = p_program_id
         and tp.status = 'active'
    )
    or exists (
      select 1
        from public.programs p
       where p.id = p_program_id
         and p.trainer_id = public.current_profile_id()
    );
end $$;

-- ---------------------------------------------------------------------------
-- generate_temp_password(len)
--   Cryptographically secure temporary password (uses gen_random_bytes).
--   Ambiguous characters (0/O, 1/l/I) are excluded. Never stored in plaintext.
-- ---------------------------------------------------------------------------
create or replace function public.generate_temp_password(p_len int default 12)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charset text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*';
  v_result  text := '';
  v_bytes   bytea;
  i         int;
begin
  if p_len is null or p_len < 12 then
    p_len := 12;
  end if;

  -- Guarantee at least one of each class, then fill the rest.
  v_result := v_result
    || substr('ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + (get_byte(gen_random_bytes(1), 0) % 24), 1)
    || substr('abcdefghijkmnopqrstuvwxyz', 1 + (get_byte(gen_random_bytes(1), 0) % 23), 1)
    || substr('23456789', 1 + (get_byte(gen_random_bytes(1), 0) % 8), 1)
    || substr('!@#$%*', 1 + (get_byte(gen_random_bytes(1), 0) % 6), 1);

  for i in (length(v_result) + 1)..p_len loop
    v_bytes  := gen_random_bytes(1);
    v_result := v_result || substr(v_charset, 1 + (get_byte(v_bytes, 0) % length(v_charset)), 1);
  end loop;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- get_my_auth_state()
--   A single, safe snapshot the frontend can use to drive the MFA challenge
--   and route guards. Contains no secrets.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_auth_state()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'profile_id',      p.id,
    'role',            p.role,
    'status',          p.status,
    'is_activated',    p.is_activated,
    'mfa_enforced',    p.mfa_enforced,
    'mfa_enrolled',    public.has_verified_mfa_factor(),
    'current_aal',     public.current_aal(),
    'mfa_satisfied',   public.mfa_satisfied(),
    'requires_mfa',    (p.mfa_enforced or p.role in ('admin','super_admin'))
                        and not public.mfa_satisfied()
  )
  from public.profiles p
 where p.auth_user_id = auth.uid()
 limit 1
$$;

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
revoke all on function public.generate_temp_password(int) from public, anon, authenticated;
revoke all on function public.require_mfa()                    from public, anon;

grant execute on function public.current_profile_id()                 to authenticated;
grant execute on function public.current_role()                       to authenticated;
grant execute on function public.get_current_user_role()              to authenticated;
grant execute on function public.is_super_admin()                     to authenticated;
grant execute on function public.is_super_admin_mfa()                 to authenticated;
grant execute on function public.is_active_trainer()                  to authenticated;
grant execute on function public.is_trainer_assigned_to_program(text) to authenticated;
grant execute on function public.current_aal()                        to authenticated;
grant execute on function public.mfa_satisfied()                      to authenticated;
grant execute on function public.has_verified_mfa_factor()            to authenticated;
grant execute on function public.get_my_auth_state()                  to authenticated;
