// ===========================================================================
// Edge Function: resend-trainer-invitation
// ---------------------------------------------------------------------------
// Re-issue an activation email for a trainer who has not activated yet.
//   * Super Admin + AAL2 only.
//   * Invalidates any previous live invitation (single live invitation rule).
//   * Issues a fresh, expiring invitation and a new secure activation link.
//   * Never returns or logs a temporary credential.
// ===========================================================================

import { corsHeaders, json, errorResponse } from '../_shared/cors.ts'
import { requireSuperAdmin } from '../_shared/auth.ts'
import { activationRedirectUrl } from '../_shared/supabase.ts'
import { emailProviderConfigured, sendTrainerInviteEmail } from '../_shared/email.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse('Method not allowed.', 405)

  const auth = await requireSuperAdmin(req)
  if (!auth.ok) return errorResponse(auth.error, auth.status)
  const { admin, profile: actor } = auth

  let body: { trainer_id?: string }
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body.')
  }

  const trainerId = String(body.trainer_id ?? '').trim()
  if (!trainerId) return errorResponse('trainer_id is required.')

  const { data: trainer, error: trainerError } = await admin
    .from('profiles')
    .select('id, email, name, status, role')
    .eq('id', trainerId)
    .maybeSingle()

  if (trainerError || !trainer) return errorResponse('Trainer not found.', 404)
  if (trainer.role !== 'trainer') return errorResponse('The specified account is not a trainer.', 400)
  if (trainer.status === 'active') return errorResponse('This trainer has already activated their account.', 400)

  // Issue a fresh invitation (revokes the previous live one atomically).
  const { data: invitation, error: rpcError } = await admin.rpc('admin_resend_invitation_record', {
    p_trainer_id: trainerId,
    p_actor_profile_id: actor.id,
    p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })

  if (rpcError || !invitation) {
    return errorResponse(rpcError?.message ?? 'Failed to create the invitation.', 500)
  }

  const invitationId = (invitation as Record<string, unknown>).invitation_id as string
  const expiresAt = (invitation as Record<string, unknown>).expires_at as string
  const redirectTo = activationRedirectUrl()

  // Generate a fresh secure activation link.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: trainer.email as string,
    options: { redirectTo },
  })

  if (linkError || !linkData?.properties?.action_link) {
    await admin.rpc('admin_mark_invitation_sent', { p_invitation_id: invitationId, p_status: 'failed' })
    return errorResponse(linkError?.message ?? 'Failed to generate the activation link.', 500)
  }

  const activationUrl = linkData.properties.action_link

  if (!emailProviderConfigured()) {
    // No email provider: return the single-use, expiring link for the Super
    // Admin to relay manually. It is not a credential and cannot be reused.
    await admin.rpc('admin_mark_invitation_sent', { p_invitation_id: invitationId, p_status: 'sent', p_provider: 'manual' })
    return json({
      ok: true,
      trainer_id: trainerId,
      email: trainer.email,
      invitation_id: invitationId,
      invitation_expires_at: expiresAt,
      email_delivered: false,
      email_provider: 'manual',
      activation_url: activationUrl,
      note: 'No email provider configured — share this single-use activation link with the trainer.',
    })
  }

  const result = await sendTrainerInviteEmail({
    to: trainer.email as string,
    fullName: (trainer.name as string) ?? 'Trainer',
    tempPassword: null,
    activationUrl,
    expiresAt,
  })

  await admin.rpc('admin_mark_invitation_sent', {
    p_invitation_id: invitationId,
    p_status: result.delivered ? 'sent' : 'failed',
    p_provider: result.provider,
  })

  return json({
    ok: true,
    trainer_id: trainerId,
    email: trainer.email,
    invitation_id: invitationId,
    invitation_expires_at: expiresAt,
    email_delivered: result.delivered,
    email_provider: result.provider,
    ...(result.error ? { email_error: result.error } : {}),
  })
})
