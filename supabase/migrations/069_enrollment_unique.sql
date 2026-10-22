-- ---------------------------------------------------------------------------
-- 069_enrollment_unique.sql
--
-- Found during the UAT security pass: a trainee could POST the same
-- (trainee_id, program_id) twice and both rows were accepted. Verified live:
-- the second insert returned 201. Nothing in the database prevented it, so two
-- applications for one course could sit in the registrar's queue, each with its
-- own payment state.
--
-- The data model already assumes one row per trainee per program:
-- syncTraineeEnrollments() keeps exactly one row and updates it, a rejection is
-- resubmitted with an UPDATE, and the client hides Enroll Now once a row exists.
-- The index makes that assumption true at the storage layer.
--
-- Checked before adding: no duplicate pairs exist in the table.
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

create unique index if not exists enrollments_trainee_program_key
  on public.enrollments (trainee_id, program_id);
