# UAT Checklist and Runbook

*Project: TESDA Learning Management System (TESDA-LMS)*

*Revision 2.1 — supersedes 2.0 (2026-10-21)*

## Document Control

| Field | Value |
| --- | --- |
| Document ID | UAT-CHK-001 |
| Version | 2.1 |
| Date | 2026-10-22 |
| Status | Ready for re-execution |
| Supersedes | Version 2.0 (2026-10-21) |
| Environment | __________________  (Demo / Supabase staging / Production-like) |
| Build or commit | __________________ |
| Database revision | schema.sql + migrations 030-069 |
| Prepared by | __________________ |
| Approved by | __________________ |

## What Changed in 2.1

Version 2.0 was written before the fixes below landed. Several of its checks therefore described behaviour that no longer exists, and a few recorded failures that are now closed. This revision restates the system as it behaves today. Where a check changed meaning, the old wording is noted so a tester who ran 2.0 knows what to re-run.

| # | Change | Where it shows up |
| --- | --- | --- |
| 1 | Online self-enrollment is a working, switchable flow. 2.0 stated that a trainee cannot apply and that migration 037 disabled enrollment permanently. The switch in System Settings now opens and closes the form, and the database refuses the insert while it is closed. | SA-03, TRA-02, E2E-06, SEC-03 |
| 2 | Every System Preference now changes behaviour instead of only saving a value: institution name, academic year, default passing score, typing passing rate, attendance requirement, self-enrollment, email notifications, maintenance mode. | SA-07, SA-09, TR-09 |
| 3 | Maintenance mode is enforced on the server. 2.0 marked this as failed; it is now a restrictive RLS gate on 19 tables plus a trigger on the tables written by RPCs. | SA-09, E2E-05, SEC-12 |
| 4 | Enrollment writes are scoped per command. Until migration 064 any signed-in user could insert, approve, edit or delete any enrollment. | SEC-03, SEC-04, SEC-05 |
| 5 | Enrollment reads are scoped to the owner, the assigned trainer, or a trainer of the program when no trainer is assigned (migration 066). | SEC-02 |
| 6 | Profile and attendance reads are scoped (migration 067). A trainee no longer receives the whole staff directory or another trainee's attendance. | SEC-01, SEC-07 |
| 7 | Duplicate course codes and duplicate course titles are rejected, and an assessment cannot be saved without questions and a passing score. 2.0 marked both as failed. | SA-04, TR-03, TR-04 |
| 8 | An approved retake now actually starts (migration 061 counts real attempts and honours spare grants). | TR-05, TRA-04 |
| 9 | A quiz cannot be submitted with unanswered questions; the first blank is focused. | TRA-04 |
| 10 | A refused enrollment save rolls back the optimistic row and shows an error, instead of leaving a phantom application on screen. | TRA-02, TRA-09, DAT-04 |
| 11 | A render error shows an error boundary with Reload and Back to sign in instead of a blank page. | TRA-09, UX-05 |
| 12 | A logical backup and restore script exists, so destructive tests are recoverable. | 2.2, DAT-05 |
| 13 | Three payment observations from 2.0 were never closed. They are re-tested in SA-05 and TRA-08 rather than assumed fixed. | SA-05, TRA-08 |

## 1. How to Run This UAT

Execute in five passes, in order. Do not start the next pass until the current gate is met.

> **Note:** Run this checklist against a Supabase staging project. Demo mode has no database, no auth and no RLS, so it cannot satisfy any SEC- check, SA-08, SA-09 or E2E-05. Use it only for a quick look at the interface.

> **Note:** Two testers are recommended: one drives the browser, one watches the Network panel. Several checks are visible only in the response body or status code, not on screen.

Result codes: PASS, FAIL, BLOCKED, N/A.

Severity: S1 critical, S2 high, S3 medium, S4 low.

Each runbook group is a numbered set of checks. Tick every box. Mark the group FAIL if any box fails, and record the defect ID beside the group.

### 1.1 Execution plan

| Phase | Scope | Time | Owner | Gate |
| --- | --- | --- | --- | --- |
| 0. Setup | Install, configure, apply migrations, take a backup, create accounts and test data | 20 min | QA | App runs, Section 3 data exists, backup snapshot taken |
| 1. Smoke | Section 5 | 20 min | QA | All smoke checks pass |
| 2. Role acceptance | Sections 6-8, including SA-09 | 3-4 hrs | QA plus role representatives | No open S1/S2 defects; preference matrix signed off |
| 3. End-to-end and security | Sections 9-10 | 2 hrs | QA and technical lead | All E2E scenarios pass; SEC-01 to SEC-13 pass on a real token |
| 4. Sign-off | Exit criteria and approvals | 30 min | Product owner | Section 12 completed |

## 2. Setup

### 2.1 Demo mode

Use this for a quick UI review only. It satisfies no gate.

```
npm install
npm run dev
```

- [ ] Confirm .env.local does not define VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.
- [ ] Confirm the app loads with seeded demo data.
- [ ] Confirm the interface identifies the data store as local or demo.
- [ ] Confirm System Information names the active data store, and that it is not reported as Supabase.

### 2.2 Supabase mode

Use this for full UAT and sign-off.

```
Copy-Item .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

node scripts/configure-auth.mjs

# Apply supabase/schema.sql, then every file in supabase/migrations in
# filename order (030 through 069). schema.sql already contains 003-016,
# which have no standalone migration file.

supabase functions deploy create-trainer
supabase functions deploy resend-trainer-invitation

# Logical backup before destructive tests:
node scripts/backup.mjs
# Restore: node scripts/backup.mjs --restore backups/<stamp>
```

