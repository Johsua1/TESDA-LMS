-- ===========================================================================
-- docs/BACKEND_TESTS.sql
-- ---------------------------------------------------------------------------
-- SQL smoke checks. Run in the Supabase SQL Editor AFTER applying schema.sql
-- (these run as the table owner, so they bypass RLS and verify STRUCTURE).
--
-- Authorization/RLS behaviour (Tests 4–8) must be exercised from an
-- authenticated client session — see docs/BACKEND.md §14. The RLS assertions
-- at the bottom are written as `set local role authenticated` blocks you can
-- adapt once you have a real JWT.
-- ===========================================================================

-- 1. Objects exist -----------------------------------------------------------
select table_name
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('profiles','programs','specializations','trainer_programs',
                      'trainer_invitations','audit_logs')
 order by table_name;

-- 2. New profile columns exist ----------------------------------------------
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
   and column_name in ('first_name','last_name','phone','address','date_of_birth',
                       'profile_image_url','position','specialization',
                       'specialization_id','status','is_activated','mfa_enforced')
 order by column_name;

-- 3. Specializations seeded --------------------------------------------------
select name, slug, sort_order, is_active from public.specializations order by sort_order;

-- 4. Designated Super Admin --------------------------------------------------
select id, email, role, status, is_activated, mfa_enforced
  from public.profiles
 where lower(email) = 'institutehytglobal@gmail.com';

-- 5. No other Super Admin left over -----------------------------------------
select id, email, role, status
  from public.profiles
 where role in ('admin','super_admin')
   and lower(coalesce(email,'')) <> 'institutehytglobal@gmail.com';

-- 6. Helper + RPC functions exist -------------------------------------------
select proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('is_super_admin','is_active_trainer','is_trainer_assigned_to_program',
                   'mfa_satisfied','current_aal','get_my_auth_state',
                   'admin_create_trainer','admin_update_trainer','admin_set_trainer_status',
                   'admin_resend_trainer_invitation','admin_get_trainer',
                   'admin_finalize_trainer','activate_my_account')
 order by proname;

-- 7. RLS enabled on protected tables ----------------------------------------
select relname, relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and relname in ('profiles','programs','schedules','attendance','evaluations',
                   'specializations','trainer_programs','trainer_invitations','audit_logs')
 order by relname;

-- 8. Constraints -------------------------------------------------------------
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid in ('public.profiles'::regclass, 'public.trainer_programs'::regclass,
                    'public.trainer_invitations'::regclass)
   and contype in ('c','f','u')
 order by conname;

-- 9. Trainer assignments backfilled from programs.trainer_id -----------------
select tp.trainer_id, tp.program_id, tp.status
  from public.trainer_programs tp
 order by tp.trainer_id, tp.program_id;

-- 10. Audit log is empty of secrets -----------------------------------------
select action, target_type, count(*)
  from public.audit_logs
 group by action, target_type
 order by action;

-- ---------------------------------------------------------------------------
-- RLS behaviour (run from a real authenticated session, not the SQL editor)
-- ---------------------------------------------------------------------------
-- As a TRAINER (AAL1) these MUST fail:
--   select public.admin_create_trainer('X','x@y.z');          -- 42501
--   update public.profiles set role = 'admin' where id = auth_profile; -- trigger blocks
--   insert into public.trainer_programs(trainer_id, program_id)
--     values (self, 'event-management');                      -- RLS blocks
--
-- As a TRAINER assigned only to Housekeeping + Barista:
--   select public.is_trainer_assigned_to_program('housekeeping');     -- true
--   select public.is_trainer_assigned_to_program('event-management'); -- false
--
-- As the SUPER ADMIN at AAL1 (no MFA yet) these MUST fail with 42501:
--   select public.admin_create_trainer('X','x@y.z');
-- After completing the MFA challenge (AAL2) the same call succeeds.
