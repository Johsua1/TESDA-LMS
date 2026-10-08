// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
// HOW TO CONFIGURE
//   1) Supabase Dashboard > Project Settings > API
//   2) Paste your Project URL and the `anon public` key into SUPABASE_CONFIG
//      below, OR create a `.env.local` file with:
//          VITE_SUPABASE_URL=https://xxxx.supabase.co
//          VITE_SUPABASE_ANON_KEY=eyJ...
//      (env vars take priority over the values below).
//
// SECURITY: only the *anon* public key belongs here — it is safe to ship to the
// browser. NEVER paste the service_role key or your personal access token in
// this file; those are server-side secrets and would leak into the JS bundle.
//
// When both values are empty the app runs in DEMO MODE (local seed data) so it
// still works before you finish setup.
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js'

// ==================== PASTE YOUR KEYS HERE ====================
export const SUPABASE_CONFIG = {
  // e.g. 'https://abcdefghijklm.supabase.co'
  url: '',
  // Project Settings > API > Project API keys > anon public
  anonKey: '',
}
// ==============================================================

const url = String(import.meta.env?.VITE_SUPABASE_URL || SUPABASE_CONFIG.url || '').trim()
const anonKey = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || SUPABASE_CONFIG.anonKey || '').trim()

export const isSupabaseConfigured = Boolean(url && anonKey && /^https?:\/\//.test(url))

// Set by the Login page's "Remember me" checkbox. When '1' the auth session is
// kept in localStorage (survives a browser restart); otherwise it lives in
// sessionStorage and is cleared when the tab closes.
export const REMEMBER_KEY = 'tesda-lms-remember'

const authStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key, value) => {
    try {
      if (window.localStorage.getItem(REMEMBER_KEY) === '1') {
        window.localStorage.setItem(key, value)
        window.sessionStorage.removeItem(key)
      } else {
        window.sessionStorage.setItem(key, value)
        window.localStorage.removeItem(key)
      }
    } catch {
      /* storage unavailable — ignore */
    }
  },
  removeItem: (key) => {
    try {
      window.localStorage.removeItem(key)
      window.sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: authStorage,
        // Process the access tokens Supabase appends to the URL hash after an
        // email link (password recovery / activation), so those links sign the
        // user in. Standard Supabase behaviour; harmless for normal sign-in.
        detectSessionInUrl: true,
      },
    })
  : null

// Check an email/password pair without touching the signed-in session.
//
// Why not a second Supabase client? A second GoTrueClient shares the same
// storage key / broadcast channel as the main client, so signing it out wipes
// the real session ("Auth session missing!"). A plain call to the token
// endpoint has no client state at all, so it can never disturb the session —
// and it does not downgrade the main session's MFA assurance (AAL2).
export async function verifyPassword(email, password) {
  if (!isSupabaseConfigured || !email || !password) return false
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey },
      body: JSON.stringify({ email: String(email).trim().toLowerCase(), password }),
    })
    return res.ok
  } catch {
    return false
  }
}

export default supabase
