// Supabase clients for Edge Functions.
//
// The SERVICE ROLE key is read from the function's own environment
// (SUPABASE_SERVICE_ROLE_KEY) which is injected by the Supabase runtime.
// It NEVER leaves the server and is never returned to the caller.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

/** Privileged client — bypasses RLS. Server-side only. */
export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Client bound to the caller's JWT (RLS enforced, no service role). */
export function callerClient(jwt: string): SupabaseClient {
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? env('SUPABASE_ANON_KEY')
  return createClient(env('SUPABASE_URL'), key, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function appUrl(): string {
  return (Deno.env.get('APP_URL') ?? 'http://localhost:5173').replace(/\/+$/, '')
}

export function activationRedirectUrl(): string {
  return Deno.env.get('APP_ACTIVATION_REDIRECT_URL') ?? `${appUrl()}/login`
}
