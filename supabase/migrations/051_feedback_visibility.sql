-- ============================================================================
-- 051_feedback_visibility.sql
-- ----------------------------------------------------------------------------
-- Policy change: qualitative feedback is visible to the trainee who wrote it
-- and to the Super Admin (AAL2) only. A trainer no longer sees the feedback
-- written about them, so the trainer-facing read path is removed entirely.
--
-- Quantitative ratings (trainer_ratings) are unaffected; trainers can still see
-- their star average through that table's existing policies.
-- ============================================================================

drop policy if exists trainer_feedback_select on public.trainer_feedback;

create policy trainer_feedback_select on public.trainer_feedback
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or public.is_super_admin_mfa()
  );

-- No write policies on purpose: submission and corrections are definer RPCs.
drop policy if exists trainer_feedback_insert on public.trainer_feedback;
drop policy if exists trainer_feedback_update on public.trainer_feedback;
drop policy if exists trainer_feedback_delete on public.trainer_feedback;

revoke insert, update, delete on public.trainer_feedback from anon, authenticated;
grant select on public.trainer_feedback to authenticated;
