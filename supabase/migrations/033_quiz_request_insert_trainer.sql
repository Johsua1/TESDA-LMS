-- ============================================================================
-- 033_quiz_request_insert_trainer.sql
-- The INSERT policy only accepted a trainee's own pending row. A trainer's
-- decision was written with an upsert (INSERT ... ON CONFLICT DO UPDATE), and
-- Postgres evaluates the INSERT policy on that path too, so every approval was
-- rejected with 42501.
--
-- The client now PATCHes existing rows, but the insert path must still work for
-- the trainer who owns the program (and for a Super Admin), otherwise a request
-- that has not reached the database yet can never be decided.
-- Safe to re-run.
-- ============================================================================

drop policy if exists quiz_requests_insert on public.quiz_requests;
create policy quiz_requests_insert on public.quiz_requests
  for insert to authenticated
  with check (
    (trainee_id = public.current_profile_id() and status = 'pending')
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );
