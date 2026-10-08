#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/mfa-enroll.mjs
// ---------------------------------------------------------------------------
// Enrols a TOTP (authenticator app) factor for the Super Admin using Supabase
// Auth's built-in MFA — no custom crypto, no plaintext secrets.
//
// STEP 1 — enrol (prints the secret + writes an SVG QR code):
//     SUPER_ADMIN_PASSWORD='...' node scripts/mfa-enroll.mjs
//   Scan the QR (or type the secret) into Google Authenticator / Authy / 1Password.
//
// STEP 2 — verify the 6-digit code to activate the factor:
//     SUPER_ADMIN_PASSWORD='...' MFA_CODE=123456 node scripts/mfa-enroll.mjs
//
// Reads SUPABASE_URL + anon key from .env.local. The password is read from the
// environment and is never written anywhere.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

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

async function main() {
  loadEnvFile()

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const email = process.env.SUPER_ADMIN_EMAIL || 'institutehytglobal@gmail.com'
  const password = process.env.SUPER_ADMIN_PASSWORD
  const code = process.env.MFA_CODE || process.argv[2]

  if (!url || !anonKey) {
    console.error('Missing SUPABASE_URL / anon key (env or .env.local).')
    process.exit(1)
  }
  if (!password) {
    console.error("Missing SUPER_ADMIN_PASSWORD. Example: SUPER_ADMIN_PASSWORD='...' node scripts/mfa-enroll.mjs")
    process.exit(1)
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    console.error('Sign-in failed:', signInError.message)
    process.exit(1)
  }
  console.log(`Signed in as ${email}.`)

  // Reuse an existing verified factor if present.
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const verified = (factors?.totp || []).find((f) => f.status === 'verified')
  let factorId = verified?.id

  if (!factorId) {
    const { data: enroll, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Super Admin',
    })
    if (enrollError) {
      console.error('Enroll failed:', enrollError.message)
      process.exit(1)
    }
    factorId = enroll.id

    const svg = enroll.totp?.qr_code
    if (svg) {
      const out = resolve(root, 'mfa-super-admin-qr.svg')
      writeFileSync(out, svg, 'utf8')
      console.log(`\nQR code written to: ${out}  (open it and scan with your authenticator app)`)
    }
    console.log('\nManual entry secret:')
    console.log(`  ${enroll.totp?.secret}\n`)
    console.log('Then verify the 6-digit code:')
    console.log(`  SUPER_ADMIN_PASSWORD='...' MFA_CODE=123456 node scripts/mfa-enroll.mjs\n`)
  } else {
    console.log('A verified TOTP factor already exists.')
  }

  if (code) {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError) {
      console.error('Challenge failed:', challengeError.message)
      process.exit(1)
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: String(code),
    })
    if (verifyError) {
      console.error('Verify failed:', verifyError.message)
      process.exit(1)
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    console.log(`\nMFA verified. Current assurance level: ${aal?.currentLevel} (next: ${aal?.nextLevel}).`)
    console.log('The Super Admin can now perform sensitive operations.')
  }
}

main().catch((e) => {
  console.error('Failed:', e?.message || e)
  process.exit(1)
})
