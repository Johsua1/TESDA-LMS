# HYT Global Institute — LMS Portal

Learning Management System for TESDA-style technical-vocational programs.
Single-page React application with a Supabase backend (Auth · Postgres · Row
Level Security).

- **Live portal:** https://tesda-lms-qt64.vercel.app
- **Audience:** Super Admin (registrar), trainers, trainees
- **Status:** UAT — see [docs/UAT_REPORT.md](docs/UAT_REPORT.md) for results and
  outstanding items.

---

## 1. Technology stack

| Layer | Choice |
|-------|--------|
| UI | React 18, React Router 6, Tailwind CSS 3, Recharts, lucide-react |
| Build | Vite 5 (@vitejs/plugin-react) |
| Backend | Supabase — Postgres 15, GoTrue auth, PostgREST, RLS |
| Tests | Vitest 2 (unit + SSR component tests) |
| Hosting | Vercel (static build + SPA rewrite) |

No server of our own: the browser talks to PostgREST with the user's JWT, and
every table is protected by RLS. Business rules that must not be bypassed
(enrollment gates, quiz attempt limits, maintenance mode, auto-completion) live
in database policies, triggers and SECURITY DEFINER functions.

## 2. Repository layout

```
src/
  components/        shared UI (layout, ui primitives, gates, error boundary)
  config/            navigation + role metadata
  data/              program catalog, lesson/quiz seed content
  lib/               pure helpers (validation, access rules, backend adapter)
  pages/
    admin/           Super Admin screens (view-only content + registrar duties)
    trainer/         Trainer screens (author lessons/quizzes/exams, grade)
    trainee/         Trainee screens (courses, quizzes, exams, payments)
    shared/          announcements, profile
  store/             AppContext (data store + optimistic sync), selectors
supabase/
  migrations/        numbered SQL migrations — apply in order
  schema.sql         consolidated snapshot of the whole database
  functions/         edge functions (invitations)
  templates/         branded auth email templates
  tests/             SQL test scripts
scripts/             one-off admin/setup utilities
docs/                manuals, UAT report, data dictionary
```

## 3. Getting started

Requirements: **Node 18+**, a Supabase project, npm.

```bash
npm install
cp .env.example .env.local     # then fill in the two VITE_ values
npm run dev                    # http://localhost:5173
```

`.env.local` is git-ignored. Only two variables are needed to run the app:

| Variable | Where to find it |
|----------|------------------|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |

The **service_role key and personal access token must never be added to the
Vite environment** — anything with a `VITE_` prefix is bundled into the
browser build. They are only used by the setup scripts in `scripts/`, which
read `.env.local` directly with Node.

Without the two `VITE_` variables the app runs in offline demo mode against
`localStorage` (useful for UI work, no real accounts).

## 4. Database setup

The database is defined by the numbered migrations in `supabase/migrations/`.
Apply them **in order** to a fresh project, either with the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

or by pasting each file into the dashboard SQL editor. `supabase/schema.sql`
is the consolidated result of all migrations and can bootstrap a new environment
in one paste; the numbered files remain the source of truth for incremental
changes.

After the schema exists, create the first Super Admin:

```bash
node scripts/create-super-admin.mjs      # reads SUPER_ADMIN_EMAIL from .env.local
```

Optional setup helpers:

| Script | Purpose |
|--------|---------|
| `scripts/configure-auth.mjs` | pushes site URL, redirect URLs and Gmail SMTP into Supabase Auth |
| `scripts/create-super-admin.mjs` | creates/repairs the Super Admin account |
| `scripts/mfa-enroll.mjs` | enrols a TOTP factor for the Super Admin |
| `scripts/gen-programs.mjs` | regenerates the program catalog source file |
| `scripts/test-backend.mjs` | runs the backend/RPC checks against the linked project |
| `scripts/backup.mjs` | logical JSON backup / restore of every table |

## 5. npm scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build locally |
| `npm test` | Vitest unit + component suite |
| `npm run test:backend` | backend/RPC checks against the linked project |

## 6. Roles

| Role | Sees | Can write |
|------|------|-----------|
| `admin` (Super Admin) | everything | users, enrollments, payments, settings, announcements; content is read-only |
| `trainer` | own programs | lessons, quizzes, exams, schedules, attendance, evaluations, announcements |
| `trainee` | own enrollments | own applications, answers, payments, feedback |

Access is enforced twice: `ProtectedRoute` in the client and RLS policies in
Postgres. A signed-in user who types an admin URL is redirected to their own
dashboard, and the same write is refused by the database even if the client is
bypassed.

## 7. Deployment

`vercel.json` builds with `npm run build`, serves `dist/` and rewrites
unknown paths to `index.html` so client-side routing works on refresh.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel
project (Production **and** Preview). After deploying, add the new domain to
Supabase → Authentication → URL Configuration → Redirect URLs, otherwise
activation and password-reset links are rejected.

## 8. Documentation

| Document | Contents |
|----------|----------|
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | end-user walkthrough for all three roles |
| [docs/ADMIN_MANUAL.md](docs/ADMIN_MANUAL.md) | account management, RBAC, system settings, maintenance, backup |
| [docs/BACKEND.md](docs/BACKEND.md) | schema, RLS model, RPCs, auth configuration |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | common faults, diagnostics, escalation |
| [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) | every table and column |
| [docs/UAT_REPORT.md](docs/UAT_REPORT.md) | checklist results, defects fixed, open items |
| [docs/UAT_CHECKLIST_v2.1.docx](docs/UAT_CHECKLIST_v2.1.docx) | the checklist to execute: 250 checks (238 scored across 32 groups, 12 setup preconditions) plus 6 end-to-end scenarios (Markdown copy: [UAT_CHECKLIST_v2.1.md](docs/UAT_CHECKLIST_v2.1.md)) |
| [docs/FEEDBACK_AND_TIMERS.md](docs/FEEDBACK_AND_TIMERS.md) | quiz/exam timer and feedback rules |

## 9. License

Internal deliverable for HYT Global Institute. Not for redistribution.