- [ ] Supabase project is reachable and the anon key in .env.local belongs to it.
- [ ] supabase/schema.sql and migrations 030-069 are applied with no error.
- [ ] Both edge functions are deployed and report no boot error in the function logs.
- [ ] Auth redirect URLs include /welcome and /reset-password.
- [ ] Test email delivery works: create a throwaway trainer and confirm the activation email arrives.
- [ ] A TOTP authenticator app is available for the MFA checks.
- [x] npm test and npm run build complete without errors.  ✔ npm test + build, 22 Oct 2026
- [x] node scripts/backup.mjs writes a snapshot with a row count for every table, and the count for profiles matches the number of accounts in the Auth dashboard.  ✔ live probe, 22 Oct 2026

### 2.3 Mandatory risk checks

These are the areas where a passing screen can still hide a broken system. Every row must have a recorded result before sign-off.

| Risk | Why it matters | Where tested |
| --- | --- | --- |
| Settings toggles could be cosmetic | Passing score, typing rate, attendance requirement, self-enrollment, email and maintenance once saved values without changing behaviour. All are now wired through the UI and, where a write is involved, enforced in the database. | SA-07, SA-09, TR-09, TRA-02 |
| Self-enrollment is a switch, not a constant | With the switch off the trainee form closes and a direct API insert is refused; with it on the flow must complete end to end. Test both directions, not one. | SA-03, TRA-02, E2E-06 |
| Enrollments are the most sensitive table | They carry names, contact details, addresses, requirement documents and payment references. Until migration 064 any signed-in user could write them; until 066 anyone could read them. | SEC-02, SEC-03, SEC-04, SEC-05 |
| Global vs per-assessment passing scores | Quizzes and exams carry their own passing value; the global default only applies where a record has none. Confirm the intended behaviour rather than assuming either. | SA-07, SA-09, TR-03, TRA-04 |
| The attendance requirement appears in four places | Admin reports, trainer progress, trainee attendance and the grades legend all read the same setting. A stale copy in one screen is a defect. | SA-09, TR-09, TRA-06 |
| Session is tab-scoped | Sessions live in sessionStorage: a reload keeps the user, closing the tab does not. | SMK-09 |
| Enforcement must be server-side | Hiding a button is not a control. RLS and the API must deny the write as well. | SEC-01 to SEC-12 |
| Time-window boundaries | Quiz, exam and attendance rules depend on exact start and deadline behaviour, including a reload mid-attempt. | TRA-04, TRA-05, TR-06 |
| Destructive actions | Deleting users or content must not leave orphaned enrollments, attendance or assessments. | SA-01, SA-02, SA-04 |
| MFA recovery | A lost authenticator must not permanently lock administration out of the system. | SA-08 |
| Maintenance mode must not strand the administrator | The gate exempts the Super Admin. If it did not, nobody could switch it off again. | SA-09, E2E-05, SEC-12 |

## 3. Test Data

Demo credentials are for demo mode only. Create dedicated accounts in the staging project for shared environments, and never point this checklist at production data.

Create the following accounts and records before Pass 1.

| ID | Role / setup | Purpose |
| --- | --- | --- |
| SA-01 | Super Admin, MFA enrolled | Admin workflows, MFA, preferences |
| TR-01 | Trainer assigned to PRG-01 | Content, attendance, decisions |
| TR-02 | Trainer assigned to PRG-02 | Isolation checks |
| TR-03 | Newly invited trainer | Invitation and activation |
| TR-04 | Second trainer on PRG-01, with a different set of trainees | Co-trainer isolation: sees only their own trainees |
| TN-01 | Trainee with an approved PRG-01 enrollment, trainer TR-01 | Course and assessment flows |
| TN-02 | Newly registered trainee, no enrollment | Registration and access denial |
| TN-03 | Trainee with a pending and a rejected enrollment | Enrollment gating and remarks |
| TN-04 | Trainee on PRG-01 assigned to TR-04, not TR-01 | Read-scope negative checks |
| PRG-01 | Virtual Assistant program | Typing test and content |
| PRG-02 | Non-Virtual-Assistant program | Cross-program isolation |
| SCH-01 | Future trainer session on PRG-01 | Attendance |
| QZ-01 | Quiz with a future start and deadline | Quiz window |
| EX-01 | Exam with a future start and deadline | Exam window |

Passwords are set at activation. Record them in the test log, not in this document.

Demo mode accounts only:

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | admin@tesda.gov.ph | admin123 |
| Trainer | juan@tesda.gov.ph | trainer123 |
| Trainee | angel@trainee.ph | trainee123 |

## 4. Recording Results

Use this format in the runbooks:

```
Result: PASS / FAIL / BLOCKED / N/A
Defect: DEF-___    Tester: ________    Date: __________
Browser / build: ______________________
Notes: __________________________________________________
```

Raise a defect for every failed or blocked check. Include the test ID, steps, expected result, actual result, severity, browser, account, and a screenshot or recording. For a security check, include the request and the response status code.

## 5. Smoke Suite (Every Build)

- [ ] SMK-01  /login loads without a blank screen or console error.
- [ ] SMK-02  Super Admin signs in and reaches /admin; MFA is requested when enforced.
- [ ] SMK-03  Trainer signs in and reaches /trainer with assigned programs visible.
- [ ] SMK-04  Trainee signs in and reaches /trainee with their enrollment visible.
- [ ] SMK-05  Opening an admin route as trainer or trainee redirects to the correct role home.
- [ ] SMK-06  Admin dashboard counts load and are not all zero.
- [ ] SMK-07  Trainer can open an assigned program's content.
- [ ] SMK-08  Trainee can open an approved course and mark a lesson complete.
- [ ] SMK-09  Sign out and reopen the app in a new tab; the previous session is not restored.
- [ ] SMK-10  Announcements and schedules appear for the correct audience.
- [ ] SMK-11  No uncaught exception appears in DevTools during the checks above.
- [ ] SMK-12  Reloading the page preserves the signed-in user within the same tab.
- [ ] SMK-13  The sidebar and login screen show the institution name from System Settings, not a hard-coded value.
- [ ] SMK-14  Every list shows either rows or an empty state; none stays on a spinner.

