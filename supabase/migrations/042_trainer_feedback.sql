-- ============================================================================
-- 042_trainer_feedback.sql
-- ----------------------------------------------------------------------------
-- Qualitative trainee -> trainer feedback, submitted after the trainee
-- completes an enrollment. This is deliberately separate from
-- trainer_ratings (026): trainer_ratings is the 5-star average used in the
-- trainer directory, while this table stores the written evaluation that the
-- Super Admin reviews and exports.
--
-- One row per enrollment. A draft may exist (is_submitted = false) but the
-- public submission RPC writes a submitted row directly. Once submitted the
-- text is immutable; the only exception is the auditable Super Admin
-- correction path, which records the previous values in
-- trainer_feedback_revisions.
--
-- Safe to re-run.
-- ============================================================================

create table if not exists public.trainer_feedback (
  id                     text primary key default ('tf-' || replace(gen_random_uuid()::text, '-', '')),
  trainee_id             text not null references public.profiles(id)    on delete restrict,
  trainer_id             text not null references public.profiles(id)    on delete restrict,
  program_id             text not null references public.programs(id)    on delete restrict,
  enrollment_id          text not null references public.enrollments(id) on delete restrict,
  feedback_text          text not null,
  learning_experience    text,
  trainer_strengths      text,
  areas_for_improvement  text,
  recommendation         text,
  rating                 smallint,
  is_submitted           boolean not null default true,
  submitted_at           timestamptz,
  corrected_at           timestamptz,
  corrected_by           text references public.profiles(id) on delete set null,
  correction_reason      text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- One feedback record per enrollment. Revisions are corrections of this row,
-- not additional rows, so the academic history stays one-to-one.
create unique index if not exists trainer_feedback_enrollment_key
  on public.trainer_feedback (enrollment_id);

create index if not exists trainer_feedback_trainer_idx
  on public.trainer_feedback (trainer_id, submitted_at desc);
create index if not exists trainer_feedback_trainee_idx
  on public.trainer_feedback (trainee_id, submitted_at desc);
create index if not exists trainer_feedback_program_idx
  on public.trainer_feedback (program_id, submitted_at desc);
create index if not exists trainer_feedback_submitted_idx
  on public.trainer_feedback (submitted_at desc)
  where is_submitted;

-- Constraints (added defensively so the migration can be re-run).
do $$
begin
  alter table public.trainer_feedback
    add constraint trainer_feedback_rating_check
    check (rating is null or rating between 1 and 5);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.trainer_feedback
    add constraint trainer_feedback_text_check
    check (length(btrim(feedback_text)) > 0);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.trainer_feedback
    add constraint trainer_feedback_submitted_check
    check (not is_submitted or submitted_at is not null);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.trainer_feedback
    add constraint trainer_feedback_no_self_check
    check (trainee_id <> trainer_id);
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- Audit trail for corrections. The previous row is stored as JSON so the
-- original wording is never lost.
-- ----------------------------------------------------------------------------
create table if not exists public.trainer_feedback_revisions (
  id              uuid primary key default gen_random_uuid(),
  feedback_id     text not null references public.trainer_feedback(id) on delete restrict,
  previous_values jsonb not null,
  reason          text not null,
  corrected_by    text references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists trainer_feedback_revisions_feedback_idx
  on public.trainer_feedback_revisions (feedback_id, created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
drop trigger if exists trainer_feedback_touch_updated_at on public.trainer_feedback;
create trigger trainer_feedback_touch_updated_at
  before update on public.trainer_feedback
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Immutability guard.
--   * DELETE is always rejected (history is preserved).
--   * Identity columns can never change.
--   * Once submitted, the trainee's original answers and submitted_at cannot
--     change through a normal UPDATE. The auditable correction RPC sets
--     app.feedback_correction = 'on' for its transaction.
-- ----------------------------------------------------------------------------
create or replace function public.protect_trainer_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Trainer feedback is part of the academic record and cannot be deleted.'
      using errcode = '42501';
  end if;

  -- Identity is immutable in every path.
  new.trainee_id    := old.trainee_id;
  new.trainer_id    := old.trainer_id;
  new.program_id    := old.program_id;
  new.enrollment_id := old.enrollment_id;
  new.created_at    := old.created_at;

  if coalesce(current_setting('app.feedback_correction', true), '') <> 'on' then
    if old.is_submitted then
      new.feedback_text         := old.feedback_text;
      new.learning_experience   := old.learning_experience;
      new.trainer_strengths     := old.trainer_strengths;
      new.areas_for_improvement := old.areas_for_improvement;
      new.recommendation        := old.recommendation;
      new.rating                := old.rating;
      new.is_submitted          := old.is_submitted;
      new.submitted_at          := old.submitted_at;
      new.corrected_at          := old.corrected_at;
      new.corrected_by          := old.corrected_by;
      new.correction_reason     := old.correction_reason;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trainer_feedback_immutable on public.trainer_feedback;
create trigger trainer_feedback_immutable
  before update or delete on public.trainer_feedback
  for each row execute function public.protect_trainer_feedback();

-- Direct DML is not granted: submission goes through
-- submit_trainer_feedback() and corrections through
-- admin_correct_trainer_feedback(). SELECT is granted for the RLS policies.
revoke all on public.trainer_feedback from anon, authenticated;
grant select on public.trainer_feedback to authenticated;

revoke all on public.trainer_feedback_revisions from anon, authenticated;
grant select on public.trainer_feedback_revisions to authenticated;

alter table public.trainer_feedback enable row level security;
alter table public.trainer_feedback_revisions enable row level security;
