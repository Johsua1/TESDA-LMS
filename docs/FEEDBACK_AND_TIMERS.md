# Trainer feedback and timed assessments

Backend-only implementation for:

1. qualitative trainee → trainer feedback, Super Admin review and CSV export;
2. a database-backed course-completion rule that gates feedback;
3. server-authoritative timers for quizzes and exams, including automatic
   submission, idempotent grading and offline deadline enforcement.

No frontend code was changed. The existing tables and records are preserved;
all changes are additive.

---

## 1. Migrations

Apply in order after the existing migrations (041):

| File | Purpose |
|------|---------|
| `042_trainer_feedback.sql` | `trainer_feedback` + `trainer_feedback_revisions`, constraints, indexes, immutability trigger |
| `043_timed_assessment_fields.sql` | attempt clock/score columns, answer tables, `quiz_sessions` clock columns, historical backfill |
| `044_trainer_feedback_functions.sql` | completion rule, eligibility, submission, admin paging, correction, export audit |
| `045_feedback_rls_policies.sql` | feedback read policies (trainee own / trainer own / admin MFA) |
| `046_timed_assessment_functions.sql` | start/save/finalize/get RPCs, server grading, compatibility triggers |
| `047_assessment_rls_updates.sql` | scoped attempt reads, author-only inserts, immutable updates |
| `048_expired_attempt_processing.sql` | expired-attempt processor + optional pg_cron schedule |
| `049_security_hardening_grants.sql` | revoke `TRUNCATE`/`REFERENCES`/`TRIGGER` from `anon`/`authenticated` on the new tables |
| `050_auto_complete_enrollments.sql` | automatic `Completed` status + `sync_all_enrollment_completion()` backfill |
| `051_feedback_visibility.sql` | feedback readable by its author and the Super Admin only — trainers get zero rows |
| `052_trainer_ratings_visibility.sql` | scope star ratings to author / rated trainer / admin (was `USING (true)`) |
| `053_ratings_quantitative_only.sql` | strip legacy comments from `trainer_ratings.data` + trigger that keeps ratings stars-only |
| `054_single_feedback_submission.sql` | stars required in the same submission, mirrored to `trainer_ratings`, rated only once |
| `055_ratings_write_lock.sql` | clients get `SELECT` only on `trainer_ratings`; the RPC is the sole writer |
| `056_exam_grading_record_fix.sql` | exam submissions no longer fail with `record "v_session" is not assigned yet`; session clock is read into scalars |

All files are idempotent. They were applied to the project on 2026-10-21.

---

## 2. Trainer feedback schema

`public.trainer_feedback` (one row per enrollment):

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | `tf-…` |
| `trainee_id` | text FK → profiles | restrict delete |
| `trainer_id` | text FK → profiles | restrict delete |
| `program_id` | text FK → programs | restrict delete |
| `enrollment_id` | text FK → enrollments | unique; restrict delete |
| `feedback_text` | text | required, non-empty |
| `learning_experience` | text | optional |
| `trainer_strengths` | text | optional |
| `areas_for_improvement` | text | optional |
| `recommendation` | text | optional |
| `rating` | smallint | optional, 1–5 |
| `is_submitted` | boolean | default true |
| `submitted_at` | timestamptz | required when submitted |
| `corrected_at`, `corrected_by`, `correction_reason` | audit metadata | admin correction only |
| `created_at`, `updated_at` | timestamptz | |

`trainer_feedback_revisions` stores the previous values, the reason and the
admin who corrected a record. Deletes are always rejected; submitted text is
immutable unless the auditable correction RPC is used.

### Completion rule

An enrollment is complete when all four are true:

* `enrollments.status = 'Completed'`;
* every published lesson in `programs.data.competencies[].lessons` (including
  `units[].lessons`) is present in `enrollments.data.progress`;
* every published quiz passed (best attempt `percentage >= passing`, default 75);
* every published exam passed.

`course_completion(enrollment_id)` returns the counts and the boolean. This is
evaluated in the database, so opening the feedback page cannot make a course
complete.

### Automatic completion (`050`)