**Result: ______ of 14 checks        Defect: ______________**

## 6. Super Admin Runbook

### SA-01 — Trainer lifecycle

- [ ] Create a trainer with name, email, phone, address, position, specialization and at least one program.
- [ ] The new trainer has role trainer and status pending_activation.
- [ ] No temporary password is displayed or emailed in plain text.
- [ ] The success panel states whether the activation email was sent, and the email arrives.
- [ ] Resending the invitation sends a new email and does not create a duplicate user.
- [ ] Creating another user with the same email is rejected before any email is sent.
- [ ] TR-03 opens the activation link, sets a password, and signs in successfully.
- [ ] TR-03 sees only assigned programs and cannot open admin pages.
- [ ] Deleting a trainer requires confirmation and leaves no orphaned assignments, schedules or content.
- [ ] With System Settings > Email notifications off, creating a trainer reports that no email was sent and the test inbox receives nothing.

**Result: ______ of 10 checks        Defect: ______________**

### SA-02 — Trainee lifecycle

- [ ] Create a trainee with personal details, at least one program, and a trainer for each program.
- [ ] The trainee receives an activation email and can set a password.
- [ ] Duplicate email creation is rejected.
- [ ] Each assigned program appears immediately as the trainee's course, without a separate enrollment step, and is funded as a scholarship.
- [ ] Two trainees on the same program can be assigned different trainers, and each trainer sees only their own trainee.
- [ ] Changing a trainee's trainer is reflected after the trainee signs in again.
- [ ] Removing a program from the trainee removes that course; reassigning the trainer removes the old trainer's access to that trainee's program.
- [ ] Deleting a trainee requires confirmation and handles enrollment, attendance and assessment history safely.

**Result: ______ of 8 checks        Defect: ______________**

### SA-03 — Enrollment queue and access

The switch in System Settings > Allow online self-enrollment is the control under test. Test it on, then off, then on again.

- [ ] With self-enrollment ON, a trainee opens Enroll Now, completes the three steps and submits; the application appears in the admin queue as Pending.
- [x] With self-enrollment OFF, the trainee sees a closed notice, the Submit button is disabled, and a direct POST to /rest/v1/enrollments from the trainee's own session is refused with 403.  ✔ live probe, 22 Oct 2026
- [ ] Turning the switch back ON restores the form without a code change or redeploy.
- [x] An admin can still create an enrollment for a trainee while self-enrollment is OFF.  ✔ live probe, 22 Oct 2026
- [x] A trainee whose application was rejected can still correct and resubmit it while self-enrollment is OFF.  ✔ live probe, 22 Oct 2026
- [ ] Admin assignment creates a pending or under-review enrollment, and a pending enrollment grants no course access.
- [ ] Approving the enrollment grants access to the course, lessons and assessments.
- [ ] Rejecting requires remarks; without them the action is refused. The trainee sees the remarks and Enroll Now becomes available again.
- [ ] Completing and cancelling an enrollment change access and payment state correctly.
- [x] A duplicate enrollment for the same trainee and program is blocked.  ✔ live probe, 22 Oct 2026
- [ ] Pending, active, completed and rejected tabs show the correct records and counts.
- [ ] A direct lesson URL for a non-approved program is denied.

**Result: ______ of 12 checks        Defect: ______________**

### SA-04 — Curriculum oversight

- [ ] Create a course with code, title, level, fee, hours, duration, description and trainer.
- [ ] A missing title or course code is rejected with a field-level message.
- [ ] A duplicate course code is rejected. Codes are compared after trimming and upper-casing, so bp-201 and BP-201 collide.
- [ ] A duplicate course title is rejected and the message names the existing code.
- [ ] Reassigning the trainer transfers content management to the new trainer.
- [ ] Existing lessons, quizzes and exams are visible to the assigned trainer.
- [ ] Admin lesson, quiz and exam views show records without exposing unauthorized edit actions.
- [ ] Deleting a course or content requires confirmation and does not orphan related records.

**Result: ______ of 8 checks        Defect: ______________**

### SA-05 — Payments and accounting

> **Note:** Version 2.0 recorded failures on the payment-method row, on admin-recorded payments appearing in the trainee's history, and on cancelled enrollments retaining a balance. Those three are re-tested here and must be closed or raised as defects.

- [ ] A self-pay enrollment with no payment is unpaid and shows the full balance.
- [ ] Paying the remaining balance changes the status to Fully Paid and leaves a zero balance.
- [ ] GCash, Maya, Bank Transfer and Over-the-Counter payments are recorded with the correct method and reference.
- [ ] A scholarship enrollment has no trainee balance due.
- [ ] Admin-recorded payments appear in the trainee's payment history.
- [ ] Accounting billed, collected and balance totals reconcile with enrollment and report data.
- [ ] Cancelled or rejected enrollments do not retain an active balance that cannot be explained.
- [ ] A trainee cannot mark their own payment as verified; the entry is recorded for registrar confirmation (see O-06).

**Result: ______ of 8 checks        Defect: ______________**

### SA-06 — Schedules and attendance oversight

- [ ] Create a future session with program, lesson, date, start and end time, class type and meeting link.
- [ ] A start time in the past is rejected.
- [ ] An end time earlier than the start time is rejected.
- [ ] Editing and deleting a session work, and deletion requires confirmation.
- [ ] Online and hybrid sessions expose a usable meeting link; face-to-face sessions do not require one.
- [ ] Trainees see only sessions for their enrolled programs.
- [ ] Admin attendance records match trainer entries.
- [ ] Admin cannot create attendance for a session that has not started.

**Result: ______ of 8 checks        Defect: ______________**

### SA-07 — Reports, settings and system behaviour

