-- ============================================================================
-- 050_auto_complete_enrollments.sql
-- ----------------------------------------------------------------------------
-- Marks an enrollment "Completed" as soon as the trainee has actually finished
-- the program: every published lesson done, every published quiz passed and
-- every published exam passed. The status is a database decision, not a
-- frontend one, so the feedback eligibility rule that depends on it cannot be
-- triggered by navigating to a page.
--
-- Triggers:
--   enrollments      AFTER INSERT/UPDATE OF data, status  -> re-evaluate
--   quiz_attempts    AFTER INSERT/UPDATE OF percentage,status -> re-evaluate
--   exam_attempts    AFTER INSERT/UPDATE OF percentage,status -> re-evaluate
--
-- The update sets app.completion_sync so the enrollments trigger does not
-- recurse, and every trigger body swallows its own errors: a completion
-- bookkeeping failure must never reject a trainee's quiz/exam submission.
--
-- Additive and idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Requirement snapshot (ignores the enrollment status).
-- ---------------------------------------------------------------------------
create or replace function public.enrollment_requirements_met(p_enrollment_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_e              record;
  v_p              record;
  v_progress       jsonb;
  v_lesson_ids     text[];
  v_lessons_total  int := 0;
  v_lessons_done   int := 0;
  v_quizzes_total  int := 0;
  v_quizzes_passed int := 0;
  v_exams_total    int := 0;
  v_exams_passed   int := 0;
  v_met            boolean := false;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id;
  if not found then
    return jsonb_build_object('met', false, 'reason', 'enrollment_not_found');
  end if;

  select * into v_p from public.programs where id = v_e.program_id;
  if not found then
    return jsonb_build_object('met', false, 'reason', 'program_not_found');
  end if;

  v_progress   := coalesce(v_e.data->'progress', '{}'::jsonb);
  v_lesson_ids := public.program_lesson_ids(v_e.program_id);
  v_lessons_total := coalesce(array_length(v_lesson_ids, 1), 0);

  select count(*) into v_lessons_done
  from unnest(v_lesson_ids) lid
  where lower(coalesce(v_progress->>lid, '')) in ('true', 't', '1', 'yes');

  select count(*) into v_quizzes_total
  from jsonb_array_elements(coalesce(v_p.data->'quizzes', '[]'::jsonb)) q
  where coalesce((q->>'published')::boolean, true)
    and (
      coalesce(q->>'lessonId', '') = ''
      or (q->>'lessonId') = any(v_lesson_ids)
    );

  select count(*) into v_quizzes_passed
  from jsonb_array_elements(coalesce(v_p.data->'quizzes', '[]'::jsonb)) q
  where coalesce((q->>'published')::boolean, true)
    and (
      coalesce(q->>'lessonId', '') = ''
      or (q->>'lessonId') = any(v_lesson_ids)
    )
    and exists (
      select 1
      from public.quiz_attempts qa
      where qa.trainee_id = v_e.trainee_id
        and qa.program_id = v_e.program_id
        and qa.data->>'quizId' = q->>'id'
        and coalesce(qa.percentage, nullif(qa.data->>'percentage', '')::numeric, 0)
            >= coalesce(nullif(q->>'passing', '')::numeric, 75)
    );

  select count(*) into v_exams_total
  from jsonb_array_elements(coalesce(v_p.data->'exams', '[]'::jsonb)) e
  where coalesce((e->>'published')::boolean, true);

  select count(*) into v_exams_passed
  from jsonb_array_elements(coalesce(v_p.data->'exams', '[]'::jsonb)) e
  where coalesce((e->>'published')::boolean, true)
    and exists (
      select 1
      from public.exam_attempts ea
      where ea.trainee_id = v_e.trainee_id
        and ea.program_id = v_e.program_id
        and ea.data->>'examId' = e->>'id'
        and coalesce(ea.percentage, nullif(ea.data->>'percentage', '')::numeric, 0)
            >= coalesce(nullif(e->>'passing', '')::numeric, 75)
    );

  -- A program with no lessons at all is still being authored: never complete.
  v_met := v_lessons_total > 0
           and v_lessons_done >= v_lessons_total
           and v_quizzes_passed >= v_quizzes_total
           and v_exams_passed >= v_exams_total;

  return jsonb_build_object(
    'met', v_met,
    'program_id', v_e.program_id,
    'trainee_id', v_e.trainee_id,
    'lessons_total', v_lessons_total,
    'lessons_completed', v_lessons_done,
    'quizzes_total', v_quizzes_total,
    'quizzes_passed', v_quizzes_passed,
    'exams_total', v_exams_total,
    'exams_passed', v_exams_passed
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- course_completion() now delegates, so there is one definition of "done".
-- Output keys are unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.course_completion(p_enrollment_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_e      record;
  v_req    jsonb;
  v_reasons text[] := array[]::text[];
  v_status text;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id;
  if not found then
    return jsonb_build_object(
      'complete', false,
      'status_completed', false,
      'reasons', jsonb_build_array('enrollment_not_found')
    );
  end if;

  v_req    := public.enrollment_requirements_met(p_enrollment_id);
  v_status := v_e.status;

  if v_status is distinct from 'Completed' then
    v_reasons := array_append(v_reasons, 'enrollment_not_completed');
  end if;
  if coalesce((v_req->>'lessons_completed')::int, 0) < coalesce((v_req->>'lessons_total')::int, 0) then
    v_reasons := array_append(v_reasons, 'lessons_incomplete');
  end if;
  if coalesce((v_req->>'quizzes_passed')::int, 0) < coalesce((v_req->>'quizzes_total')::int, 0) then
    v_reasons := array_append(v_reasons, 'quizzes_incomplete');
  end if;
  if coalesce((v_req->>'exams_passed')::int, 0) < coalesce((v_req->>'exams_total')::int, 0) then
    v_reasons := array_append(v_reasons, 'exams_incomplete');
  end if;

  return jsonb_build_object(
    'complete', v_status = 'Completed' and coalesce((v_req->>'met')::boolean, false),
    'status_completed', v_status = 'Completed',
    'status', v_status,
    'lessons_total', coalesce((v_req->>'lessons_total')::int, 0),
    'lessons_completed', coalesce((v_req->>'lessons_completed')::int, 0),
    'quizzes_total', coalesce((v_req->>'quizzes_total')::int, 0),
    'quizzes_passed', coalesce((v_req->>'quizzes_passed')::int, 0),
    'exams_total', coalesce((v_req->>'exams_total')::int, 0),
    'exams_passed', coalesce((v_req->>'exams_passed')::int, 0),
    'reasons', to_jsonb(v_reasons)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- sync_enrollment_completion(enrollment_id)
--   Idempotent. Completes only when the requirements are met AND the current
--   status is still an "in progress" one; a Cancelled/Dropped record is never
--   resurrected, and a Completed record is never touched.
-- ---------------------------------------------------------------------------
create or replace function public.sync_enrollment_completion(p_enrollment_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e   record;
  v_req jsonb;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id for update;
  if not found then
    return jsonb_build_object('changed', false, 'reason', 'enrollment_not_found');
  end if;

  v_req := public.enrollment_requirements_met(p_enrollment_id);

  if v_e.status = 'Completed' then
    return jsonb_build_object('changed', false, 'status', v_e.status, 'reason', 'already_completed', 'requirements', v_req);
  end if;

  if lower(coalesce(v_e.status, '')) not in ('enrolled', 'approved', 'ongoing', 'active') then
    return jsonb_build_object('changed', false, 'status', v_e.status, 'reason', 'status_not_eligible', 'requirements', v_req);
  end if;

  if not coalesce((v_req->>'met')::boolean, false) then
    return jsonb_build_object('changed', false, 'status', v_e.status, 'reason', 'requirements_not_met', 'requirements', v_req);
  end if;

  perform set_config('app.completion_sync', 'on', true);
  update public.enrollments
     set status = 'Completed',
         updated_at = now()
   where id = p_enrollment_id;
  perform set_config('app.completion_sync', 'off', true);

  perform public.write_audit(
    'ENROLLMENT_AUTO_COMPLETED',
    'enrollments',
    p_enrollment_id,
    jsonb_build_object(
      'previous_status', v_e.status,
      'program_id', v_e.program_id,
      'trainee_id', v_e.trainee_id,
      'requirements', v_req
    )
  );

  return jsonb_build_object(
    'changed', true,
    'status', 'Completed',
    'previous_status', v_e.status,
    'requirements', v_req
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger bodies
-- ---------------------------------------------------------------------------
create or replace function public.auto_complete_enrollment_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.completion_sync', true), '') = 'on' then
    return new;
  end if;
  begin
    perform public.sync_enrollment_completion(new.id);
  exception when others then
    raise warning 'auto-completion skipped for enrollment %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create or replace function public.auto_complete_from_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  for v_id in
    select e.id
    from public.enrollments e
    where e.trainee_id = new.trainee_id
      and e.program_id = new.program_id
      and coalesce(e.status, '') <> 'Completed'
  loop
    begin
      perform public.sync_enrollment_completion(v_id);
    exception when others then
      raise warning 'auto-completion skipped for enrollment %: %', v_id, sqlerrm;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists enrollments_auto_complete on public.enrollments;
create trigger enrollments_auto_complete
  after insert or update of data, status on public.enrollments
  for each row execute function public.auto_complete_enrollment_trigger();

drop trigger if exists quiz_attempts_auto_complete on public.quiz_attempts;
create trigger quiz_attempts_auto_complete
  after insert or update of percentage, status on public.quiz_attempts
  for each row execute function public.auto_complete_from_attempt();

drop trigger if exists exam_attempts_auto_complete on public.exam_attempts;
create trigger exam_attempts_auto_complete
  after insert or update of percentage, status on public.exam_attempts
  for each row execute function public.auto_complete_from_attempt();

-- ---------------------------------------------------------------------------
-- Backfill / manual sweep. Returns how many enrollments were completed.
-- ---------------------------------------------------------------------------
create or replace function public.sync_all_enrollment_completion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      text;
  v_changed int := 0;
  v_scanned int := 0;
  v_result  jsonb;
begin
  for v_id in
    select id from public.enrollments
    where lower(coalesce(status, '')) in ('enrolled', 'approved', 'ongoing', 'active')
  loop
    v_scanned := v_scanned + 1;
    v_result := public.sync_enrollment_completion(v_id);
    if coalesce((v_result->>'changed')::boolean, false) then
      v_changed := v_changed + 1;
    end if;
  end loop;
  return jsonb_build_object('scanned', v_scanned, 'completed', v_changed);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: internal only. Trainees reach completion through the triggers, never
-- by calling these directly.
-- ---------------------------------------------------------------------------
revoke all on function public.enrollment_requirements_met(text) from public, anon, authenticated;
revoke all on function public.sync_enrollment_completion(text) from public, anon, authenticated;
revoke all on function public.sync_all_enrollment_completion() from public, anon, authenticated;
revoke all on function public.auto_complete_enrollment_trigger() from public, anon, authenticated;
revoke all on function public.auto_complete_from_attempt() from public, anon, authenticated;

grant execute on function public.sync_all_enrollment_completion() to service_role;
grant execute on function public.sync_enrollment_completion(text) to service_role;