The status is no longer a manual step. `sync_enrollment_completion(id)` sets
`Completed` as soon as the work is finished, and three triggers call it:

| Trigger | Fires on |
|---------|----------|
| `enrollments_auto_complete` | `enrollments` INSERT / UPDATE OF `data`, `status` |
| `quiz_attempts_auto_complete` | `quiz_attempts` INSERT / UPDATE OF `percentage`, `status` |
| `exam_attempts_auto_complete` | `exam_attempts` INSERT / UPDATE OF `percentage`, `status` |

Rules:

* Only `Enrolled`, `Approved`, `Ongoing` and `Active` are promoted — a
  `Cancelled`/`Dropped` record is never resurrected.
* A program with **no published lessons** never completes (it is still being
  authored).
* The update sets `app.completion_sync` so the enrollments trigger does not
  recurse, and each trigger swallows its own errors: bookkeeping can never
  reject a trainee's quiz or exam submission.
* `ENROLLMENT_AUTO_COMPLETED` is written to the audit log with the previous
  status and the requirement counts.
* Completion is one-way: nothing in the system reverts a `Completed` record.

`sync_all_enrollment_completion()` runs the same check over every in-progress
enrollment (used for the initial backfill and safe to call again).

### Trainer resolution

`trainer_for_enrollment(enrollment_id)` uses, in order:

1. `enrollments.data.trainerId` (must be a real trainer profile);
2. the single active `trainer_programs` assignment;
3. a valid `programs.trainer_id`.

It returns NULL when the answer is ambiguous or the trainer is not assigned.
The submission RPC never accepts a trainer id from the client.

### Feedback RPCs

```sql
get_my_trainer_feedback_status() -> jsonb
  -- one entry per enrollment: status pending | submitted | not_required

submit_trainer_feedback(
  p_enrollment_id, p_feedback_text,
  p_learning_experience, p_trainer_strengths,
  p_areas_for_improvement, p_recommendation, p_rating
) -> jsonb

admin_trainer_feedback_page(p_filters jsonb, p_limit int, p_offset int) -> jsonb
  -- requires is_super_admin_mfa(); filters: trainer_id, program_id,
  -- trainee_id, enrollment_id, date_from, date_to, search

log_trainer_feedback_export(p_filters jsonb, p_row_count int, p_format text)
admin_correct_trainer_feedback(id, feedback_text, …, reason) -> jsonb
```

Submission is serialized with `SELECT … FOR UPDATE` on the enrollment, checks
ownership and eligibility, derives the trainer, and relies on the unique
enrollment index to reject duplicates. Audit rows are written for submit,
correct and export.

---

## 3. CSV export

Edge Function: `supabase/functions/export-trainer-feedback`.

```
GET  /functions/v1/export-trainer-feedback?trainer_id=…&date_from=…
POST /functions/v1/export-trainer-feedback   { "filters": { … } }
```

Security chain:

1. `requireSuperAdmin(req)` verifies the JWT with Supabase Auth, loads the
   profile, requires an active, activated Super Admin.
2. The session must be AAL2 (MFA). This is enforced even when the account's
   `mfa_enforced` flag is off.
3. The function calls `admin_trainer_feedback_page` and
   `log_trainer_feedback_export` with the **caller's JWT**, so the RPC's own
   `is_super_admin_mfa()` check is the final authority.
4. `service_role` is never used to read feedback rows and never reaches the
   browser.
5. The audit row is written before the file is returned; an audit failure
   fails the export.

Pagination walks 1,000 rows at a time with a stable `submitted_at, id` order.
It never silently truncates; if a report exceeds 1,000,000 rows it returns an
error asking for narrower filters.

CSV rules (`_shared/csv.ts`, unit-tested):

* UTF-8 BOM + CRLF for Excel;
* every field quoted, embedded quotes doubled;
* commas and line breaks preserved inside quotes;
* NUL removed;
* values starting with `=`, `+`, `-`, `@`, tab or CR (after leading
  whitespace) get a leading apostrophe to prevent formula injection.

Columns: trainer name, trainee name, trainee id, course/program, program id,
enrollment id, qualitative feedback, strengths, areas for improvement, learning
experience, recommendations, rating, submission date.

