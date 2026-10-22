# UAT & System Verification Report

**System:** HYT Global Institute — LMS Portal
**Environment:** Production project `eebvyivdmvhjcqqitmyu` (Supabase) + https://tesda-lms-qt64.vercel.app
**Date of this pass:** 22 October 2026
**Checklist used:** `LMS_System_Turnover_Checklist_Engr_James_Borja_Docu_002` (functional, security, data integrity, performance, error handling, compatibility, deployment)
**Turnover document:** `LMS_System_Turnover_Checklist_Engr_James_Borja` — deliverable status in section 6.
**Checklist to execute:** [UAT_CHECKLIST_v2.1.docx](UAT_CHECKLIST_v2.1.docx) (v2.1, 22 Oct 2026) — 250 checks; supersedes v2.0 in `UAT_CHECKLIST.docx`.

---

## 0. How to read this report

| Mark | Meaning |
|------|---------|
| **PASS** | Verified in this pass (live database probe, unit test or build). |
| **PASS (note)** | Works, with a documented caveat that does not block acceptance. |
| **FIXED** | A defect was found in this pass and corrected; the fix is verified. |
| **OPEN** | Known limitation, recorded in section 5 with an owner and recommendation. |
| **N/A** | Not applicable to a static SPA with a managed backend. |

Verification methods used: live PostgREST calls signed with real user JWTs, SQL
probes through the Supabase Management API, the automated Vitest suite, and a
production build. Items that need a human on a device are marked **PASS (note)**
and listed for the manual walkthrough.

---

## 1. Functional testing

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1.1 | Login, logout, password reset | **PASS** | Supabase GoTrue; `POST /auth/v1/recover` returns 200 for the Super Admin address; logout calls `signOut()` and clears the local store. |
| 1.2 | User registration and profile management | **PASS** | Public sign-up creates a trainee; the registrar creates trainer/trainee accounts with an invitation link; profile edits persist (email change mirrored to `profiles.email`, migration 060). |
| 1.3 | Create / edit / delete / view records | **PASS** | Courses, lessons, quizzes, exams, schedules, enrollments, announcements, attendance, payments — all write through `commit()` and land in Postgres. |
| 1.4 | LMS workflows (course → lesson → quiz → exam → enrollment) | **PASS** | Application → registrar approval → requirement verification → payment → lessons → quizzes → exams → automatic completion (`auto_complete_enrollment_trigger`). |
| 1.5 | Search, filters, buttons, links, form submissions | **PASS (note)** | Course search, table filters, program tabs and all CTAs wired; a manual click-through is part of the acceptance walkthrough. |
| 1.6 | Required fields, invalid input, duplicate records | **PASS** | Course code/title uniqueness (12 unit tests), quiz/exam validation (18 tests), settings limits (11 tests), enrollment requirement rules (11 tests). |

## 2. Security and access control

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 2.1 | Valid and invalid login credentials | **PASS** | Invalid credentials return Supabase's generic error; no user enumeration beyond "invalid login credentials". |
| 2.2 | Password reset and session expiration | **PASS** | `jwt_exp = 3600`, refresh-token rotation enabled with a 10 s reuse window; expired sessions fall back to the login screen. |
| 2.3 | Role-based access control | **PASS** | `ProtectedRoute` per role group + RLS on every table. |
| 2.4 | Ordinary users cannot perform administrator functions | **FIXED** | Before this pass `enrollments_write` was `ALL / true`: any trainee could set their own `status` to *Enrolled*. Migration **064** scopes the table and normalises protected fields. Re-tested: trainee self-approval leaves the row `Pending`. |
| 2.5 | Direct URL access to restricted pages | **PASS** | A trainee opening `/admin/*` is redirected to `/trainee`; the same request against PostgREST is refused by policy. |
| 2.6 | Exposed secrets in source or logs | **PASS** | `.env.local` is git-ignored; `.env.example` carries no values; a grep of `src/`, `public/` and `index.html` for JWTs, service-role keys and access tokens returns nothing but a warning comment. Only the anon key ships to the browser, by design. |
| 2.7 | Logout invalidates the session | **PASS** | `supabase.auth.signOut()` (global scope) revokes the refresh token; cached rows are cleared from the store. |

Live access-control matrix executed for migration 064 (real JWTs):

