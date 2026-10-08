-- ===========================================================================
-- 018_rls_policies.sql
-- ---------------------------------------------------------------------------
-- Row Level Security for the EXISTING tables.
--
-- Compatibility note
--   The single-page frontend loads the whole catalog and gates the UI by role,
--   so broad *read* access for authenticated users is intentionally preserved
--   for catalog/content tables (programs, schedules, enrollments, ...).
--   Writes, however, are locked down: a trainer may only write content that
--   belongs to a program they are assigned to; only a Super Admin may write
--   anywhere.
--
-- Policies for the NEW tables (trainer_programs, specializations,
-- trainer_invitations, audit_logs) live in their own migration files, created
-- right after the tables themselves.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles
--   Read: broad (names are shown across the app).
--   Write: self, or Super Admin. Privileged columns are additionally guarded
--          by the trigger in 002_profiles.sql.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (auth_user_id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (auth_user_id = auth.uid() or public.is_super_admin())
  with check (auth_user_id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- programs
--   Trainer may only create/update/delete rows for programs assigned to them.
--   (Programs are normally created by the Super Admin.)
-- ---------------------------------------------------------------------------
drop policy if exists programs_select on public.programs;
create policy programs_select on public.programs
  for select to authenticated using (true);

drop policy if exists programs_write on public.programs;
create policy programs_write on public.programs
  for all to authenticated
  using (public.is_super_admin() or public.is_trainer_assigned_to_program(id))
  with check (public.is_super_admin() or public.is_trainer_assigned_to_program(id));

-- ---------------------------------------------------------------------------
-- schedules / attendance / evaluations
--   All carry a program_id -> a trainer may only write rows for assigned
--   programs. Reads stay broad for the shared calendar / roster views.
-- ---------------------------------------------------------------------------
drop policy if exists schedules_select on public.schedules;
create policy schedules_select on public.schedules
  for select to authenticated using (true);

drop policy if exists schedules_write on public.schedules;
create policy schedules_write on public.schedules
  for all to authenticated
  using (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id))
  with check (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id));

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated using (true);

drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance
  for all to authenticated
  using (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id))
  with check (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id));

drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select to authenticated using (true);

drop policy if exists evaluations_write on public.evaluations;
create policy evaluations_write on public.evaluations
  for all to authenticated
  using (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id))
  with check (public.is_super_admin() or public.is_trainer_assigned_to_program(program_id));

-- ---------------------------------------------------------------------------
-- Deliberately left as-is (broad read + authenticated write), to keep the
-- existing learner experience working:
--   enrollments, quiz_attempts, exam_attempts, typing_tests,
--   announcements, settings.
-- See docs/BACKEND.md "Security considerations" for the rationale.
-- ---------------------------------------------------------------------------
