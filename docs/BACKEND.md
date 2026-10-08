# Backend — Supabase (Auth · Postgres · RLS · MFA · Edge Functions)

This document describes the **backend only**. No frontend/UI was created or
modified. It implements:

1. Super Admin MFA
2. Trainer account creation
3. Trainer invitation / activation
4. Temporary password handling
5. Trainer profile information
6. Trainer assigned programs (many-to-many)
7. Role-based access control + RLS
8. Email-based trainer activation

Architecture: **Existing Frontend → Supabase Auth → PostgreSQL → RLS → RPC / Edge Functions**

---

## 0. Key design decision — the Super Admin role string

The existing frontend hard-codes the Super Admin role as `'admin'`
(`ProtectedRoute allow={['admin']}`, `roleMeta.admin`, `saveUser`). To keep the
frontend working without touching it, the database stores `'admin'` for the
Super Admin and the backend treats **`'admin'` and `'super_admin'` as
equivalent everywhere** (`is_super_admin()` accepts both; the role CHECK allows
both). New code may write `'super_admin'`; the UI will still understand it once
its role checks are widened.

Roles: `super_admin`, `admin` (alias), `trainer`, `trainee`.

---

## 1. Updated database schema

### Modified table: `public.profiles`

Existing columns are untouched (`id text PK`, `auth_user_id uuid`,
`role`, `email`, `name`, `data jsonb`, timestamps) so the frontend keeps
working. Added columns:

| column | type | notes |
|--------|------|-------|
| `first_name`, `last_name` | text | split from `name` on backfill |
| `phone`, `address` | text | |
| `date_of_birth` | date | |
| `profile_image_url` | text | |
| `position` | text | |
| `specialization` | text | display value |
| `specialization_id` | uuid → `specializations(id)` | authoritative |
| `status` | text NOT NULL default `'active'` | `pending_activation` / `active` / `inactive` / `suspended` |
| `is_activated` | boolean NOT NULL default true | |
| `mfa_enforced` | boolean NOT NULL default false | true for the Super Admin |
| `last_login_at` | timestamptz | |

Constraints: `profiles_role_check`, `profiles_status_check`.
A `BEFORE UPDATE` trigger (`protect_profile_privileged_columns`) blocks
non-Super-Admins from changing `role`, `status`, `is_activated`, `mfa_enforced`,
`email` or `specialization_id`.

### New tables

```
specializations       (id, name, slug, description, is_active, sort_order, ...)
trainer_programs      (id, trainer_id, program_id, assigned_by, assigned_at, status)
trainer_invitations   (id, trainer_id, email, token_hash, invitation_status,
                       provider, expires_at, sent_at, used_at, activated_at,
                       created_by, created_at, metadata)
audit_logs            (id, user_id, actor_profile_id, action, target_type,
                       target_id, metadata, created_at)
```

`trainer_programs` enforces `unique (trainer_id, program_id)`.
`trainer_invitations` has a partial unique index allowing **one live
invitation per trainer**.

---

## 2. SQL migrations

```
supabase/migrations/
  001_extensions.sql
  002_profiles.sql
  017_functions.sql
  018_rls_policies.sql
  019_trainer_management.sql
  020_trainer_invitations.sql
  021_audit_logs.sql
  022_super_admin_mfa.sql
  023_trainer_rpcs.sql
  README.md            (maps spec 003–016 to the existing baseline schema)
```

`supabase/schema.sql` now contains the baseline **plus** all of the above
appended in order, so the existing "paste schema.sql into the SQL Editor" flow
still sets up everything.

Everything is idempotent and safe to re-run.

---

## 3. Trainer management tables

* `specializations` — the controlled list (Housekeeping, Barista, Hilot /
  Massage, Event Management, Virtual Assistant, Multiple Programs, Other).
  Seeded by slug; add/update rows later without touching frontend code.
* `trainer_programs` — many-to-many trainer↔program assignments, the
  authoritative model for access control. Backfilled from the legacy
  `programs.trainer_id`.

---

## 4. Trainer invitation system

We use **Supabase Auth's own secure invitation / recovery links** — no custom
token, no raw token in the database.

* `create-trainer` (Edge Function): creates the auth user (temp password) or
  sends a Supabase invite, then writes the `trainer_invitations` row and emails
  a secure, expiring activation link.
* `admin_create_trainer` (RPC): same DB effect, browser-callable, returns the
  temp password once (no email — the Super Admin relays it, or triggers the
  Edge Function to email).
