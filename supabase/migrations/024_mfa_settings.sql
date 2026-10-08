-- ===========================================================================
-- 024_mfa_settings.sql
-- ---------------------------------------------------------------------------
-- Super Admin MFA on/off setting.
--
--   * mfa_enforced_for_current_user() -- the caller's own MFA requirement flag
--   * require_mfa()                    -- now only enforces when the flag is ON
--   * get_my_auth_state() / admin_mfa_status() -- report the flag
--   * admin_set_mfa_enforced(boolean)  -- the Settings toggle RPC
--
-- Behaviour:
--   MFA ON  (mfa_enforced = true)  -> sensitive RPCs require AAL2.
--   MFA OFF (mfa_enforced = false) -> sensitive RPCs accept the password
--                                     session (AAL1).
--
-- Security: turning MFA OFF while it is currently ON requires AAL2 (so a
-- stolen password alone cannot downgrade the account). Turning it ON requires
-- a verified authenticator factor to already be enrolled.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Is MFA enforced for the current user?
-- ---------------------------------------------------------------------------
create or replace function public.mfa_enforced_for_current_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select mfa_enforced from public.profiles where auth_user_id = auth.uid() limit 1),
    false
  )
$$;

-- ---------------------------------------------------------------------------
-- require_mfa() now honours the per-account flag.
-- ---------------------------------------------------------------------------
create or replace function public.require_mfa()
returns void
language plpgsql
stable
as $$
begin
  if public.mfa_enforced_for_current_user() and not public.mfa_satisfied() then
    raise exception 'Multi-factor authentication is required for this operation. Complete the MFA challenge and try again.'
      using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- get_my_auth_state() -- `requires_mfa` now follows the flag (not the role).
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
    'requires_mfa',    p.mfa_enforced and not public.mfa_satisfied()
  )
  from public.profiles p
 where p.auth_user_id = auth.uid()
 limit 1
$$;

-- ---------------------------------------------------------------------------
-- admin_mfa_status() -- reflect the flag.
-- ---------------------------------------------------------------------------
create or replace function public.admin_mfa_status()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'is_super_admin',      public.is_super_admin(),
    'mfa_enforced',        public.mfa_enforced_for_current_user(),
    'mfa_enrolled',        public.has_verified_mfa_factor(),
    'current_aal',         public.current_aal(),
    'mfa_satisfied',       public.mfa_satisfied(),
    'can_manage_trainers', public.is_super_admin()
                           and (not public.mfa_enforced_for_current_user() or public.mfa_satisfied())
  )
$$;

-- ---------------------------------------------------------------------------
-- admin_set_mfa_enforced(enabled) -- the Settings toggle.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_mfa_enforced(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id text := public.current_profile_id();
begin
  if not public.is_super_admin() then
    raise exception 'Only a Super Admin can change MFA settings.' using errcode = '42501';
  end if;

  if p_enabled then
    -- Must have a verified authenticator factor first.
    if not public.has_verified_mfa_factor() then
      raise exception 'Enrol and verify an authenticator app before enabling MFA.' using errcode = '42501';
    end if;

    update public.profiles
       set mfa_enforced = true, updated_at = now()
     where auth_user_id = auth.uid();

    perform public.write_audit('MFA_ENABLED', 'profile', v_profile_id, '{}'::jsonb);
  else
    -- Turning MFA off while it is on requires AAL2 (prevents a password-only
    -- downgrade) — but only when an authenticator is actually enrolled, so an
    -- account that is enforced-but-not-yet-enrolled can never be locked out.
    if public.mfa_enforced_for_current_user() and public.has_verified_mfa_factor() then
      perform public.require_mfa();
    end if;

    update public.profiles
       set mfa_enforced = false, updated_at = now()
     where auth_user_id = auth.uid();

    perform public.write_audit('MFA_DISABLED', 'profile', v_profile_id, '{}'::jsonb);
  end if;

  return public.get_my_auth_state();
end $$;

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
revoke all on function public.mfa_enforced_for_current_user() from public, anon;
revoke all on function public.admin_set_mfa_enforced(boolean)  from public, anon;

grant execute on function public.mfa_enforced_for_current_user() to authenticated;
grant execute on function public.admin_set_mfa_enforced(boolean) to authenticated;
