import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Lock, Eye, EyeOff, ShieldCheck, AlertTriangle, ArrowLeft, Sparkles } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { supabase } from '../lib/supabase'
import * as backend from '../lib/backend'
import { roleMeta } from '../config/navigation'
import { Button, Input, FormField } from '../components/ui'

// Landing page for the onboarding link emailed to a freshly created trainer or
// trainee (see sendActivationEmail). The Supabase link signs them in (type
// recovery); here they choose their OWN password, after which we send them
// straight to their role's dashboard.
export function Welcome() {
  const { toast } = useApp()
  const [status, setStatus] = useState('checking') // checking | ready | invalid
  const [profile, setProfile] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setStatus('invalid')
      return
    }
    let cancelled = false
    const accept = (session) => {
      if (cancelled || !session?.user) return
      setStatus('ready')
      // Best-effort personalisation; the form works without it.
      backend
        .fetchProfile(session.user.id)
        .then((p) => {
          if (!cancelled && p) setProfile(p)
        })
        .catch(() => {})
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) accept(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) accept(session)
    })
    return () => {
      cancelled = true
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('The passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await backend.updatePassword(password)
      // Clear the onboarding flag so a future "forgot password" email reads as
      // a reset rather than another account-setup invite.
      try {
        await supabase.auth.updateUser({ data: { must_set_password: false } })
      } catch {
        /* best-effort */
      }
      const me = profile || (await backend.fetchProfile())
      const home = roleMeta[me?.role]?.home || '/login'
      // Full reload so the app bootstraps with the (now persisted) session and
      // lands on the dashboard — no second sign-in required.
      window.location.replace(home)
    } catch (err) {
      setError(err?.message || 'Could not set your password. The link may have expired.')
      setLoading(false)
    }
  }

  const firstName = profile?.name ? profile.name.split(' ')[0] : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-800 p-1.5">
            <img src="/hgi-logo.png" alt="HYT Global Institute" className="h-full w-full object-contain" />
          </span>
          <div>
            <p className="font-bold text-slate-800">HYT Global Institute</p>
            <p className="text-xs text-slate-500">Learning Management System</p>
          </div>
        </div>

        {status === 'checking' && (
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
            Verifying your link…
          </div>
        )}

        {status === 'invalid' && (
          <div className="rounded-2xl border border-warm-200 bg-warm-50 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warm-500" />
              <div>
                <h1 className="text-base font-bold text-slate-800">This link is invalid or has expired</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Ask your administrator to resend your account invitation, then open the newest link.
                </p>
                <Link to="/login" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </Link>
              </div>
            </div>
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <Sparkles className="h-3.5 w-3.5" /> Account setup
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              {firstName ? `Welcome, ${firstName}!` : 'Welcome to the LMS Portal'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create your own password to finish setting up your account. You&apos;ll be taken straight to your dashboard.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <FormField label="New password" htmlFor="new-password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="new-password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pl-9 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-500"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <FormField label="Confirm password" htmlFor="confirm-password" error={error}>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="confirm-password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pl-9"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
              </FormField>

              <Button type="submit" className="w-full" size="lg" loading={loading} icon={KeyRound}>
                Create password &amp; continue
              </Button>
            </form>

            <p className="mt-4 text-xs text-slate-400">
              Use at least 6 characters. You can change it later from your profile.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default Welcome
