-- ---------------------------------------------------------------------------
-- 062_maintenance_mode_rls.sql
--
-- System Settings > Maintenance mode was only a client-side gate: the UI hid
-- the app, but a trainee or trainer holding a valid session could still write
-- straight to PostgREST. This adds the server-side half.
--
-- Rule: while settings.data->>'maintenanceMode' is true, every non-Super-Admin
-- write to LMS data is refused. Reads stay open on purpose — the client needs
-- to load settings and its own profile to know that maintenance is on, and the
-- app renders a maintenance notice instead of a dashboard.
--
-- Two layers, because they cover different paths:
--   1. RESTRICTIVE RLS policies on every activity table -> blocks the client's
--      normal PostgREST writes (INSERT / UPDATE / DELETE).
--   2. A BEFORE trigger on the tables that SECURITY DEFINER RPCs write to ->
--      RLS is bypassed inside those functions, triggers are not.
--
-- public.settings is not in the maintenance list because it is locked down
-- harder: only a Super Admin may write it at all. Without that, any trainee
-- could simply switch maintenance mode back off through PostgREST.
--
-- Deliberately NOT gated: public.profiles (identity + the auth email trigger)
-- and public.audit_logs (written by definer functions only). Account activation
-- still works so a new user is not stranded mid-onboarding.
--
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

-- True when the global settings row says maintenance is on.
create or replace function public.maintenance_mode_on()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (data->>'maintenanceMode')::boolean
       from public.settings
      where id = 'global'),
    false
  )
$$;

-- True when this caller must be refused. public.is_super_admin() already
-- exists (migration 022) and matches the client's admin exemption.
create or replace function public.maintenance_blocks_writes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.maintenance_mode_on() and not public.is_super_admin()
$$;

grant execute on function public.maintenance_mode_on() to authenticated;
grant execute on function public.maintenance_blocks_writes() to authenticated;

-- ---------------------------------------------------------------------------
-- 1) Restrictive RLS policies: INSERT / UPDATE / DELETE for non-admins.
--    Restrictive policies are ANDed with the existing permissive ones, so the
--    normal "who may write this row" rules still apply — this only adds the
--    maintenance gate on top.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'programs',
    'schedules',
    'enrollments',
    'attendance',
    'quiz_attempts',
    'quiz_attempt_answers',
    'quiz_requests',
    'quiz_sessions',
    'exam_attempts',
    'exam_attempt_answers',
    'typing_tests',
    'typing_test_requests',
    'evaluations',
    'trainer_ratings',
    'trainer_feedback',
    'trainer_feedback_revisions',
    'announcements',
    'announcement_reads',
    'trainer_programs'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists maintenance_no_insert on public.%I', t);
    execute format('drop policy if exists maintenance_no_update on public.%I', t);
    execute format('drop policy if exists maintenance_no_delete on public.%I', t);

    execute format(
      'create policy maintenance_no_insert on public.%I as restrictive for insert to authenticated with check (not public.maintenance_blocks_writes())',
      t
    );
    execute format(
      'create policy maintenance_no_update on public.%I as restrictive for update to authenticated using (not public.maintenance_blocks_writes()) with check (not public.maintenance_blocks_writes())',
      t
    );
    execute format(
      'create policy maintenance_no_delete on public.%I as restrictive for delete to authenticated using (not public.maintenance_blocks_writes())',
      t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 1b) Settings are Super-Admin-only (SELECT stays open: every client reads the
--     flag to know whether maintenance is on).
-- ---------------------------------------------------------------------------
drop policy if exists settings_admin_insert on public.settings;
drop policy if exists settings_admin_update on public.settings;
drop policy if exists settings_admin_delete on public.settings;

create policy settings_admin_insert on public.settings
  as restrictive for insert to authenticated
  with check (public.is_super_admin());

create policy settings_admin_update on public.settings
  as restrictive for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy settings_admin_delete on public.settings
  as restrictive for delete to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 2) Trigger guard for the tables written by SECURITY DEFINER RPCs
--    (submit_trainer_feedback, admin_correct_trainer_feedback, and the
--    start/save/finalize assessment functions). RLS is bypassed inside those
--    functions; triggers are not.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_maintenance_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.maintenance_blocks_writes() then
    raise exception 'The system is in maintenance mode. Changes cannot be saved right now.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'trainer_feedback',
    'trainer_ratings',
    'quiz_attempts',
    'quiz_attempt_answers',
    'exam_attempts',
    'exam_attempt_answers'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists maintenance_write_guard on public.%I', t);
    execute format(
      'create trigger maintenance_write_guard before insert or update or delete on public.%I for each row execute function public.enforce_maintenance_write()',
      t
    );
  end loop;
end
$$;
