-- ---------------------------------------------------------------------------
-- 066_enrollment_read_scope.sql
--
-- O-01 from the UAT report: every signed-in user could SELECT every enrollment
-- (applicant name, contact details, address, requirements, payment reference).
-- Writes were scoped in 064; this closes the read side.
--
-- Visible to:
--   * Super Admin — everything
--   * the trainee who owns the row
--   * the trainer the enrollment is explicitly assigned to (data->>'trainerId')
--   * a trainer of that program, for enrollments that carry no explicit trainer
--     (several trainers can share a program; an unassigned row is ambiguous and
--     stays visible to all of them until the registrar picks one)
--
-- The client is unchanged: loadAll() still issues one SELECT and simply
-- receives the caller's slice.
--
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

drop policy if exists enrollments_select on public.enrollments;

create policy enrollments_select on public.enrollments
  for select
  using (
    public.is_super_admin()
    or trainee_id = public.current_profile_id()
    or data->>'trainerId' = public.current_profile_id()
    or (
      public.is_trainer_assigned_to_program(program_id)
      and coalesce(data->>'trainerId', '') = ''
    )
  );

-- The trainer clause filters on a JSON key; index it so the policy does not
-- turn every read into a sequential scan as the table grows.
create index if not exists enrollments_trainer_idx
  on public.enrollments ((data->>'trainerId'));
