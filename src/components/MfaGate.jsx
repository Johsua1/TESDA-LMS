import { useState } from 'react'
import { ShieldCheck, LogOut, ArrowRight } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { Button, Input, FormField } from './ui'

// Full-screen gate shown when a restored session still needs its second factor
// (AAL1 with a verified factor enrolled). Completing it upgrades the session to
// AAL2 and lets the app render normally.
export function MfaGate() {
  const { mfaPending, completeMfa, logout } = useApp()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const firstName = mfaPending?.profile?.name ? mfaPending.profile.name.split(' ')[0] : null

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (String(code).replace(/\D/g, '').length < 6) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setLoading(true)
    const res = await completeMfa(mfaPending?.factorId, code, mfaPending?.profile)
    setLoading(false)
    if (!res.ok) {
      setError(res.error || 'That code did not work. Try the next one.')
      setCode('')
    }
    // On success mfaPending clears and the app renders normally.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#141a58] p-1.5">
            <img src="/hgi-logo.png" alt="HYT Global Institute" className="h-full w-full object-contain" />
          </span>
          <div>
            <p className="font-bold text-slate-800">HYT Global Institute</p>
            <p className="text-xs text-slate-500">Learning Management System</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-800">Two-factor authentication</h1>
        <p className="mt-1 text-sm text-slate-500">
          {firstName ? `Welcome back, ${firstName}. ` : ''}
          Enter the 6-digit code from your authenticator app to continue.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <FormField label="Verification code" htmlFor="mfa-gate-code" error={error}>
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="mfa-gate-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                className="pl-9 tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                required
              />
            </div>
          </FormField>

          <Button type="submit" className="w-full" size="lg" loading={loading} icon={ArrowRight}>
            Verify &amp; continue
          </Button>
        </form>

        <button
          type="button"
          onClick={logout}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  )
}

export default MfaGate
