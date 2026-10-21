-- ============================================================================
-- 047_assessment_rls_updates.sql
-- ----------------------------------------------------------------------------
-- Tighten the assessment tables without changing the shapes the existing
-- frontend reads and writes.
--
--   trainee  -> own attempts; may INSERT (legacy submission) and may re-send
--               the same row (idempotent retry). The BEFORE UPDATE trigger
--               forces every protected field back to its stored value.
--   trainer  -> read attempts for programs assigned to them.
--   admin    -> read all, delete (existing account-cleanup flow). Cannot alter
--               a score or timestamp: the trigger blocks it.
--   answers  -> never directly writable by a client; RPCs own them.
-- ============================================================================

alter table public.quiz_attempts enable row level security;
alter table public.exam_attempts enable row level security;

drop policy if exists quiz_attempts_select on public.quiz_attempts;
create policy quiz_attempts_select on public.quiz_attempts
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );

drop policy if exists quiz_attempts_write on public.quiz_attempts;
drop policy if exists quiz_attempts_insert on public.quiz_attempts;
create policy quiz_attempts_insert on public.quiz_attempts
  for insert to authenticated
  with check (trainee_id = public.current_profile_id());

drop policy if exists quiz_attempts_update on public.quiz_attempts;
create policy quiz_attempts_update on public.quiz_attempts
  for update to authenticated
  using (trainee_id = public.current_profile_id() or public.is_super_admin())
  with check (trainee_id = public.current_profile_id() or public.is_super_admin());

drop policy if exists quiz_attempts_delete on public.quiz_attempts;
create policy quiz_attempts_delete on public.quiz_attempts
  for delete to authenticated
  using (public.is_super_admin());

drop policy if exists exam_attempts_select on public.exam_attempts;
create policy exam_attempts_select on public.exam_attempts
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );

drop policy if exists exam_attempts_write on public.exam_attempts;
drop policy if exists exam_attempts_insert on public.exam_attempts;
create policy exam_attempts_insert on public.exam_attempts
  for insert to authenticated
  with check (trainee_id = public.current_profile_id());

drop policy if exists exam_attempts_update on public.exam_attempts;
create policy exam_attempts_update on public.exam_attempts
  for update to authenticated
  using (trainee_id = public.current_profile_id() or public.is_super_admin())
  with check (trainee_id = public.current_profile_id() or public.is_super_admin());

drop policy if exists exam_attempts_delete on public.exam_attempts;
create policy exam_attempts_delete on public.exam_attempts
  for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Answer rows: read-only to trainers/admin, invisible to trainees (the
-- get_*_attempt RPC returns graded answers only after finalization).
-- ---------------------------------------------------------------------------
drop policy if exists quiz_attempt_answers_select on public.quiz_attempt_answers;
create policy quiz_attempt_answers_select on public.quiz_attempt_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = quiz_attempt_answers.attempt_id
        and (public.is_super_admin() or public.is_trainer_assigned_to_program(a.program_id))
    )
  );

drop policy if exists exam_attempt_answers_select on public.exam_attempt_answers;
create policy exam_attempt_answers_select on public.exam_attempt_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.exam_attempts a
      where a.id = exam_attempt_answers.attempt_id
        and (public.is_super_admin() or public.is_trainer_assigned_to_program(a.program_id))
    )
  );

revoke insert, update, delete on public.quiz_attempt_answers from anon, authenticated;
revoke insert, update, delete on public.exam_attempt_answers from anon, authenticated;
grant select on public.quiz_attempt_answers to authenticated;
grant select on public.exam_attempt_answers to authenticated;

-- ---------------------------------------------------------------------------
-- quiz_sessions: keep the existing author-scoped policies, but make them
-- explicit so a baseline rerun cannot leave a broad write policy behind.
-- ---------------------------------------------------------------------------
drop policy if exists quiz_sessions_select on public.quiz_sessions;
create policy quiz_sessions_select on public.quiz_sessions
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );

drop policy if exists quiz_sessions_insert on public.quiz_sessions;
create policy quiz_sessions_insert on public.quiz_sessions
  for insert to authenticated
  with check (trainee_id = public.current_profile_id());

drop policy if exists quiz_sessions_update on public.quiz_sessions;
create policy quiz_sessions_update on public.quiz_sessions
  for update to authenticated
  using (trainee_id = public.current_profile_id())
  with check (trainee_id = public.current_profile_id());

drop policy if exists quiz_sessions_delete on public.quiz_sessions;
create policy quiz_sessions_delete on public.quiz_sessions
  for delete to authenticated
  using (trainee_id = public.current_profile_id() or public.is_super_admin());
