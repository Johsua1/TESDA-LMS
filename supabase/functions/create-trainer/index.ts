// ===========================================================================
// Edge Function: create-trainer
// ---------------------------------------------------------------------------
// Securely create a Trainer account. Responsibilities:
//   1. Verify the authenticated caller (JWT).
//   2. Verify the caller is an active Super Admin at AAL2 (MFA completed).
//   3. Validate the trainer payload.
//   4. Ensure the email is unique.
//   5. Create the Supabase Auth user (temp password) OR send a Supabase invite.
//   6. Atomically create the profile (pending_activation), program assignments
//      and invitation record via the admin_finalize_trainer() RPC.
//   7. Send the branded invitation email (Resend) or rely on Supabase's invite.
//   8. Roll back the Auth user if the database step fails.
//
// Returns only safe information. The service_role key never leaves the server.
// ===========================================================================

import { corsHeaders, json, errorResponse } from '../_shared/cors.ts'
import { requireSuperAdmin } from '../_shared/auth.ts'
import { activationRedirectUrl } from '../_shared/supabase.ts'
import { emailProviderConfigured, sendTrainerInviteEmail } from '../_shared/email.ts'
import { generateTempPassword } from '../_shared/password.ts'

interface CreateTrainerBody {
  full_name?: string
  email?: string
  position?: string
  specialization_id?: string | null
  address?: string
  phone?: string
  programs?: string[]
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('Method not allowed.', 405)

  const auth = await requireSuperAdmin(req)
  if (!auth.ok) return errorResponse(auth.error, auth.status)
  const { admin, profile: actor } = auth

  let body: CreateTrainerBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body.')
  }

  const fullName = String(body.full_name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const position = body.position ? String(body.position).trim() : null
  const specializationId = body.specialization_id ? String(body.specialization_id) : null
  const address = body.address ? String(body.address).trim() : null
  const phone = body.phone ? String(body.phone).trim() : null
  const programs = Array.isArray(body.programs) ? body.programs.map((p) => String(p)) : []

  if (!fullName) return errorResponse('Full name is required.')
  if (!EMAIL_RE.test(email)) return errorResponse('A valid email address is required.')

  // ---- Email uniqueness (cheap check; the Auth API is authoritative) --------
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existingProfile) return errorResponse('An account with this email already exists.', 409)

  const useProvider = emailProviderConfigured()
  const tempPassword = useProvider ? generateTempPassword(12) : null
  const redirectTo = activationRedirectUrl()

  let userId: string | null = null
  let inviteSentBySupabase = false

  // ---- 1) Create the Auth user ---------------------------------------------
  try {
    if (useProvider) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: tempPassword!,
        email_confirm: true,
        user_metadata: { role: 'trainer', name: fullName, must_set_password: true },
      })
      if (error || !data?.user) {
        return errorResponse(error?.message ?? 'Failed to create the auth account.', 409)
      }
      userId = data.user.id
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { role: 'trainer', name: fullName, must_set_password: true },
      })
      if (error || !data?.user) {
        return errorResponse(error?.message ?? 'Failed to invite the trainer.', 409)
      }
      userId = data.user.id
      inviteSentBySupabase = true
    }
  } catch (e) {
    return errorResponse((e as Error).message, 500)
  }

  // ---- 2) Atomically create profile + assignments + invitation -------------
  const { data: finalized, error: finalizeError } = await admin.rpc('admin_finalize_trainer', {
    p_auth_user_id: userId,
    p_trainer_id: null,
    p_email: email,
    p_full_name: fullName,
    p_position: position,
    p_specialization_id: specializationId,
    p_address: address,
    p_phone: phone,
    p_programs: programs,
    p_actor_profile_id: actor.id,
    p_invitation_status: inviteSentBySupabase ? 'sent' : 'pending',
    p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })

  if (finalizeError || !finalized) {
    // Roll back the orphaned Auth user — never leave a partial trainer.
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
    return errorResponse(finalizeError?.message ?? 'Failed to finalize the trainer account.', 500)
  }

  const trainerId = (finalized as Record<string, unknown>).trainer_id as string
  const invitationId = (finalized as Record<string, unknown>).invitation_id as string
  const expiresAt = (finalized as Record<string, unknown>).expires_at as string

  // ---- 3) Generate the secure activation link + send the email -------------
  let activationUrl = `${redirectTo}`
  let emailDelivered = inviteSentBySupabase
  let emailProvider = inviteSentBySupabase ? 'supabase' : 'none'
  let emailError: string | undefined

  if (useProvider) {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })

    if (linkError || !linkData?.properties?.action_link) {
      emailError = linkError?.message ?? 'Failed to generate the activation link.'
      await admin.rpc('admin_mark_invitation_sent', { p_invitation_id: invitationId, p_status: 'failed', p_provider: 'resend' })
    } else {
      activationUrl = linkData.properties.action_link
      const result = await sendTrainerInviteEmail({
        to: email,
        fullName,
        tempPassword,
        activationUrl,
        expiresAt,
      })
      emailDelivered = result.delivered
      emailProvider = result.provider
      emailError = result.error
      await admin.rpc('admin_mark_invitation_sent', {
        p_invitation_id: invitationId,
        p_status: result.delivered ? 'sent' : 'failed',
        p_provider: result.provider,
      })
    }
  }

  return json({
    ok: true,
    trainer_id: trainerId,
    email,
    status: 'pending_activation',
    invitation_id: invitationId,
    invitation_expires_at: expiresAt,
    email_delivered: emailDelivered,
    email_provider: emailProvider,
    ...(emailError ? { email_error: emailError } : {}),
  })
})