---

## 4. Timed assessment schema

Added to `quiz_attempts` and `exam_attempts`:

`started_at`, `deadline_at`, `submitted_at`, `time_limit_seconds`,
`status`, `score`, `total_questions`, `answered_questions`,
`correct_answers`, `incorrect_answers`, `unanswered_questions`,
`percentage numeric(6,2)`, `auto_submitted`, `created_at`, `updated_at`.

Statuses: `in_progress`, `submitted`, `auto_submitted`, `graded`.

Historical rows are backfilled with `status = 'graded'`, their legacy score,
total and percentage. `deadline_at` stays NULL for historical attempts: no
arbitrary deadline is invented.

Answer storage:

* `quiz_attempt_answers(attempt_id, question_id, answer jsonb, is_correct, answered_at)`
* `exam_attempt_answers` — same shape.

`quiz_sessions` gained `started_at`, `deadline_at`, `time_limit_seconds`
and `timer_version`. The server sets the clock on insert; the client's
`startedAt` is ignored. A session can only be restarted after its old deadline
expired or a trainer approval exists. Pre-migration sessions are
`timer_version = 1` and are ignored by the processor.

Indexes: partial `(deadline_at) WHERE status = 'in_progress'` on both attempt
tables, trainee/status and program indexes, unique partial
`(trainee_id, data->>'quizId')` for live attempts, plus feedback lookup
indexes.

---

## 5. Timer RPCs

```sql
start_quiz_attempt(program_id, quiz_id) -> jsonb
save_quiz_answer(attempt_id, question_id, answer jsonb) -> jsonb
finalize_quiz_attempt(attempt_id) -> jsonb
get_quiz_attempt(attempt_id) -> jsonb

start_exam_attempt(program_id, exam_id) -> jsonb
save_exam_answer(attempt_id, question_id, answer jsonb) -> jsonb
finalize_exam_attempt(attempt_id) -> jsonb
get_exam_attempt(attempt_id) -> jsonb

get_quiz_session_state(program_id, quiz_id) -> jsonb
```

### Start

Verifies the authenticated trainee, an active enrollment, the published
assessment and the trainer's schedule window (Asia/Manila). Creates the attempt
with `started_at = now()` and
`deadline_at = now() + time_limit_seconds`, taken from `timeLimit` (default
30 min quiz / 60 min exam). Returns the existing live attempt instead of
creating a second clock. A unique partial index makes concurrent starts safe.

### Save

Locks the attempt row, checks ownership and `in_progress`, checks the server
clock against `deadline_at`, validates that the question belongs to the
assessment and that the answer is a scalar. If the deadline has passed it
finalizes the attempt and returns `accepted: false`. Answers are never
accepted after finalization. Row locking serializes save vs finalize.

### Finalize

Locks the attempt, returns the stored result if already terminal (idempotent),
loads only persisted answers, grades them, counts unanswered questions as zero,
and writes the final score. `submitted_at` is the server time;
`auto_submitted` is true when the deadline had passed. Repeated calls return
the same score, percentage and timestamp.

### Retrieval

Returns the original `started_at`, original `deadline_at`, current status and
`remaining_seconds = max(0, deadline_at - now())`. If the attempt is still
`in_progress` but expired, retrieval finalizes it before returning. The timer
can therefore never be reset by refreshing, reconnecting or reopening.

### Scoring

```
percentage = (earned_points / total_possible_points) × 100
```

Questions default to 1 point; a question-level `points` field is honored.
Unanswered questions earn zero. The raw `score` is the number of correct
answers. Example: 8 correct out of 15 questions → score 8, total 15,
percentage 53.33%, unanswered 5.

### Legacy frontend compatibility

The existing QuizRunner/ExamRunner submit one row at the end. A BEFORE INSERT
trigger (`grade_legacy_attempt`) keeps that flow working:

* the quiz deadline comes from the server-owned `quiz_sessions` row;
* the exam deadline comes from the recorded `startedAt` plus the configured
  limit;
* the client's score, percentage and per-answer correctness are replaced by a
  server grade;
* a submission later than the deadline plus 30 seconds is rejected.

