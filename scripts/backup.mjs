#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Logical backup / restore for the LMS database.
//
//   node scripts/backup.mjs                 -> backups/<timestamp>/<table>.json
//   node scripts/backup.mjs --restore DIR   -> upsert those JSON files back
//
// Reads SUPABASE_ACCESS_TOKEN + VITE_SUPABASE_URL from .env.local (never from
// the browser bundle). Export uses the Management API so RLS does not hide
// rows; restore uses the service role through PostgREST.
//
// This is a *logical* backup for portability and pre-UAT snapshots. Supabase's
// own daily backups / PITR (Dashboard > Database > Backups) remain the primary
// recovery mechanism — see docs/ADMIN_MANUAL.md.
// ---------------------------------------------------------------------------
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const url = env.VITE_SUPABASE_URL
const token = env.SUPABASE_ACCESS_TOKEN
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !token) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_ACCESS_TOKEN in .env.local')
  process.exit(1)
}
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1]

// Parents before children so a restore never violates a foreign key.
const RESTORE_ORDER = [
  'specializations',
  'profiles',
  'programs',
  'trainer_programs',
  'schedules',
  'enrollments',
  'attendance',
  'quiz_attempts',
  'quiz_attempt_answers',
  'quiz_sessions',
  'quiz_requests',
  'exam_attempts',
  'exam_attempt_answers',
  'typing_tests',
  'typing_test_requests',
  'evaluations',
  'trainer_ratings',
  'trainer_feedback',
  'trainer_feedback_revisions',
  'announcements',
  'announcement_reads',
  'trainer_invitations',
  'settings',
  'audit_logs',
]

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function tableNames() {
  const rows = await sql(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  )
  return rows.map((r) => r.tablename)
}

async function backup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = path.join('backups', stamp)
  fs.mkdirSync(dir, { recursive: true })

  const tables = await tableNames()
  let total = 0
  for (const table of tables) {
    const rows = await sql(`select coalesce(json_agg(t), '[]'::json) as data from public.${table} t`)
    const data = rows[0]?.data ?? []
    fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(data, null, 2))
    total += data.length
    console.log(`  ${table.padEnd(28)} ${String(data.length).padStart(5)} rows`)
  }
  fs.writeFileSync(
    path.join(dir, '_manifest.json'),
    JSON.stringify({ created_at: new Date().toISOString(), project: ref, tables, rows: total }, null, 2),
  )
  console.log(`\nBackup written to ${dir} (${total} rows, ${tables.length} tables)`)
}

async function restore(dir) {
  if (!serviceKey) {
    console.error('Restore needs SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_manifest.json')
  const present = new Set(files.map((f) => f.replace(/\.json$/, '')))
  const ordered = [...RESTORE_ORDER.filter((t) => present.has(t)), ...[...present].filter((t) => !RESTORE_ORDER.includes(t))]

  for (const table of ordered) {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, `${table}.json`), 'utf8'))
    if (!rows.length) {
      console.log(`  ${table.padEnd(28)} skipped (empty)`)
      continue
    }
    const CHUNK = 200
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict: 'id' })
      if (error) throw new Error(`${table}: ${error.message}`)
    }
    console.log(`  ${table.padEnd(28)} ${String(rows.length).padStart(5)} rows restored`)
  }
  console.log(`\nRestore from ${dir} complete`)
}

const args = process.argv.slice(2)
try {
  if (args[0] === '--restore') {
    if (!args[1]) throw new Error('Usage: node scripts/backup.mjs --restore backups/<timestamp>')
    await restore(args[1])
  } else {
    await backup()
  }
} catch (e) {
  console.error('FAILED:', e.message)
  process.exit(1)
}
