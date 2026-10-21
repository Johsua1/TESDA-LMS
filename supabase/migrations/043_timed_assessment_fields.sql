-- ============================================================================
-- 043_timed_assessment_fields.sql
-- ----------------------------------------------------------------------------
-- Server-authoritative attempt clock and grading columns.
--
-- Existing rows are historical results: they get a status of 'graded' and
-- their score/total/percentage copied out of the legacy data jsonb. They do
-- NOT get an invented deadline (deadline_at stays NULL) because the old client
-- never recorded one. Only attempts started after this migration have a
-- server-issued deadline.
--
-- Safe to re-run: every backfill only touches rows whose column is still NULL.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- quiz_attempts
-- ---------------------------------------------------------------------------
alter table public.quiz_attempts add column if not exists started_at             timestamptz;
alter table public.quiz_attempts add column if not exists deadline_at            timestamptz;
alter table public.quiz_attempts add column if not exists submitted_at           timestamptz;
alter table public.quiz_attempts add column if not exists time_limit_seconds     integer;
alter table public.quiz_attempts add column if not exists status                 text;
alter table public.quiz_attempts add column if not exists score                  integer;
alter table public.quiz_attempts add column if not exists total_questions        integer;
alter table public.quiz_attempts add column if not exists answered_questions     integer;
alter table public.quiz_attempts add column if not exists correct_answers        integer;
alter table public.quiz_attempts add column if not exists incorrect_answers      integer;
alter table public.quiz_attempts add column if not exists unanswered_questions   integer;
alter table public.quiz_attempts add column if not exists percentage             numeric(6,2);
alter table public.quiz_attempts add column if not exists auto_submitted         boolean not null default false;
alter table public.quiz_attempts add column if not exists created_at             timestamptz;
alter table public.quiz_attempts add column if not exists updated_at             timestamptz not null default now();

update public.quiz_attempts
   set status = 'graded'
 where status is null;

update public.quiz_attempts qa
   set started_at = coalesce(
         qa.started_at,
         nullif(qa.data->>'startedAt', '')::timestamptz
       ),
       submitted_at = coalesce(
         qa.submitted_at,
         nullif(qa.data->>'submittedAt', '')::timestamptz,
         nullif(qa.data->>'date', '')::date::timestamptz
       ),
       score = coalesce(
         qa.score,
         nullif(qa.data->>'score', '')::int,
         0
       ),
       total_questions = coalesce(
         qa.total_questions,
         nullif(qa.data->>'total', '')::int,
         case when jsonb_typeof(qa.data->'answers') = 'array'
              then jsonb_array_length(qa.data->'answers') else 0 end,
         0
       ),
       answered_questions = coalesce(
         qa.answered_questions,
         case when jsonb_typeof(qa.data->'answers') = 'array'
              then jsonb_array_length(qa.data->'answers') else 0 end,
         0
       ),
       correct_answers = coalesce(
         qa.correct_answers,
         nullif(qa.data->>'score', '')::int,
         0
       ),
       time_limit_seconds = coalesce(qa.time_limit_seconds, 1800),
       created_at = coalesce(
         qa.created_at,
         nullif(qa.data->>'submittedAt', '')::timestamptz,
         nullif(qa.data->>'date', '')::date::timestamptz,
         now()
       )
 where qa.status = 'graded';

update public.quiz_attempts qa
   set incorrect_answers = greatest(coalesce(qa.answered_questions, 0) - coalesce(qa.correct_answers, 0), 0),
       unanswered_questions = greatest(coalesce(qa.total_questions, 0) - coalesce(qa.answered_questions, 0), 0),
       percentage = coalesce(
         qa.percentage,
         case when coalesce(qa.total_questions, 0) > 0
              then round(coalesce(qa.correct_answers, 0) * 100.0 / qa.total_questions, 2)
              else 0 end
       )
 where qa.incorrect_answers is null
    or qa.unanswered_questions is null
    or qa.percentage is null;

alter table public.quiz_attempts alter column status             set default 'graded';
alter table public.quiz_attempts alter column status             set not null;
alter table public.quiz_attempts alter column score              set default 0;
alter table public.quiz_attempts alter column score              set not null;
alter table public.quiz_attempts alter column total_questions    set default 0;
alter table public.quiz_attempts alter column total_questions    set not null;
alter table public.quiz_attempts alter column answered_questions set default 0;
alter table public.quiz_attempts alter column answered_questions set not null;
alter table public.quiz_attempts alter column correct_answers    set default 0;
alter table public.quiz_attempts alter column correct_answers    set not null;
alter table public.quiz_attempts alter column incorrect_answers  set default 0;
alter table public.quiz_attempts alter column incorrect_answers  set not null;
alter table public.quiz_attempts alter column unanswered_questions set default 0;
alter table public.quiz_attempts alter column unanswered_questions set not null;
alter table public.quiz_attempts alter column created_at         set default now();
alter table public.quiz_attempts alter column created_at         set not null;

