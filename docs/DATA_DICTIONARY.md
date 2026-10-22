# Data Dictionary - LMS database (public schema)

Generated from the live Supabase project on 2026-10-22. Regenerate after any migration (section 5).

> Row counts are a snapshot for context, not part of the schema.

## 1. Tables

| Table | Rows | Purpose |
|-------|------|---------|
| `announcement_reads` | 7 | Per-user read receipts for announcements |
| `announcements` | 2 | Portal announcements (admin or trainer authored, optionally scoped to a program) |
| `attendance` | 4 | One row per trainee per schedule session |
| `audit_logs` | 117 | Append-only audit trail written by SECURITY DEFINER functions |
| `enrollments` | 11 | Enrollment applications and their lifecycle (JSON data holds applicant, requirements, payment, progress) |
| `evaluations` | 0 | Trainer evaluation of a trainee per program |
| `exam_attempt_answers` | 0 | Per-question answers for an exam attempt |
| `exam_attempts` | 1 | Exam attempts with score, percentage and status |
| `profiles` | 19 | Application user record linked to an auth user (role, contact details, assignment data) |
| `programs` | 6 | Course catalog (TESDA-style programs, competencies, quizzes, exams) |
| `quiz_attempt_answers` | 0 | Per-question answers for a quiz attempt |
| `quiz_attempts` | 17 | Quiz attempts with score, percentage and pass flag |
| `quiz_requests` | 18 | Trainee requests for an extra quiz attempt, approved by the trainer |
| `quiz_sessions` | 0 | Open in-progress quiz sessions (one per trainee/quiz) |
| `schedules` | 3 | Class schedules per program and trainer |
| `settings` | 1 | Single global row (id = global) with System Settings JSON |
| `specializations` | 8 | Trainer specialization lookup |
| `trainer_feedback` | 0 | End-of-program trainee feedback about a trainer |
| `trainer_feedback_revisions` | 0 | Revision history for feedback |
| `trainer_invitations` | 0 | Invitation/activation records for trainer accounts |
| `trainer_programs` | 10 | Authoritative trainer-program assignment (drives RLS) |
| `trainer_ratings` | 4 | Star rating a trainee gave a trainer |
| `typing_test_requests` | 0 | Trainee requests for a typing test retake |
| `typing_tests` | 0 | Typing test results (WPM, accuracy, score, pass flag) |

## 2. Columns

### `announcement_reads`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `announcement_id` | text | no | - |
| `user_id` | text | no | - |
| `data` | jsonb | no | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | no | `now()` |

### `announcements`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `author_id` | text | yes | - |
| `program_id` | text | yes | - |
| `audience` | text | yes | - |
| `date` | date | yes | - |
| `data` | jsonb | no | `'{}'::jsonb` |

### `attendance`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `trainee_id` | text | yes | - |
| `program_id` | text | yes | - |
| `schedule_id` | text | yes | - |
| `data` | jsonb | no | `'{}'::jsonb` |

### `audit_logs`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | uuid | no | `gen_random_uuid()` |
| `user_id` | uuid | yes | - |
| `actor_profile_id` | text | yes | - |
| `action` | text | no | - |
| `target_type` | text | yes | - |
| `target_id` | text | yes | - |
| `metadata` | jsonb | no | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | no | `now()` |

### `enrollments`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `trainee_id` | text | yes | - |
| `program_id` | text | yes | - |
| `status` | text | yes | - |
| `data` | jsonb | no | `'{}'::jsonb` |
| `updated_at` | timestamp with time zone | no | `now()` |

### `evaluations`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `trainee_id` | text | yes | - |
| `program_id` | text | yes | - |
| `trainer_id` | text | yes | - |
| `data` | jsonb | no | `'{}'::jsonb` |

### `exam_attempt_answers`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `attempt_id` | text | no | - |
| `question_id` | text | no | - |
| `answer` | jsonb | yes | - |
| `is_correct` | boolean | yes | - |
| `answered_at` | timestamp with time zone | no | `now()` |

