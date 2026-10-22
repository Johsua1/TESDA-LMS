-- ---------------------------------------------------------------------------
-- 065_enrollment_indexes.sql
--
-- public.enrollments had no index other than the primary key, yet every
-- dashboard, RLS check and auto-completion sync filters on trainee_id,
-- program_id or status. Harmless at 11 rows, a sequential scan per row at
-- turnover scale. Added during the performance pass of the UAT checklist.
--
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

create index if not exists enrollments_trainee_idx  on public.enrollments (trainee_id);
create index if not exists enrollments_program_idx  on public.enrollments (program_id);
create index if not exists enrollments_status_idx   on public.enrollments (status);