-- ---------------------------------------------------------------------------
-- exam_attempts (same shape)
-- ---------------------------------------------------------------------------
alter table public.exam_attempts add column if not exists started_at             timestamptz;
alter table public.exam_attempts add column if not exists deadline_at            timestamptz;
alter table public.exam_attempts add column if not exists submitted_at           timestamptz;
alter table public.exam_attempts add column if not exists time_limit_seconds     integer;
alter table public.exam_attempts add column if not exists status                 text;
alter table public.exam_attempts add column if not exists score                  integer;
alter table public.exam_attempts add column if not exists total_questions        integer;
alter table public.exam_attempts add column if not exists answered_questions     integer;
alter table public.exam_attempts add column if not exists correct_answers        integer;
alter table public.exam_attempts add column if not exists incorrect_answers      integer;
alter table public.exam_attempts add column if not exists unanswered_questions   integer;
alter table public.exam_attempts add column if not exists percentage             numeric(6,2);
alter table public.exam_attempts add column if not exists auto_submitted         boolean not null default false;
alter table public.exam_attempts add column if not exists created_at             timestamptz;
alter table public.exam_attempts add column if not exists updated_at             timestamptz not null default now();

update public.exam_attempts
   set status = 'graded'
 where status is null;

update public.exam_attempts ea
   set started_at = coalesce(
         ea.started_at,
         nullif(ea.data->>'startedAt', '')::timestamptz
       ),
       submitted_at = coalesce(
         ea.submitted_at,
         nullif(ea.data->>'submittedAt', '')::timestamptz,
         nullif(ea.data->>'date', '')::date::timestamptz
       ),
       score = coalesce(
         ea.score,
         nullif(ea.data->>'score', '')::int,
         0
       ),
       total_questions = coalesce(
         ea.total_questions,
         nullif(ea.data->>'total', '')::int,
         case when jsonb_typeof(ea.data->'answers') = 'array'
              then jsonb_array_length(ea.data->'answers') else 0 end,
         0
       ),
       answered_questions = coalesce(
         ea.answered_questions,
         case when jsonb_typeof(ea.data->'answers') = 'array'
              then jsonb_array_length(ea.data->'answers') else 0 end,
         0
       ),
       correct_answers = coalesce(
         ea.correct_answers,
         nullif(ea.data->>'score', '')::int,
         0
       ),
       time_limit_seconds = coalesce(ea.time_limit_seconds, 3600),
       created_at = coalesce(
         ea.created_at,
         nullif(ea.data->>'submittedAt', '')::timestamptz,
         nullif(ea.data->>'date', '')::date::timestamptz,
         now()
       )
 where ea.status = 'graded';

update public.exam_attempts ea
   set incorrect_answers = greatest(coalesce(ea.answered_questions, 0) - coalesce(ea.correct_answers, 0), 0),
       unanswered_questions = greatest(coalesce(ea.total_questions, 0) - coalesce(ea.answered_questions, 0), 0),
       percentage = coalesce(
         ea.percentage,
         case when coalesce(ea.total_questions, 0) > 0
              then round(coalesce(ea.correct_answers, 0) * 100.0 / ea.total_questions, 2)
              else 0 end
       )
 where ea.incorrect_answers is null
    or ea.unanswered_questions is null
    or ea.percentage is null;

