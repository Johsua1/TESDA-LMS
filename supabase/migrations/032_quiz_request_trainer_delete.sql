-- ============================================================================
-- 032_quiz_request_trainer_delete.sql
-- Let the trainer who owns a program remove quiz requests for it.
-- Deleting a quiz (or a program) purges its request rows; without this the
-- trainer's delete is rejected by RLS and the whole sync batch fails.
-- Safe to re-run.
-- ============================================================================

drop policy if exists quiz_requests_delete on public.quiz_requests;
create policy quiz_requests_delete on public.quiz_requests
  for delete to authenticated
  using (
    public.is_super_admin()
    or trainee_id = public.current_profile_id()
    or public.is_trainer_assigned_to_program(program_id)
  );
