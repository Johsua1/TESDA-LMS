-- ---------------------------------------------------------------------------
-- 056 — Fix exam submissions failing with
--        'record "v_session" is not assigned yet'
--
-- grade_legacy_attempt() declared a single record variable, v_session, and
-- only filled it on the quiz branch. The deadline expression still referenced
-- v_session.deadline_at, and PL/pgSQL evaluates the whole CASE/AND condition
-- before choosing a branch, so every exam insert raised
--   55000  record "v_session" is not assigned yet
-- The trainee saw "This result has not been saved yet", no exam_attempts row
-- was written, and the trainer's exam results stayed empty.
--
-- The session clock is now read into two scalars, and the exam branch never
-- touches session data at all.
-- ---------------------------------------------------------------------------

create or replace function public.grade_legacy_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind             text := tg_argv[0];
  v_config           jsonb;
  v_session_started  timestamptz;
  v_session_deadline timestamptz;
  v_started          timestamptz;
  v_deadline         timestamptz;
  v_limit            int;
  v_grade            jsonb;
  v_auto             boolean;
  v_status           text;
  v_key              text;
begin
  -- RPC-created attempts and server-authored forfeiture rows already carry a
  -- server clock; never re-grade or deadline-check them here.
  if coalesce(current_setting('app.assessment_rpc', true), '') = 'on' then
    return new;
  end if;

  if new.status = 'in_progress' and new.deadline_at is not null then
    return new;
  end if;

  v_key := case when v_kind = 'quiz' then 'quizId' else 'examId' end;
  v_config := public.assessment_config(v_kind, new.program_id, new.data->>v_key);

  if v_config is null then
    -- Unknown/legacy assessment: keep the old behaviour, but stamp the row.
    new.submitted_at := coalesce(new.submitted_at, now());
    new.status := coalesce(nullif(new.status, ''), 'graded');
    return new;
  end if;

  if v_kind = 'quiz' then
    select qs.started_at, qs.deadline_at
      into v_session_started, v_session_deadline
    from public.quiz_sessions qs
    where qs.trainee_id = new.trainee_id
      and qs.quiz_id = new.data->>'quizId'
    order by qs.created_at desc
    limit 1;

    v_started := coalesce(
      v_session_started,
      nullif(new.data->>'startedAt', '')::timestamptz,
      now()
    );
  else
    -- Exams have no session row: the browser's start stamp is the clock.
    v_started := coalesce(
      nullif(new.data->>'startedAt', '')::timestamptz,
      now()
    );
  end if;

  if v_started > now() then
    v_started := now();
  end if;

  v_limit := public.assessment_time_limit(v_kind, v_config);

  if v_kind = 'quiz' then
    v_deadline := coalesce(v_session_deadline, v_started + make_interval(secs => v_limit));
  else
    v_deadline := v_started + make_interval(secs => v_limit);
  end if;

  -- 30 seconds of transport tolerance for a submission that left the browser
  -- at 00:00. Anything later is refused; the attempt is not reopened.
  if now() > v_deadline + interval '30 seconds' then
    raise exception 'The assessment deadline has passed. This attempt cannot be accepted.'
      using errcode = 'check_violation';
  end if;

  v_grade := public.grade_assessment(v_kind, v_config, new.data->'answers');
  v_auto := now() >= v_deadline;
  v_status := case when v_auto then 'auto_submitted' else 'submitted' end;

  new.started_at := v_started;
  new.deadline_at := v_deadline;
  new.submitted_at := now();
  new.time_limit_seconds := v_limit;
  new.status := v_status;
  new.auto_submitted := v_auto;
  new.score := (v_grade->>'score')::int;
  new.total_questions := (v_grade->>'total')::int;
  new.answered_questions := (v_grade->>'answered')::int;
  new.correct_answers := (v_grade->>'correct')::int;
  new.incorrect_answers := (v_grade->>'incorrect')::int;
  new.unanswered_questions := (v_grade->>'unanswered')::int;
  new.percentage := (v_grade->>'percentage')::numeric;
  new.updated_at := now();

  new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object(
    'score', new.score,
    'total', new.total_questions,
    'percentage', new.percentage,
    'passed', new.percentage >= coalesce(nullif(v_config->>'passing', '')::numeric, 75),
    'answers', v_grade->'answers',
    'status', v_status,
    'startedAt', to_jsonb(v_started),
    'deadlineAt', to_jsonb(v_deadline),
    'submittedAt', to_jsonb(now()),
    'autoSubmitted', v_auto
  );

  return new;
end;
$$;

comment on function public.grade_legacy_attempt() is
  'BEFORE INSERT grading for legacy single-shot quiz/exam submissions. Session clock read into scalars so the exam branch never touches an unassigned record.';
