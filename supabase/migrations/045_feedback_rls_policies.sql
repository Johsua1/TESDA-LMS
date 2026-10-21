-- ============================================================================
-- 045_feedback_rls_policies.sql
-- ----------------------------------------------------------------------------
-- Read access only. Submission and corrections are SECURITY DEFINER RPCs, so
-- there is deliberately no INSERT/UPDATE/DELETE policy for clients.
--
--   trainee  -> own feedback
--   trainer  -> feedback about themselves (never another trainer's)
--   admin    -> all feedback, but only at AAL2 (MFA satisfied)
-- ============================================================================

alter table public.trainer_feedback enable row level security;
alter table public.trainer_feedback_revisions enable row level security;

drop policy if exists trainer_feedback_select on public.trainer_feedback;
create policy trainer_feedback_select on public.trainer_feedback
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or trainer_id = public.current_profile_id()
    or public.is_super_admin_mfa()
  );

drop policy if exists trainer_feedback_revisions_select on public.trainer_feedback_revisions;
create policy trainer_feedback_revisions_select on public.trainer_feedback_revisions
  for select to authenticated
  using (public.is_super_admin_mfa());

-- No write policies on purpose.
drop policy if exists trainer_feedback_insert on public.trainer_feedback;
drop policy if exists trainer_feedback_update on public.trainer_feedback;
drop policy if exists trainer_feedback_delete on public.trainer_feedback;
drop policy if exists trainer_feedback_revisions_insert on public.trainer_feedback_revisions;
drop policy if exists trainer_feedback_revisions_update on public.trainer_feedback_revisions;
drop policy if exists trainer_feedback_revisions_delete on public.trainer_feedback_revisions;

revoke insert, update, delete on public.trainer_feedback from anon, authenticated;
revoke insert, update, delete on public.trainer_feedback_revisions from anon, authenticated;
grant select on public.trainer_feedback to authenticated;
grant select on public.trainer_feedback_revisions to authenticated;
