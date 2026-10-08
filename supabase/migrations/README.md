# Supabase migrations

Run these **in numeric order**, after the baseline `supabase/schema.sql`
(the baseline creates the core LMS tables and seeds the 5-program catalog).

```
001_extensions.sql          pgcrypto (+citext when available)
002_profiles.sql            trainer/admin profile columns, status, activation, guards
017_functions.sql           authz + MFA helper functions
018_rls_policies.sql        RLS for the existing tables (assignment-scoped writes)
019_trainer_management.sql  specializations + trainer_programs (many-to-many)
020_trainer_invitations.sql invitations, activation trigger, activate_my_account()
021_audit_logs.sql          audit_logs + write_audit()
022_super_admin_mfa.sql     designated Super Admin, hardened admin RPCs, MFA status
023_trainer_rpcs.sql        trainer-management RPCs (create/update/status/resend)
024_mfa_settings.sql        MFA on/off toggle (admin_set_mfa_enforced) + enforcement flag
025_trainer_email_metadata.sql  temp password in auth metadata for the onboarding email
026_trainer_ratings.sql     trainee -> trainer ratings (5 stars + comment)
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
explicitly `alter table`s it (002, 022). All migrations are idempotent.

## Two ways to apply

1. **SQL Editor (simplest, matches the project's existing flow)** — paste
   `supabase/schema.sql` (it now contains the baseline **plus** everything in
   this folder appended in order) and click Run.
2. **Supabase CLI** — `supabase link` then `supabase db push` (needs
   `SUPABASE_ACCESS_TOKEN` and the DB password).