The 30-second window is transport tolerance for a payload that left the browser
at 00:00. It is not a new deadline and never reopens the attempt.

**Limitation:** the existing exam UI never calls a start endpoint, so a legacy
exam's `startedAt` is client-supplied. The new `start_exam_attempt` RPC is
fully server-authoritative and should be used by any future exam UI. Legacy
quiz starts are server-authoritative because the existing UI already writes a
`quiz_sessions` row, whose clock the database now owns.

---

## 6. RLS summary

| Table | Trainee | Trainer | Super Admin |
|-------|---------|---------|-------------|
| `trainer_feedback` | SELECT own | — (no access) | SELECT all at AAL2 |
| `trainer_feedback_revisions` | — | — | SELECT at AAL2 |
| `quiz_attempts` / `exam_attempts` | SELECT/INSERT/UPDATE own (trigger forces immutable fields); no DELETE | SELECT assigned programs | SELECT all, DELETE (account cleanup) |
| `quiz_attempt_answers` / `exam_attempt_answers` | no direct access | SELECT assigned programs | SELECT all |
| `quiz_sessions` | SELECT/INSERT/UPDATE/DELETE own (clock trigger) | SELECT assigned programs | SELECT/DELETE |
| `trainer_ratings` (stars) | SELECT/INSERT/UPDATE own | SELECT rows about themselves (average) | SELECT all |

No client has INSERT/UPDATE/DELETE on `trainer_feedback`; submission and
correction are definer RPCs. Attempt updates by a client are accepted as a
no-op (idempotent retry) and every protected field is restored by
`protect_assessment_attempt`.

Policies only govern `SELECT`/`INSERT`/`UPDATE`/`DELETE`. Supabase's default
privileges also grant `TRUNCATE` (which ignores RLS entirely) plus
`REFERENCES`/`TRIGGER`; `049` revokes those from `anon` and `authenticated` on
every table introduced by `042`–`048` and on the pre-existing attempt tables.

---

## 7. Expired-attempt processing

`process_expired_assessments()` runs:

* `finalize_expired_attempts(200)` — grades live RPC attempts past their
  deadline;
* `finalize_expired_quiz_sessions(200)` — closes legacy quiz sessions that
  expired without a submission (2-minute grace) and records a zero-score
  forfeited attempt, so the clock cannot be restarted.

The function is executable by `service_role` only. `048` tries to create a
pg_cron job every minute when pg_cron is available. On this project pg_cron was
not enabled, so the migration printed a notice instead of failing.

To enable it:

1. Supabase Dashboard → Database → Extensions → enable `pg_cron`.
2. Re-run `048_expired_attempt_processing.sql`.
3. Verify: `select * from cron.job where jobname = 'process-expired-assessments';`

Alternatively call `select public.process_expired_assessments();` from any
external scheduler. The retrieve/save/finalize RPCs also enforce deadlines on
access, so the scheduler is a safety net rather than the only defence.

---

## 8. Environment and settings

Edge Function secrets (Supabase-injected unless noted):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | injected |
| `SUPABASE_ANON_KEY` | injected; used for the caller-scoped client |
| `SUPABASE_SERVICE_ROLE_KEY` | injected; used only to verify the caller's JWT/profile |

No new secret is required for the export. Never expose the service role key to
the frontend.

Database settings:

* `timeLimit` on each quiz/exam (minutes). Missing/0 falls back to 30/60.
* `passing` on each quiz/exam (default 75).
* Question-level `points` (optional, default 1).
* The 30-second legacy submission tolerance is a constant in
  `grade_legacy_attempt`; change it there if the network environment requires.

---

## 9. Tests

Run:

```bash
node --experimental-strip-types scripts/test-backend.mjs
```

It needs `VITE_SUPABASE_URL` and `SUPABASE_ACCESS_TOKEN` in `.env.local`.
The SQL suite runs in a transaction that is rolled back. The concurrency test
creates a uniquely named fixture and removes it in a `finally` block.

Actual result on 2026-10-21:

