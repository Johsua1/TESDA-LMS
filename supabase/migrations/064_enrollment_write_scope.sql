-- ---------------------------------------------------------------------------
-- 064_enrollment_write_scope.sql
--
-- Found during the UAT/security pass: public.enrollments still carried
--   enrollments_write  ALL  USING (true) WITH CHECK (true)
-- i.e. any authenticated user could insert, update or delete ANY enrollment —
-- approve their own application by PATCHing status to 'Enrolled', edit another
-- trainee's personal data, or delete someone else's record. That fails the
-- "ordinary users cannot perform administrator functions" and "one user cannot
-- access another user's private records" checks.
--
-- Replaced with per-command policies:
--   INSERT  admin, trainer of that program, or the trainee themselves
--           (the self-enroll switch is enforced separately by 063)
--   UPDATE  same row scope
--   DELETE  Super Admin only — the client only deletes enrollments when an
--           admin removes a trainee or a program
--
-- Row scope alone is not enough for UPDATE: a trainee may still correct their
-- documents, contact details, payment reference and progress, but the
-- registrar's decisions live in the same row and the client sends whole rows.
-- The trigger below therefore *normalises* the protected fields back to their
-- stored values instead of raising — a trainee whose copy is a minute stale
-- must still be able to mark a lesson complete, while an attempt to approve
-- themselves simply changes nothing. It skips the internal auto-completion
-- UPDATE (guarded by app.completion_sync in sync_enrollment_completion()).
--
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

drop policy if exists enrollments_write on public.enrollments;

drop policy if exists enrollments_insert on public.enrollments;
create policy enrollments_insert on public.enrollments
  for insert
  with check (
    public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
    or trainee_id = public.current_profile_id()
  );

drop policy if exists enrollments_update on public.enrollments;
create policy enrollments_update on public.enrollments
  for update
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
  for delete
  using (public.is_super_admin());

create or replace function public.enforce_enrollment_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb := coalesce(new.data, '{}'::jsonb);
  v_old  jsonb := coalesce(old.data, '{}'::jsonb);
  v_key  text;
begin
  -- Registrar: no field restrictions.
  if public.is_super_admin() then
    return new;
  end if;

  -- Internal auto-completion (sync_enrollment_completion) runs as the caller,
  -- so let it through — it only ever moves the row to 'Completed'.
  if coalesce(current_setting('app.completion_sync', true), '') = 'on' then
    return new;
  end if;

  -- Ownership and the registrar's decision are not the trainee's to change.
  new.trainee_id := old.trainee_id;
  new.program_id := old.program_id;
  new.status     := old.status;

  foreach v_key in array array[
    'status', 'decisionRemarks', 'decisionAt', 'decisionBy',
    'certificateIssued', 'startDate', 'endDate'
  ]
  loop
    if (v_data->>v_key) is distinct from (v_old->>v_key) then
      if v_old ? v_key then
        v_data := jsonb_set(v_data, array[v_key], v_old->v_key, true);
      else
        v_data := v_data - v_key;
      end if;
    end if;
  end loop;

  new.data := v_data;
  return new;
end
$$;

drop trigger if exists enrollments_self_update_guard on public.enrollments;
create trigger enrollments_self_update_guard
  before update on public.enrollments
  for each row execute function public.enforce_enrollment_self_update();
