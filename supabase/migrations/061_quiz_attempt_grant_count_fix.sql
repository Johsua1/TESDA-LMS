-- ---------------------------------------------------------------------------
-- 061_quiz_attempt_grant_count_fix.sql
--
-- A trainee who was approved for a retake was locked out with
--   "Quiz already attempted. Trainer approval is required for another attempt."
-- even though the trainer had just approved the retake.
--
-- Cause: the old gate trusted quiz_requests.data->>'attemptsUsed'. That counter
-- is written by the browser (recordQuizAttempt increments it optimistically),
-- so a submission whose attempt row never reached the table still burned the
-- approval. The counter then said "used" while no attempt existed, and every
-- later submission was rejected.
--
-- The gate now counts what actually exists:
--   allowed attempts = 1 (first attempt) + number of approved requests
-- so a counter that drifted can never lock a trainee out again. The counter is
-- still maintained for the UI, but it is no longer the gate.
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
  v_grants      int;
  v_spare       boolean;
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

  -- 2) How many attempts already exist, and how many were granted.
  select count(*) into v_attempts
  from public.quiz_attempts
  where trainee_id = new.trainee_id
    and data->>'quizId' = new.data->>'quizId'
    and id <> new.id;

  select count(*) into v_grants
  from public.quiz_requests
  where trainee_id = new.trainee_id
    and quiz_id = new.data->>'quizId'
    and status = 'approved';

  -- One attempt is always allowed; every approval adds exactly one more.
  if v_attempts >= 1 + v_grants then
    raise exception 'Quiz already attempted. Trainer approval is required for another attempt.'
      using errcode = 'check_violation';
  end if;

  -- A spare approval is what makes a submission valid outside the trainer's
  -- window: a "late access" grant is issued when the deadline passed with no
  -- attempt (v_attempts = 0), a retake grant after the first attempt. Attempts
  -- beyond the free first one each spend one grant.
  v_spare := v_grants > greatest(0, v_attempts - 1);

  -- 3) Keep the display counter in step: mark one unused approval as used.
  --    It is informational only — the count above is what authorises the row.
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
  end if;

  -- 4) Without a spare approval the attempt must fall inside the trainer's
  --    window. Schedule fields are wall-clock times for the training centre, so
  --    compare against Philippine time. Judge it at the moment the trainee
  --    pressed Start, so a quiz that runs past the deadline still submits.
  if v_spare then
    return new;
  end if;

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
-- Data repair: rebuild the display counter from the attempts that exist.
-- A request whose counter claims an attempt that was never stored is reset, so
-- the trainee's "approved attempt" banner and the gate agree again.
-- ---------------------------------------------------------------------------
update public.quiz_requests qr
   set data = jsonb_set(
         qr.data,
         '{attemptsUsed}',
         to_jsonb(
           least(
             coalesce((qr.data->>'attemptsGranted')::int, 1),
             (
               select count(*)
               from public.quiz_attempts qa
               where qa.trainee_id = qr.trainee_id
                 and qa.data->>'quizId' = qr.quiz_id
                 and qa.created_at >= coalesce((qr.data->>'decidedAt')::timestamptz, qr.created_at)
             )
           )
         )
       )
 where qr.status = 'approved'
   and coalesce((qr.data->>'attemptsUsed')::int, 0) <> least(
         coalesce((qr.data->>'attemptsGranted')::int, 1),
         (
           select count(*)
           from public.quiz_attempts qa
           where qa.trainee_id = qr.trainee_id
             and qa.data->>'quizId' = qr.quiz_id
             and qa.created_at >= coalesce((qr.data->>'decidedAt')::timestamptz, qr.created_at)
         )
       );
