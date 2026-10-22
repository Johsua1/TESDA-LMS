-- ---------------------------------------------------------------------------
-- 057 — announcement targeting, isolation and read receipts
--
-- * Admin: everyone / all trainees / specific trainers, all programs or one.
-- * Trainer: only their own students, scoped to their programs. A trainer
--   announcement is invisible to every other trainer.
-- * Trainees only see notices for programs they are enrolled in.
-- * announcement_reads tracks per-user read state for the bell badge.
-- ---------------------------------------------------------------------------

create table if not exists public.announcement_reads (
  id              text primary key,
  announcement_id text not null references public.announcements(id) on delete cascade,
  user_id         text not null references public.profiles(id) on delete cascade,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index if not exists announcement_reads_user_idx on public.announcement_reads (user_id);
create index if not exists announcements_author_idx on public.announcements (author_id);
create index if not exists announcements_program_idx on public.announcements (program_id);

alter table public.announcement_reads enable row level security;

drop policy if exists announcement_reads_select on public.announcement_reads;
create policy announcement_reads_select on public.announcement_reads
  for select to authenticated
  using (user_id = public.current_profile_id() or public.is_super_admin());

drop policy if exists announcement_reads_insert on public.announcement_reads;
create policy announcement_reads_insert on public.announcement_reads
  for insert to authenticated
  with check (user_id = public.current_profile_id());

drop policy if exists announcement_reads_delete on public.announcement_reads;
create policy announcement_reads_delete on public.announcement_reads
  for delete to authenticated
  using (user_id = public.current_profile_id());

revoke all on public.announcement_reads from anon;
grant select, insert, delete on public.announcement_reads to authenticated;
revoke truncate, references, trigger on public.announcement_reads from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Who may read one announcement row
-- ---------------------------------------------------------------------------
create or replace function public.announcement_visible(
  p_author_id  text,
  p_program_id text,
  p_audience   text,
  p_data       jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me          text := public.current_profile_id();
  v_role        text := public.current_role();
  v_author_role text;
begin
  if v_me is null then
    return false;
  end if;
  if v_role = 'admin' then
    return true;
  end if;
  if p_author_id = v_me then
    return true;
  end if;

  select role into v_author_role from public.profiles where id = p_author_id;

  -- Trainer-authored: only that trainer's own students.
  if v_author_role = 'trainer' then
    if v_role <> 'trainee' then
      return false;
    end if;
    if p_program_id is not null then
      return exists (
        select 1 from public.enrollments e
        where e.trainee_id = v_me
          and e.program_id = p_program_id
          and e.status in ('Enrolled', 'Approved', 'Completed')
      );
    end if;
    return exists (
      select 1
      from public.trainer_programs tp
      join public.enrollments e on e.program_id = tp.program_id
      where tp.trainer_id = p_author_id
        and tp.status = 'active'
        and e.trainee_id = v_me
        and e.status in ('Enrolled', 'Approved', 'Completed')
    );
  end if;

  -- Admin-authored, hand-picked trainers.
  if p_audience = 'selected' then
    return coalesce((p_data -> 'audienceIds') ? v_me, false);
  end if;

  if v_role = 'trainer' then
    if p_audience not in ('all', 'trainer') then
      return false;
    end if;
    if p_program_id is null then
      return true;
    end if;
    return exists (
      select 1 from public.trainer_programs tp
      where tp.trainer_id = v_me
        and tp.program_id = p_program_id
        and tp.status = 'active'
    );
  end if;

  if v_role = 'trainee' then
    if p_audience not in ('all', 'trainee') then
      return false;
    end if;
    if p_program_id is null then
      return true;
    end if;
    return exists (
      select 1 from public.enrollments e
      where e.trainee_id = v_me
        and e.program_id = p_program_id
        and e.status in ('Enrolled', 'Approved', 'Completed')
    );
  end if;

  return false;
end $$;

-- ---------------------------------------------------------------------------
-- Announcement policies (replace the blanket admin+trainer write policy)
-- ---------------------------------------------------------------------------
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (public.announcement_visible(author_id, program_id, audience, data));

drop policy if exists announcements_write on public.announcements;

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (
    author_id = public.current_profile_id()
    and (
      public.is_super_admin()
      or (
        public.current_role() = 'trainer'
        and audience = 'trainee'
        and (program_id is null or public.is_trainer_assigned_to_program(program_id))
      )
    )
  );

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements
  for update to authenticated
  using (public.is_super_admin() or author_id = public.current_profile_id())
  with check (public.is_super_admin() or author_id = public.current_profile_id());

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements
  for delete to authenticated
  using (public.is_super_admin() or author_id = public.current_profile_id());
