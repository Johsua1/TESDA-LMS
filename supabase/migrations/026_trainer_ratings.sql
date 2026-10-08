-- ===========================================================================
-- 026_trainer_ratings.sql
-- ---------------------------------------------------------------------------
-- Trainee -> trainer ratings (5 stars + optional comment).
--
-- Why: a trainer's rating used to be a static number the Super Admin typed in
-- the Add/Edit Trainer form (persisted in profiles.data.rating). That is being
-- replaced: trainees rate their trainer, and every rating shown in the app is a
-- derived average of these rows. This migration also strips the legacy field.
--
-- Shape mirrors the other collections (evaluations, attendance, ...): a few
-- scalar columns plus a `data` jsonb for the nested parts (rating, comment,
-- date). One row per (trainee, trainer) — re-rating updates the same row.
--
-- RLS is author-scoped: a trainee may only write their own row; reads are broad
-- so the shared UI (admin dashboards, trainer self-view) can compute averages.
-- ===========================================================================

create table if not exists public.trainer_ratings (
  id         text primary key,
  trainee_id text references public.profiles(id) on delete cascade,
  trainer_id text references public.profiles(id) on delete cascade,
  program_id text,
  data       jsonb not null default '{}'::jsonb,
  unique (trainee_id, trainer_id)
);

-- The rating lives inside `data` jsonb; validate it when present. A missing
-- value yields NULL and passes (CHECK only fails on FALSE), so this is a guard,
-- not a NOT NULL.
do $$
begin
  alter table public.trainer_ratings
    add constraint trainer_ratings_rating_check
    check ((data->>'rating')::int between 1 and 5);
exception when duplicate_object then null;
end $$;

create index if not exists trainer_ratings_trainer_idx on public.trainer_ratings (trainer_id);
create index if not exists trainer_ratings_trainee_idx on public.trainer_ratings (trainee_id);

alter table public.trainer_ratings enable row level security;

-- Reads: broad (the average is shown in admin/trainer views).
drop policy if exists trainer_ratings_select on public.trainer_ratings;
create policy trainer_ratings_select on public.trainer_ratings
  for select to authenticated using (true);

-- Writes: a trainee authors only their own row. Upsert needs both the INSERT
-- and UPDATE policies; the Super Admin may also moderate.
drop policy if exists trainer_ratings_insert on public.trainer_ratings;
create policy trainer_ratings_insert on public.trainer_ratings
  for insert to authenticated
  with check (trainee_id = public.current_profile_id());

drop policy if exists trainer_ratings_update on public.trainer_ratings;
create policy trainer_ratings_update on public.trainer_ratings
  for update to authenticated
  using (trainee_id = public.current_profile_id() or public.is_super_admin())
  with check (trainee_id = public.current_profile_id() or public.is_super_admin());

drop policy if exists trainer_ratings_delete on public.trainer_ratings;
create policy trainer_ratings_delete on public.trainer_ratings
  for delete to authenticated
  using (trainee_id = public.current_profile_id() or public.is_super_admin());

-- Baseline grants ran before this appended table existed, so grant explicitly
-- (same pattern as migration 019).
grant select, insert, update, delete on public.trainer_ratings to authenticated;

-- ---------------------------------------------------------------------------
-- Cleanup: drop the legacy admin-typed rating from profile data (now derived).
-- ---------------------------------------------------------------------------
update public.profiles set data = data - 'rating' where data ? 'rating';
