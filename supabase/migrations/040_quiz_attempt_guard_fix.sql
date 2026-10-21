-- ---------------------------------------------------------------------------
-- 040_quiz_attempt_guard_fix.sql
-- Fixes the quiz_attempts gate so a legitimate submission is never rejected
-- while the result is still shown to the trainee.
--
-- Problems with the previous version:
--   * an upsert that re-sent an attempt already stored (a retry, or a client
--     that re-syncs) was re-checked and failed with "already attempted";
--   * when the row carried no startedAt the gate fell back to now(), so a quiz
--     started inside the window but submitted later was rejected with
--     "deadline has passed" — the trainee saw the result on screen and an error
--     toast at the same time;
--   * the gate never looked at quiz_sessions, which is the record of when the
--     attempt actually started.
--
-- The rule is now: an attempt is accepted when
--   1. the exact attempt row already exists (idempotent retry), or
--   2. an unused trainer approval exists (consumed atomically), or
--   3. it is the trainee's first attempt and the start time — taken from the
--      row, then the open session, then now() — is inside the window.
--
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_quiz_attempt_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz        jsonb;
  v_attempts    int;
  v_grant_id    text;
  v_start       timestamp;
  v_deadline    timestamp;
  v_at          timestamp;
  v_session_at  timestamptz;
begin
  -- 1) Re-sending an attempt that is already stored: nothing to enforce.
  if exists (select 1 from public.quiz_attempts where id = new.id) then
    return new;
  end if;

  -- Quiz configuration lives inside programs.data->'quizzes'.
  select elem into v_quiz
  from public.programs p
  cross join lateral jsonb_array_elements(coalesce(p.data->'quizzes', '[]'::jsonb)) elem
  where p.id = new.program_id
    and elem->>'id' = new.data->>'quizId'
  limit 1;

  -- Unknown/legacy quiz: nothing to enforce.
  if v_quiz is null then
    return new;
  end if;

  -- 2) An approved request grants exactly one attempt; consume it atomically.
  select qr.id into v_grant_id
  from public.quiz_requests qr
  where qr.trainee_id = new.trainee_id
    and qr.quiz_id = new.data->>'quizId'
    and qr.status = 'approved'
    and coalesce((qr.data->>'attemptsUsed')::int, 0)
        < coalesce((qr.data->>'attemptsGranted')::int, 1)
  order by qr.created_at desc
  limit 1;

  if v_grant_id is not null then
    update public.quiz_requests
       set data = jsonb_set(
             data,
             '{attemptsUsed}',
             to_jsonb(coalesce((data->>'attemptsUsed')::int, 0) + 1)
           )
     where id = v_grant_id;
    return new;
  end if;

  -- 3) Otherwise only the first attempt, inside the scheduled window, is valid.
  select count(*) into v_attempts
  from public.quiz_attempts
  where trainee_id = new.trainee_id
    and data->>'quizId' = new.data->>'quizId'
    and id <> new.id;

  if v_attempts > 0 then
    raise exception 'Quiz already attempted. Trainer approval is required for another attempt.'
      using errcode = 'check_violation';
  end if;

  -- Schedule fields are wall-clock times for the training centre, so compare
  -- against Philippine time rather than the database's UTC clock.
  -- Judge the attempt at the moment the trainee pressed Start, so a quiz that
  -- runs past the deadline still submits. When the row carries no start time
  -- fall back to the open session, and only then to now().
  select nullif(s.data->>'startedAt', '')::timestamptz into v_session_at
  from public.quiz_sessions s
  where s.trainee_id = new.trainee_id
    and s.quiz_id = new.data->>'quizId'
  order by s.created_at desc
  limit 1;

  v_at := coalesce(
    nullif(new.data->>'startedAt', '')::timestamptz at time zone 'Asia/Manila',
    v_session_at at time zone 'Asia/Manila',
    now() at time zone 'Asia/Manila'
  );

  if nullif(v_quiz->>'startDate', '') is not null then
    v_start := (v_quiz->>'startDate')::date
               + coalesce(nullif(v_quiz->>'startTime', '')::time, time '00:00');
    if v_at < v_start then
      raise exception 'Quiz is not open yet.' using errcode = 'check_violation';
    end if;
  end if;

  if nullif(v_quiz->>'deadlineDate', '') is not null then
    v_deadline := (v_quiz->>'deadlineDate')::date
                  + coalesce(nullif(v_quiz->>'deadlineTime', '')::time, time '23:59:59');
    if v_at > v_deadline then
      raise exception 'Quiz deadline has passed. Request late access from your trainer.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists quiz_attempts_access_guard on public.quiz_attempts;
create trigger quiz_attempts_access_guard
  before insert on public.quiz_attempts
  for each row execute function public.enforce_quiz_attempt_access();

-- ---------------------------------------------------------------------------
-- Data repair: an approval marked as used whose submission never landed left
-- the trainee with no attempt and no remaining grant. Give the attempt back.
-- ---------------------------------------------------------------------------
update public.quiz_requests qr
   set data = jsonb_set(qr.data, '{attemptsUsed}', '0'::jsonb)
 where qr.status = 'approved'
   and coalesce((qr.data->>'attemptsUsed')::int, 0) > 0
   and not exists (
     select 1 from public.quiz_attempts qa
      where qa.trainee_id = qr.trainee_id
        and qa.data->>'quizId' = qr.quiz_id
   );