| Action | Actor | Result |
|--------|-------|--------|
| Update another trainee's enrollment | trainee | 0 rows affected |
| Delete another trainee's enrollment | trainee | 0 rows affected, record intact |
| Approve own enrollment | trainee | 200, but `status` stays `Pending` (normalised) |
| Save lesson progress | trainee (owner) | 200, progress written |
| Insert an enrollment for someone else | trainee | 403 `42501` |
| Update an enrollment in their program | assigned trainer | 200 |
| Update an enrollment outside their programs | other trainer | 0 rows affected |
| Approve / reject | Super Admin | 200 |

## 3. Database and data integrity

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 3.1 | Submitted records are saved correctly | **PASS** | Every write path exercised through PostgREST returned 200/201 with the expected payload. |
| 3.2 | Updates and deletions persist after refresh | **PASS** | Rows re-read after the write; the client reloads the full dataset on login and every 60 s. |
| 3.3 | Duplicate, missing and invalid data | **PASS** | Unique constraints (profiles.email, trainer_programs, announcement_reads, attendance per session) plus client validation before submit. |
| 3.4 | Relationships between users, courses, enrollments, results | **PASS** | 19 foreign keys; cascades remove dependent rows when a program or trainee is deleted (see `docs/DATA_DICTIONARY.md`). |
| 3.5 | One user cannot read another user's private records | **PASS** | Enrollment reads are scoped to the owner, the assigned trainer and the Super Admin (066). Profile reads are scoped to self, trainers and a trainer's own trainees (067). Attendance is scoped to the owner or a trainer of that program (067). Verified for all 19 accounts. |
| 3.6 | Backup and restoration | **PASS** | `scripts/backup.mjs` exports all 24 tables to JSON (tested: 228 rows) and restores them in FK order (restore path tested). Supabase daily backups remain the primary mechanism — procedure in `docs/ADMIN_MANUAL.md`. |

## 4. Performance and load

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 4.1 | Page load and API response | **PASS (note)** | Production build: app chunk 1.04 MB (267 kB gzip) + React 53 kB + charts 111 kB gzip, split so a release does not re-download vendor code. Initial data load is a single parallel batch (one query per collection, plus profiles, settings and trainer assignments). |
| 4.2 | Multiple concurrent users | **OPEN** | Not measured — no load-testing tooling in scope. The stack is stateless (SPA + PostgREST), so capacity is the Supabase plan's. See O-04. |
| 4.3 | Repeated submissions and large retrieval | **PASS** | Double-submit guarded on enrollment (button lock + server round trip); one in-progress attempt per quiz/exam enforced by partial unique indexes; enrollment indexes added in migration 065. |
| 4.4 | CPU, RAM, database load, network | **N/A / OPEN** | Monitored through the Supabase dashboard, not from the application. Baseline capture recommended at go-live. |
| 4.5 | Timeouts, memory leaks, slow queries | **PASS (note)** | 60 s background refresh plus refresh-on-focus, cancelled on unmount; no unbounded timers. Long-running browser sessions should be observed during the pilot. |

## 5. Error handling and debugging

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 5.1 | Empty fields, malformed input, failed requests | **PASS** | Form-level validators, inline field errors, warning/error toasts; a failed write never reports success. |
| 5.2 | HTTP status codes and console errors | **PASS** | Expected codes observed: 200/201 success, 401 unauthenticated, 403 RLS refusal, 400 invalid payload. Production build compiles without warnings other than the chunk-size notice. |
| 5.3 | Clear error messages | **PASS** | e.g. "Enrollment was not saved. Online enrollment may have been closed — please contact the registrar." |
| 5.4 | Failures do not create duplicate or partial records | **FIXED** | Enrollment submission now awaits the server and rolls back the optimistic row when the write is refused; before, a refused row stayed on screen until refresh. |
| 5.5 | Logs without passwords or tokens | **PASS** | Client logs messages and error objects only; the new error boundary logs the stack, never form values. |

## 6. Compatibility and user interface

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 6.1 | Desktop, tablet, mobile layouts | **PASS (note)** | Tailwind breakpoints throughout; sidebar collapses to a drawer below `lg`. Physical-device walkthrough still required. |
| 6.2 | Supported browsers | **PASS (note)** | Targets evergreen Chrome/Edge/Firefox/Safari (ES2020 build). Not formally tested on legacy browsers. |
| 6.3 | Alignment, navigation, readability | **PASS (note)** | Consistent page header, card and table components; 11–12 px labels reserved for metadata. |
| 6.4 | Keyboard navigation and basic accessibility | **OPEN** | Native buttons, labels and focus rings are in place, but modal dialogs do not trap focus or restore it on close. See O-05. |
| 6.5 | File uploads, downloads, printing | **PASS (note)** | Requirement uploads accept image/PDF and preview in-app; receipts render for printing. Files are stored as data URLs inside JSONB (see O-03). |