- [ ] Dashboard totals match underlying user, program, enrollment, attendance and assessment records.
- [ ] Report filters update tables and charts correctly.
- [ ] CSV export contains the filtered data currently displayed.
- [ ] Print layout is readable and does not cut critical columns.
- [ ] Institution name and academic year save and persist after reload, and appear on the login screen, the sidebar and printed output.
- [ ] Changing the default passing score changes the pass threshold shown to trainees and the default used where an assessment carries no passing value.
- [ ] Changing the typing passing rate changes typing pass/fail immediately for existing results.
- [ ] Changing the attendance requirement changes the trainee warning, the trainer progress figure and the admin report in the same session.
- [ ] The self-enrollment toggle opens and closes the trainee application flow (SA-03). A dead control is a defect.
- [ ] Maintenance mode blocks trainee and trainer access and allows the Super Admin to restore it (SA-09, E2E-05).
- [ ] The email notification toggle is observable in the test inbox.
- [ ] System Information accurately identifies the active data store in Supabase mode.
- [ ] Reset All Data reloads server data in Supabase mode and never wipes the shared database.

**Result: ______ of 13 checks        Defect: ______________**

### SA-08 — MFA and announcements

- [ ] Enabling MFA shows a QR or secret, verifies a valid code, and enforces the second factor.
- [ ] An invalid MFA code is rejected and does not open the dashboard.
- [ ] A restored AAL1 session is blocked by the MFA gate, and the block is server-side, not only a redirect.
- [ ] Disabling MFA removes enforcement and the factor; the next sign-in requires only a password.
- [ ] Trainer and trainee tokens cannot call MFA administration RPCs.
- [ ] The MFA recovery process is documented and leaves the organisation an admin access path.
- [ ] Create an announcement for all users, a trainee-only audience, and one program.
- [ ] Each announcement is visible only to its intended audience.
- [ ] Pinned or high-priority announcements display first and remain pinned after reload.
- [ ] Editing and deleting announcements propagate to audience views.
- [ ] An announcement written by the Super Admin shows an author label that does not expose the admin's profile to trainees (expected: Posted by Administration; see O-01).

**Result: ______ of 11 checks        Defect: ______________**

### SA-09 — System preference enforcement

One row per preference. Change the value as Super Admin, then confirm the effect in every place listed. Tick only when the effect is visible without a redeploy, and state the database half where the row has one.

| Preference | Effect that must be visible | Database half |
| --- | --- | --- |
| Institution name | Login screen, sidebar, page titles, printed reports | None (display only) |
| Academic year | Report headers, printed output, enrollment records | None (display only) |
| Default passing score | Trainee grades legend and thresholds; the fallback where an assessment has no passing value | None |
| Typing passing rate | Typing result pass/fail, trainee grades, trainer typing view | None |
| Attendance requirement | Trainee attendance warning, trainer progress, admin reports | None |
| Allow online self-enrollment | Trainee Enroll Now form opens or closes; submit disabled with a notice | Restrictive INSERT policy self_enroll_closed (063) |
| Email notifications | Trainer and trainee creation report whether an email was sent; no request when off | None |
| Maintenance mode | Trainee and trainer see the maintenance notice; the Super Admin is unaffected | Restrictive RLS on 19 tables plus a BEFORE trigger on RPC-written tables (062) |

- [ ] Institution name and academic year: changed, verified in all three places, then restored.
- [ ] Default passing score: changed, verified in the trainee grades view, then restored.
- [ ] Typing passing rate: changed, verified on an existing typing result, then restored.
- [ ] Attendance requirement: changed, verified in the trainee view, trainer progress and admin report, then restored.
- [x] Allow online self-enrollment: verified ON and OFF, including the 403 on a direct insert, then left in the agreed state.  ✔ live probe, 22 Oct 2026
- [ ] Email notifications: verified ON and OFF against the test inbox, then restored.
- [x] Maintenance mode: verified ON and OFF, including the 403 on a trainee write and continued admin access, then left OFF.  ✔ live probe, 22 Oct 2026
- [ ] Every value survives a reload and a fresh sign-in.
- [x] Values that are out of range (passing score 0 or 101, attendance 0) are rejected with a message.  ✔ npm test + build, 22 Oct 2026

**Result: ______ of 9 checks        Defect: ______________**

## 7. Trainer Runbook

### TR-01 — Program isolation

- [ ] Trainer sees only programs assigned through trainer_programs, the profile programs array, or the course trainerId.
- [ ] Opening an unassigned program URL does not reveal content or management actions.
- [ ] Creating or changing content for another trainer's program fails through the UI and through the API (SEC-06).
- [ ] The trainer cannot access admin user, setting or report pages.

> **Note:** Version 2.0 could not confirm the second and third boxes. They are the UI half of SEC-06 and must be recorded here, not skipped.

**Result: ______ of 4 checks        Defect: ______________**

### TR-02 — Lessons

- [ ] Create a lesson with competency, unit, title, description, content, duration and published state.
- [ ] Empty titles or invalid durations are rejected.
- [ ] Attach a video URL and materials; the trainee can view and download them.
- [ ] Unpublishing a lesson hides it from trainees without deleting progress.
- [ ] Editing and deleting a lesson requires confirmation where destructive, and does not orphan quizzes unexpectedly.

**Result: ______ of 5 checks        Defect: ______________**

### TR-03 — Quizzes

- [ ] Create a quiz with multiple-choice, true/false and identification questions.
- [ ] The quiz cannot be saved without required fields, at least one question, and a correct answer for every question.
- [ ] A schedule with start and deadline is required before a trainee can start.
- [ ] The configured passing score is saved and used in results.
- [ ] A quiz without a schedule is blocked for the trainee.
- [ ] The quiz opens only inside its schedule window.

**Result: ______ of 6 checks        Defect: ______________**

### TR-04 — Exams

- [ ] Create an exam with a question bank, question count, passing score and schedule.
- [ ] The exam cannot be saved without required fields, a passing score and at least one question; the field-level error names the problem.
- [ ] An exam with zero questions cannot be published or scheduled.
- [ ] The trainee cannot start without a schedule or outside the window.
- [ ] The 60-minute exam timer starts correctly.
- [ ] Exam scores and pass/fail results appear in trainer progress and trainee grades.

