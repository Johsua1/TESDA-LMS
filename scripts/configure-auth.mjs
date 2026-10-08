#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/configure-auth.mjs
// ---------------------------------------------------------------------------
// Pushes the Supabase Auth settings kept in .env.local to the live project via
// the Supabase Management API — no dashboard clicking.
//
//   node scripts/configure-auth.mjs
//
// It reads from the environment or .env.local:
//   SUPABASE_ACCESS_TOKEN   (required)  https://supabase.com/dashboard/account/tokens
//   VITE_SUPABASE_URL       (required)  used to derive the project ref
//   AUTH_SITE_URL           Site URL (e.g. http://localhost:5173)
//   AUTH_REDIRECT_URLS      comma-separated allow-list (e.g. http://localhost:5173/**)
//   AUTH_RECOVERY_SUBJECT   Subject of the branded trainer email (optional)
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_SENDER_EMAIL, SMTP_SENDER_NAME
//   SMTP_PASS               Gmail App Password — optional; when blank the
//                           existing stored password is left untouched.
//
// Branded email templates live in supabase/templates/<name>.html and are
// pushed to the matching Supabase mailer template (currently `recovery.html`
// -> the "Reset Password" email used for trainer onboarding).
//
// NOTE: these values are NEVER used by the Vite/browser bundle. Only the
// Management API call here consumes them.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvFile() {
  const file = resolve(root, '.env.local')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let value = m[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(m[1] in process.env)) process.env[m[1]] = value
  }
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split('.')[0]
  } catch {
    return null
  }
}

async function main() {
  loadEnvFile()

  const token = process.env.SUPABASE_ACCESS_TOKEN
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const ref = process.env.SUPABASE_PROJECT_REF || (url ? projectRefFromUrl(url) : null)

  if (!token) {
    console.error('Missing SUPABASE_ACCESS_TOKEN (env or .env.local).')
    process.exit(1)
  }
  if (!ref) {
    console.error('Missing VITE_SUPABASE_URL (or SUPABASE_PROJECT_REF) to derive the project ref.')
    process.exit(1)
  }

  const body = {}

  if (process.env.AUTH_SITE_URL) body.site_url = process.env.AUTH_SITE_URL.trim()
  if (process.env.AUTH_REDIRECT_URLS) {
    body.uri_allow_list = process.env.AUTH_REDIRECT_URLS
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(',')
  }

  if (process.env.SMTP_HOST) {
    body.smtp_host = process.env.SMTP_HOST.trim()
    if (process.env.SMTP_PORT) body.smtp_port = String(process.env.SMTP_PORT).trim()
    if (process.env.SMTP_USER) body.smtp_user = process.env.SMTP_USER.trim()
    if (process.env.SMTP_SENDER_EMAIL) body.smtp_admin_email = process.env.SMTP_SENDER_EMAIL.trim()
    if (process.env.SMTP_SENDER_NAME) body.smtp_sender_name = process.env.SMTP_SENDER_NAME.trim()
    // Seconds between emails (Supabase's own throttle). Lower = smoother bulk
    // onboarding; the provider (Gmail) still enforces its own daily limits.
    if (process.env.SMTP_MAX_FREQUENCY) body.smtp_max_frequency = Number(process.env.SMTP_MAX_FREQUENCY)
    // Only (re)set the password when one is provided, so we never blank it out.
    if (process.env.SMTP_PASS) body.smtp_pass = process.env.SMTP_PASS
  }

  // Branded auth email templates. Each entry maps a file in supabase/templates
  // to the Supabase mailer fields that hold its subject + HTML body.
  const templates = [
    {
      file: 'recovery.html',
      subject: process.env.AUTH_RECOVERY_SUBJECT || 'Your HYT Global Institute LMS Portal access',
      subjectKey: 'mailer_subjects_recovery',
      contentKey: 'mailer_templates_recovery_content',
      flagKey: 'MAILER_TEMPLATES_RECOVERY_CONTENT',
    },
  ]

  const customContents = {}
  for (const t of templates) {
    const path = resolve(root, 'supabase', 'templates', t.file)
    if (!existsSync(path)) continue
    body[t.contentKey] = readFileSync(path, 'utf8')
    body[t.subjectKey] = t.subject.trim()
    customContents[t.flagKey] = true
  }
  if (Object.keys(customContents).length) body.mailer_templates_custom_contents = customContents

  if (!Object.keys(body).length) {
    console.error('Nothing to update — set AUTH_SITE_URL / AUTH_REDIRECT_URLS / SMTP_* in .env.local.')
    process.exit(1)
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.error(`Update failed (${res.status}): ${(await res.text()).slice(0, 500)}`)
    process.exit(1)
  }

  const updated = await res.json()
  console.log('\nSupabase Auth config updated ✓\n')
  console.log(`  Project ref:        ${ref}`)
  console.log(`  site_url:           ${updated.site_url ?? '(unchanged)'}`)
  console.log(`  uri_allow_list:     ${updated.uri_allow_list || '(empty)'}`)
  console.log(`  smtp_host:          ${updated.smtp_host ?? '(unchanged)'}`)
  console.log(`  smtp_port:          ${updated.smtp_port ?? '(unchanged)'}`)
  console.log(`  smtp_user:          ${updated.smtp_user ?? '(unchanged)'}`)
  console.log(`  smtp_admin_email:   ${updated.smtp_admin_email ?? '(unchanged)'}`)
  console.log(`  smtp_sender_name:   ${updated.smtp_sender_name ?? '(unchanged)'}`)
  console.log(`  smtp_max_frequency: ${updated.smtp_max_frequency ?? '(unchanged)'}`)
  console.log(`  smtp_pass:          ${body.smtp_pass ? '(updated)' : '(left as-is)'}`)
  if (body.mailer_templates_recovery_content) {
    console.log(`  recovery subject:   ${updated.mailer_subjects_recovery ?? '(unchanged)'}`)
    console.log(`  recovery template:  ${body.mailer_templates_recovery_content.length} bytes pushed`)
  }
  console.log('')
}

main().catch((e) => {
  console.error('Failed:', e?.message || e)
  process.exit(1)
})
