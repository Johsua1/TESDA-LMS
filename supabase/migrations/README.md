# Supabase migrations

Run these **in numeric order**, after the baseline `supabase/schema.sql`
(the baseline creates the core LMS tables and seeds the 6-program catalog).

```
001_extensions.sql              pgcrypto (+citext when available)
002_profiles.sql                trainer/admin profile columns, status, activation, guards
017_functions.sql               authz + MFA helper functions
018_rls_policies.sql            RLS for the existing tables (assignment-scoped writes)
019_trainer_management.sql      specializations + trainer_programs (many-to-many)
020_trainer_invitations.sql     invitations, activation trigger, activate_my_account()
021_audit_logs.sql              audit_logs + write_audit()
022_super_admin_mfa.sql         designated Super Admin, hardened admin RPCs, MFA status
023_trainer_rpcs.sql            trainer-management RPCs (create/update/status/resend)
024_mfa_settings.sql            MFA on/off toggle + enforcement flag
025_trainer_email_metadata.sql  temp password in auth metadata for the onboarding email
026_trainer_ratings.sql         trainee -> trainer ratings (5 stars + comment)
027_self_service_password.sql   self-service password activation
028_mfa_no_lockout.sql          MFA retry handling without lockout
030_lesson_quizzes.sql          program catalog reseed (one quiz per lesson)
031_quiz_requests.sql           quiz scheduling + attempt approvals
032_quiz_request_trainer_delete.sql
033_quiz_request_insert_trainer.sql
034_backfill_attempt_time_limits.sql
035_quiz_sessions.sql           one row per started quiz attempt
036_bookkeeping_program.sql
037_lock_online_enrollment.sql
038_va_nc2.sql
039_trainer_specializations.sql
040_quiz_attempt_guard_fix.sql  idempotent attempt guard
041_per_lesson_quizzes.sql      per-lesson quiz question sets
042_trainer_feedback.sql        qualitative feedback + revision history
043_timed_assessment_fields.sql attempt clock/score columns + answer tables
044_trainer_feedback_functions.sql completion, eligibility, submit, admin paging, correction
045_feedback_rls_policies.sql   feedback read policies
046_timed_assessment_functions.sql start/save/finalize/get + legacy grading triggers
047_assessment_rls_updates.sql  scoped attempt reads and immutable updates
048_expired_attempt_processing.sql expired-attempt processor (+ optional pg_cron)
049_security_hardening_grants.sql drop TRUNCATE/REFERENCES/TRIGGER from client roles
050_auto_complete_enrollments.sql auto-Complete when lessons/quizzes/exams are done
051_feedback_visibility.sql   feedback readable by author + Super Admin only
052_trainer_ratings_visibility.sql scope star ratings to author/trainer/admin
053_ratings_quantitative_only.sql strip legacy comments, enforce stars only
054_single_feedback_submission.sql stars + text in one submit, rated once
055_ratings_write_lock.sql     clients read ratings only; RPC is the sole writer
056_exam_grading_record_fix.sql exam inserts no longer raise 'record v_session is not assigned yet'
057_announcement_targeting_reads.sql per-program announcements, trainer isolation, read receipts
058_trainer_evaluation_isolation.sql evaluations/typing results private to their trainer; evaluations keyed by id
059_typing_test_requests.sql   one typing test attempt + trainer-approved retakes
060_profile_email_sync.sql     auth email change mirrored into profiles.email
061_quiz_attempt_grant_count_fix.sql attempt limit counted from real rows, approved retakes bypass the window
062_maintenance_mode_rls.sql   maintenance mode refuses non-admin writes server-side; settings are Super-Admin only
063_self_enroll_gate.sql      "allow online self-enrollment" refuses trainee enrollment inserts server-side
064_enrollment_write_scope.sql enrollment writes scoped by role; trainee cannot approve/move/delete records
065_enrollment_indexes.sql    indexes on enrollments(trainee_id, program_id, status)
066_enrollment_read_scope.sql enrollment reads scoped to owner / assigned trainer / Super Admin
067_profile_attendance_read_scope.sql profile reads scoped to self/trainers/own trainees; attendance to owner or trainer
068_policy_role_scoping.sql    those read/write policies scoped TO authenticated — anon was reading every trainer profile
069_enrollment_unique.sql      unique (trainee_id, program_id) — one application per course per trainee
```

## Why the numbering starts at 017

The original LMS schema (`supabase/schema.sql`) already implements the core
tables requested as migrations `003`–`016`. To avoid duplicating 90 KB of seed
data and creating two competing sources of truth, those objects are **not**
re-created here. The mapping is:

| Spec migration          | Implemented by (baseline `schema.sql`)                          |
|-------------------------|-----------------------------------------------------------------|
| `003_courses.sql`       | `programs` table (+ `programs.data` jsonb competency tree)      |
| `004_competencies.sql`  | nested in `programs.data.competencies`                          |
| `005_lessons.sql`       | nested in `programs.data.competencies[].lessons`                |
| `006_quizzes.sql`       | nested in `programs.data.quizzes`                               |
| `007_exams.sql`         | nested in `programs.data.exams`                                 |
| `008_enrollments.sql`   | `enrollments` table                                             |
| `009_schedules.sql`     | `schedules` table                                               |
| `010_attendance.sql`    | `attendance` table                                              |
| `011_typing_tests.sql`  | `typing_tests` table                                            |
| `012_progress.sql`      | `enrollments.data.progress`                                     |
| `013_payments.sql`      | `enrollments.data.payment`                                      |
| `014_evaluations.sql`   | `evaluations` table                                             |
| `015_notifications.sql` | `announcements` table                                           |
| `016_storage.sql`       | optional — see `docs/BACKEND.md` (profile images)               |

The baseline is **not modified** by these migrations except where a migration
explicitly `alter table`s it (002, 022, 042-048). All migrations are
idempotent.

## Two ways to apply

1. **SQL Editor (simplest, matches the project's existing flow)** — paste
   `supabase/schema.sql` (it now contains the baseline **plus** everything in
   this folder appended in order) and click Run.
2. **Supabase CLI** — `supabase link` then `supabase db push` (needs
   `SUPABASE_ACCESS_TOKEN` and the DB password).

See `docs/FEEDBACK_AND_TIMERS.md` for the feedback/timer design, RLS matrix,
scheduled processing and test instructions.