**Result: ______ of 6 checks        Defect: ______________**

### TR-05 — Access requests and retakes

- [ ] A completed quiz blocks retakes until the trainer approves one.
- [ ] A missed deadline with no attempt offers late-access requests only when eligible.
- [ ] A duplicate pending request is blocked.
- [ ] Trainer approves or rejects a request with a note.
- [ ] Approval grants exactly one attempt, and that attempt actually starts instead of reporting that the quiz was already attempted.
- [ ] Rejection grants none.
- [ ] The trainer can decide requests only for their own programs.

**Result: ______ of 7 checks        Defect: ______________**

### TR-06 — Attendance

- [ ] Future sessions cannot be marked.
- [ ] An ongoing or completed session can be marked Present, Late, Absent or Excused.
- [ ] Bulk mark-all-present applies, and individual overrides are preserved.
- [ ] Saving creates one record per trainee and prevents duplicates.
- [ ] The trainer cannot edit another trainer's session attendance, including a co-trainer on the same program.
- [ ] Trainees see only their own attendance, with the configured requirement applied.
- [ ] A direct API write to a future session's attendance is refused, not only hidden in the UI.

**Result: ______ of 7 checks        Defect: ______________**

### TR-07 — Progress, evaluations and typing remarks

- [ ] Trainer progress shows the correct trainees, lessons completed, quiz and exam scores, and attendance.
- [ ] A trainee's grade matches the trainee's own grades view.
- [ ] Trainer evaluations save criteria scores, period, remarks and overall result.
- [ ] The trainer can add remarks to a Virtual Assistant typing result for an assigned trainee.
- [ ] The trainer cannot view or edit another trainer's evaluations or typing results.

**Result: ______ of 5 checks        Defect: ______________**

### TR-08 — Trainer schedules

- [ ] Create, edit and delete own-program sessions.
- [ ] Past start times and end-before-start are rejected.
- [ ] The trainee sees the correct date, time, type and meeting link.
- [ ] Another trainer's sessions cannot be edited or deleted.

**Result: ______ of 4 checks        Defect: ______________**

### TR-09 — Preferences as the trainer sees them

- [ ] The header and any printed view show the institution name from System Settings.
- [ ] Trainer progress applies the configured attendance requirement, not a hard-coded 80%.
- [ ] Typing results apply the configured typing passing rate, and a change is visible without a redeploy.

**Result: ______ of 3 checks        Defect: ______________**

## 8. Trainee Runbook

### TRA-01 — Account and profile

- [ ] Activate the account from the invitation, or register successfully.
- [ ] Sign in and land on /trainee.
- [ ] Update name, phone, address, birth date, gender and education; changes persist after reload.
- [ ] Changing email to an existing account is rejected.
- [ ] Change the password with a valid current password; the old password stops working.
- [ ] An incorrect current password blocks the change.

**Result: ______ of 6 checks        Defect: ______________**

### TRA-02 — Enrollment and course access

This group replaces the 2.0 wording, which stated that no online application exists. Both directions of the switch must be tested.

- [ ] With self-enrollment ON, Enroll Now opens a three-step application with the required documents and submits successfully.
- [ ] The submitted application appears in the admin queue as Pending and grants no course access yet.
- [ ] With self-enrollment OFF, the form shows a closed notice and Submit is disabled.
- [ ] With self-enrollment OFF, a direct API insert from the trainee's session is refused (403).
- [ ] A pending or rejected enrollment does not open course content.
- [ ] A rejection shows the registrar's remarks, and Enroll Now becomes available again.
- [ ] An approved or enrolled program opens normally.
- [ ] A completed enrollment retains the intended read-only or access behaviour.
- [ ] Direct URLs to unenrolled or unapproved programs are denied.
- [ ] The trainee cannot change their own enrollment status: a PATCH to their own row returns 200 but the stored status is unchanged.

**Result: ______ of 10 checks        Defect: ______________**

### TRA-03 — Lessons and progress

- [ ] Lesson video, content and materials display correctly.
- [ ] Marking a lesson complete updates progress immediately and after reload.
- [ ] Marking it incomplete reverses the progress correctly.
- [ ] Course and dashboard percentages match the number of completed lessons.
- [ ] No other program's lessons appear in the course.

**Result: ______ of 5 checks        Defect: ______________**

### TRA-04 — Quizzes

- [ ] A quiz with no schedule cannot be started.
- [ ] A quiz before its start time cannot be started.
- [ ] Starting inside the window launches a 30-minute countdown.
- [ ] Leaving and returning resumes the same attempt and the same remaining time, including after a reload.
- [ ] At zero, the attempt submits automatically and cannot be edited.
- [ ] Submitting with an unanswered question is refused; the view jumps to the first blank and a counter shows how many remain.
- [ ] Score, pass/fail and correct/incorrect totals match the answer key and the quiz passing score.
- [ ] A retake is blocked until a trainer approves one additional attempt, and an approved retake starts.
- [ ] A late-access request is available only after an eligible missed deadline.
- [ ] An unauthorized direct start or submission is rejected by the data layer.

**Result: ______ of 10 checks        Defect: ______________**

### TRA-05 — Exams

- [ ] An unscheduled exam cannot be started.
- [ ] An exam before its start time cannot be started.
- [ ] Starting inside the window launches a 60-minute countdown.
- [ ] Submission records the score and pass/fail using the exam passing score.
- [ ] In-window retakes follow the designed behaviour; after-deadline submissions are rejected.
- [ ] Exam results appear in grades and trainer progress.

**Result: ______ of 6 checks        Defect: ______________**

### TRA-06 — Schedules and attendance

