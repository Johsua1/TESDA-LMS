-- ============================================================================
-- 046_timed_assessment_functions.sql
-- ----------------------------------------------------------------------------
-- Server-authoritative start / save / finalize / retrieve for timed quizzes
-- and exams, plus the compatibility triggers used by the existing frontend.
--
-- Design:
--   * The attempt row owns the clock (started_at, deadline_at, status).
--   * The deadline is issued by the database, never accepted from the client.
--   * Answers are persisted one row per question while the attempt is live.
--   * Finalization locks the attempt, grades only persisted answers, counts
--     unanswered questions as zero, and is idempotent.
--   * The legacy single-shot submission still works: a BEFORE INSERT trigger
--     replaces the client's score with a server grade and rejects a payload
--     that arrives after the stored deadline (30 second transport grace).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Configuration helpers
-- ---------------------------------------------------------------------------
create or replace function public.assessment_config(
  p_kind          text,
  p_program_id    text,
  p_assessment_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key   text;
  v_cfg   jsonb;
begin
  if p_kind not in ('quiz', 'exam') then
    raise exception 'Unknown assessment kind: %', p_kind using errcode = '22023';
  end if;

  v_key := case when p_kind = 'quiz' then 'quizzes' else 'exams' end;

  select elem into v_cfg
  from public.programs p
  cross join lateral jsonb_array_elements(coalesce(p.data->v_key, '[]'::jsonb)) elem
  where p.id = p_program_id
    and elem->>'id' = p_assessment_id
  limit 1;

  return v_cfg;
end;
$$;

create or replace function public.assessment_time_limit(p_kind text, p_config jsonb)
returns integer
language plpgsql
immutable
as $$
declare
  v_minutes numeric;
  v_default numeric := case when p_kind = 'exam' then 60 else 30 end;
begin
  v_minutes := nullif(p_config->>'timeLimit', '')::numeric;
  if v_minutes is null or v_minutes <= 0 then
    v_minutes := v_default;
  end if;
  return greatest(60, round(v_minutes * 60))::int;
end;
$$;

create or replace function public.normalize_assessment_answer(p_answer jsonb)
returns text
language sql
immutable
as $$
  select case
    when p_answer is null or jsonb_typeof(p_answer) = 'null' then ''
    when jsonb_typeof(p_answer) = 'string' then lower(btrim(p_answer #>> '{}'))
    else lower(btrim(p_answer::text))
  end
$$;

-- ---------------------------------------------------------------------------
-- Grade a set of answers against the assessment configuration.
-- Accepts either [{questionId, given}] (legacy shape) or {questionId: given}.
-- ---------------------------------------------------------------------------
create or replace function public.grade_assessment(
  p_kind    text,
  p_config  jsonb,
  p_answers jsonb
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_questions     jsonb := coalesce(p_config->'questions', '[]'::jsonb);
  v_total         int := 0;
  v_answered      int := 0;
  v_correct       int := 0;
  v_total_points  numeric := 0;
  v_earned_points numeric := 0;
  v_map           jsonb := '{}'::jsonb;
  v_out           jsonb := '[]'::jsonb;
  v_q             jsonb;
  v_qid           text;
  v_given         jsonb;
  v_given_text    text;
  v_correct_flag  boolean;
  v_points        numeric;
begin
  if jsonb_typeof(p_answers) = 'array' then
    select coalesce(jsonb_object_agg(x->>'questionId', x->'given'), '{}'::jsonb)
    into v_map
    from jsonb_array_elements(p_answers) x
    where coalesce(x->>'questionId', '') <> '';
  elsif jsonb_typeof(p_answers) = 'object' then
    v_map := p_answers;
  end if;

  for v_q in select value from jsonb_array_elements(v_questions)
  loop
    v_qid := v_q->>'id';
    continue when v_qid is null or v_qid = '';

    v_given      := v_map->v_qid;
    v_given_text := public.normalize_assessment_answer(v_given);
    v_points     := coalesce(nullif(v_q->>'points', '')::numeric, 1);

    v_total := v_total + 1;
    v_total_points := v_total_points + v_points;

    if v_given_text <> '' then
      v_answered := v_answered + 1;
    end if;

    v_correct_flag :=
      v_given_text <> ''
      and v_given_text = public.normalize_assessment_answer(v_q->'answer');

    if v_correct_flag then
      v_correct := v_correct + 1;
      v_earned_points := v_earned_points + v_points;
    end if;

    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'questionId', v_qid,
        'given', coalesce(v_given, 'null'::jsonb),
        'correct', v_correct_flag
      )
    );
  end loop;

  return jsonb_build_object(
    'total', v_total,
    'answered', v_answered,
    'correct', v_correct,
    'incorrect', greatest(v_answered - v_correct, 0),
    'unanswered', greatest(v_total - v_answered, 0),
    'score', v_correct,
    'percentage', case
      when v_total_points > 0 then round(v_earned_points * 100.0 / v_total_points, 2)
      else 0
    end,
    'points_earned', v_earned_points,
    'total_points', v_total_points,
    'answers', v_out
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal state reader
-- ---------------------------------------------------------------------------
create or replace function public._assessment_state(p_kind text, p_attempt_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table   text;
  v_a       record;
  v_key     text;
  v_remain  int;
  v_payload jsonb;
begin
  v_table := case when p_kind = 'quiz' then 'quiz_attempts' else 'exam_attempts' end;
  v_key   := case when p_kind = 'quiz' then 'quizId' else 'examId' end;

  execute format('select * from public.%I where id = $1', v_table)
  into v_a
  using p_attempt_id;

  if v_a.id is null then
    return null;
  end if;

  v_remain := case
    when v_a.deadline_at is null then null
    else greatest(0, floor(extract(epoch from (v_a.deadline_at - now()))))::int
  end;

  v_payload := jsonb_build_object(
    'id', v_a.id,
    'kind', p_kind,
    'program_id', v_a.program_id,
    'assessment_id', v_a.data->>v_key,
    'trainee_id', v_a.trainee_id,
    'status', v_a.status,
    'started_at', v_a.started_at,
    'deadline_at', v_a.deadline_at,
    'submitted_at', v_a.submitted_at,
    'time_limit_seconds', v_a.time_limit_seconds,
    'remaining_seconds', v_remain,
    'server_time', now(),
    'score', v_a.score,
    'total_questions', v_a.total_questions,
    'answered_questions', v_a.answered_questions,
    'correct_answers', v_a.correct_answers,
    'incorrect_answers', v_a.incorrect_answers,
    'unanswered_questions', v_a.unanswered_questions,
    'percentage', v_a.percentage,
    'auto_submitted', v_a.auto_submitted
  );

  if v_a.status <> 'in_progress' then
    v_payload := v_payload || jsonb_build_object(
      'passed', coalesce((v_a.data->>'passed')::boolean, false),
      'answers', coalesce(v_a.data->'answers', '[]'::jsonb)
    );
  end if;

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Start (idempotent per trainee + assessment)
-- ---------------------------------------------------------------------------
create or replace function public._start_assessment_attempt(
  p_kind          text,
  p_program_id    text,
  p_assessment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me         text := public.current_profile_id();
  v_table      text;
  v_key        text;
  v_title_key  text;
  v_config     jsonb;
  v_existing   record;
  v_limit      int;
  v_total      int;
  v_id         text;
  v_data       jsonb;
  v_count      int := 0;
  v_grant      text;
  v_start      timestamp;
  v_deadline   timestamp;
  v_now_ph     timestamp := now() at time zone 'Asia/Manila';
  v_enrollment record;
begin
  if p_kind not in ('quiz', 'exam') then
    raise exception 'Unknown assessment kind: %', p_kind using errcode = '22023';
  end if;
  if v_me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  v_table     := case when p_kind = 'quiz' then 'quiz_attempts' else 'exam_attempts' end;
  v_key       := case when p_kind = 'quiz' then 'quizId' else 'examId' end;
  v_title_key := case when p_kind = 'quiz' then 'quizTitle' else 'examTitle' end;

  -- The trainee must have an accessible enrollment for the program.
  select * into v_enrollment
  from public.enrollments
  where trainee_id = v_me
    and program_id = p_program_id
    and status in ('Enrolled', 'Approved', 'Completed')
  order by updated_at desc
  limit 1;

  if not found then
    raise exception 'You are not enrolled in this program.' using errcode = '42501';
  end if;

  v_config := public.assessment_config(p_kind, p_program_id, p_assessment_id);
  if v_config is null then
    raise exception 'Assessment not found.' using errcode = 'P0002';
  end if;
  if not coalesce((v_config->>'published')::boolean, true) then
    raise exception 'This assessment is not published.' using errcode = '42501';
  end if;

  v_total := jsonb_array_length(coalesce(v_config->'questions', '[]'::jsonb));
  if v_total = 0 then
    raise exception 'This assessment has no questions.' using errcode = '22023';
  end if;

  -- Trainer schedule window (Asia/Manila wall clock, same as the UI).
  if nullif(v_config->>'startDate', '') is not null then
    v_start := (v_config->>'startDate')::date
               + coalesce(nullif(v_config->>'startTime', '')::time, time '00:00');
    if v_now_ph < v_start then
      raise exception 'This assessment is not open yet.' using errcode = '42501';
    end if;
  end if;

  if nullif(v_config->>'deadlineDate', '') is not null then
    v_deadline := (v_config->>'deadlineDate')::date
                  + coalesce(nullif(v_config->>'deadlineTime', '')::time, time '23:59:59');
    if v_now_ph > v_deadline then
      raise exception 'The assessment deadline has passed.' using errcode = '42501';
    end if;
  end if;

  -- Return the live attempt instead of creating a second clock.
  execute format(
    'select * from public.%I where trainee_id = $1 and status = ''in_progress'' and data->>$2 = $3 order by started_at desc limit 1',
    v_table
  )
  into v_existing
  using v_me, v_key, p_assessment_id;

  if v_existing.id is not null then
    return public._assessment_state(p_kind, v_existing.id);
  end if;

  if p_kind = 'quiz' then
    execute format(
      'select count(*) from public.%I where trainee_id = $1 and data->>$2 = $3',
      v_table
    )
    into v_count
    using v_me, v_key, p_assessment_id;

    if v_count > 0 then
      select qr.id into v_grant
      from public.quiz_requests qr
      where qr.trainee_id = v_me
        and qr.quiz_id = p_assessment_id
        and qr.status = 'approved'
        and coalesce((qr.data->>'attemptsUsed')::int, 0)
            < coalesce((qr.data->>'attemptsGranted')::int, 1)
      order by qr.created_at desc
      limit 1;

      if v_grant is null then
        raise exception 'Quiz already attempted. Trainer approval is required for another attempt.'
          using errcode = '42501';
      end if;

      update public.quiz_requests
         set data = jsonb_set(
               data,
               '{attemptsUsed}',
               to_jsonb(coalesce((data->>'attemptsUsed')::int, 0) + 1)
             )
       where id = v_grant;
    end if;
  end if;

  v_limit := public.assessment_time_limit(p_kind, v_config);
  v_id    := case when p_kind = 'quiz' then 'qa-' else 'ea-' end
             || replace(gen_random_uuid()::text, '-', '');

  v_data := jsonb_build_object(
    v_key, p_assessment_id,
    'programId', p_program_id,
    v_title_key, v_config->>'title',
    'startedAt', to_jsonb(now()),
    'deadlineAt', to_jsonb(now() + make_interval(secs => v_limit)),
    'status', 'in_progress',
    'answers', '[]'::jsonb,
    'total', v_total,
    'score', 0,
    'percentage', 0,
    'passed', false
  );

  begin
    execute format(
      'insert into public.%I
         (id, trainee_id, program_id, data, started_at, deadline_at, time_limit_seconds,
          status, score, total_questions, answered_questions, unanswered_questions,
          percentage, auto_submitted, created_at, updated_at)
       values ($1, $2, $3, $4, now(), now() + make_interval(secs => $5), $5,
               ''in_progress'', 0, $6, 0, $6, 0, false, now(), now())',
      v_table
    )
    using v_id, v_me, p_program_id, v_data, v_limit, v_total;
  exception when unique_violation then
    execute format(
      'select * from public.%I where trainee_id = $1 and status = ''in_progress'' and data->>$2 = $3 order by started_at desc limit 1',
      v_table
    )
    into v_existing
    using v_me, v_key, p_assessment_id;
    if v_existing.id is not null then
      return public._assessment_state(p_kind, v_existing.id);
    end if;
    raise;
  end;

  return public._assessment_state(p_kind, v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Save one answer (deadline enforced with the server clock)
-- ---------------------------------------------------------------------------
create or replace function public._save_assessment_answer(
  p_kind        text,
  p_attempt_id  text,
  p_question_id text,
  p_answer      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       text := public.current_profile_id();
  v_table    text;
  v_ans      text;
  v_a        record;
  v_config   jsonb;
  v_exists   boolean;
  v_answered int;
  v_remain   int;
begin
  if p_kind not in ('quiz', 'exam') then
    raise exception 'Unknown assessment kind: %', p_kind using errcode = '22023';
  end if;
  if v_me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  v_table := case when p_kind = 'quiz' then 'quiz_attempts' else 'exam_attempts' end;
  v_ans   := case when p_kind = 'quiz' then 'quiz_attempt_answers' else 'exam_attempt_answers' end;

  execute format('select * from public.%I where id = $1 for update', v_table)
  into v_a
  using p_attempt_id;

  if v_a.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  if v_a.trainee_id is distinct from v_me then
    raise exception 'You can only answer your own attempt.' using errcode = '42501';
  end if;

  if v_a.status <> 'in_progress' then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'finalized',
      'attempt', public._assessment_state(p_kind, p_attempt_id)
    );
  end if;

  if v_a.deadline_at is not null and now() >= v_a.deadline_at then
    perform set_config('app.assessment_rpc', 'on', true);
    perform public._finalize_assessment_attempt(p_kind, p_attempt_id, true);
    return jsonb_build_object(
      'accepted', false,
      'reason', 'deadline_passed',
      'attempt', public._assessment_state(p_kind, p_attempt_id)
    );
  end if;

  v_config := public.assessment_config(p_kind, v_a.program_id, v_a.data->>(
    case when p_kind = 'quiz' then 'quizId' else 'examId' end
  ));

  select exists (
    select 1
    from jsonb_array_elements(coalesce(v_config->'questions', '[]'::jsonb)) q
    where q->>'id' = p_question_id
  ) into v_exists;

  if not v_exists then
    raise exception 'That question does not belong to this assessment.' using errcode = '22023';
  end if;

  if p_answer is not null and jsonb_typeof(p_answer) not in ('string', 'number', 'boolean', 'null') then
    raise exception 'Unsupported answer format.' using errcode = '22023';
  end if;

  perform set_config('app.assessment_rpc', 'on', true);

  if p_answer is null
     or jsonb_typeof(p_answer) = 'null'
     or public.normalize_assessment_answer(p_answer) = '' then
    execute format('delete from public.%I where attempt_id = $1 and question_id = $2', v_ans)
    using p_attempt_id, p_question_id;
  else
    execute format(
      'insert into public.%I (attempt_id, question_id, answer, is_correct, answered_at)
       values ($1, $2, $3, null, now())
       on conflict (attempt_id, question_id)
       do update set answer = excluded.answer, is_correct = null, answered_at = now()',
      v_ans
    )
    using p_attempt_id, p_question_id, p_answer;
  end if;

  execute format('select count(*) from public.%I where attempt_id = $1', v_ans)
  into v_answered
  using p_attempt_id;

  execute format(
    'update public.%I set answered_questions = $2, updated_at = now() where id = $1',
    v_table
  )
  using p_attempt_id, v_answered;

  perform set_config('app.assessment_rpc', 'off', true);

  v_remain := case
    when v_a.deadline_at is null then null
    else greatest(0, floor(extract(epoch from (v_a.deadline_at - now()))))::int
  end;

  return jsonb_build_object(
    'accepted', true,
    'attempt_id', p_attempt_id,
    'question_id', p_question_id,
    'answered_questions', v_answered,
    'remaining_seconds', v_remain,
    'status', 'in_progress'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Finalize (idempotent, concurrency-safe)
-- ---------------------------------------------------------------------------
create or replace function public._finalize_assessment_attempt(
  p_kind       text,
  p_attempt_id text,
  p_auto       boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       text := public.current_profile_id();
  v_table    text;
  v_ans      text;
  v_a        record;
  v_config   jsonb;
  v_answers  jsonb := '{}'::jsonb;
  v_grade    jsonb;
  v_auto     boolean;
  v_status   text;
  v_passed   boolean;
  v_patch    jsonb;
begin
  if p_kind not in ('quiz', 'exam') then
    raise exception 'Unknown assessment kind: %', p_kind using errcode = '22023';
  end if;

  v_table := case when p_kind = 'quiz' then 'quiz_attempts' else 'exam_attempts' end;
  v_ans   := case when p_kind = 'quiz' then 'quiz_attempt_answers' else 'exam_attempt_answers' end;

  execute format('select * from public.%I where id = $1 for update', v_table)
  into v_a
  using p_attempt_id;

  if v_a.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  -- Authorization: the owner, the assigned trainer, or a Super Admin. Cron
  -- and service_role calls have no auth.uid() and are allowed.
  if v_me is not null then
    if v_a.trainee_id is distinct from v_me
       and not public.is_super_admin()
       and not public.is_trainer_assigned_to_program(v_a.program_id) then
      raise exception 'You cannot finalize this attempt.' using errcode = '42501';
    end if;
  end if;

  -- Idempotent: a terminal attempt is returned unchanged.
  if v_a.status <> 'in_progress' then
    return public._assessment_state(p_kind, p_attempt_id);
  end if;

  v_config := public.assessment_config(
    p_kind,
    v_a.program_id,
    v_a.data->>(case when p_kind = 'quiz' then 'quizId' else 'examId' end)
  );

  execute format(
    'select coalesce(jsonb_object_agg(question_id, answer), ''{}''::jsonb) from public.%I where attempt_id = $1',
    v_ans
  )
  into v_answers
  using p_attempt_id;

  -- Compatibility: an attempt created outside the RPC flow may carry its
  -- answers in data.answers instead of the answer table.
  if v_answers = '{}'::jsonb
     and jsonb_typeof(v_a.data->'answers') = 'array'
     and jsonb_array_length(v_a.data->'answers') > 0 then
    v_answers := v_a.data->'answers';
  end if;

  v_grade := public.grade_assessment(p_kind, coalesce(v_config, '{}'::jsonb), v_answers);

  v_auto := coalesce(p_auto, v_a.deadline_at is not null and now() >= v_a.deadline_at);
  v_status := case when v_auto then 'auto_submitted' else 'submitted' end;
  v_passed := coalesce((v_grade->>'percentage')::numeric, 0)
              >= coalesce(nullif(v_config->>'passing', '')::numeric, 75);

  v_patch := jsonb_build_object(
    'score', (v_grade->>'score')::int,
    'total', (v_grade->>'total')::int,
    'percentage', (v_grade->>'percentage')::numeric,
    'passed', v_passed,
    'answers', v_grade->'answers',
    'status', v_status,
    'submittedAt', to_jsonb(now()),
    'autoSubmitted', v_auto
  );

  perform set_config('app.assessment_rpc', 'on', true);

  execute format(
    'update public.%I
        set status = $2,
            submitted_at = now(),
            auto_submitted = $3,
            score = $4,
            total_questions = $5,
            answered_questions = $6,
            correct_answers = $7,
            incorrect_answers = $8,
            unanswered_questions = $9,
            percentage = $10,
            updated_at = now(),
            data = coalesce(data, ''{}''::jsonb) || $11
      where id = $1',
    v_table
  )
  using
    p_attempt_id,
    v_status,
    v_auto,
    (v_grade->>'score')::int,
    (v_grade->>'total')::int,
    (v_grade->>'answered')::int,
    (v_grade->>'correct')::int,
    (v_grade->>'incorrect')::int,
    (v_grade->>'unanswered')::int,
    (v_grade->>'percentage')::numeric,
    v_patch;

  perform set_config('app.assessment_rpc', 'off', true);

  return public._assessment_state(p_kind, p_attempt_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Retrieve (auto-finalizes an expired live attempt)
-- ---------------------------------------------------------------------------
create or replace function public._get_assessment_attempt(p_kind text, p_attempt_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me     text := public.current_profile_id();
  v_table  text;
  v_a      record;
begin
  v_table := case when p_kind = 'quiz' then 'quiz_attempts' else 'exam_attempts' end;

  execute format('select * from public.%I where id = $1', v_table)
  into v_a
  using p_attempt_id;

  if v_a.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  if v_me is not null
     and v_a.trainee_id is distinct from v_me
     and not public.is_super_admin()
     and not public.is_trainer_assigned_to_program(v_a.program_id) then
    raise exception 'You cannot view this attempt.' using errcode = '42501';
  end if;

  if v_a.status = 'in_progress'
     and v_a.deadline_at is not null
     and now() >= v_a.deadline_at then
    return public._finalize_assessment_attempt(p_kind, p_attempt_id, true);
  end if;

  return public._assessment_state(p_kind, p_attempt_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------
create or replace function public.start_quiz_attempt(p_program_id text, p_quiz_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._start_assessment_attempt('quiz', p_program_id, p_quiz_id) $$;

create or replace function public.save_quiz_answer(p_attempt_id text, p_question_id text, p_answer jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select public._save_assessment_answer('quiz', p_attempt_id, p_question_id, p_answer) $$;

create or replace function public.finalize_quiz_attempt(p_attempt_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._finalize_assessment_attempt('quiz', p_attempt_id, null) $$;

create or replace function public.get_quiz_attempt(p_attempt_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._get_assessment_attempt('quiz', p_attempt_id) $$;

create or replace function public.start_exam_attempt(p_program_id text, p_exam_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._start_assessment_attempt('exam', p_program_id, p_exam_id) $$;

create or replace function public.save_exam_answer(p_attempt_id text, p_question_id text, p_answer jsonb)
returns jsonb language sql security definer set search_path = public
as $$ select public._save_assessment_answer('exam', p_attempt_id, p_question_id, p_answer) $$;

create or replace function public.finalize_exam_attempt(p_attempt_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._finalize_assessment_attempt('exam', p_attempt_id, null) $$;

create or replace function public.get_exam_attempt(p_attempt_id text)
returns jsonb language sql security definer set search_path = public
as $$ select public._get_assessment_attempt('exam', p_attempt_id) $$;

-- ---------------------------------------------------------------------------
-- Compatibility trigger: grade legacy single-shot submissions on insert.
-- The existing QuizRunner/ExamRunner send the whole attempt once. The server
-- replaces score/percentage/answers with its own grade and enforces the
-- deadline derived from the quiz session (quiz) or the recorded startedAt.
-- ---------------------------------------------------------------------------
create or replace function public.grade_legacy_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind     text := tg_argv[0];
  v_config   jsonb;
  v_session  record;
  v_started  timestamptz;
  v_deadline timestamptz;
  v_limit    int;
  v_grade    jsonb;
  v_auto     boolean;
  v_status   text;
  v_key      text;
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
    select * into v_session
    from public.quiz_sessions
    where trainee_id = new.trainee_id
      and quiz_id = new.data->>'quizId'
    order by created_at desc
    limit 1;

    v_started := coalesce(
      v_session.started_at,
      nullif(new.data->>'startedAt', '')::timestamptz,
      now()
    );
  else
    v_started := coalesce(
      nullif(new.data->>'startedAt', '')::timestamptz,
      now()
    );
  end if;

  if v_started > now() then
    v_started := now();
  end if;

  v_limit := public.assessment_time_limit(v_kind, v_config);
  v_deadline := case
    when v_kind = 'quiz' and v_session.deadline_at is not null then v_session.deadline_at
    else v_started + make_interval(secs => v_limit)
  end;

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

drop trigger if exists quiz_attempts_grade_legacy on public.quiz_attempts;
create trigger quiz_attempts_grade_legacy
  before insert on public.quiz_attempts
  for each row execute function public.grade_legacy_attempt('quiz');

drop trigger if exists exam_attempts_grade_legacy on public.exam_attempts;
create trigger exam_attempts_grade_legacy
  before insert on public.exam_attempts
  for each row execute function public.grade_legacy_attempt('exam');

-- The session has served its purpose once the attempt is stored.
create or replace function public.clear_quiz_session_after_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'in_progress' then
    delete from public.quiz_sessions
    where trainee_id = new.trainee_id
      and quiz_id = new.data->>'quizId';
  end if;
  return new;
end;
$$;

drop trigger if exists quiz_attempts_clear_session on public.quiz_attempts;
create trigger quiz_attempts_clear_session
  after insert on public.quiz_attempts
  for each row execute function public.clear_quiz_session_after_attempt();

-- ---------------------------------------------------------------------------
-- Immutability: clients may re-send an attempt (idempotent retry), but the
-- trigger forces every protected field back to its stored value. Only the
-- SECURITY DEFINER RPCs set app.assessment_rpc to 'on'.
-- ---------------------------------------------------------------------------
create or replace function public.protect_assessment_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.assessment_rpc', true), '') = 'on' then
    new.updated_at := now();
    return new;
  end if;

  new.id := old.id;
  new.trainee_id := old.trainee_id;
  new.program_id := old.program_id;
  new.data := old.data;
  new.started_at := old.started_at;
  new.deadline_at := old.deadline_at;
  new.submitted_at := old.submitted_at;
  new.time_limit_seconds := old.time_limit_seconds;
  new.status := old.status;
  new.score := old.score;
  new.total_questions := old.total_questions;
  new.answered_questions := old.answered_questions;
  new.correct_answers := old.correct_answers;
  new.incorrect_answers := old.incorrect_answers;
  new.unanswered_questions := old.unanswered_questions;
  new.percentage := old.percentage;
  new.auto_submitted := old.auto_submitted;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quiz_attempts_protect on public.quiz_attempts;
create trigger quiz_attempts_protect
  before update on public.quiz_attempts
  for each row execute function public.protect_assessment_attempt();

drop trigger if exists exam_attempts_protect on public.exam_attempts;
create trigger exam_attempts_protect
  before update on public.exam_attempts
  for each row execute function public.protect_assessment_attempt();

-- ---------------------------------------------------------------------------
-- quiz_sessions clock (server-owned)
-- ---------------------------------------------------------------------------
create or replace function public.set_quiz_session_clock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_limit  int;
  v_reset  boolean := false;
begin
  v_config := public.assessment_config('quiz', new.program_id, new.quiz_id);
  v_limit  := public.assessment_time_limit('quiz', coalesce(v_config, '{}'::jsonb));

  if tg_op = 'INSERT' then
    new.started_at := now();
    new.deadline_at := now() + make_interval(secs => v_limit);
    new.time_limit_seconds := v_limit;
    new.timer_version := 2;
    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object(
      'startedAt', to_jsonb(new.started_at),
      'deadlineAt', to_jsonb(new.deadline_at),
      'timeLimitSeconds', v_limit
    );
    return new;
  end if;

  if new.trainee_id is distinct from old.trainee_id
     or new.program_id is distinct from old.program_id
     or new.quiz_id is distinct from old.quiz_id then
    raise exception 'A quiz session cannot be moved to another trainee or quiz.'
      using errcode = '42501';
  end if;

  -- A fresh clock is allowed only when the previous one already expired, or
  -- when the trainer granted another attempt.
  v_reset := old.deadline_at is null
             or now() >= old.deadline_at
             or exists (
               select 1 from public.quiz_requests qr
               where qr.trainee_id = old.trainee_id
                 and qr.quiz_id = old.quiz_id
                 and qr.status = 'approved'
                 and coalesce((qr.data->>'attemptsUsed')::int, 0)
                     < coalesce((qr.data->>'attemptsGranted')::int, 1)
             );

  if v_reset then
    new.started_at := now();
    new.deadline_at := now() + make_interval(secs => v_limit);
    new.time_limit_seconds := v_limit;
    new.timer_version := 2;
  else
    new.started_at := old.started_at;
    new.deadline_at := old.deadline_at;
    new.time_limit_seconds := old.time_limit_seconds;
    new.timer_version := old.timer_version;
  end if;

  new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object(
    'startedAt', to_jsonb(new.started_at),
    'deadlineAt', to_jsonb(new.deadline_at),
    'timeLimitSeconds', new.time_limit_seconds
  );

  return new;
end;
$$;

drop trigger if exists quiz_sessions_clock on public.quiz_sessions;
create trigger quiz_sessions_clock
  before insert or update on public.quiz_sessions
  for each row execute function public.set_quiz_session_clock();

-- ---------------------------------------------------------------------------
-- Server-side session state (used by the frontend on refresh if it wants the
-- authoritative remaining time).
-- ---------------------------------------------------------------------------
create or replace function public.get_quiz_session_state(p_program_id text, p_quiz_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me      text := public.current_profile_id();
  v_session record;
  v_config  jsonb;
begin
  if v_me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_session
  from public.quiz_sessions
  where trainee_id = v_me and quiz_id = p_quiz_id
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('exists', false, 'server_time', now());
  end if;

  v_config := public.assessment_config('quiz', p_program_id, p_quiz_id);

  return jsonb_build_object(
    'exists', true,
    'id', v_session.id,
    'program_id', v_session.program_id,
    'quiz_id', v_session.quiz_id,
    'started_at', v_session.started_at,
    'deadline_at', v_session.deadline_at,
    'time_limit_seconds', v_session.time_limit_seconds,
    'remaining_seconds', greatest(0, floor(extract(epoch from (v_session.deadline_at - now()))))::int,
    'expired', now() >= v_session.deadline_at,
    'server_time', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.assessment_config(text, text, text) from public, anon, authenticated;
revoke all on function public.assessment_time_limit(text, jsonb) from public, anon, authenticated;
revoke all on function public.normalize_assessment_answer(jsonb) from public, anon, authenticated;
revoke all on function public.grade_assessment(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public._assessment_state(text, text) from public, anon, authenticated;
revoke all on function public._start_assessment_attempt(text, text, text) from public, anon, authenticated;
revoke all on function public._save_assessment_answer(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public._finalize_assessment_attempt(text, text, boolean) from public, anon, authenticated;
revoke all on function public._get_assessment_attempt(text, text) from public, anon, authenticated;

revoke all on function public.start_quiz_attempt(text, text) from public, anon;
revoke all on function public.save_quiz_answer(text, text, jsonb) from public, anon;
revoke all on function public.finalize_quiz_attempt(text) from public, anon;
revoke all on function public.get_quiz_attempt(text) from public, anon;
revoke all on function public.start_exam_attempt(text, text) from public, anon;
revoke all on function public.save_exam_answer(text, text, jsonb) from public, anon;
revoke all on function public.finalize_exam_attempt(text) from public, anon;
revoke all on function public.get_exam_attempt(text) from public, anon;
revoke all on function public.get_quiz_session_state(text, text) from public, anon;

grant execute on function public.start_quiz_attempt(text, text) to authenticated;
grant execute on function public.save_quiz_answer(text, text, jsonb) to authenticated;
grant execute on function public.finalize_quiz_attempt(text) to authenticated;
grant execute on function public.get_quiz_attempt(text) to authenticated;
grant execute on function public.start_exam_attempt(text, text) to authenticated;
grant execute on function public.save_exam_answer(text, text, jsonb) to authenticated;
grant execute on function public.finalize_exam_attempt(text) to authenticated;
grant execute on function public.get_exam_attempt(text) to authenticated;
grant execute on function public.get_quiz_session_state(text, text) to authenticated;
