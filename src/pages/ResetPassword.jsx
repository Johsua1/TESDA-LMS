import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, Lock, Eye, EyeOff, ShieldCheck, AlertTriangle, ArrowLeft } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { supabase } from '../lib/supabase'
import * as backend from '../lib/backend'
import { Button, Input, FormField } from '../components/ui'

// Landing page for the password-recovery link. Supabase appends the recovery
// token to the URL hash; the client (detectSessionInUrl) exchanges it for a
// session on load, after which the user can set a new password.
export function ResetPassword() {
  const { toast, logout } = useApp()
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking') // checking | ready | invalid
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
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setStatus(data?.session?.user ? 'ready' : 'invalid')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!cancelled && (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session))) {
        setStatus('ready')
      }
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
      toast('Your password has been updated. Please sign in.', 'success', 'Password changed')
      logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err?.message || 'Could not update your password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

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
            Verifying your reset link…
          </div>
        )}

        {status === 'invalid' && (
          <div className="rounded-2xl border border-warm-200 bg-warm-50 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warm-500" />
              <div>
                <h1 className="text-base font-bold text-slate-800">This reset link is invalid or has expired</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Request a new password-reset email from the sign-in page and try again.
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
            <h1 className="text-2xl font-bold text-slate-800">Choose a new password</h1>
            <p className="mt-1 text-sm text-slate-500">
              Enter and confirm your new password to finish resetting your account.
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

              <FormField label="Confirm new password" htmlFor="confirm-password" error={error}>
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
                Update password
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default ResetPassword