- [ ] Only sessions for the trainee's enrolled programs appear.
- [ ] Online and hybrid join links work; face-to-face sessions show the room instead.
- [ ] Attendance shows Present, Late, Absent and Excused accurately.
- [ ] The attendance percentage uses the configured requirement and displays the correct warning state.
- [ ] The trainee cannot edit attendance.

**Result: ______ of 5 checks        Defect: ______________**

### TRA-07 — Typing test

- [ ] A non-Virtual-Assistant trainee sees the program-exclusive message and cannot record a test.
- [ ] A Virtual Assistant trainee can complete a passage.
- [ ] WPM, accuracy, errors, score and pass/fail are calculated correctly.
- [ ] The configured typing passing rate is used.
- [ ] History, best score, best WPM and trainer remarks persist.

**Result: ______ of 5 checks        Defect: ______________**

### TRA-08 — Payments, ratings and announcements

> **Note:** Version 2.0 left two boxes in this group without a result. Re-test both and record an outcome.

- [ ] The trainee sees only their own fees, balance, payment history and receipts.
- [ ] Partial and full payments update status and balance correctly.
- [ ] A scholarship enrollment shows no self-pay balance.
- [ ] One rating per trainer is available for an active enrollment, and the comment saves.
- [ ] The trainer rating summary updates from trainee submissions.
- [ ] Only announcements targeted to the trainee or their program appear.

**Result: ______ of 6 checks        Defect: ______________**

### TRA-09 — Failure handling

- [ ] With the network set to offline, submitting an enrollment shows an error and leaves no phantom application in the list.
- [ ] A failed save shows an error message; the screen never reports success for a write the server refused.
- [ ] A forced render error shows the error boundary with Reload and Back to sign in, not a blank page.
- [ ] Reloading from the error boundary restores the signed-in session within the same tab.

**Result: ______ of 4 checks        Defect: ______________**

## 9. End-to-End Scenarios

### E2E-01 — Trainee intake to course access

1.  Admin creates a trainee, assigns a program and picks the trainer for that program.
2.  Trainee activates the account and signs in.
3.  Admin approves the enrollment (or the assignment already produced it).
4.  Trainee opens the course, schedule and lesson.
5.  Trainer records attendance.
6.  Trainee completes a lesson and passes a quiz.
7.  Trainer sees the progress and result.

Pass: status transitions are correct, access appears only after approval, and all three roles see consistent records.

### E2E-02 — Trainer content delivery and assessment control

1.  Trainer creates a lesson, quiz, exam and scheduled sessions.
2.  Trainee completes the lesson and starts the quiz.
3.  Trainee leaves and resumes; the timer continues from the same point.
4.  Trainee requests a retake; trainer approves one attempt.
5.  Trainee retakes the quiz and takes the exam.
6.  Trainer reviews scores, attendance and progress.
7.  Trainer tries to edit another trainer's content and is denied in the UI and by the API.

Pass: timing and approval rules are enforced, and program isolation holds.

### E2E-03 — Super Admin security and governance

1.  Super Admin enables TOTP MFA.
2.  Sign out and sign back in with a valid code.
3.  Confirm an invalid code is rejected.
4.  Invite a trainer; the trainer activates and signs in.
5.  Record a payment, review reports, and update settings.
6.  Disable MFA and confirm the next sign-in behaviour.

Pass: MFA gates access correctly, invitations activate once, and administrative changes persist.

### E2E-04 — Self-pay enrollment reconciliation

1.  Create a self-pay enrollment with a fee.
2.  Record a partial payment.
3.  Record the remaining payment.
4.  Compare trainee history, admin accounting and reports.

Pass: status moves from Unpaid to Partially Paid to Fully Paid; balances reach zero; totals reconcile.

### E2E-05 — Maintenance window

1.  Sign in as a trainee in one browser and as the Super Admin in another.
2.  Super Admin switches maintenance mode on and saves.
3.  Trainee reloads: the maintenance notice appears and no dashboard is rendered.
4.  Trainee attempts a write from their own session (for example marking a lesson complete): the request is refused by the database.
5.  Super Admin continues to work normally, including reports and settings.
6.  Super Admin switches maintenance off; the trainee reloads and resumes where they left off.

Pass: the window closes and reopens for non-admins, the administrator is never locked out, and no data is lost or half-written.

### E2E-06 — Enrollment switch

1.  Super Admin turns Allow online self-enrollment off.
2.  Trainee opens Enroll Now: the form is closed with an explanation.
3.  Trainee attempts a direct API insert: refused.
4.  Super Admin turns the switch on.
5.  Trainee submits a complete application and it reaches the admin queue.
6.  Admin rejects it with remarks; the trainee sees the remarks and can apply again.

Pass: the switch controls the flow in both directions, the refusal is server-side, and a rejection is explainable and recoverable.

## 10. Security and Cross-Cutting Checks

Run these with a real session token, not by looking at the screen. Appendix A shows how to take a token and how to read the answer. A 200 with an empty array means the row filter held; 403 with code 42501 means a policy refused the write.

### SEC — RLS and API enforcement

