// Trainer invitation email.
//
// Primary provider: Resend (RESEND_API_KEY + EMAIL_FROM).
// If Resend is not configured the Edge Function falls back to Supabase Auth's
// own built-in invitation email (inviteUserByEmail), which needs no provider.
//
// The temporary password is passed to the provider only — it is never logged,
// never stored in the database, and never returned in an API response.

export interface TrainerInviteEmailInput {
  to: string
  fullName: string
  tempPassword: string | null
  activationUrl: string
  expiresAt?: string | null
  institution?: string
}

export interface EmailResult {
  delivered: boolean
  provider: string
  error?: string
}

export function emailProviderConfigured(): boolean {
  return Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('EMAIL_FROM'))
}

export async function sendTrainerInviteEmail(input: TrainerInviteEmailInput): Promise<EmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM')
  if (!apiKey || !from) {
    return { delivered: false, provider: 'none', error: 'No email provider configured (RESEND_API_KEY / EMAIL_FROM).' }
  }

  const institution = input.institution ?? Deno.env.get('INSTITUTION_NAME') ?? 'HYT Global Institute'
  const subject = `Welcome to ${institution} — Activate your trainer account`

  const passwordBlock = input.tempPassword
    ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Temporary Password</td>
         <td style="padding:6px 0;font-weight:700;font-family:monospace;font-size:15px;color:#0f172a;">${escapeHtml(input.tempPassword)}</td></tr>`
    : ''

  const expiry = input.expiresAt
    ? `<p style="color:#64748b;font-size:12px;">This activation link expires on ${escapeHtml(new Date(input.expiresAt).toUTCString())}.</p>`
    : ''

  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8fafc;padding:24px;">
    <div style="background:#141a58;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">
      <h1 style="margin:0;font-size:18px;">${escapeHtml(institution)}</h1>
      <p style="margin:4px 0 0;color:#c7cdf5;font-size:13px;">Learning Management System</p>
    </div>
    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:24px;">
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:16px;">Welcome to the Learning Management System</h2>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        Hi ${escapeHtml(input.fullName || 'Trainer')}, your trainer account has been created by the Super Admin.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Email</td>
            <td style="padding:6px 0;font-weight:600;color:#0f172a;">${escapeHtml(input.to)}</td></tr>
        ${passwordBlock}
      </table>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        Click the button below to access the LMS and create your own password. Your temporary password will
        stop working as soon as you set a new one.
      </p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${input.activationUrl}" style="background:#141a58;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;display:inline-block;">Activate Account</a>
      </p>
      ${expiry}
      <p style="color:#94a3b8;font-size:12px;">If you did not expect this email you can safely ignore it.</p>
    </div>
  </div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: input.to, subject, html }),
    })

    if (!res.ok) {
      const detail = await res.text()
      return { delivered: false, provider: 'resend', error: `Resend error (${res.status}): ${detail.slice(0, 300)}` }
    }
    return { delivered: true, provider: 'resend' }
  } catch (e) {
    return { delivered: false, provider: 'resend', error: (e as Error).message }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
