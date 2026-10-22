-- ============================================================================
-- 059_typing_test_requests.sql
-- One typing test attempt per VA trainee + trainer-approved retakes.
--   * typing_test_requests: one row per trainee request, approved/rejected by
--     the trainer who owns the result.
--   * trigger on typing_tests: a second row is only accepted when the trainee
--     holds an unused approved request, which the trigger consumes.
-- Safe to re-run.
-- ============================================================================

set check_function_bodies = false;

create table if not exists public.typing_test_requests (
  id         text primary key,
  trainee_id text not null,
  program_id text not null,
  trainer_id text,
  status     text not null default 'pending',
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists typing_test_requests_trainee_idx
  on public.typing_test_requests (trainee_id, program_id);

-- A trainee can only have one open request per program.
create unique index if not exists typing_test_requests_one_pending
  on public.typing_test_requests (trainee_id, program_id)
  where status = 'pending';

alter table public.typing_test_requests enable row level security;

drop policy if exists typing_test_requests_select on public.typing_test_requests;
create policy typing_test_requests_select on public.typing_test_requests
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or trainer_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );

drop policy if exists typing_test_requests_insert on public.typing_test_requests;
create policy typing_test_requests_insert on public.typing_test_requests
  for insert to authenticated
  with check (
    trainee_id = public.current_profile_id()
    and status = 'pending'
  );

drop policy if exists typing_test_requests_update on public.typing_test_requests;
create policy typing_test_requests_update on public.typing_test_requests
  for update to authenticated
  using (
    trainee_id = public.current_profile_id()
    or trainer_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  )
  with check (
    trainee_id = public.current_profile_id()
    or trainer_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );

-- A trainee may only mirror the attempt counter (attemptsUsed + consumedAt);
-- the decision fields stay under the trainer's control.
create or replace function public.protect_typing_request_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin()
     or old.trainer_id = public.current_profile_id()
     or public.is_trainer_assigned_to_program(old.program_id) then
    return new;
  end if;

  if new.trainee_id is distinct from old.trainee_id
     or new.program_id is distinct from old.program_id
     or new.trainer_id is distinct from old.trainer_id
     or new.status is distinct from old.status
     or (new.data - 'attemptsUsed' - 'consumedAt')
        is distinct from (old.data - 'attemptsUsed' - 'consumedAt') then
    raise exception 'Only the assigned trainer can decide a typing test request.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists typing_test_requests_protect_decision on public.typing_test_requests;
create trigger typing_test_requests_protect_decision
  before update on public.typing_test_requests
  for each row execute function public.protect_typing_request_decision();

drop policy if exists typing_test_requests_delete on public.typing_test_requests;
create policy typing_test_requests_delete on public.typing_test_requests
  for delete to authenticated
  using (
    public.is_super_admin()
    or trainee_id = public.current_profile_id()
  );

grant select, insert, update, delete on public.typing_test_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Single-attempt gate on typing_tests
-- ---------------------------------------------------------------------------
create table if not exists public.typing_tests (
  id         text primary key,
  trainee_id text,
  program_id text,
  trainer_id text,
  data       jsonb not null default '{}'::jsonb
);

create or replace function public.enforce_typing_test_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant_id text;
  v_attempts int;
begin
  -- Upserts of an existing row (the trainer saving remarks/evaluation) are
  -- updates, not new attempts.
  if exists (select 1 from public.typing_tests where id = new.id) then
    return new;
  end if;

  -- 1) An approved request grants exactly one attempt; consume it atomically.
  select r.id into v_grant_id
  from public.typing_test_requests r
  where r.trainee_id = new.trainee_id
    and r.program_id = new.program_id
    and r.status = 'approved'
    and coalesce((r.data->>'attemptsUsed')::int, 0)
        < coalesce((r.data->>'attemptsGranted')::int, 1)
  order by r.created_at desc
  limit 1;

  if v_grant_id is not null then
    update public.typing_test_requests
       set data = jsonb_set(
             data,
             '{attemptsUsed}',
             to_jsonb(coalesce((data->>'attemptsUsed')::int, 0) + 1)
           )
     where id = v_grant_id;
    return new;
  end if;

  -- 2) Otherwise only the trainee's first attempt is valid.
  select count(*) into v_attempts
  from public.typing_tests
  where trainee_id = new.trainee_id
    and program_id = new.program_id;

  if v_attempts > 0 then
    raise exception 'Typing test already taken. Trainer approval is required for another attempt.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists typing_tests_single_attempt on public.typing_tests;
create trigger typing_tests_single_attempt
  before insert on public.typing_tests
  for each row execute function public.enforce_typing_test_access();
