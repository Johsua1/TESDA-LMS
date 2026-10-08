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

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

export default supabase