* `admin_resend_trainer_invitation` (RPC) / `resend-trainer-invitation`
  (Edge Function): revoke the live invitation, issue a fresh one (7-day expiry).
* Activation flips `status → active`, `is_activated → true` via the
  `on_auth_user_activation` trigger on `auth.users` (fires when the trainer
  confirms email or sets a password) and/or the `activate_my_account()` RPC.

Tokens: single-use, expiring, invalidated after activation, never stored raw.

---

## 5. Supabase Auth configuration (Dashboard)

* **Authentication → Providers → Email**: enabled.
* **Confirm email**: OFF (matches the project's existing trainee self-signup).
* **Authentication → Multi-Factor Authentication**: enable **TOTP**.
* **Authentication → URL Configuration**: add the app origin + the activation
  redirect (`APP_ACTIVATION_REDIRECT_URL`) to the allow-list.
* **Authentication → Emails**: customize the Invite / Recovery templates
  (or use Resend via the Edge Function).

---

## 6. Super Admin MFA implementation

**Method:** Supabase Auth built-in **TOTP** (Google Authenticator / Authy).
Enforced at **AAL2** — no custom crypto, no secrets stored in plaintext.

* Designated account: **`institutehytglobal@gmail.com`** (role `admin`,
  `mfa_enforced = true`). Created by `scripts/create-super-admin.mjs` (generates
  a random password, prints it once; never stored in SQL).
* Enrolment: `scripts/mfa-enroll.mjs` (prints QR + secret, verifies the code).
  Alternatively any Supabase client can call `auth.mfa.enroll/challenge/verify`.
* **Server-side enforcement** (the important part):
  * `current_aal()` reads the `aal` JWT claim; `mfa_satisfied()` = `aal2`.
  * `require_mfa()` raises `42501` unless AAL2.
  * Every sensitive RPC calls `require_super_admin_mfa()`
    (`is_super_admin()` **and** `require_mfa()`).
  * Every Edge Function calls `requireSuperAdmin()` which rejects non-AAL2.
* `get_my_auth_state()` / `admin_mfa_status()` let the frontend drive the MFA
  challenge without leaking anything.

**On/Off toggle (Settings page).** The Super Admin can enable or disable MFA from
*Admin → System Settings → Two-Factor Authentication*:

* The toggle writes `profiles.mfa_enforced` via `admin_set_mfa_enforced(bool)`.
* Turning it **ON** requires a verified authenticator factor first; the UI
  shows a QR code (`supabase.auth.mfa.enroll`) to scan, then verifies the
  6-digit code before persisting the flag.
* Turning it **OFF** while it is on requires AAL2 (a stolen password alone
  cannot downgrade the account), then unenrolls the factor.
* `require_mfa()` / the Edge Function only enforce AAL2 when
  `mfa_enforced = true`, so turning MFA off actually removes the requirement.

Sensitive operations that require AAL2 (while MFA is ON): creating/updating/
deleting trainers and any account, assigning programs, changing trainer status,
resending invitations, managing users.

---

## 7. RLS policies

Enabled on every protected table.

| Table | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|----------------------|
| `profiles` | authenticated (broad — names are shown app-wide) | self **or** Super Admin; privileged columns guarded by trigger |
| `programs` | authenticated | Super Admin, **or** trainer assigned to that program |
| `schedules` / `attendance` / `evaluations` | authenticated | Super Admin, **or** trainer assigned to `program_id` |
| `trainer_programs` | Super Admin, or trainer's own rows | Super Admin only |
| `specializations` | authenticated | Super Admin only |
| `trainer_invitations` | Super Admin, or trainer's own rows | none (definer functions only) |
| `audit_logs` | Super Admin only | none (definer functions only) |
| `enrollments`, `quiz_attempts`, `exam_attempts`, `typing_tests`, `announcements`, `settings` | unchanged (broad) | unchanged |

A trainer can therefore never touch another trainer, another program, their own
role/status, or assign themselves — enforced by RLS, not just the UI.

---

## 8. PostgreSQL functions / RPC

**Helpers (client-readable):**
`current_profile_id()`, `current_role()`, `get_current_user_role()`,
`is_super_admin()`, `is_super_admin_mfa()`, `is_active_trainer()`,
`is_trainer_assigned_to_program(program_id)`, `current_aal()`,
`mfa_satisfied()`, `has_verified_mfa_factor()`, `get_my_auth_state()`,
`admin_mfa_status()`.

**Internal (revoked from clients):**
`require_mfa()`, `require_super_admin_mfa()`, `generate_temp_password(int)`,
`_create_auth_user(...)`, `write_audit(...)`.

**Trainer management RPC (authenticated, self-authorizing):**

| RPC | Purpose |
|-----|---------|
| `admin_create_trainer(full_name, email, position, specialization_id, address, phone, programs[])` | Create trainer (pending_activation) + assignments + invitation; returns temp password once |
| `admin_update_trainer(trainer_id, full_name, position, specialization_id, address, phone, programs[])` | Edit profile + reconcile assignments |
| `admin_set_trainer_status(trainer_id, status)` | active / inactive / suspended / pending_activation |
| `admin_resend_trainer_invitation(trainer_id)` | Revoke + reissue invitation |
| `admin_get_trainer(trainer_id)` | Read model (profile + programs + invitations) |
| `activate_my_account()` | Trainer self-activation fallback |
| `admin_set_mfa_enforced(enabled)` | Super Admin MFA on/off toggle (audited) |

**Service-role-only (Edge Functions):**
`admin_finalize_trainer(...)`, `admin_mark_invitation_sent(...)`,
`admin_resend_invitation_record(...)`.

**Legacy (kept, hardened):** `admin_create_user(...)`, `admin_delete_user(id)`
now require Super Admin + AAL2 and write audit rows.

---

## 9. Edge Functions

| Function | Responsibilities |
|----------|------------------|
| `create-trainer` | verify JWT → Super Admin → AAL2 → validate → unique email → create Auth user / invite → `admin_finalize_trainer` (atomic) → generate activation link → email → **roll back the Auth user if the DB step fails** → return safe info only |
| `resend-trainer-invitation` | verify JWT → Super Admin → AAL2 → revoke old → new expiring invitation + link → email |

Shared helpers in `supabase/functions/_shared/`: `cors.ts`, `supabase.ts`,
`auth.ts`, `email.ts`, `password.ts`. The **service_role key never leaves the
server** and is never returned.

---

## 10. Email / invitation configuration

* Default: **Supabase Auth** built-in invitation email (no provider needed;
  `create-trainer` uses `inviteUserByEmail`, no temporary password).
* Branded option: set `RESEND_API_KEY` + `EMAIL_FROM` and the Edge Function
  sends the template from the spec (Email + Temporary Password + Activate
  Account link) via Resend.
* Activation links are single-use and expire (7 days). The temp password stops
  working the moment the trainer sets their own password.

---

## 11. Audit logging

`audit_logs` records who / what / which / when / metadata. Written only by
`SECURITY DEFINER` functions. Actions:
`TRAINER_CREATED`, `TRAINER_UPDATED`, `TRAINER_PROGRAM_ASSIGNED`,
`TRAINER_PROGRAM_REMOVED`, `TRAINER_INVITATION_RESENT`, `TRAINER_ACTIVATED`,
`TRAINER_SUSPENDED`, `TRAINER_DEACTIVATED`, `TRAINER_REACTIVATED`,
`ACCOUNT_CREATED`, `ACCOUNT_DELETED`. **No passwords, temp credentials, tokens
or MFA secrets are ever written to the log.**

---

## 12. Environment variables

Browser (`.env.local`, safe to ship):
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Server-side / Edge Function secrets (**never** in the browser):
```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Edge Functions only
SUPABASE_ACCESS_TOKEN=              # CLI only
APP_URL=https://your-app.example.com
APP_ACTIVATION_REDIRECT_URL=https://your-app.example.com/login
INSTITUTION_NAME=HYT Global Institute
RESEND_API_KEY=                     # optional
EMAIL_FROM=                         # optional
SUPER_ADMIN_EMAIL=institutehytglobal@gmail.com
```

---

## 13. Supabase Dashboard configuration

1. Providers → Email enabled; **Confirm email OFF**.
2. MFA → **TOTP enabled**.
3. URL Configuration → add app origin + activation redirect.
4. Run `supabase/schema.sql` in the SQL Editor.
5. Run `node scripts/create-super-admin.mjs`.
6. Run `node scripts/mfa-enroll.mjs` (enrol + verify).
7. `supabase secrets set ...` and `supabase functions deploy create-trainer resend-trainer-invitation`.

---

## 14. Testing instructions

| # | Test | How |
|---|------|-----|
| 1 | Super Admin login + MFA | sign in → `auth.mfa.challenge/verify` → AAL2. `get_my_auth_state().requires_mfa` is true before MFA. |
| 2 | Create trainer | call `admin_create_trainer` (or `create-trainer`) with Juan Dela Cruz / juan@example.com / Housekeeping / Quezon City / [housekeeping, barista] → profile `pending_activation`, assignments + invitation created, email sent. |
| 3 | Trainer activation | trainer opens link, sets password → `status=active`, `is_activated=true`; temp password no longer works. |
| 4 | Program access | trainer A (housekeeping, barista) can write those programs; `is_trainer_assigned_to_program('event-management')` is false and writes are rejected. |
| 5 | Trainer security | trainer calls `admin_create_trainer` / updates `role` / writes another program → `42501`. |
| 6 | Suspended trainer | `admin_set_trainer_status(id,'suspended')` → `is_active_trainer()` false, writes rejected. |
| 7 | Invitation expiry | use a link past `expires_at` → activation fails. |
| 8 | MFA security | call a sensitive RPC at AAL1 → `42501`; Edge Function → HTTP 403. |

SQL smoke checks are included at the end of `docs/BACKEND_TESTS.sql`.

---

## 15. Security considerations

* Passwords: only ever bcrypt-hashed by Supabase Auth. No plaintext temp
  password is stored; it is generated server-side (CSPRNG) and shown/emailed once.
* `service_role` key: Edge Function secrets only — never in `VITE_*`, never
  returned, never logged.
* Authorization is derived from `auth.uid()` → `profiles` → role (+ AAL), never
  from request payloads.
* RLS enforces access on the server; frontend route guards are cosmetic.
* Invitation links are Supabase-managed: single-use, expiring, invalidated on
  use. No raw tokens stored.
* The `protect_profile_privileged_columns` trigger stops self-elevation.
* Compatibility trade-off: catalog/content **reads** stay broad for authenticated
  users so the existing SPA (catalog browsing, rosters) keeps working; all
  **writes** are role- and assignment-scoped. Tighten reads later if desired.

---

## 16. Frontend integration contract (no UI changes required to deploy)

The existing frontend continues to work unchanged. To adopt the new flows, wire
these calls:

```js
// auth state (drives the MFA challenge screen)
const { data } = await supabase.rpc('get_my_auth_state')
// data.requires_mfa, data.mfa_enrolled, data.current_aal

// MFA enrolment / challenge (Supabase Auth client)
const { data: f } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
await supabase.auth.mfa.challenge({ factorId: f.id })
await supabase.auth.mfa.verify({ factorId: f.id, challengeId, code })

// MFA on/off (Settings toggle). Enforce a code only while enabled.
await supabase.rpc('admin_set_mfa_enforced', { p_enabled: true })
// to disable: admin_set_mfa_enforced({ p_enabled: false }) then mfa.unenroll(...)

// create a trainer (browser, anon key, Super Admin + AAL2)
const { data } = await supabase.rpc('admin_create_trainer', {
  p_full_name: 'Juan Dela Cruz', p_email: 'juan@example.com',
  p_position: 'Trainer', p_specialization_id: '<uuid>',
  p_address: 'Quezon City', p_phone: '', p_programs: ['housekeeping','barista'],
})
// data.temp_password shown ONCE — do not log it.

// or via the Edge Function (sends the email, never returns the password)
await supabase.functions.invoke('create-trainer', { body: { ... } })

await supabase.rpc('admin_update_trainer', { ... })
await supabase.rpc('admin_set_trainer_status', { p_trainer_id, p_status: 'suspended' })
await supabase.rpc('admin_resend_trainer_invitation', { p_trainer_id })
await supabase.rpc('admin_get_trainer', { p_trainer_id })

// trainer activation (after setting a password)
await supabase.rpc('activate_my_account')
```

Specifications for the trainer creation form (matches `ManageTrainers`):
Full Name, Email, Position, Specialization (from `specializations`), Address,
Assigned Programs (from `programs`). The backend forces `role = trainer`,
`status = pending_activation`, `is_activated = false`.

---

## 17. Definition of done

- [x] Super Admin MFA (TOTP / AAL2), enforced server-side.
- [x] `institutehytglobal@gmail.com` is the designated Super Admin.
- [x] Super Admin can securely create trainers.
- [x] Trainers start `pending_activation` and receive a secure, expiring invite.
- [x] Trainer sets their own password → account becomes active; temp credential dies.
- [x] Many-to-many program assignments; trainers scoped to assigned programs.
- [x] RLS protects all sensitive tables; service_role never exposed.
- [x] No plaintext passwords; no raw tokens stored.
- [x] Trainer-management actions are audited.
- [x] Backend validates all important operations (no TODO / mock logic).
