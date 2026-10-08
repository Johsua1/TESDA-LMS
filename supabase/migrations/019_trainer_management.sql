-- ===========================================================================
-- 019_trainer_management.sql
-- ---------------------------------------------------------------------------
-- Controlled specializations + many-to-many trainer <-> program assignments.
--
--   specializations   : the controlled list of trainer specializations
--                       (the database is the source of truth, not the UI).
--   trainer_programs  : one row per (trainer, program) assignment.
--
-- The existing LMS stores a single `programs.trainer_id` (primary trainer) and
-- a `user.programs` array inside jsonb. trainer_programs is the AUTHORITATIVE
-- many-to-many model used for access control; the legacy fields are kept for
-- frontend display only and are backfilled here.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. specializations
-- ---------------------------------------------------------------------------
create table if not exists public.specializations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.specializations enable row level security;

drop trigger if exists specializations_touch_updated_at on public.specializations;
create trigger specializations_touch_updated_at
  before update on public.specializations
  for each row execute function public.touch_updated_at();

-- Seed the controlled list (upsert by slug so re-running is safe).
insert into public.specializations (name, slug, sort_order) values
  ('Housekeeping',       'housekeeping',       1),
  ('Barista',            'barista',            2),
  ('Hilot / Massage',    'hilot-massage',      3),
  ('Event Management',   'event-management',   4),
  ('Virtual Assistant',  'virtual-assistant',  5),
  ('Multiple Programs',  'multiple-programs',  6),
  ('Other',              'other',              99)
on conflict (slug) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- RLS: everyone authenticated can read the list; only Super Admin may change it.
drop policy if exists specializations_select on public.specializations;
create policy specializations_select on public.specializations
  for select to authenticated using (true);

drop policy if exists specializations_write on public.specializations;
create policy specializations_write on public.specializations
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Link profiles.specialization_id -> specializations.id
do $$
begin
  alter table public.profiles
    add constraint profiles_specialization_id_fkey
    foreign key (specialization_id) references public.specializations(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. trainer_programs  (many-to-many)
-- ---------------------------------------------------------------------------
create table if not exists public.trainer_programs (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  text not null references public.profiles(id) on delete cascade,
  program_id  text not null references public.programs(id) on delete cascade,
  assigned_by text references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  status      text not null default 'active',
  unique (trainer_id, program_id)
);

do $$
begin
  alter table public.trainer_programs
    add constraint trainer_programs_status_check
    check (status in ('active', 'inactive', 'revoked'));
exception when duplicate_object then null;
end $$;

create index if not exists trainer_programs_trainer_idx on public.trainer_programs (trainer_id);
create index if not exists trainer_programs_program_idx on public.trainer_programs (program_id);

alter table public.trainer_programs enable row level security;

-- RLS: a trainer may READ only their own assignments. Only Super Admin writes.
drop policy if exists trainer_programs_select on public.trainer_programs;
create policy trainer_programs_select on public.trainer_programs
  for select to authenticated
  using (public.is_super_admin() or trainer_id = public.current_profile_id());

drop policy if exists trainer_programs_write on public.trainer_programs;
create policy trainer_programs_write on public.trainer_programs
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 3. Backfill trainer_programs from the legacy programs.trainer_id
-- ---------------------------------------------------------------------------
insert into public.trainer_programs (trainer_id, program_id, status)
select p.trainer_id, p.id, 'active'
  from public.programs p
  join public.profiles pr on pr.id = p.trainer_id and pr.role = 'trainer'
 where p.trainer_id is not null
on conflict (trainer_id, program_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. GRANTS
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.specializations  to authenticated;
grant select, insert, update, delete on public.trainer_programs to authenticated;