alter table public.exam_attempts alter column status             set default 'graded';
alter table public.exam_attempts alter column status             set not null;
alter table public.exam_attempts alter column score              set default 0;
alter table public.exam_attempts alter column score              set not null;
alter table public.exam_attempts alter column total_questions    set default 0;
alter table public.exam_attempts alter column total_questions    set not null;
alter table public.exam_attempts alter column answered_questions set default 0;
alter table public.exam_attempts alter column answered_questions set not null;
alter table public.exam_attempts alter column correct_answers    set default 0;
alter table public.exam_attempts alter column correct_answers    set not null;
alter table public.exam_attempts alter column incorrect_answers  set default 0;
alter table public.exam_attempts alter column incorrect_answers  set not null;
alter table public.exam_attempts alter column unanswered_questions set default 0;
alter table public.exam_attempts alter column unanswered_questions set not null;
alter table public.exam_attempts alter column created_at         set default now();
alter table public.exam_attempts alter column created_at         set not null;

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array['quiz_attempts', 'exam_attempts'] loop
    begin
      execute format(
        'alter table public.%I add constraint %I check (status in (''in_progress'',''submitted'',''auto_submitted'',''graded''))',
        v_table, v_table || '_status_check');
    exception when duplicate_object then null;
    end;

    begin
      execute format(
        'alter table public.%I add constraint %I check (time_limit_seconds is null or time_limit_seconds > 0)',
        v_table, v_table || '_time_limit_check');
    exception when duplicate_object then null;
    end;

    begin
      execute format(
        'alter table public.%I add constraint %I check (deadline_at is null or started_at is null or deadline_at > started_at)',
        v_table, v_table || '_deadline_check');
    exception when duplicate_object then null;
    end;

    begin
      execute format(
        'alter table public.%I add constraint %I check (score >= 0 and total_questions >= 0 and answered_questions >= 0 and correct_answers >= 0 and incorrect_answers >= 0 and unanswered_questions >= 0)',
        v_table, v_table || '_score_check');
    exception when duplicate_object then null;
    end;

    begin
      execute format(
        'alter table public.%I add constraint %I check (percentage is null or (percentage >= 0 and percentage <= 100))',
        v_table, v_table || '_percentage_check');
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Efficient expiry scans + per-trainee lookups.
create index if not exists quiz_attempts_expiry_idx
  on public.quiz_attempts (deadline_at)
  where status = 'in_progress';
create index if not exists quiz_attempts_trainee_status_idx
  on public.quiz_attempts (trainee_id, status);
create index if not exists quiz_attempts_program_idx
  on public.quiz_attempts (program_id);
create index if not exists exam_attempts_expiry_idx
  on public.exam_attempts (deadline_at)
  where status = 'in_progress';
create index if not exists exam_attempts_trainee_status_idx
  on public.exam_attempts (trainee_id, status);
create index if not exists exam_attempts_program_idx
  on public.exam_attempts (program_id);

-- At most one live attempt per trainee/assessment. This is what makes
-- start_*_attempt() idempotent under concurrent calls.
create unique index if not exists quiz_attempts_one_in_progress
  on public.quiz_attempts (trainee_id, (data->>'quizId'))
  where status = 'in_progress';
create unique index if not exists exam_attempts_one_in_progress
  on public.exam_attempts (trainee_id, (data->>'examId'))
  where status = 'in_progress';

-- ---------------------------------------------------------------------------
-- Answer storage (one row per answered question)
-- ---------------------------------------------------------------------------
create table if not exists public.quiz_attempt_answers (
  attempt_id  text not null references public.quiz_attempts(id) on delete restrict,
  question_id text not null,
  answer      jsonb,
  is_correct  boolean,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create table if not exists public.exam_attempt_answers (
  attempt_id  text not null references public.exam_attempts(id) on delete restrict,
  question_id text not null,
  answer      jsonb,
  is_correct  boolean,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create index if not exists quiz_attempt_answers_attempt_idx
  on public.quiz_attempt_answers (attempt_id);
create index if not exists exam_attempt_answers_attempt_idx
  on public.exam_attempt_answers (attempt_id);

alter table public.quiz_attempt_answers enable row level security;
alter table public.exam_attempt_answers enable row level security;

-- ---------------------------------------------------------------------------
-- quiz_sessions: the legacy client creates one row when a quiz starts. The
-- server now owns its clock. timer_version = 1 marks rows that predate this
-- migration; the scheduled processor leaves those alone.
-- ---------------------------------------------------------------------------
alter table public.quiz_sessions add column if not exists started_at         timestamptz;
alter table public.quiz_sessions add column if not exists deadline_at        timestamptz;
alter table public.quiz_sessions add column if not exists time_limit_seconds integer;
alter table public.quiz_sessions add column if not exists timer_version      smallint not null default 2;

-- Rows that already existed when this migration first ran are legacy.
update public.quiz_sessions
   set timer_version = 1
 where timer_version = 2
   and started_at is null;

update public.quiz_sessions
   set started_at = coalesce(
         started_at,
         nullif(data->>'startedAt', '')::timestamptz,
         created_at
       ),
       time_limit_seconds = coalesce(time_limit_seconds, 1800)
 where started_at is null
    or time_limit_seconds is null;

update public.quiz_sessions
   set deadline_at = coalesce(deadline_at, started_at + make_interval(secs => time_limit_seconds))
 where deadline_at is null;

create index if not exists quiz_sessions_expiry_idx
  on public.quiz_sessions (deadline_at)
  where timer_version >= 2;
