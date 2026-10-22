-- ---------------------------------------------------------------------------
-- 068_policy_role_scoping.sql
--
-- Found during the UAT security pass. The read policies added in 066 and 067
-- were created without a `to authenticated` clause. A policy with no TO applies
-- to PUBLIC, which includes the anon role — and profiles_select contains a
-- branch that does not depend on the caller at all:
--
--     or role = 'trainer'
--
-- so an anonymous request holding only the public anon key could read every
-- trainer profile: id, auth_user_id, email, name, phone, address, birth date.
-- Verified live: GET /rest/v1/profiles with the anon key returned 9 rows.
--
-- enrollments_select and attendance_select happened to return no rows for anon
-- only because every branch of those expressions depends on auth.uid() (null for
-- anon). They are scoped here too, so the next edit cannot reopen the same hole.
--
-- The 064 write policies and the 063 self-enrollment gate are also re-created
-- with the same clause. Their expressions are unchanged, so behaviour for
-- signed-in users is identical.
--
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
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

drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments
  for select to authenticated
  using (
    public.is_super_admin()
    or trainee_id = public.current_profile_id()
    or data->>'trainerId' = public.current_profile_id()
    or (
      public.is_trainer_assigned_to_program(program_id)
      and coalesce(data->>'trainerId', '') = ''
    )
  );

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated
  using (
    public.is_super_admin()
    or trainee_id = public.current_profile_id()
    or public.is_trainer_assigned_to_program(program_id)
  );

drop policy if exists enrollments_insert on public.enrollments;
create policy enrollments_insert on public.enrollments
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
    or trainee_id = public.current_profile_id()
  );

drop policy if exists enrollments_update on public.enrollments;
create policy enrollments_update on public.enrollments
  for update to authenticated
  using (
    public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
    or trainee_id = public.current_profile_id()
  )
  with check (
    public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
    or trainee_id = public.current_profile_id()
  );

drop policy if exists enrollments_delete on public.enrollments;
create policy enrollments_delete on public.enrollments
  for delete to authenticated
  using (public.is_super_admin());

drop policy if exists self_enroll_closed on public.enrollments;
create policy self_enroll_closed on public.enrollments
  as restrictive
  for insert to authenticated
  with check (not public.self_enroll_blocks_insert());
