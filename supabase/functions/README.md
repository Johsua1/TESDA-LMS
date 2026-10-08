# Edge Functions

Server-side logic that must never run in the browser. Both functions verify the
caller's JWT, require an **active Super Admin at AAL2 (MFA completed)**, and use
the `service_role` key from the function environment only.

| Function | Purpose |
|----------|---------|
| `create-trainer` | Create a Trainer auth account + profile (pending_activation) + program assignments + invitation, and send the activation email. |
| `resend-trainer-invitation` | Revoke the previous invitation and issue a fresh expiring activation link/email. |

## Shared helpers (`_shared/`)

| File | Purpose |
|------|---------|
| `cors.ts` | CORS headers + JSON responses |
| `supabase.ts` | service-role client, caller client, app URLs |
| `auth.ts` | JWT verification, AAL2 + Super Admin checks |
| `email.ts` | Resend provider (falls back to Supabase Auth invite) |
| `password.ts` | CSPRNG temporary password generator |

## Deploy

```bash
supabase functions deploy create-trainer
supabase functions deploy resend-trainer-invitation
```

## Required function secrets

```bash
supabase secrets set \
  SUPABASE_URL="https://<project>.supabase.co" \
  SUPABASE_ANON_KEY="<anon key>" \
  SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
  APP_URL="https://your-app.example.com" \
  APP_ACTIVATION_REDIRECT_URL="https://your-app.example.com/login" \
  INSTITUTION_NAME="HYT Global Institute" \
  RESEND_API_KEY="re_..." \
  EMAIL_FROM="HYT Global Institute <no-reply@your-domain>"
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided
automatically by the Supabase runtime — you only need to set the rest.

If `RESEND_API_KEY`/`EMAIL_FROM` are absent, `create-trainer` falls back to
Supabase's built-in invitation email (no temporary password), and
`resend-trainer-invitation` returns a single-use activation link for the Super
Admin to relay.
