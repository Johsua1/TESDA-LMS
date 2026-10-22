# Troubleshooting & Maintenance Guide

**System:** HYT Global Institute — LMS Portal
**Audience:** System administrator, first-line support
**Companion documents:** [ADMIN_MANUAL.md](ADMIN_MANUAL.md), [BACKEND.md](BACKEND.md)

Work down each entry: symptom → likely cause → what to do. Escalation criteria are in §10.

---

## 1. Sign-in problems

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| "Invalid login credentials" | Wrong password, or the account was never activated | Confirm the spelling of the email. If the account shows *Pending activation* in Admin → Trainers, resend the invitation. Otherwise use *Forgot password?*. |
| Signs in, then immediately returns to the login page | Session expired, or the browser blocked storage | Allow cookies/local storage for the portal, then sign in again. Private/incognito windows drop the session on close. |
| "Account is not activated" / no dashboard after sign-in | The profile is missing or still pending | Admin → Trainers/Trainees → open the record → **Resend invitation**. |
| MFA code rejected | Phone clock drift | Enable automatic time on the phone, wait for the next code, retry. A lost authenticator requires the developer to remove the factor. |
| Locked out after several attempts | Supabase rate limit | Wait a few minutes; the limit clears automatically. |

## 2. Email not received

Applies to activation and password-reset links.

1. Check spam/junk and the exact address on the account.
2. In Supabase → **Authentication → Logs**, look for `error` entries around the send time.
3. Supabase sends through Gmail SMTP (`smtp.gmail.com:465`). If the Google **app password** was changed or revoked, every send fails:
   - Generate a new app password for the Google account.
   - Put it in `.env.local` as `SMTP_PASS` and run `node scripts/configure-auth.mjs`.
4. The default throttle is 30 emails per hour. Bulk onboarding can hit it — space the invitations out.
5. Verify delivery with a single reset for a known mailbox before bulk-sending.

> A successful API response (`POST /auth/v1/recover` → 200) only means Supabase accepted the message, not that it reached the inbox. Always confirm receipt.

## 3. "Failed to save to the server" / RLS errors

| Message contains | Meaning | Action |
|------------------|---------|--------|
| `row-level security policy` | The signed-in role is not allowed to write that row | Check the role and the ownership. If it is legitimate, the policy needs review — see §8. |
| `new row violates row-level security policy "maintenance_no_..."` | Maintenance mode is on and the user is not a Super Admin | Turn maintenance off, or use the Super Admin account. |
| `... "self_enroll_closed"` | Online enrollment is switched off | Enable it in System Settings, or create the enrollment from Admin → Trainees. |
| `duplicate key value` | A unique constraint (email, trainer-program pair, one open attempt) | Refresh; the record already exists. |
| `JWT expired` | Session older than one hour and refresh failed | Sign out and back in. |
| `Failed to fetch` | Network, VPN or Supabase outage | Check the Supabase status page; retry. |

Every failed write shows a red toast; the row is not stored. Refresh before retrying so the screen matches the database.

## 4. Enrollment issues

| Symptom | Cause | Action |
|---------|-------|--------|
| "Enrollment closed" on every program | *Allow online self-enrollment* is off | Settings → toggle on. Existing applications remain visible. |
| Trainee submitted but the application is missing | The write was refused (enrollment closed mid-form) | The app now removes the phantom row and shows an error. Ask the trainee to re-apply once enrollment is open. |
| "Already applied" but the trainee wants to re-apply | An active application already exists for that program | Reject or cancel the old application with a remark; *Enroll Now* returns. |
| Rejected application shows no reason | The rejection was saved without a remark | Remarks are mandatory in the UI; older records may predate that rule. |
| Approved but content still locked | Requirements are not all verified | Verify every document in the enrollment record. |
| Course marked Completed too early | Auto-completion requires all published lessons **and** all published quizzes/exams | Check for unpublished items; the trigger only counts published content. |