```
PASS  SQL acceptance suite (64 checks, rolled back)
PASS  CSV: plain / comma / quote / newline / formula = + - @
PASS  CSV: formula with leading spaces / null / nul stripped
PASS  CSV: BOM + CRLF + quoted header
PASS  CSV: embedded quote, comma and line break survive
PASS  Concurrency: save and finalize cannot both win
PASS  Concurrency: simultaneous finalizations return one result

16/16 checks passed
```

The 64 SQL checks cover: completion, automatic completion (partial progress
stays Enrolled, finishing every lesson sets Completed, audit row, and a program
with no lessons never completes), eligible/duplicate/foreign/ineligible
feedback, trainer derivation, admin filters (trainer, program, trainee,
enrollment, date, search), stable paging, AAL1 refusal (page and export audit),
trainer read isolation, trainer
write denial, correction revisions, audit rows, partial completion scoring
(8/15 = 53.33%), refresh stability, expired exam retrieval, offline grading,
post-deadline rejection, idempotent finalization, legacy insert regrading,
client tampering, legacy session-clock integrity, legacy session submission,
RLS isolation, and that no client role holds `TRUNCATE` on the new tables
(`TRUNCATE` bypasses RLS, so the grant itself must be removed).

---

## 10. Frontend

The UI reads and writes only through the RPCs above; there is no direct DML on
`trainer_feedback` or the answer tables.

| Route | Page | What it does |
|-------|------|--------------|
| `/trainee/feedback` | `src/pages/trainee/TrainerFeedback.jsx` | Lists every enrollment with `get_my_trainer_feedback_status()`. `pending` rows open a single form — **required 1–5 stars**, required qualitative text, four optional narrative fields — and call `submit_trainer_feedback`. `submitted` rows render read-only. |
| `/admin/feedback` | `src/pages/admin/ManageFeedback.jsx` | Calls `admin_trainer_feedback_page()` with trainer/program/date/search filters and 25-row paging, opens a detail modal, and calls `admin_correct_trainer_feedback()` with a mandatory reason. **Export CSV** downloads through the Edge Function. Without AAL2 the page shows an MFA banner instead of an empty table. |

Trainers have **no** feedback page: `051` removed their read policy, so the
trainer role receives zero rows even for feedback written about them. Only the
author (trainee) and a Super Admin at AAL2 can read a row.

The trainee fills **one form**: stars first, then the written feedback, submitted
together. There is no separate rating page any more.

* `submit_trainer_feedback()` requires the star rating (1–5) as well as the
  text, and mirrors the stars into `trainer_ratings` so the trainer's average
  keeps working from one submission.
* A rating is submitted **once**: `055` removed the client `INSERT`/`UPDATE`
  grants, so a trainee cannot create a rating outside the RPC, and
  `prevent_trainer_rating_change()` rejects any update. The RPC and a Super
  Admin are the only writers.
* `053` removed the legacy comment text from `trainer_ratings.data` and
  `sanitize_trainer_rating()` strips `comment`, `feedback`, `feedbackText`,
  `review` and `remarks` from any insert/update and rejects a rating that is not
  a whole number from 1 to 5.

Shared helpers:

* `src/lib/feedback.js` — feedback RPCs + the CSV download (calls the Edge
  Function with the caller's access token; never builds the CSV in the browser).
* `src/lib/assessments.js` — `get_quiz_session_state`, `get_quiz_attempt`,
  `get_exam_attempt`.

### Timer and grading in the runner

`QuizRunner` asks the database for the session clock when the attempt starts
(`get_quiz_session_state`) and then counts down to the **server's**
`deadline_at`, correcting for browser clock skew with `server_time`. The header
shows "Server deadline HH:MM" while the server clock is known; offline it falls
back to the local countdown. After the attempt is saved, both runners call
`get_quiz_attempt` / `get_exam_attempt` and display a "Verified by the server"
panel with the server's score, percentage, and answered/unanswered counts.

The write path is unchanged: the runner still inserts the attempt row once, and
the database trigger re-grades it, so no duplicate attempts are created and the
score of record always comes from the server.

### Deploying the export function

```bash
supabase functions deploy export-trainer-feedback
```

Until it is deployed the **Export CSV** button reports that the function is
missing; it never falls back to an unaudited client-side file.
