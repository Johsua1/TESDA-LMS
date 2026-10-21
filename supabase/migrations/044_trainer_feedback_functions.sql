-- ============================================================================
-- 044_trainer_feedback_functions.sql
-- ----------------------------------------------------------------------------
-- Server-side completion rule, feedback eligibility, submission, Super Admin
-- retrieval/export helpers and the auditable correction path.
--
-- Everything here is SECURITY DEFINER with a fixed search_path. Authorization
-- is always derived from auth.uid() -> profiles, never from a client argument.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- All published lesson ids of a program, including lessons nested under
-- competencies[].units[].lessons.
-- ---------------------------------------------------------------------------
create or replace function public.program_lesson_ids(p_program_id text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct les.l->>'id'), array[]::text[])
  from public.programs p
  cross join lateral jsonb_array_elements(coalesce(p.data->'competencies', '[]'::jsonb)) c
  cross join lateral (
    select l.value as l
    from jsonb_array_elements(coalesce(c->'lessons', '[]'::jsonb)) as l
    union all
    select l2.value as l
    from jsonb_array_elements(coalesce(c->'units', '[]'::jsonb)) as u
    cross join lateral jsonb_array_elements(coalesce(u.value->'lessons', '[]'::jsonb)) as l2
  ) les
  where p.id = p_program_id
    and coalesce(les.l->>'id', '') <> ''
    and coalesce((les.l->>'published')::boolean, true)
$$;

