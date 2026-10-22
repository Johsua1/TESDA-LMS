-- 058_trainer_evaluation_isolation.sql
-- Evaluations and typing-test results become private to the trainer who owns
-- them (plus the trainee they describe, and Super Admins).
--
-- Before this migration both tables used the baseline "read-all" policies and
-- evaluations used a single write policy keyed on the program, so any trainer
-- assigned to the same program could read *and overwrite* another trainer's
-- evaluation. Typing tests were fully open as well.

-- ---------------------------------------------------------------------------
-- 1. Evaluations are keyed by id, not by trainee + program
--    The old UNIQUE(trainee_id, program_id) made a second period (for example
--    "Final Evaluation") overwrite the earlier "Mid-Term Evaluation" for the
--    same trainee, and it also collided when two trainers shared a program.
-- ---------------------------------------------------------------------------
alter table public.evaluations
  drop constraint if exists evaluations_trainee_id_program_id_key;

-- ---------------------------------------------------------------------------
-- 2. evaluations: author-scoped read/write
-- ---------------------------------------------------------------------------
drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations
  for select to authenticated
  using (
    public.is_super_admin()
    or trainer_id = public.current_profile_id()
    or trainee_id = public.current_profile_id()
  );

drop policy if exists evaluations_write on public.evaluations;
drop policy if exists evaluations_insert on public.evaluations;
create policy evaluations_insert on public.evaluations
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      trainer_id = public.current_profile_id()
      and public.is_trainer_assigned_to_program(program_id)
    )
  );

drop policy if exists evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations
  for update to authenticated
  using (public.is_super_admin() or trainer_id = public.current_profile_id())
  with check (
    public.is_super_admin()
    or (
      trainer_id = public.current_profile_id()
      and public.is_trainer_assigned_to_program(program_id)
    )
  );

drop policy if exists evaluations_delete on public.evaluations;
create policy evaluations_delete on public.evaluations
  for delete to authenticated
  using (public.is_super_admin() or trainer_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- 3. typing_tests: the trainee sees their own results, the trainer who owns the
--    result sees and annotates it, nobody else does.
-- ---------------------------------------------------------------------------
drop policy if exists typing_tests_select on public.typing_tests;
create policy typing_tests_select on public.typing_tests
  for select to authenticated
  using (
    public.is_super_admin()
    or trainer_id = public.current_profile_id()
    or trainee_id = public.current_profile_id()
  );

drop policy if exists typing_tests_write on public.typing_tests;
drop policy if exists typing_tests_insert on public.typing_tests;
create policy typing_tests_insert on public.typing_tests
  for insert to authenticated
  with check (
    public.is_super_admin()
    or trainee_id = public.current_profile_id()
    or (
      trainer_id = public.current_profile_id()
      and public.is_trainer_assigned_to_program(program_id)
    )
  );

drop policy if exists typing_tests_update on public.typing_tests;
create policy typing_tests_update on public.typing_tests
  for update to authenticated
  using (public.is_super_admin() or trainer_id = public.current_profile_id())
  with check (public.is_super_admin() or trainer_id = public.current_profile_id());

drop policy if exists typing_tests_delete on public.typing_tests;
create policy typing_tests_delete on public.typing_tests
  for delete to authenticated
  using (public.is_super_admin() or trainer_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- 4. Backfill results that were attributed to the program's legacy trainer id
--    (e.g. 'tr-005'), which does not map to a profile — those rows would be
--    invisible to every trainer under the policies above. Re-point them at the
--    trainer the trainee's enrollment is assigned to.
-- ---------------------------------------------------------------------------
update public.typing_tests tt
   set trainer_id = (
     select e.data->>'trainerId'
       from public.enrollments e
      where e.trainee_id = tt.trainee_id
        and e.program_id = tt.program_id
        and e.data->>'trainerId' in (select p.id from public.profiles p where p.role = 'trainer')
      limit 1
   )
 where tt.trainer_id is not null
   and not exists (select 1 from public.profiles p where p.id = tt.trainer_id)
   and exists (
     select 1
       from public.enrollments e2
      where e2.trainee_id = tt.trainee_id
        and e2.program_id = tt.program_id
        and e2.data->>'trainerId' in (select p.id from public.profiles p where p.role = 'trainer')
   );
