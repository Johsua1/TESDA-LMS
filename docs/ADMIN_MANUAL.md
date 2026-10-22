# Administration Manual

**System:** HYT Global Institute — LMS Portal
**Audience:** Super Admin (registrar), designated system administrator
**Companion documents:** [USER_MANUAL.md](USER_MANUAL.md), [TROUBLESHOOTING.md](TROUBLESHOOTING.md), [BACKEND.md](BACKEND.md)

---

## 1. Roles at a glance

| Capability | Super Admin | Trainer | Trainee |
|------------|:-----------:|:-------:|:-------:|
| Create / edit / delete users | ✔ | — | — |
| Assign programs and trainers | ✔ | — | — |
| Approve or reject enrollments | ✔ | — | — |
| Verify admission requirements | ✔ | — | — |
| Record and verify payments | ✔ | — | submit only |
| Author lessons, quizzes, exams | view only | ✔ (own programs) | — |
| Take attendance | view only | ✔ (own programs) | — |
| System Settings | ✔ | — | — |
| Announcements | ✔ | ✔ (own programs) | read |

Content pages under **Admin → Lessons / Quizzes / Exams / Competencies / Attendance** are deliberately read-only. Trainers author the content; the registrar oversees it.

## 2. Signing in

1. Open the portal URL.
2. Enter the email address and password issued to you.
3. If your account has MFA enrolled, enter the 6-digit code from your authenticator app. The code changes every 30 seconds.
4. Sessions last **1 hour** and refresh silently while the tab is open. After a long idle period you will be returned to the sign-in page — no work is lost because every action is saved as you make it.

**Forgot password:** use *Forgot password?* on the sign-in page. The reset link is valid for one use and expires; if no email arrives within a few minutes, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) §2.

## 3. Managing accounts

### 3.1 Create a trainer

1. **Admin → Trainers → Add Trainer**.
2. Fill in name, email, contact details, specialization and the programs the trainer will handle.
3. Save. The trainer receives an invitation email with a link to set their own password; the temporary password is never shown or emailed in plain text.
4. Until the invitation is accepted the account shows **Pending activation**.

Use **Resend invitation** if the email was lost. If email notifications are switched off in System Settings, the screen tells you that no email was sent and gives you the activation link to pass on manually.

### 3.2 Create a trainee

1. **Admin → Trainees → Add Trainee**.
2. Enter the personal details and select the programs to enrol them in.
3. For each program choose the trainer who will handle that trainee. Several trainers can share a program — each trainee is assigned to exactly one of them per program.
4. Saving creates the account **and** the corresponding enrollments, so the trainee can start immediately.

Trainees may also self-register from the public sign-up page. Self-registered accounts start with no program assignment; assign programs from **Admin → Trainees**.

### 3.3 Edit or remove an account

- **Edit** opens the same form; changing the program list adds or removes enrollments to match.
- **Delete** removes the profile, the auth user and every dependent record (enrollments, attempts, attendance, ratings). This cannot be undone — take a backup first if the record matters (§7).

## 4. Enrollment workflow

1. **Application** — the trainee submits an application from *Enrollment* (when online enrollment is open) or the registrar creates it while adding the trainee.
2. **Review** — *Admin → Enrollments* lists applications by status. Open one to see the applicant's details and uploaded requirements.
3. **Verify requirements** — mark each document **Verified** or **Rejected** with a remark. A rejected document sends the application back to the trainee, who can upload a replacement from *My Applications*.
4. **Approve or reject** —
   - **Approve** unlocks the course content and, for self-pay programs, the payment step.
   - **Reject** requires a remark. The trainee sees the reason, the record stays in both lists for history, and *Enroll Now* becomes available again so they can re-apply.
5. **Completion** — when every published lesson is done and every published quiz and exam is passed, the system marks the enrollment **Completed** and issues the certificate flag automatically.

Status values: *Pending → Under Review → Approved → Enrolled → Completed*, plus *Rejected* and *Cancelled*.

## 5. Payments

- Payment is collected **after** approval and after every requirement is verified.
- The trainee records a payment (amount, method, reference number) from *My Payments*; the balance updates immediately.
- **Reconcile** from *Admin → Accounting*: confirm the reference against the actual transfer and correct the record if needed. Treat trainee-entered payments as claims until reconciled (see the UAT report, O-06).
- A receipt showing the institution name and academic year can be printed from the trainee's payment screen.

## 6. System Settings

