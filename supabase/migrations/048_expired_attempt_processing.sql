-- ============================================================================
-- 048_expired_attempt_processing.sql
-- ----------------------------------------------------------------------------
-- Deadline enforcement when nobody is looking at the page.
--
--   1. finalize_expired_attempts() grades RPC-created live attempts whose
--      deadline has passed.
--   2. finalize_expired_quiz_sessions() closes legacy quiz sessions that
--      expired without a submission and records a zero-score forfeited
--      attempt, so the trainee cannot restart the clock by refreshing.
--   3. process_expired_assessments() runs both.
--
-- Schedule it with pg_cron when available. On a Supabase project where pg_cron
-- is not enabled, enable it in Database > Extensions and re-run this file, or
-- call process_expired_assessments() from an external scheduler every minute.
-- The retrieve/save/finalize RPCs also enforce the deadline on access, so the
-- scheduler is a safety net, not the only line of defence.
-- ============================================================================

create or replace function public.finalize_expired_attempts(p_limit int default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   record;
  v_count int := 0;
  v_limit int := least(greatest(coalesce(p_limit, 200), 1), 1000);
begin
  for v_row in
    select kind, id
    from (
      select 'quiz'::text as kind, id, deadline_at
      from public.quiz_attempts
      where status = 'in_progress'
        and deadline_at is not null
        and deadline_at < now()
      union all
      select 'exam'::text as kind, id, deadline_at
      from public.exam_attempts
      where status = 'in_progress'
        and deadline_at is not null
        and deadline_at < now()
    ) expired
    order by deadline_at asc
    limit v_limit
  loop
    perform set_config('app.assessment_rpc', 'on', true);
    perform public._finalize_assessment_attempt(v_row.kind, v_row.id, true);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.finalize_expired_quiz_sessions(p_limit int default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_config  jsonb;
  v_total   int;
  v_limit   int := least(greatest(coalesce(p_limit, 200), 1), 1000);
  v_count   int := 0;
  v_id      text;
  v_attempts int;
  v_data    jsonb;
begin
  for v_session in
    select *
    from public.quiz_sessions
    where timer_version >= 2
      and deadline_at is not null
      and deadline_at < now() - interval '2 minutes'
    order by deadline_at asc
    limit v_limit
    for update skip locked
  loop
    -- If the trainee did submit, the AFTER INSERT trigger should already have
    -- removed the session. Clean up a leftover row and move on.
    select count(*) into v_attempts
    from public.quiz_attempts
    where trainee_id = v_session.trainee_id
      and data->>'quizId' = v_session.quiz_id;

    if v_attempts > 0 then
      delete from public.quiz_sessions where id = v_session.id;
      continue;
    end if;

    v_config := public.assessment_config('quiz', v_session.program_id, v_session.quiz_id);
    v_total  := jsonb_array_length(coalesce(v_config->'questions', '[]'::jsonb));
    v_id     := 'qa-' || replace(gen_random_uuid()::text, '-', '');

    v_data := jsonb_build_object(
      'quizId', v_session.quiz_id,
      'quizTitle', v_config->>'title',
      'programId', v_session.program_id,
      'startedAt', to_jsonb(v_session.started_at),
      'deadlineAt', to_jsonb(v_session.deadline_at),
      'submittedAt', to_jsonb(now()),
      'autoSubmitted', true,
      'status', 'auto_submitted',
      'answers', '[]'::jsonb,
      'score', 0,
      'total', v_total,
      'percentage', 0,
      'passed', false
    );

    -- The insert is server-authored; the compatibility trigger must not try
    -- to re-grade it or reject it for being late.
    perform set_config('app.assessment_rpc', 'on', true);

    insert into public.quiz_attempts (
      id, trainee_id, program_id, data,
      started_at, deadline_at, submitted_at, time_limit_seconds,
      status, score, total_questions, answered_questions,
      correct_answers, incorrect_answers, unanswered_questions,
      percentage, auto_submitted, created_at, updated_at
    )
    values (
      v_id, v_session.trainee_id, v_session.program_id, v_data,
      v_session.started_at, v_session.deadline_at, now(), v_session.time_limit_seconds,
      'auto_submitted', 0, v_total, 0,
      0, 0, v_total,
      0, true, now(), now()
    );

    delete from public.quiz_sessions where id = v_session.id;
    perform set_config('app.assessment_rpc', 'off', true);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.process_expired_assessments()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
  v_sessions int;
begin
  v_attempts := public.finalize_expired_attempts(200);
  v_sessions := public.finalize_expired_quiz_sessions(200);
  return jsonb_build_object(
    'finalized_attempts', v_attempts,
    'finalized_sessions', v_sessions,
    'processed_at', now()
  );
end;
$$;

revoke all on function public.finalize_expired_attempts(int) from public, anon, authenticated;
revoke all on function public.finalize_expired_quiz_sessions(int) from public, anon, authenticated;
revoke all on function public.process_expired_assessments() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.finalize_expired_attempts(int) to service_role;
    grant execute on function public.finalize_expired_quiz_sessions(int) to service_role;
    grant execute on function public.process_expired_assessments() to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Optional pg_cron schedule (every minute).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
    exception when others then
      raise notice 'pg_cron could not be enabled automatically: %', sqlerrm;
    end;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      if exists (select 1 from cron.job where jobname = 'process-expired-assessments') then
        perform cron.unschedule('process-expired-assessments');
      end if;
      perform cron.schedule(
        'process-expired-assessments',
        '* * * * *',
        'select public.process_expired_assessments();'
      );
      raise notice 'Scheduled process-expired-assessments every minute.';
    exception when others then
      raise notice 'Could not create the pg_cron job: %', sqlerrm;
    end;
  else
    raise notice 'pg_cron is not enabled. Enable it in Database > Extensions and re-run 048, or call process_expired_assessments() from an external scheduler.';
  end if;
end $$;