## 5. Quiz and exam issues

| Symptom | Cause | Action |
|---------|-------|--------|
| "Quiz already attempted" after an approved retake | Grant not counted (fixed in migration 061) | Confirm the request is **approved** and the attempt row exists; if not, re-approve. |
| Cannot submit — "N questions still unanswered" | Every question must be answered | The button jumps to the first blank question. |
| Attempt expired mid-quiz | The timer ran out | The attempt is graded as-is. Approve a retake from the trainer's queue. |
| Timer shows a different duration | Duration is fixed per assessment type | See [FEEDBACK_AND_TIMERS.md](FEEDBACK_AND_TIMERS.md). |
| Score looks wrong | Passing score comes from the assessment, then System Settings | Check the quiz/exam record before changing global settings. |

## 6. Maintenance mode

| Symptom | Cause | Action |
|---------|-------|--------|
| Everyone sees "Scheduled maintenance" | Toggle is on | Super Admin → Settings → switch off. |
| A user still sees the old dashboard | The client refreshes settings on focus and every 60 s | Ask them to switch tabs or reload. |
| Super Admin is blocked too | The account role is not `admin`/`super_admin`, or `is_activated` is false | Check `profiles.role`, `status` and `is_activated` for that account. |
| Writes fail with `maintenance_no_...` after turning it off | Client cached settings, or the settings row did not save | Reload; confirm the toggle state in Settings. |

## 7. Blank page or "Something went wrong"

1. The app now shows a recovery screen instead of a white page. Note the message.
2. Reload once. If it persists, open the browser console and copy the first red error.
3. Common causes: a stale build after a deploy (hard reload with Ctrl+F5), a browser extension blocking scripts, or a corrupted local session (sign out, clear site data, sign in).
4. Report the console error to the developer — the message alone usually identifies the failing component.

## 8. Data looks wrong or stale

1. The client reloads everything on sign-in and every 60 seconds while the tab is focused. If a value looks stale, click elsewhere and back, or reload.
2. If a record is genuinely wrong in the database, confirm with a backup first (§9), then correct it through the UI so the audit log records the change.
3. Never edit rows directly in the SQL editor during operating hours — open transactions and the client's optimistic writes can conflict.

## 9. Backup before you touch anything

```bash
node scripts/backup.mjs
```

Writes `backups/<timestamp>/` with every table. Restore with `node scripts/backup.mjs --restore <dir>`. Full procedure: [ADMIN_MANUAL.md](ADMIN_MANUAL.md) §8.

## 10. Diagnostics checklist

When escalating, include:

- **Who** — account email and role.
- **When** — date and time with time zone.
- **Where** — page and, if possible, the URL.
- **What** — the exact message on screen; a screenshot is better than a paraphrase.
- **Console** — F12 → Console → first red line. Do not paste passwords, tokens or full personal records.
- **Network** — F12 → Network → the failing request's status code (401 / 403 / 400 / 500) and response body.

Useful server-side checks (read-only):

```sql
-- recent administrative activity
select created_at, action, target_table, target_id, actor_id
  from public.audit_logs order by created_at desc limit 50;

-- enrollment state for one trainee
select id, program_id, status, updated_at
  from public.enrollments where trainee_id = 'tn-...' order by updated_at desc;

-- current system settings
select data from public.settings where id = 'global';
```

## 11. Escalation matrix

| Severity | Example | Response |
|----------|---------|----------|
| **Critical** | Portal unreachable, all users blocked, data loss | Turn on maintenance mode, notify the developer immediately, restore from backup if needed |
| **High** | One role cannot sign in, writes failing for everyone | Same day; capture diagnostics before changing anything |
| **Medium** | One feature misbehaves for some users | Log it, work around, include in the next release |
| **Low** | Cosmetic or wording issue | Batch into the next release |

Escalate to the developer with the diagnostics from §10. Do not attempt schema changes to work around a bug — policies and triggers are interdependent.