-- ---------------------------------------------------------------------------
-- course_completion(enrollment_id)
--   A database-backed completion decision. It combines the enrollment status
--   with the actual progress map, every published quiz and every published
--   exam. The frontend cannot make this true by navigating to a page.
-- ---------------------------------------------------------------------------
create or replace function public.course_completion(p_enrollment_id text)
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
  v_reasons        text[] := array[]::text[];
  v_complete       boolean := false;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id;
  if not found then
    return jsonb_build_object(
      'complete', false,
      'status_completed', false,
      'reasons', jsonb_build_array('enrollment_not_found')
    );
  end if;

  select * into v_p from public.programs where id = v_e.program_id;
  if not found then
    return jsonb_build_object(
      'complete', false,
      'status_completed', false,
      'reasons', jsonb_build_array('program_not_found')
    );
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
        and coalesce(
              qa.percentage,
              nullif(qa.data->>'percentage', '')::numeric,
              0
            ) >= coalesce(nullif(q->>'passing', '')::numeric, 75)
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
        and coalesce(
              ea.percentage,
              nullif(ea.data->>'percentage', '')::numeric,
              0
            ) >= coalesce(nullif(e->>'passing', '')::numeric, 75)
    );

  if v_e.status is distinct from 'Completed' then
    v_reasons := array_append(v_reasons, 'enrollment_not_completed');
  end if;
  if v_lessons_done < v_lessons_total then
    v_reasons := array_append(v_reasons, 'lessons_incomplete');
  end if;
  if v_quizzes_passed < v_quizzes_total then
    v_reasons := array_append(v_reasons, 'quizzes_incomplete');
  end if;
  if v_exams_passed < v_exams_total then
    v_reasons := array_append(v_reasons, 'exams_incomplete');
  end if;

  v_complete :=
    v_e.status = 'Completed'
    and v_lessons_done >= v_lessons_total
    and v_quizzes_passed >= v_quizzes_total
    and v_exams_passed >= v_exams_total;

  return jsonb_build_object(
    'complete', v_complete,
    'status_completed', v_e.status = 'Completed',
    'status', v_e.status,
    'lessons_total', v_lessons_total,
    'lessons_completed', v_lessons_done,
    'quizzes_total', v_quizzes_total,
    'quizzes_passed', v_quizzes_passed,
    'exams_total', v_exams_total,
    'exams_passed', v_exams_passed,
    'reasons', to_jsonb(v_reasons)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The trainer responsible for an enrollment. Enrollment.data.trainerId wins;
-- otherwise the single active trainer_programs assignment is used. A stale
-- programs.trainer_id is only accepted when it points at a real trainer
-- profile. Returns NULL when the answer is ambiguous.
-- ---------------------------------------------------------------------------
create or replace function public.trainer_for_enrollment(p_enrollment_id text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_e       record;
  v_trainer text;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id;
  if not found then
    return null;
  end if;

  v_trainer := nullif(v_e.data->>'trainerId', '');
  if v_trainer is not null and not exists (
    select 1 from public.profiles where id = v_trainer and role = 'trainer'
  ) then
    v_trainer := null;
  end if;

  if v_trainer is null then
    select min(tp.trainer_id) into v_trainer
    from public.trainer_programs tp
    join public.profiles pr on pr.id = tp.trainer_id and pr.role = 'trainer'
    where tp.program_id = v_e.program_id
      and tp.status = 'active'
    having count(distinct tp.trainer_id) = 1;
  end if;

  if v_trainer is not null and not exists (
    select 1
    from public.trainer_programs tp
    where tp.program_id = v_e.program_id
      and tp.trainer_id = v_trainer
      and tp.status = 'active'
  ) and not exists (
    select 1
    from public.programs p
    join public.profiles pr on pr.id = p.trainer_id and pr.role = 'trainer'
    where p.id = v_e.program_id
      and p.trainer_id = v_trainer
  ) then
    v_trainer := null;
  end if;

  return v_trainer;
end;
$$;

-- ---------------------------------------------------------------------------
-- Eligibility snapshot for one enrollment.
-- ---------------------------------------------------------------------------
create or replace function public.trainer_feedback_eligibility(p_enrollment_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_e          record;
  v_p          record;
  v_completion jsonb;
  v_trainer    text;
  v_feedback   record;
  v_status     text;
  v_eligible   boolean := false;
begin
  select * into v_e from public.enrollments where id = p_enrollment_id;
  if not found then
    return jsonb_build_object(
      'enrollment_id', p_enrollment_id,
      'status', 'not_required',
      'eligible', false,
      'reason', 'enrollment_not_found'
    );
  end if;

  select * into v_p from public.programs where id = v_e.program_id;
  v_completion := public.course_completion(p_enrollment_id);
  v_trainer    := public.trainer_for_enrollment(p_enrollment_id);

  select * into v_feedback
  from public.trainer_feedback
  where enrollment_id = p_enrollment_id;

  if found and v_feedback.is_submitted then
    v_status := 'submitted';
  elsif coalesce((v_completion->>'complete')::boolean, false) and v_trainer is not null then
    v_status := 'pending';
    v_eligible := true;
  else
    v_status := 'not_required';
  end if;

  return jsonb_build_object(
    'enrollment_id', p_enrollment_id,
    'trainee_id', v_e.trainee_id,
    'program_id', v_e.program_id,
    'program_title', coalesce(nullif(v_p.title, ''), nullif(v_p.data->>'title', ''), v_p.code, v_e.program_id),
    'trainer_id', v_trainer,
    'trainer_name', (
      select coalesce(nullif(pr.name, ''), pr.email, pr.id)
      from public.profiles pr
      where pr.id = v_trainer
    ),
    'completion', v_completion,
    'status', v_status,
    'eligible', v_eligible,
    'feedback_id', case when found then v_feedback.id else null end,
    'submitted_at', case when found then v_feedback.submitted_at else null end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Trainee-facing status for every enrollment. This is the only status the
-- frontend needs to decide whether to show the feedback form.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_trainer_feedback_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me   text := public.current_profile_id();
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x.row order by x.updated_at desc), '[]'::jsonb)
  into v_rows
  from (
    select e.updated_at,
           public.trainer_feedback_eligibility(e.id) as row
    from public.enrollments e
    where e.trainee_id = v_me
      and coalesce(e.status, '') not in ('Cancelled', 'Rejected')
  ) x;

  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_trainer_feedback(...)
--   The trainee is derived from the JWT. The trainer is derived from the
--   enrollment, so a trainee can never evaluate an unrelated trainer.
-- ---------------------------------------------------------------------------
create or replace function public.submit_trainer_feedback(
  p_enrollment_id        text,
  p_feedback_text        text,
  p_learning_experience  text default null,
  p_trainer_strengths    text default null,
  p_areas_for_improvement text default null,
  p_recommendation       text default null,
  p_rating               smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       text := public.current_profile_id();
  v_e        record;
  v_elig     jsonb;
  v_trainer  text;
  v_id       text;
begin
  if v_me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_feedback_text is null or length(btrim(p_feedback_text)) = 0 then
    raise exception 'Written feedback is required.' using errcode = '22023';
  end if;

  if p_rating is not null and (p_rating < 1 or p_rating > 5) then
    raise exception 'Rating must be between 1 and 5.' using errcode = '22023';
  end if;

  -- Serialize concurrent submissions for the same enrollment.
  select * into v_e
  from public.enrollments
  where id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Enrollment not found.' using errcode = 'P0002';
  end if;

  if v_e.trainee_id is distinct from v_me then
    raise exception 'You can only submit feedback for your own enrollment.'
      using errcode = '42501';
  end if;

  v_elig := public.trainer_feedback_eligibility(p_enrollment_id);

  if exists (
    select 1 from public.trainer_feedback
    where enrollment_id = p_enrollment_id and is_submitted
  ) then
    raise exception 'Feedback has already been submitted for this enrollment.'
      using errcode = '23505';
  end if;

  if not coalesce((v_elig->>'eligible')::boolean, false) then
    raise exception 'This enrollment is not eligible for trainer feedback yet: %',
      coalesce(v_elig->'completion'->>'reasons', v_elig->>'reason', 'requirements not met')
      using errcode = '42501';
  end if;

  v_trainer := v_elig->>'trainer_id';
  if v_trainer is null then
    raise exception 'No trainer is assigned to this enrollment.' using errcode = '42501';
  end if;

  insert into public.trainer_feedback (
    trainee_id, trainer_id, program_id, enrollment_id,
    feedback_text, learning_experience, trainer_strengths,
    areas_for_improvement, recommendation, rating,
    is_submitted, submitted_at
  )
  values (
    v_me, v_trainer, v_e.program_id, p_enrollment_id,
    btrim(p_feedback_text), nullif(btrim(coalesce(p_learning_experience, '')), ''),
    nullif(btrim(coalesce(p_trainer_strengths, '')), ''),
    nullif(btrim(coalesce(p_areas_for_improvement, '')), ''),
    nullif(btrim(coalesce(p_recommendation, '')), ''),
    p_rating, true, now()
  )
  on conflict (enrollment_id) do update
    set feedback_text         = excluded.feedback_text,
        learning_experience   = excluded.learning_experience,
        trainer_strengths     = excluded.trainer_strengths,
        areas_for_improvement = excluded.areas_for_improvement,
        recommendation        = excluded.recommendation,
        rating                = excluded.rating,
        is_submitted          = true,
        submitted_at          = now(),
        updated_at            = now()
    where public.trainer_feedback.is_submitted = false
  returning id into v_id;

  if v_id is null then
    raise exception 'Feedback has already been submitted for this enrollment.'
      using errcode = '23505';
  end if;

  perform public.write_audit(
    'TRAINER_FEEDBACK_SUBMITTED',
    'trainer_feedback',
    v_id,
    jsonb_build_object(
      'enrollment_id', p_enrollment_id,
      'trainer_id', v_trainer,
      'program_id', v_e.program_id
    )
  );

  return public.trainer_feedback_eligibility(p_enrollment_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Super Admin retrieval (paged; the CSV function walks the pages).
-- Filters: trainer_id, program_id, trainee_id, enrollment_id, date_from,
-- date_to, search.
-- ---------------------------------------------------------------------------
create or replace function public.admin_trainer_feedback_page(
  p_filters jsonb default '{}'::jsonb,
  p_limit   int default 1000,
  p_offset  int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_from   timestamptz;
  v_to     timestamptz;
  v_rows   jsonb;
begin
  if not public.is_super_admin_mfa() then
    raise exception 'Super Admin access with MFA is required.' using errcode = '42501';
  end if;

  -- Date-only filters are interpreted as Asia/Manila calendar days, which is
  -- what the training centre means by "today". Full timestamps are used as-is.
  if nullif(p_filters->>'date_from', '') is not null then
    if length(p_filters->>'date_from') = 10 then
      v_from := (p_filters->>'date_from')::date::timestamp at time zone 'Asia/Manila';
    else
      v_from := (p_filters->>'date_from')::timestamptz;
    end if;
  end if;

  if nullif(p_filters->>'date_to', '') is not null then
    if length(p_filters->>'date_to') = 10 then
      v_to := ((p_filters->>'date_to')::date + 1)::timestamp at time zone 'Asia/Manila';
    else
      v_to := (p_filters->>'date_to')::timestamptz;
    end if;
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.submitted_at, t.id), '[]'::jsonb)
  into v_rows
  from (
    select
      f.id,
      f.trainer_id,
      coalesce(nullif(tr.name, ''), tr.email, f.trainer_id) as trainer_name,
      f.trainee_id,
      coalesce(nullif(tn.name, ''), tn.email, f.trainee_id) as trainee_name,
      f.program_id,
      coalesce(nullif(p.title, ''), nullif(p.data->>'title', ''), p.code, f.program_id) as course_title,
      f.enrollment_id,
      f.feedback_text,
      f.learning_experience,
      f.trainer_strengths,
      f.areas_for_improvement,
      f.recommendation,
      f.rating,
      f.submitted_at,
      f.created_at,
      f.corrected_at,
      f.correction_reason
    from public.trainer_feedback f
    join public.profiles tr on tr.id = f.trainer_id
    join public.profiles tn on tn.id = f.trainee_id
    left join public.programs p on p.id = f.program_id
    where f.is_submitted
      and (nullif(p_filters->>'trainer_id', '') is null
           or f.trainer_id = p_filters->>'trainer_id')
      and (nullif(p_filters->>'program_id', '') is null
           or f.program_id = p_filters->>'program_id')
      and (nullif(p_filters->>'trainee_id', '') is null
           or f.trainee_id = p_filters->>'trainee_id')
      and (nullif(p_filters->>'enrollment_id', '') is null
           or f.enrollment_id = p_filters->>'enrollment_id')
      and (v_from is null or f.submitted_at >= v_from)
      and (v_to is null or f.submitted_at < v_to)
      and (
        nullif(p_filters->>'search', '') is null
        or f.feedback_text ilike '%' || (p_filters->>'search') || '%'
        or coalesce(f.trainer_strengths, '') ilike '%' || (p_filters->>'search') || '%'
        or coalesce(f.areas_for_improvement, '') ilike '%' || (p_filters->>'search') || '%'
        or coalesce(f.learning_experience, '') ilike '%' || (p_filters->>'search') || '%'
        or coalesce(f.recommendation, '') ilike '%' || (p_filters->>'search') || '%'
      )
    order by f.submitted_at asc, f.id asc
    limit v_limit offset v_offset
  ) t;

  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit helper for exports. The Edge Function calls this after building the
-- CSV, so an export can never happen without an audit row.
-- ---------------------------------------------------------------------------
create or replace function public.log_trainer_feedback_export(
  p_filters   jsonb,
  p_row_count int,
  p_format    text default 'csv'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin_mfa() then
    raise exception 'Super Admin access with MFA is required.' using errcode = '42501';
  end if;

  perform public.write_audit(
    'TRAINER_FEEDBACK_EXPORTED',
    'trainer_feedback',
    null,
    jsonb_build_object(
      'filters', coalesce(p_filters, '{}'::jsonb),
      'row_count', greatest(coalesce(p_row_count, 0), 0),
      'format', coalesce(p_format, 'csv')
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditable correction. The original values are copied into
-- trainer_feedback_revisions before the row is touched.
-- ---------------------------------------------------------------------------
create or replace function public.admin_correct_trainer_feedback(
  p_id                   text,
  p_feedback_text        text,
  p_learning_experience  text default null,
  p_trainer_strengths    text default null,
  p_areas_for_improvement text default null,
  p_recommendation       text default null,
  p_reason               text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old      record;
  v_revision uuid;
begin
  if not public.is_super_admin_mfa() then
    raise exception 'Super Admin access with MFA is required.' using errcode = '42501';
  end if;

  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'A correction reason is required.' using errcode = '22023';
  end if;

  if p_feedback_text is null or length(btrim(p_feedback_text)) = 0 then
    raise exception 'Written feedback is required.' using errcode = '22023';
  end if;

  select * into v_old
  from public.trainer_feedback
  where id = p_id
  for update;

  if not found then
    raise exception 'Feedback not found.' using errcode = 'P0002';
  end if;

  insert into public.trainer_feedback_revisions (feedback_id, previous_values, reason, corrected_by)
  values (
    p_id,
    jsonb_build_object(
      'feedback_text', v_old.feedback_text,
      'learning_experience', v_old.learning_experience,
      'trainer_strengths', v_old.trainer_strengths,
      'areas_for_improvement', v_old.areas_for_improvement,
      'recommendation', v_old.recommendation,
      'rating', v_old.rating,
      'submitted_at', v_old.submitted_at
    ),
    btrim(p_reason),
    public.current_profile_id()
  )
  returning id into v_revision;

  perform set_config('app.feedback_correction', 'on', true);

  update public.trainer_feedback
     set feedback_text         = btrim(p_feedback_text),
         learning_experience   = nullif(btrim(coalesce(p_learning_experience, '')), ''),
         trainer_strengths     = nullif(btrim(coalesce(p_trainer_strengths, '')), ''),
         areas_for_improvement = nullif(btrim(coalesce(p_areas_for_improvement, '')), ''),
         recommendation        = nullif(btrim(coalesce(p_recommendation, '')), ''),
         corrected_at          = now(),
         corrected_by          = public.current_profile_id(),
         correction_reason     = btrim(p_reason),
         updated_at            = now()
   where id = p_id;

  perform set_config('app.feedback_correction', 'off', true);

  perform public.write_audit(
    'TRAINER_FEEDBACK_CORRECTED',
    'trainer_feedback',
    p_id,
    jsonb_build_object('revision_id', v_revision, 'reason', btrim(p_reason))
  );

  return jsonb_build_object(
    'id', p_id,
    'revision_id', v_revision,
    'corrected_at', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.program_lesson_ids(text) from public, anon, authenticated;
revoke all on function public.course_completion(text) from public, anon, authenticated;
revoke all on function public.trainer_for_enrollment(text) from public, anon, authenticated;
revoke all on function public.trainer_feedback_eligibility(text) from public, anon, authenticated;

revoke all on function public.get_my_trainer_feedback_status() from public, anon;
revoke all on function public.submit_trainer_feedback(text, text, text, text, text, text, smallint) from public, anon;
revoke all on function public.admin_trainer_feedback_page(jsonb, int, int) from public, anon;
revoke all on function public.log_trainer_feedback_export(jsonb, int, text) from public, anon;
revoke all on function public.admin_correct_trainer_feedback(text, text, text, text, text, text, text) from public, anon;

grant execute on function public.get_my_trainer_feedback_status() to authenticated;
grant execute on function public.submit_trainer_feedback(text, text, text, text, text, text, smallint) to authenticated;
grant execute on function public.admin_trainer_feedback_page(jsonb, int, int) to authenticated;
grant execute on function public.log_trainer_feedback_export(jsonb, int, text) to authenticated;
grant execute on function public.admin_correct_trainer_feedback(text, text, text, text, text, text, text) to authenticated;