## 7. Integration, deployment and regression

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 7.1 | Frontend ↔ backend ↔ database | **PASS** | Load is one parallel PostgREST batch; writes are acknowledged before the UI reports success. |
| 7.2 | API endpoints, integrations, file storage | **PASS** | PostgREST + GoTrue + one edge function (trainer invitation). Storage is in-database (O-03). |
| 7.3 | Environment variables and production configuration | **PASS** | `.env.example` documents every variable; Vercel holds the two `VITE_` values; redirect URLs registered in Supabase Auth. |
| 7.4 | Clean deployment using the documented procedure | **PASS** | `npm ci && npm run build` verified; `vercel.json` rewrites SPA routes; steps documented in `README.md`. |
| 7.5 | Re-run previously passed tests after fixes | **PASS** | 147 automated tests across 14 files pass after every change in this pass. |
| 7.6 | Repository, dependencies and build instructions complete | **FIXED** | There was no root `README.md`; added with setup, database, deployment and troubleshooting pointers. |

---

## 8. Defect log (this pass)

| ID | Severity | Defect | Status | Fix |
|----|----------|--------|--------|-----|
| D-01 | **Critical** | Any authenticated user could insert, update or delete any enrollment (`enrollments_write ALL true`), including approving their own application. | **Fixed** | Migration 064: per-command policies + `enforce_enrollment_self_update()` normalising status/decision/ownership. |
| D-02 | High | A render error unmounted the whole tree, leaving a blank page with no recovery. | **Fixed** | `ErrorBoundary` around the app with Reload / Back to sign-in. |
| D-03 | Medium | No root README — setup and deployment steps only existed in scattered notes. | **Fixed** | `README.md`. |
| D-04 | Low | `enrollments` had no index on `trainee_id`, `program_id` or `status`. | **Fixed** | Migration 065. |
| D-05 | Medium | A refused enrollment write left a phantom application on screen until refresh. | **Fixed** | `createEnrollment` awaits the server and rolls back on failure. |
| D-12 | **High** | Every signed-in user could read every enrollment — applicant name, contact details, address, requirements, payment reference (`enrollments_select` was `true`). | **Fixed** | Migration 066: reads scoped to the owner, the explicitly assigned trainer, or a trainer of the program when no trainer is assigned. |
| D-13 | **High** | Every signed-in user could read every profile (contact details, birth date, address) and every attendance record. | **Fixed** | Migration 067: profiles visible to self, trainers and a trainer's own trainees; attendance to the owner or a trainer of that program. |
| D-14 | **Critical** | An anonymous caller holding only the public anon key could read all 9 trainer profiles — email, phone, address, birth date. `profiles_select` (067) had no `TO authenticated` clause, and its `or role = 'trainer'` branch does not depend on the caller, so it was true for `anon`. Found by executing SEC-09. | **Fixed** | Migration 068: the 066/067 read policies and the 064/063 write policies re-created with `TO authenticated`. Re-verified: anon now reads 0 rows from all 24 tables; signed-in row counts unchanged. |
| D-15 | Medium | The same trainee could be enrolled in one program twice — the second POST returned 201, so two applications for one course could sit in the queue with separate payment states. | **Fixed** | Migration 069: unique index on `enrollments (trainee_id, program_id)`; the second insert now returns 409 `23505`. Checked for existing duplicates first — none. |

### 8.1 Checklist execution (22 October 2026)

`docs/UAT_CHECKLIST_v2.1.docx` was executed for every check that can be proven without a browser. Two defects (D-14, D-15) were found by doing so.

| Run | Result |
|-----|--------|
| `npm test` | 147 tests in 14 files, all pass |
| `npm run build` | pass; app chunk 1.04 MB (267 kB gzip) + React 53 kB + charts 111 kB |
| PostgREST probes with real user tokens (1 admin, 2 trainers, 3 trainees) | 18 / 18 |
| Gate probes: self-enrollment closed, maintenance on, duplicate insert | 8 / 8 |
| Anonymous read of all 24 tables | 0 rows (was 9 trainer profiles before 068) |
| `node scripts/backup.mjs` | 228 rows across 24 tables |

**22 of the 250 checks are ticked** in the checklist (all of SEC-01 to SEC-13, the server halves of SA-03 and SA-09, the build and backup steps, and the settings validation test). The remaining **228 need a human in the browser** — email delivery, MFA enrolment, print layout, and the visual states. Each ticked item carries its evidence inline; nothing was ticked on the strength of reading code alone.

