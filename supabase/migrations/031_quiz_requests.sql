-- ============================================================================
-- 031_quiz_requests.sql
-- Quiz scheduling + attempt approvals.
--   * quiz_requests: one row per trainee request (retake or late access),
--     approved/rejected by the trainer of that program.
--   * trigger on quiz_attempts: a row can only be written when the trainee is
--     inside the quiz window on their first attempt, or holds an unused
--     approved request. This is the server-side gate behind the UI.
-- Safe to re-run.
-- ============================================================================

-- Helper bodies are validated on first call, not at creation time, so this
-- migration also works on a database where some tables arrive later.
set check_function_bodies = false;

-- ---------------------------------------------------------------------------
-- Compatibility: a few deployments were bootstrapped from an older schema that
-- predates the helper functions in 017_functions.sql. Create the three helpers
-- this migration needs when they are missing, but never overwrite an existing
-- definition (those include the stricter status/is_activated checks).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.current_profile_id()') is null then
    execute $fn$
      create function public.current_profile_id()
      returns text
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select id from public.profiles where auth_user_id = auth.uid() limit 1
      $body$;
    $fn$;
  end if;

  if to_regprocedure('public.is_super_admin()') is null then
    execute $fn$
      create function public.is_super_admin()
      returns boolean
      language sql
      stable
      security definer
      set search_path = public
      as $body$
        select exists (
          select 1 from public.profiles
           where auth_user_id = auth.uid()
             and role in ('admin', 'super_admin')
        )
      $body$;
    $fn$;
  end if;

  if to_regprocedure('public.is_trainer_assigned_to_program(text)') is null then
    execute $fn$
      create function public.is_trainer_assigned_to_program(p_program_id text)
      returns boolean
      language plpgsql
      stable
      security definer
      set search_path = public
      as $body$
      begin
        if to_regclass('public.trainer_programs') is not null and exists (
          select 1
            from public.trainer_programs tp
           where tp.trainer_id = public.current_profile_id()
             and tp.program_id = p_program_id
             and tp.status = 'active'
        ) then
          return true;
        end if;

        return exists (
          select 1
            from public.programs p
           where p.id = p_program_id
             and p.trainer_id = public.current_profile_id()
        );
      end
      $body$;
    $fn$;
  end if;
end $$;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_trainer_assigned_to_program(text) to authenticated;

create table if not exists public.quiz_requests (
  id         text primary key,
  trainee_id text not null,
  program_id text not null,
  quiz_id    text not null,
  status     text not null default 'pending',
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quiz_requests_trainee_quiz_idx
  on public.quiz_requests (trainee_id, quiz_id);

-- A trainee can only have one open request per quiz.
create unique index if not exists quiz_requests_one_pending
  on public.quiz_requests (trainee_id, quiz_id)
  where status = 'pending';

alter table public.quiz_requests enable row level security;

drop policy if exists quiz_requests_select on public.quiz_requests;
create policy quiz_requests_select on public.quiz_requests
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );

drop policy if exists quiz_requests_insert on public.quiz_requests;
create policy quiz_requests_insert on public.quiz_requests
  for insert to authenticated
  with check (
    trainee_id = public.current_profile_id()
    and status = 'pending'
  );

-- Trainees may touch their own row so the client can mirror the attempt
-- counter; the trigger below blocks every other field change.
drop policy if exists quiz_requests_update on public.quiz_requests;
create policy quiz_requests_update on public.quiz_requests
  for update to authenticated
  using (
    trainee_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  )
  with check (
    trainee_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );

-- A trainee can only increment attemptsUsed; status/decision fields stay under
-- the trainer's control.
create or replace function public.protect_quiz_request_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() or public.is_trainer_assigned_to_program(old.program_id) then
    return new;
  end if;

  if new.trainee_id is distinct from old.trainee_id
     or new.program_id is distinct from old.program_id
     or new.quiz_id is distinct from old.quiz_id
     or new.status is distinct from old.status
     or (new.data - 'attemptsUsed') is distinct from (old.data - 'attemptsUsed') then
    raise exception 'Only the assigned trainer can decide a quiz request.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists quiz_requests_protect_decision on public.quiz_requests;
create trigger quiz_requests_protect_decision
  before update on public.quiz_requests
  for each row execute function public.protect_quiz_request_decision();

drop policy if exists quiz_requests_delete on public.quiz_requests;
create policy quiz_requests_delete on public.quiz_requests
  for delete to authenticated
  using (
    public.is_super_admin()
    or trainee_id = public.current_profile_id()
  );

grant select, insert, update, delete on public.quiz_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Attempt gate
-- The trigger lives on quiz_attempts; create the table when the base schema has
-- not been applied yet (same shape as schema.sql).
-- ---------------------------------------------------------------------------
create table if not exists public.quiz_attempts (
  id         text primary key,
  trainee_id text,
  program_id text,
  data       jsonb not null default '{}'::jsonb
);

create or replace function public.enforce_quiz_attempt_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz      jsonb;
  v_attempts  int;
  v_grant_id  text;
  v_start     timestamp;
  v_deadline  timestamp;
  v_at        timestamp;
begin
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

  -- 1) An approved request grants exactly one attempt; consume it atomically.
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

  -- 2) Otherwise only the first attempt, inside the scheduled window, is valid.
  select count(*) into v_attempts
  from public.quiz_attempts
  where trainee_id = new.trainee_id
    and data->>'quizId' = new.data->>'quizId';

  if v_attempts > 0 then
    raise exception 'Quiz already attempted. Trainer approval is required for another attempt.'
      using errcode = 'check_violation';
  end if;

  -- Schedule fields are wall-clock times for the training centre, so compare
  -- against Philippine time rather than the database's UTC clock.
  -- Judge the attempt at the moment the trainee pressed Start, so a quiz that
  -- runs past the deadline still submits.
  v_at := coalesce(
    nullif(new.data->>'startedAt', '')::timestamptz at time zone 'Asia/Manila',
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