- [x] SEC-01  Profiles: a trainee's token returns their own profile and the trainers assigned to them, not other trainees. A trainer returns their own trainees, not the whole directory.  ✔ live probe, 22 Oct 2026
- [x] SEC-02  Enrollments: a trainee returns only their own rows; a trainer returns their trainees' rows plus unassigned applications for their programs; a co-trainer of the same program does not see a trainee assigned to another trainer.  ✔ live probe, 22 Oct 2026
- [x] SEC-03  Enrollment insert: a trainee cannot insert a row for another trainee (403), and cannot insert at all while self-enrollment is off (403).  ✔ live probe, 22 Oct 2026
- [x] SEC-04  Self-approval: a trainee PATCHing their own enrollment with status Enrolled gets 200 but the stored status is unchanged, as are decisionRemarks, decisionAt, decisionBy, certificateIssued, startDate, endDate, trainee_id and program_id.  ✔ live probe, 22 Oct 2026
- [x] SEC-05  Enrollment delete: only the Super Admin deletes; a trainer and a trainee get zero rows affected.  ✔ live probe, 22 Oct 2026
- [x] SEC-06  Program content: a trainer token cannot read or write lessons, quizzes or exams belonging to an unassigned program.  ✔ live probe, 22 Oct 2026
- [x] SEC-07  Attendance: a trainee cannot read another trainee's attendance; a trainer cannot read attendance for a program they are not assigned to.  ✔ live probe, 22 Oct 2026
- [x] SEC-08  Admin RPCs: trainer and trainee tokens cannot call admin-only RPCs such as admin_set_mfa_enforced.  ✔ live probe, 22 Oct 2026
- [x] SEC-09  Anonymous access to profiles, enrollments, assessments and payments is denied.  ✔ live probe, 22 Oct 2026
- [x] SEC-10  Only the anon key appears in the browser bundle; searching dist/ for service_role returns nothing.  ✔ live probe, 22 Oct 2026
- [x] SEC-11  Sensitive admin actions appear in audit_logs with the actor and the target.  ✔ live probe, 22 Oct 2026
- [x] SEC-12  Maintenance mode: with it on, a trainee INSERT or UPDATE to any gated table is refused by the database, while reads still succeed.  ✔ live probe, 22 Oct 2026
- [x] SEC-13  A signed-in user cannot escalate their own role by patching their profile row.  ✔ live probe, 22 Oct 2026

**Result: ______ of 13 checks        Defect: ______________**

### UX — Usability and accessibility

- [ ] UX-01  Main workflows work at 1366x768 and 1920x1080 without clipped controls or unusable tables.
- [ ] UX-02  Login, course, quiz and attendance screens work at 375 px and 768 px widths.
- [ ] UX-03  Keyboard-only navigation reaches all controls and focus is visible.
- [ ] UX-04  Success, warning and error messages are specific and dismissible.
- [ ] UX-05  No uncaught exceptions, failed required requests or repeated console errors; a forced error shows the error boundary.
- [ ] UX-06  Empty states explain the next action; loading states are visible on slow connections.

**Result: ______ of 6 checks        Defect: ______________**

### DAT — Data and persistence

- [ ] DAT-01  Created and edited records persist after reload.
- [ ] DAT-02  Supabase-backed data refreshes correctly in a second tab.
- [ ] DAT-03  Demo and Supabase modes show consistent core behaviour, apart from documented backend-only features.
- [ ] DAT-04  A failed save shows an error and does not falsely report success or leave an optimistic row behind.
- [ ] DAT-05  The backup and restore process is reproducible: node scripts/backup.mjs, restore into a scratch project, and row counts match.

**Result: ______ of 5 checks        Defect: ______________**

## 11. Defect Log

### 11.1 Regression set from earlier passes

These were found and fixed before this revision. They are re-tested here because each one was a behaviour change, not only a patch. Mark each row PASS or FAIL.

| ID | Severity | What was wrong | Fix | Retest |
| --- | --- | --- | --- | --- |
| D-01 | S1 | Any signed-in user could insert, update or delete any enrollment, including approving their own application | 064: per-command policies plus a normalising trigger |  |
| D-02 | S2 | A render error unmounted the tree and left a blank page | Error boundary with Reload / Back to sign in |  |
| D-03 | S3 | No root README; setup existed only in scattered notes | README.md |  |
| D-04 | S4 | No index on enrollments.trainee_id, program_id or status | 065 |  |
| D-05 | S3 | A refused enrollment write left a phantom application on screen | createEnrollment awaits the server and rolls back |  |
| D-06 | S2 | Duplicate course codes accepted; assessments saved with no questions | courseValidation and assessmentValidation with shared rules |  |
| D-07 | S2 | An approved retake still reported that the quiz was already attempted | 061: count real attempts, honour spare grants |  |
| D-08 | S2 | A quiz could be submitted with unanswered questions | Submit blocked, focus moves to the first blank |  |
| D-09 | S2 | System Settings toggles had no effect | Wired through the app, 062 and 063 |  |
| D-10 | S1 | Maintenance mode was client-side only | 062: restrictive RLS on 19 tables plus a trigger for RPC-written tables |  |
| D-11 | S1 | Online enrollment could be bypassed with a direct API call | 063: restrictive INSERT policy self_enroll_closed |  |
| D-12 | S2 | Every signed-in user could read every enrollment, including applicant contact details and payment references | 066: read scope by owner, assigned trainer or program trainer |  |
| D-13 | S2 | Every signed-in user could read every profile and every attendance record | 067: profile and attendance read scope |  |

### 11.2 New defects found during this pass

| Defect ID | Test ID | Description | Severity | Status | Owner | Retest |
| --- | --- | --- | --- | --- | --- | --- |
| DEF-001 |  |  |  | Open |  |  |
| DEF-002 |  |  |  | Open |  |  |
| DEF-003 |  |  |  | Open |  |  |
| DEF-004 |  |  |  | Open |  |  |
| DEF-005 |  |  |  | Open |  |  |
| DEF-006 |  |  |  | Open |  |  |

## 12. Exit Criteria and Sign-Off

- [ ] All S1 and S2 defects are fixed and retested, and no open S1 defect remains.
- [ ] Every row of the D-01 to D-13 regression set is PASS.
- [ ] All six E2E scenarios pass.
- [ ] Every mandatory risk check in Section 2.3 has a recorded result.
- [ ] SEC-01 to SEC-13 pass on a real token, not only in the UI.
- [ ] The SA-09 preference matrix is complete and signed row by row.
- [ ] No secrets are exposed in the browser bundle or the repository.
- [ ] The backup snapshot from 2.2 is retained with the signed checklist.
- [ ] The known limitations in Section 13 are accepted in writing by the product owner.

**Result: ______ of 9 checks        Defect: ______________**