### Defects found earlier in the UAT cycle (already closed)

| ID | Defect | Fix |
|----|--------|-----|
| D-06 | Course codes could be duplicated; exam/quiz could be saved without questions | `courseValidation` + `assessmentValidation` (shared rules, 30 tests) |
| D-07 | Approved quiz retake still answered "Quiz already attempted" | Migration 061 counts real rows and honours spare grants |
| D-08 | Trainee could submit a quiz with unanswered questions | Submit blocked, jumps to the first blank, amber counter |
| D-09 | System Settings toggles had no effect (maintenance, self-enroll, thresholds) | Wired across the app + server-side enforcement (062, 063) |
| D-10 | Maintenance mode was client-side only | Migration 062: restrictive RLS on 19 tables + trigger on RPC-written tables |
| D-11 | Online enrollment could be bypassed with a direct API call | Migration 063: `self_enroll_closed` restrictive INSERT policy |

---

## 9. Outstanding issues and limitations

| ID | Item | Impact | Recommendation | Owner |
|----|------|--------|----------------|-------|
| O-01 | Announcements authored by the Super Admin now read "Posted by Administration" to trainees and trainers, because admin profiles are no longer readable by other roles (067). | Cosmetic only — visibility rules are unchanged. | Accept as-is, or add an explicit author-name column to `announcements` if the registrar's name should be shown. | Admin |
| O-02 | Password policy is 6 characters, CAPTCHA is off, and public sign-up stays open during maintenance. | Weaker account protection; sign-ups can continue during a maintenance window. | Raise the minimum to 8–10 characters, enable CAPTCHA, and close sign-up while maintenance mode is on. | Developer / Admin |
| O-03 | Requirement documents and receipts are stored as base64 data URLs inside JSONB. | Large uploads inflate the row and slow the initial load. | Move to Supabase Storage with signed URLs. | Developer |
| O-04 | No load or soak testing has been performed. | Unknown behaviour at concurrency. | Run a k6/Locust profile against a staging copy before the pilot. | Developer |
| O-05 | Modal dialogs do not trap focus. | Keyboard and screen-reader users can tab behind the dialog. | Add a focus trap and return focus to the trigger. | Developer |
| O-06 | Trainees record their own payments; the balance updates immediately. | A trainee can mark themselves paid before the registrar reconciles. | Treat the trainee entry as "for verification" and require registrar confirmation. | Admin |
| O-07 | Password-reset email was accepted by SMTP (HTTP 200) but inbox delivery was not confirmed. | Users may report "no email received". | Confirm receipt in the inbox during the acceptance walkthrough; keep the Gmail app password current. | Admin |

---

## 10. Turnover deliverables (Engr. James Borja checklist)

| Section | Deliverable | Status | Location |
|---------|-------------|--------|----------|
| A | LMS portal, complete and operational | ✔ | https://tesda-lms-qt64.vercel.app |
| A | System access credentials | ✔ | Issued separately through an approved channel |
| A | Source code repository | ✔ | Project git repository (branches: `main`) |
| A | Configuration and deployment | ✔ | `README.md` §3–4, §7; `.env.example`; `vercel.json` |
| A | Database schema and data dictionary | ✔ | `supabase/schema.sql`, `docs/DATA_DICTIONARY.md` |
| A | Backup and restoration procedure | ✔ | `docs/ADMIN_MANUAL.md` §7; `scripts/backup.mjs` |
| B | UAT documentation | ✔ | This document |
| B | Testing and validation report | ✔ | This document §1–8; `npm test` output |
| B | Requirements traceability | ✔ | §1–7 of this document map checklist item → feature → evidence |
| C | System technical manual | ✔ | `docs/BACKEND.md`, `README.md` |
| C | System user manual | ✔ | `docs/USER_MANUAL.md` (+ `.docx`) |
| C | System administration manual | ✔ | `docs/ADMIN_MANUAL.md` |
| C | Troubleshooting and maintenance guide | ✔ | `docs/TROUBLESHOOTING.md` |
| D | Presentation, demonstration, training, knowledge transfer | ☐ | To be scheduled with the receiving team |
| E | Access and permission verification | ✔ | §2 of this document |
| E | Backup and recovery verification | ✔ | §3.6 |
| E | Outstanding issues and limitations | ✔ | §9 |
| E | Formal turnover and acceptance | ☐ | Signature below |

---

## 11. Sign-off

| | Name | Signature | Date |
|---|------|-----------|------|
| Prepared / verified by | Engr. James Borja | | |
| System developer | | | |
| Accepted by (receiving team) | | | |
