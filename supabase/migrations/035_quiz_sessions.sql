-- ============================================================================
-- 035_quiz_sessions.sql
-- One row per started attempt. The timer reads `startedAt` from here, so a
-- trainee who leaves the quiz and returns sees the remaining time instead of a
-- fresh 30 minutes. The row is removed when the attempt is submitted.
-- Safe to re-run.
-- ============================================================================

create table if not exists public.quiz_sessions (
  id         text primary key,
  trainee_id text not null,
  program_id text not null,
  quiz_id    text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- One open session per trainee and quiz.
create unique index if not exists quiz_sessions_one_open
  on public.quiz_sessions (trainee_id, quiz_id);

alter table public.quiz_sessions enable row level security;

drop policy if exists quiz_sessions_select on public.quiz_sessions;
create policy quiz_sessions_select on public.quiz_sessions
  for select to authenticated
  using (
    trainee_id = public.current_profile_id()
    or public.is_super_admin()
    or public.is_trainer_assigned_to_program(program_id)
  );

drop policy if exists quiz_sessions_insert on public.quiz_sessions;
create policy quiz_sessions_insert on public.quiz_sessions
  for insert to authenticated
  with check (trainee_id = public.current_profile_id());

drop policy if exists quiz_sessions_update on public.quiz_sessions;
create policy quiz_sessions_update on public.quiz_sessions
  for update to authenticated
  using (trainee_id = public.current_profile_id())
  with check (trainee_id = public.current_profile_id());

drop policy if exists quiz_sessions_delete on public.quiz_sessions;
create policy quiz_sessions_delete on public.quiz_sessions
  for delete to authenticated
  using (trainee_id = public.current_profile_id() or public.is_super_admin());

grant select, insert, update, delete on public.quiz_sessions to authenticated;