### `exam_attempts`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `trainee_id` | text | yes | - |
| `program_id` | text | yes | - |
| `data` | jsonb | no | `'{}'::jsonb` |
| `started_at` | timestamp with time zone | yes | - |
| `deadline_at` | timestamp with time zone | yes | - |
| `submitted_at` | timestamp with time zone | yes | - |
| `time_limit_seconds` | integer | yes | - |
| `status` | text | no | `'graded'::text` |
| `score` | integer | no | `0` |
| `total_questions` | integer | no | `0` |
| `answered_questions` | integer | no | `0` |
| `correct_answers` | integer | no | `0` |
| `incorrect_answers` | integer | no | `0` |
| `unanswered_questions` | integer | no | `0` |
| `percentage` | numeric | yes | - |
| `auto_submitted` | boolean | no | `false` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

### `profiles`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `auth_user_id` | uuid | yes | - |
| `role` | text | no | `'trainee'::text` |
| `email` | text | yes | - |
| `name` | text | yes | - |
| `data` | jsonb | no | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |
| `first_name` | text | yes | - |
| `last_name` | text | yes | - |
| `phone` | text | yes | - |
| `address` | text | yes | - |
| `date_of_birth` | date | yes | - |
| `profile_image_url` | text | yes | - |
| `position` | text | yes | - |
| `specialization` | text | yes | - |
| `specialization_id` | uuid | yes | - |
| `status` | text | no | `'active'::text` |
| `is_activated` | boolean | no | `true` |
| `mfa_enforced` | boolean | no | `false` |
| `last_login_at` | timestamp with time zone | yes | - |

### `programs`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `code` | text | yes | - |
| `title` | text | yes | - |
| `trainer_id` | text | yes | - |
| `data` | jsonb | no | `'{}'::jsonb` |
| `updated_at` | timestamp with time zone | no | `now()` |

### `quiz_attempt_answers`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `attempt_id` | text | no | - |
| `question_id` | text | no | - |
| `answer` | jsonb | yes | - |
| `is_correct` | boolean | yes | - |
| `answered_at` | timestamp with time zone | no | `now()` |

### `quiz_attempts`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `trainee_id` | text | yes | - |
| `program_id` | text | yes | - |
| `data` | jsonb | no | `'{}'::jsonb` |
| `started_at` | timestamp with time zone | yes | - |
| `deadline_at` | timestamp with time zone | yes | - |
| `submitted_at` | timestamp with time zone | yes | - |
| `time_limit_seconds` | integer | yes | - |
| `status` | text | no | `'graded'::text` |
| `score` | integer | no | `0` |
| `total_questions` | integer | no | `0` |
| `answered_questions` | integer | no | `0` |
| `correct_answers` | integer | no | `0` |
| `incorrect_answers` | integer | no | `0` |
| `unanswered_questions` | integer | no | `0` |
| `percentage` | numeric | yes | - |
| `auto_submitted` | boolean | no | `false` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

### `quiz_requests`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `trainee_id` | text | no | - |
| `program_id` | text | no | - |
| `quiz_id` | text | no | - |
| `status` | text | no | `'pending'::text` |
| `data` | jsonb | no | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | no | `now()` |

### `quiz_sessions`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `trainee_id` | text | no | - |
| `program_id` | text | no | - |
| `quiz_id` | text | no | - |
| `data` | jsonb | no | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | no | `now()` |
| `started_at` | timestamp with time zone | yes | - |
| `deadline_at` | timestamp with time zone | yes | - |
| `time_limit_seconds` | integer | yes | - |
| `timer_version` | smallint | no | `2` |

### `schedules`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `program_id` | text | yes | - |
| `trainer_id` | text | yes | - |
| `date` | date | yes | - |
| `data` | jsonb | no | `'{}'::jsonb` |

### `settings`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | `'global'::text` |
| `data` | jsonb | no | `'{}'::jsonb` |
| `updated_at` | timestamp with time zone | no | `now()` |

### `specializations`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | uuid | no | `gen_random_uuid()` |
| `name` | text | no | - |
| `slug` | text | no | - |
| `description` | text | yes | - |
| `is_active` | boolean | no | `true` |
| `sort_order` | integer | no | `0` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

### `trainer_feedback`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | `('tf-'::text || replace((gen_random_uuid())::text, '-'::text` |
| `trainee_id` | text | no | - |
| `trainer_id` | text | no | - |
| `program_id` | text | no | - |
| `enrollment_id` | text | no | - |
| `feedback_text` | text | no | - |
| `learning_experience` | text | yes | - |
| `trainer_strengths` | text | yes | - |
| `areas_for_improvement` | text | yes | - |
| `recommendation` | text | yes | - |
| `rating` | smallint | yes | - |
| `is_submitted` | boolean | no | `true` |
| `submitted_at` | timestamp with time zone | yes | - |
| `corrected_at` | timestamp with time zone | yes | - |
| `corrected_by` | text | yes | - |
| `correction_reason` | text | yes | - |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |

### `trainer_feedback_revisions`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | uuid | no | `gen_random_uuid()` |
| `feedback_id` | text | no | - |
| `previous_values` | jsonb | no | - |
| `reason` | text | no | - |
| `corrected_by` | text | yes | - |
| `created_at` | timestamp with time zone | no | `now()` |

### `trainer_invitations`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | uuid | no | `gen_random_uuid()` |
| `trainer_id` | text | no | - |
| `email` | text | no | - |
| `token_hash` | text | yes | - |
| `invitation_status` | text | no | `'pending'::text` |
| `provider` | text | no | `'supabase_auth'::text` |
| `expires_at` | timestamp with time zone | yes | - |
| `sent_at` | timestamp with time zone | yes | - |
| `used_at` | timestamp with time zone | yes | - |
| `activated_at` | timestamp with time zone | yes | - |
| `created_by` | text | yes | - |
| `created_at` | timestamp with time zone | no | `now()` |
| `metadata` | jsonb | no | `'{}'::jsonb` |

### `trainer_programs`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | uuid | no | `gen_random_uuid()` |
| `trainer_id` | text | no | - |
| `program_id` | text | no | - |
| `assigned_by` | text | yes | - |
| `assigned_at` | timestamp with time zone | no | `now()` |
| `status` | text | no | `'active'::text` |

### `trainer_ratings`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `trainee_id` | text | yes | - |
| `trainer_id` | text | yes | - |
| `program_id` | text | yes | - |
| `data` | jsonb | no | `'{}'::jsonb` |

### `typing_test_requests`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `trainee_id` | text | no | - |
| `program_id` | text | no | - |
| `trainer_id` | text | yes | - |
| `status` | text | no | `'pending'::text` |
| `data` | jsonb | no | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | no | `now()` |

### `typing_tests`

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | text | no | - |
| `trainee_id` | text | yes | - |
| `program_id` | text | yes | - |
| `trainer_id` | text | yes | - |
| `data` | jsonb | no | `'{}'::jsonb` |

## 3. Relationships (foreign keys)

| Table | Column | References |
|-------|--------|------------|
| `announcement_reads` | `announcement_id` | `announcements.id` |
| `announcement_reads` | `user_id` | `profiles.id` |
| `exam_attempt_answers` | `attempt_id` | `exam_attempts.id` |
| `profiles` | `specialization_id` | `specializations.id` |
| `quiz_attempt_answers` | `attempt_id` | `quiz_attempts.id` |
| `trainer_feedback` | `corrected_by` | `profiles.id` |
| `trainer_feedback` | `enrollment_id` | `enrollments.id` |
| `trainer_feedback` | `program_id` | `programs.id` |
| `trainer_feedback` | `trainee_id` | `profiles.id` |
| `trainer_feedback` | `trainer_id` | `profiles.id` |
| `trainer_feedback_revisions` | `corrected_by` | `profiles.id` |
| `trainer_feedback_revisions` | `feedback_id` | `trainer_feedback.id` |
| `trainer_invitations` | `created_by` | `profiles.id` |
| `trainer_invitations` | `trainer_id` | `profiles.id` |
| `trainer_programs` | `assigned_by` | `profiles.id` |
| `trainer_programs` | `program_id` | `programs.id` |
| `trainer_programs` | `trainer_id` | `profiles.id` |
| `trainer_ratings` | `trainee_id` | `profiles.id` |
| `trainer_ratings` | `trainer_id` | `profiles.id` |

## 4. Notes

- Most domain objects keep their rich payload in a JSONB data column; the typed columns exist for RLS, indexing and ordering.
- public.settings is a single row (id = global). If the row is missing the app falls back to defaults, so an empty table is valid.
- public.audit_logs is written only by definer functions and is not writable by client roles.
- Row Level Security is enabled on every table; see docs/BACKEND.md section 7 and migrations 047-065 for the policy set.

## 5. Regenerating this document

Run this query and rebuild the tables above:

```sql
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
 order by table_name, ordinal_position;
```