**Admin → System Settings** applies to the whole portal. Changes take effect immediately for new sessions and within about a minute for users who are already signed in (the client refreshes settings on focus and every 60 seconds).

| Setting | Effect | Enforced |
|---------|--------|----------|
| Institution name | Sidebar header, maintenance notice, receipts | client |
| Academic year | Printed on receipts | client |
| Default passing score | Pre-fills new quizzes/exams; grades, charts and pass/fail colouring | client + per-quiz value |
| Typing test passing rate | Pass mark shown on the typing test and trainer evaluation | client |
| Attendance requirement | Trainee attendance badge, trainer at-risk list, reports | client |
| Allow online self-enrollment | Trainee *Enroll Now* button and the API | client **and** database (migration 063) |
| Email notifications | Whether account-creation emails are sent | client |
| Maintenance mode | Blocks trainees and trainers; Super Admins keep access | client **and** database (migration 062) |

All numeric fields are validated (1–100, whole numbers). The Save button stays disabled until something changes, and a failed save shows an error instead of a false success.

## 7. Maintenance mode

Use it for migrations, bulk imports or any change that must not be interrupted.

**Before turning it on**
1. Announce the window from *Announcements* (trainees and trainers see it on their dashboards).
2. Ask staff to finish any quiz or exam in progress — an attempt that is open when maintenance starts cannot be submitted.
3. Take a backup (§8).

**Turn it on:** *Admin → System Settings → Maintenance mode → Save*.

**What happens**
- Trainees and trainers are shown a "Scheduled maintenance" page with a Sign out button.
- Every write from a non-admin session is refused by the database, even if the client is bypassed.
- Reads stay open so the maintenance notice itself can load.
- The Super Admin keeps full access to switch it back off.

**Turn it off:** switch the toggle off and save. Users see the portal again on their next focus/refresh (within a minute) or immediately after signing in.

## 8. Backup and restore

### 8.1 Automated backups
Supabase takes daily backups of the project (Dashboard → **Database → Backups**). Retention depends on the plan. This is the primary recovery mechanism; confirm the retention period at handover.

### 8.2 On-demand logical backup
Run from the project folder on a machine that holds `.env.local`:

```bash
node scripts/backup.mjs
```

This writes `backups/<timestamp>/<table>.json` for all 24 tables plus a manifest. Keep the folder outside the repository (it contains personal data). Recommended before every bulk change and at the end of each term.

### 8.3 Restore
1. **Preferred:** restore from the Supabase dashboard (point-in-time or daily backup).
2. **Logical restore** into an empty or matching database:

```bash
node scripts/backup.mjs --restore backups/2026-10-22T08-42-30
```

Rows are upserted in foreign-key order (lookups → profiles → programs → enrollments → results), so a partial restore is safe to re-run.

3. After any restore, sign in and check **Enrollments**, **Accounting** and **Reports** against the last known totals.

### 8.4 What is *not* in the backup
Auth passwords and MFA factors live in Supabase's `auth` schema and are covered by the platform backup, not by `scripts/backup.mjs`. Users keep their passwords across a logical restore as long as the `profiles.auth_user_id` values are unchanged.

## 9. Routine maintenance

| Frequency | Task |
|-----------|------|
| Daily | Skim *Enrollments* for applications waiting on review; check the dashboard for failed logins or unusual activity |
| Weekly | Reconcile payments against bank/GCash records; review *Audit log* for admin actions |
| Monthly | Export a logical backup; review trainer assignments; archive completed programs |
| Each term | Update the academic year in System Settings; issue certificates; review the outstanding issues in the UAT report |

## 10. Audit and reporting

- **Reports** shows enrollment, trainee, attendance and revenue summaries per program and date range.
- `public.audit_logs` records administrative actions (enrollment auto-completion, trainer feedback submission, account deletion) with actor, target and timestamp. It is append-only and cannot be edited from the portal.
- Export any table with `scripts/backup.mjs` if a spreadsheet is needed for an audit.

## 11. Escalation

| Symptom | First step |
|---------|------------|
| Nobody can sign in | Check the Supabase project status, then [TROUBLESHOOTING.md](TROUBLESHOOTING.md) §1 |
| Emails not arriving | §2 of the troubleshooting guide; verify the Gmail app password |
| Data looks wrong after an import | Stop writes (maintenance mode), take a backup, then restore |
| Suspected unauthorized access | Turn on maintenance mode, rotate the affected password, review `audit_logs`, contact the developer |

Escalate to the developer with: the time of the incident, the account involved, the exact message on screen, and a screenshot of the browser console.
