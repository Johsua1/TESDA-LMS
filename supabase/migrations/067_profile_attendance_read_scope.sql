-- ---------------------------------------------------------------------------
-- 067_profile_attendance_read_scope.sql
--
-- Closes the rest of O-01 from the UAT report. Enrollment reads were scoped in
-- 066; profiles and attendance were still readable by every signed-in user,
-- which exposed other trainees' contact details, birth dates and attendance.
--
-- profiles
--   * Super Admin — everything
--   * yourself
--   * every trainer — trainees need their trainer's name, specialization and
--     contact details on schedules, courses and feedback screens
--   * a trainer may also read the trainees enrolled under them (explicit
--     data->>'trainerId', or an unassigned row in one of their programs)
--   Admin profiles are not exposed to trainees/trainers; announcements then
--   read "Posted by Administration" instead of the registrar's name.
--
-- attendance
--   * Super Admin — everything
--   * the trainee who owns the record
--   * a trainer of that program
--
-- Both tables keep their write policies unchanged.
--
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select on public.profiles;

create policy profiles_select on public.profiles
  for select
  using (
    public.is_super_admin()
    or auth_user_id = auth.uid()
    or role = 'trainer'
    or exists (
      select 1
        from public.enrollments e
       where e.trainee_id = profiles.id
         and (
           e.data->>'trainerId' = public.current_profile_id()
           or (
             coalesce(e.data->>'trainerId', '') = ''
             and public.is_trainer_assigned_to_program(e.program_id)
           )
         )
    )
  );

drop policy if exists attendance_select on public.attendance;

create policy attendance_select on public.attendance
  for select
  using (
    public.is_super_admin()
    or trainee_id = public.current_profile_id()
    or public.is_trainer_assigned_to_program(program_id)
  );

-- The profile policy looks up the caller's trainees through enrollments; the
-- trainee_id index from 065 serves it. Nothing else to add.
