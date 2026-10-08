import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, QrCode, Copy, KeyRound, CheckCircle2, Smartphone } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Card, CardBody, CardHeader, Button, Input, FormField, Badge, Modal } from './ui'

// ---------------------------------------------------------------------------
// Super Admin MFA settings.
//   On  -> requires a verified TOTP authenticator (shows a QR to set it up).
//   Off -> sensitive operations no longer require a second factor.
//
// Uses Supabase Auth's built-in MFA (auth.mfa.*) plus two RPCs:
//   get_my_auth_state()          -> { mfa_enforced, mfa_enrolled, current_aal, ... }
//   admin_set_mfa_enforced(bool) -> persists the on/off flag (audited)
// ---------------------------------------------------------------------------
export function MfaSettings() {
  const { toast } = useApp()
  const [state, setState] = useState(null)
  const [factorId, setFactorId] = useState(null)
  const [busy, setBusy] = useState(false)

  // Setup (QR) modal
  const [setupOpen, setSetupOpen] = useState(false)
  const [enroll, setEnroll] = useState(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const [{ data: authState }, { data: factors }] = await Promise.all([
      supabase.rpc('get_my_auth_state'),
      supabase.auth.mfa.listFactors(),
    ])
    setState(authState || null)
    const verified = (factors?.totp || []).find((f) => f.status === 'verified')
    setFactorId(verified?.id || null)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const enabled = !!state?.mfa_enforced
  const enrolled = !!state?.mfa_enrolled

  // Turn ON: begin enrolment and show the QR.
  const startSetup = async () => {
    setBusy(true)
    try {
      // listFactors() only buckets VERIFIED factors into `.totp`; unverified
      // leftovers live in `.all`. Remove ALL of them so enroll() can't collide
      // on the friendly name.
      const { data: list, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) throw listError
      for (const f of list?.all || []) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: f.id })
        if (unenrollError) throw unenrollError
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Super Admin',
      })
      if (error) throw error

      setEnroll(data)
      setCode('')
      setSetupOpen(true)
    } catch (e) {
      toast(e?.message || 'Failed to start MFA setup.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Already has a verified authenticator — just switch enforcement on.
  const enableExisting = async () => {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('admin_set_mfa_enforced', { p_enabled: true })
      if (error) throw error
      toast('MFA enabled. You will be asked for a code on each sign-in.', 'success', 'Two-factor authentication')
      await refresh()
    } catch (e) {
      toast(e?.message || 'Failed to enable MFA.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Verify the 6-digit code, then persist the on/off flag.
  const verifyAndEnable = async () => {
    if (!enroll) return
    if (String(code).replace(/\D/g, '').length < 6) {
      toast('Enter the 6-digit code from your authenticator app.', 'warning')
      return
    }
    setVerifying(true)
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enroll.id })
      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enroll.id,
        challengeId: challenge.id,
        code: String(code).trim(),
      })
      if (verifyError) throw verifyError

      const { error: rpcError } = await supabase.rpc('admin_set_mfa_enforced', { p_enabled: true })
      if (rpcError) throw rpcError

      toast('MFA enabled. You will be asked for a code on each sign-in.', 'success', 'Two-factor authentication')
      setSetupOpen(false)
      setEnroll(null)
      setCode('')
      await refresh()
    } catch (e) {
      toast(e?.message || 'Verification failed. Check the code and try again.', 'error')
    } finally {
      setVerifying(false)
    }
  }

  // Turn OFF: persist the flag first (still AAL2), then remove the factor.
  const disable = async () => {
    setBusy(true)
    try {
      const { error: rpcError } = await supabase.rpc('admin_set_mfa_enforced', { p_enabled: false })
      if (rpcError) throw rpcError

      if (factorId) await supabase.auth.mfa.unenroll({ factorId })

      toast('MFA disabled.', 'info', 'Two-factor authentication')
      await refresh()
    } catch (e) {
      toast(e?.message || 'Failed to disable MFA.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggle = () => {
    if (enabled) return disable()
    if (enrolled) return enableExisting()
    return startSetup()
  }

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(enroll?.totp?.secret || '')
      toast('Setup key copied to clipboard.', 'success')
    } catch {
      toast('Copy failed — select the key manually.', 'warning')
    }
  }

  const qr = enroll?.totp?.qr_code || ''
  const qrIsSvg = qr.trimStart().startsWith('<svg')

  return (
    <>
      <Card>
        <CardHeader
          title="Two-Factor Authentication (MFA)"
          subtitle="Protect the Super Admin account with an authenticator app."
          icon={ShieldCheck}
          action={
            <Badge tone={enabled ? 'success' : 'neutral'} dot>
              {enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          {!isSupabaseConfigured ? (
            <p className="text-xs text-slate-500">
              MFA requires the Supabase backend. Configure <code>VITE_SUPABASE_URL</code> and the anon key to enable it.
            </p>
          ) : (
            <>
              <label className="flex cursor-pointer items-start justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium text-slate-700">Require MFA for Super Admin</span>
                  <span className="block text-xs text-slate-400">
                    When on, sensitive actions (managing trainers, users, programs) require a code from your
                    authenticator app in addition to your password.
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  disabled={busy}
                  onClick={toggle}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                    enabled ? 'bg-brand-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  Session: <span className="font-medium text-slate-600">{state?.current_aal || 'aal1'}</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  {enrolled ? 'Authenticator enrolled' : 'No authenticator enrolled'}
                </span>
              </div>

              {enabled && !enrolled && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-inset ring-amber-200">
                  <p className="text-xs text-amber-800">
                    MFA is required but no authenticator is enrolled. Set it up now.
                  </p>
                  <Button size="sm" icon={QrCode} onClick={startSetup} loading={busy}>
                    Set up
                  </Button>
                </div>
              )}

              {!enabled && enrolled && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-200">
                  <p className="text-xs text-slate-600">An authenticator is enrolled but MFA is turned off.</p>
                  <Button size="sm" variant="secondary" icon={ShieldCheck} onClick={toggle} loading={busy}>
                    Turn on
                  </Button>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Modal
        open={setupOpen}
        onClose={() => !verifying && setSetupOpen(false)}
        title="Set up two-factor authentication"
        subtitle="Scan the QR code with Google Authenticator, Authy or 1Password."
        icon={QrCode}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSetupOpen(false)} disabled={verifying}>
              Cancel
            </Button>
            <Button icon={CheckCircle2} onClick={verifyAndEnable} loading={verifying}>
              Verify &amp; enable
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <ol className="space-y-1 text-xs text-slate-500">
            <li>1. Scan the QR code below with your authenticator app.</li>
            <li>2. Enter the 6-digit code the app shows.</li>
          </ol>

          <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-4">
            {qrIsSvg ? (
              <div
                className="h-44 w-44 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            ) : (
              <img src={qr} alt="MFA QR code" className="h-44 w-44" />
            )}
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Can't scan? Enter this key manually
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-1.5 text-xs text-slate-700 ring-1 ring-inset ring-slate-200">
                {enroll?.totp?.secret}
              </code>
              <Button size="sm" variant="secondary" icon={Copy} onClick={copySecret}>
                Copy
              </Button>
            </div>
          </div>

          <FormField label="Verification code" htmlFor="mfa-code" hint="6-digit code from your authenticator app">
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && verifyAndEnable()}
            />
          </FormField>
        </div>
      </Modal>
    </>
  )
}

export default MfaSettings
