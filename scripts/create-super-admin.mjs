#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/create-super-admin.mjs
// ---------------------------------------------------------------------------
// Creates (or links) the designated Super Admin auth account:
//     institutehytglobal@gmail.com
//
// * The password is generated here with a CSPRNG and printed ONCE. It is never
//   written to the database in plaintext and never committed.
// * Safe to re-run: an existing account is reused, not recreated.
//
// Requires the SERVICE ROLE key (server-side secret). Run it locally only:
//
//   node scripts/create-super-admin.mjs
//
// It reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment or
// from .env.local.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'institutehytglobal@gmail.com'
const SUPER_ADMIN_PROFILE_ID = 'sa-hyt'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvFile() {
  const file = resolve(root, '.env.local')
  if (!existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    let value = m[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function generatePassword(len = 16) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*'
  const bytes = new Uint8Array(len)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => charset[b % charset.length]).join('')
}

async function findUserByEmail(admin, email) {
  let page = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const match = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
    if (match) return match
    if (data.users.length < 1000) return null
    page += 1
  }
}

async function main() {
  loadEnvFile()

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY (env or .env.local).')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  let user = await findUserByEmail(admin, SUPER_ADMIN_EMAIL)
  let generatedPassword = null

  if (!user) {
    generatedPassword = generatePassword(16)
    const { data, error } = await admin.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: { role: 'admin', name: 'Super Administrator' },
    })
    if (error) throw error
    user = data.user
    console.log(`\nCreated auth account: ${SUPER_ADMIN_EMAIL}`)
  } else {
    console.log(`\nAuth account already exists: ${SUPER_ADMIN_EMAIL} (${user.id})`)
  }

  // Free the target email from any OTHER profile first, otherwise the
  // UNIQUE(email) constraint rejects the upsert below (e.g. a leftover seed
  // profile that had its email changed by hand).
  const { data: dupes } = await admin
    .from('profiles')
    .select('id, auth_user_id')
    .eq('email', SUPER_ADMIN_EMAIL.toLowerCase())
    .neq('id', SUPER_ADMIN_PROFILE_ID)

  for (const d of dupes || []) {
    let fallbackEmail = null
    if (d.auth_user_id) {
      const { data: u } = await admin.auth.admin.getUserById(d.auth_user_id)
      fallbackEmail = u?.user?.email ?? null
    }
    await admin.from('profiles').update({ email: fallbackEmail }).eq('id', d.id)
    console.log(`Reassigned email on profile "${d.id}" (${fallbackEmail ?? 'null'}).`)
  }

  // Link / upsert the Super Admin profile.
  const { error: profileError } = await admin
    .from('profiles')
    .upsert(
      {
        id: SUPER_ADMIN_PROFILE_ID,
        auth_user_id: user.id,
        role: 'admin',
        email: SUPER_ADMIN_EMAIL.toLowerCase(),
        name: 'Super Administrator',
        first_name: 'Super',
        last_name: 'Administrator',
        status: 'active',
        is_activated: true,
        mfa_enforced: true,
        data: { position: 'Super Administrator', since: new Date().toISOString().slice(0, 10) },
      },
      { onConflict: 'id' },
    )
  if (profileError) throw profileError

  // Demote every other account that still holds a Super Admin role.
  const { error: demoteError } = await admin
    .from('profiles')
    .update({ role: 'trainee', status: 'inactive', is_activated: false, mfa_enforced: false })
    .in('role', ['admin', 'super_admin'])
    .neq('id', SUPER_ADMIN_PROFILE_ID)
  if (demoteError) throw demoteError

  console.log('\nSuper Admin profile linked (id: %s).', SUPER_ADMIN_PROFILE_ID)

  if (generatedPassword) {
    console.log('\n================================================================')
    console.log('  ONE-TIME PASSWORD (shown once — store it safely, then enroll')
    console.log('  MFA immediately with: node scripts/mfa-enroll.mjs')
    console.log('================================================================')
    console.log(`  Email:    ${SUPER_ADMIN_EMAIL}`)
    console.log(`  Password: ${generatedPassword}`)
    console.log('================================================================\n')
  } else {
    console.log('Password unchanged (account already existed).')
  }
}

main().catch((e) => {
  console.error('Failed:', e?.message || e)
  process.exit(1)
})
