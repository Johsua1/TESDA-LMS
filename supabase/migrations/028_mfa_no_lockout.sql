-- ===========================================================================
-- 028_mfa_no_lockout.sql
-- ---------------------------------------------------------------------------
-- require_mfa() must not lock out an account that is MFA-enforced but has NO
-- verified authenticator enrolled. Such a session can never reach AAL2, so a
-- hard block makes every protected RPC (admin_create_user, admin_delete_user,
-- …) fail permanently — which is exactly what happens right after a Super
-- Admin resets/deletes their own authenticator (mfa_enforced stays true while
-- the factor is gone).
--
-- Enforcement now applies only while a verified factor actually exists, which
-- mirrors the no-lockout guard already used by admin_set_mfa_enforced(false):
--   * enforced + enrolled + AAL1  -> blocked (MFA challenge required)
--   * enforced + NOT enrolled      -> allowed (nothing to challenge)
--   * not enforced                 -> allowed
--
-- Only redefines require_mfa(); the signature is unchanged, so no GRANT
-- changes are needed.
-- ===========================================================================

create or replace function public.require_mfa()
returns void
language plpgsql
stable
as $$
begin
  if public.mfa_enforced_for_current_user()
     and public.has_verified_mfa_factor()
     and not public.mfa_satisfied() then
    raise exception 'Multi-factor authentication is required for this operation. Complete the MFA challenge and try again.'
      using errcode = '42501';
  end if;
end $$;
