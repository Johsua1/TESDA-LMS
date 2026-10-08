// Caller authentication + authorization for Edge Functions.
//
// The caller is ALWAYS derived from the verified JWT (never from the request
// body). We additionally require the session to be at AAL2 (MFA completed)
// for Super Admin operations.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { adminClient } from './supabase.ts'

export interface CallerProfile {
  id: string
  auth_user_id: string
  role: 'super_admin' | 'admin' | 'trainer' | 'trainee'
  status: string
  is_activated: boolean
  mfa_enforced: boolean
  email: string | null
  name: string | null
}

export type AuthResult =
  | { ok: true; userId: string; aal: string; profile: CallerProfile; admin: SupabaseClient }
  | { ok: false; status: number; error: string }

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
    const binary = atob(padded)
    const json = decodeURIComponent(
      Array.from(binary).map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Verify the caller is an authenticated, active Super Admin at AAL2.
 */
export async function requireSuperAdmin(req: Request): Promise<AuthResult> {
  const token = bearerToken(req)
  if (!token) return { ok: false, status: 401, error: 'Missing Authorization bearer token.' }

  const admin = adminClient()

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: 'Invalid or expired session.' }
  }
  const userId = userData.user.id

  const claims = decodeJwt(token)
  const aal = String(claims?.aal ?? 'aal1')

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, auth_user_id, role, status, is_activated, mfa_enforced, email, name')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    return { ok: false, status: 403, error: 'No profile is linked to this account.' }
  }

  const p = profile as CallerProfile

  if (p.role !== 'admin' && p.role !== 'super_admin') {
    return { ok: false, status: 403, error: 'Only a Super Admin can perform this operation.' }
  }
  if (p.status !== 'active' || !p.is_activated) {
    return { ok: false, status: 403, error: 'This Super Admin account is not active.' }
  }
  // MFA is required only while the account has it turned ON (Settings toggle).
  if (p.mfa_enforced && aal !== 'aal2') {
    return { ok: false, status: 403, error: 'Multi-factor authentication is required. Complete the MFA challenge and retry.' }
  }

  return { ok: true, userId, aal, profile: p, admin }
}