Sign-off:

| Role | Name | Decision | Signature | Date |
| --- | --- | --- | --- | --- |
| Product Owner |  |  |  |  |
| Super Admin Representative |  |  |  |  |
| Trainer Representative |  |  |  |  |
| Trainee Representative |  |  |  |  |
| QA Lead |  |  |  |  |
| Technical Lead |  |  |  |  |

## 13. Known Limitations to Accept

These are known and were not changed in this revision. Each needs an explicit accept or reject at sign-off.

| ID | Limitation | Impact | Proposed action |
| --- | --- | --- | --- |
| O-01 | Announcements written by the Super Admin read Posted by Administration to trainees and trainers, because admin profiles are no longer readable by other roles | Cosmetic; visibility rules are unchanged | Accept, or add an explicit author-name column to announcements |
| O-02 | Password policy is 6 characters, CAPTCHA is off, and public sign-up stays open during maintenance | Weaker account protection; sign-ups can continue during a maintenance window | Raise the minimum to 8-10 characters, enable CAPTCHA, close sign-up while maintenance is on |
| O-03 | Requirement documents and receipts are stored as base64 data URLs inside JSONB | Large uploads inflate the row and slow the initial load | Move to Supabase Storage with signed URLs |
| O-04 | No load or soak testing has been performed | Unknown behaviour at concurrency | Run a k6 or Locust profile against a staging copy before the pilot |
| O-05 | Modal dialogs do not trap focus | Keyboard and screen-reader users can tab behind the dialog | Add a focus trap and return focus to the trigger |
| O-06 | Trainees record their own payments and the balance updates immediately | A trainee can mark themselves paid before the registrar reconciles | Treat the trainee entry as for verification and require registrar confirmation |
| O-07 | Password-reset email was accepted by SMTP but inbox delivery was not confirmed | Users may report that no email arrived | Confirm receipt in the inbox during the walkthrough; keep the app password current |

## Appendix A — Server-Side Verification Recipes

A1. Take a session token

Sign in, open DevTools, Application, Session Storage, key sb-<project-ref>-auth-token, and copy access_token. Sessions live in sessionStorage, so the token disappears when the tab closes.

```
TOKEN="<access_token>"
ANON="<anon key>"
URL="https://<project-ref>.supabase.co"
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  "$URL/rest/v1/enrollments?select=id,trainee_id"
```

A2. Read the answer

| Response | Meaning |
| --- | --- |
| 200 with rows | The policy allowed the read or write. |
| 200 with [] | A row filter excluded every row. The caller is authenticated but not scoped to these rows. |
| 403, code 42501 | A policy refused the statement outright. Expected for a restricted INSERT or for maintenance mode. |
| 204 or 200 with [] on PATCH | The row filter excluded the target, so nothing was updated. |
| 401 | Missing or expired token. |

A3. Prove the enrollment write scope

```
-- as the trainee: approve your own application
curl -s -X PATCH \
  -H "apikey: $ANON" -H "Authorization: Bearer $TRAINEE" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"data":{"status":"Enrolled"}}' \
  "$URL/rest/v1/enrollments?id=eq.<own-id>"
-- expected: 200, and status in the body is still Pending
```

A4. Prove the self-enrollment gate

```
-- as the Super Admin, close enrollment
update public.settings
   set data = jsonb_set(data, '{allowSelfEnroll}', 'false')
 where id = 'global';

-- as the trainee, attempt an insert
-- expected: 403 with code 42501, policy self_enroll_closed
```

A5. Prove the maintenance gate

```
-- as the Super Admin, switch maintenance on
update public.settings
   set data = jsonb_set(data, '{maintenanceMode}', 'true')
 where id = 'global';

-- as the trainee, attempt any write (lesson completion, enrollment, attendance)
-- expected: 403 with code 42501, policy maintenance_no_insert / _no_update

-- reads must still work, because the client needs settings and its own profile
-- remember to switch maintenance off again
```

A6. Inventory the policies before and after a change

```
select tablename, policyname, cmd, permissive
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;
```

A7. Backup and restore

```
node scripts/backup.mjs
node scripts/backup.mjs --restore backups/<stamp>
```

## Appendix B — Execution Summary

| Group | Checks | Pass | Fail | Blocked | Defect |
| --- | --- | --- | --- | --- | --- |
| Setup (2.1, 2.2 preconditions) | 12 |  |  |  |  |
| Smoke (SMK-01 to SMK-14) | 14 |  |  |  |  |
| SA-01 Trainer lifecycle | 10 |  |  |  |  |
| SA-02 Trainee lifecycle | 8 |  |  |  |  |
| SA-03 Enrollment queue and access | 12 |  |  |  |  |
| SA-04 Curriculum oversight | 8 |  |  |  |  |
| SA-05 Payments and accounting | 8 |  |  |  |  |
| SA-06 Schedules and attendance | 8 |  |  |  |  |
| SA-07 Reports and settings | 13 |  |  |  |  |
| SA-08 MFA and announcements | 11 |  |  |  |  |
| SA-09 Preference enforcement | 9 |  |  |  |  |
| TR-01 to TR-09 Trainer | 47 |  |  |  |  |
| TRA-01 to TRA-09 Trainee | 57 |  |  |  |  |
| E2E-01 to E2E-06 (scenarios) | — |  |  |  |  |
| SEC-01 to SEC-13 | 13 |  |  |  |  |
| UX-01 to UX-06 | 6 |  |  |  |  |
| DAT-01 to DAT-05 | 5 |  |  |  |  |
| Exit criteria (Section 12) | 9 |  |  |  |  |
| Total | 250 |  |  |  |  |

*E2E-01 to E2E-06 are scenarios with a pass criterion rather than individual checkboxes, so they carry no count and are excluded from the 250 total. Row totals are fixed and match the Result line at the end of each group.*

Tester: ____________________    Date: ____________    Build: ____________________
