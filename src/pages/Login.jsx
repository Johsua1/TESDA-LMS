import { useState } from 'react'
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, UserCog, User, ArrowRight, KeyRound } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { Button, Input, FormField, Modal } from '../components/ui'
import { roleMeta } from '../config/navigation'
import { REMEMBER_KEY } from '../lib/supabase'
import * as backend from '../lib/backend'
import { cn } from '../lib/utils'

const demoAccounts = [
  { role: 'admin', label: 'Super Admin', email: 'admin@tesda.gov.ph', password: 'admin123', icon: ShieldCheck, tone: 'bg-[#1c2560] text-white border border-blue-900/40' },
  { role: 'trainer', label: 'Trainer', email: 'juan@tesda.gov.ph', password: 'trainer123', icon: UserCog, tone: 'bg-amber-500 text-slate-950 font-bold border border-amber-400' },
  { role: 'trainee', label: 'Trainee', email: 'angel@trainee.ph', password: 'trainee123', icon: User, tone: 'bg-blue-600 text-white' },
]

export function Login() {
  const { user, login, completeMfa, toast, isSupabaseConfigured } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mfa, setMfa] = useState(null)
  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  if (user) return <Navigate to={roleMeta[user.role]?.home || '/login'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
    } catch {
      /* ignore */
    }

    if (mfa) {
      const res = await completeMfa(mfa.factorId, code, mfa.profile)
      setLoading(false)
      if (!res.ok) {
        setError(res.error)
        return
      }
      toast(`Welcome back, ${res.user.name.split(' ')[0]}!`, 'success', 'Signed in')
      navigate(location.state?.from || roleMeta[res.user.role]?.home || '/', { replace: true })
      return
    }

    const res = await login(email, password)
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    if (res.mfaRequired) {
      setMfa({ factorId: res.factorId, profile: res.user })
      setCode('')
      return
    }
    toast(`Welcome back, ${res.user.name.split(' ')[0]}!`, 'success', 'Signed in')
    const dest = location.state?.from || roleMeta[res.user.role]?.home || '/'
    navigate(dest, { replace: true })
  }

  const quickFill = (acct) => {
    setEmail(acct.email)
    setPassword(acct.password)
    setError('')
  }

  const sendReset = async (e) => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      toast('Password reset is unavailable in demo mode.', 'info')
      return
    }
    if (!forgotEmail.trim()) {
      toast('Enter your account email address.', 'error')
      return
    }
    setForgotLoading(true)
    try {
      await backend.sendPasswordResetEmail(forgotEmail)
      toast('If an account exists for that email, a reset link is on its way.', 'success', 'Check your inbox')
      setForgotOpen(false)
      setForgotEmail('')
    } catch (err) {
      toast(err?.message || 'Could not send the reset email. Please try again.', 'error')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-[#111625] overflow-hidden">
      
      {/* ------------------------- Left Panel (Vibrant Splitted Image & Headlines) ------------------------- */}
      <aside className="relative flex w-full flex-col justify-between p-8 sm:p-12 lg:w-[52%] xl:w-[55%] xl:p-20 bg-[#161d4a] text-white min-h-[500px] lg:min-h-screen border-r border-blue-900/20">
        
        {/* Full-bleed Architectural Image Overlay */}
        <img
          src="/login-building.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        
        {/* Lighter, Vibrating Navy Screen overlays */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(28,37,96,0.85) 0%, rgba(26,35,92,0.88) 50%, rgba(30,38,109,0.85) 100%)',
          }}
        />
        
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 20%, rgba(60,95,220,0.15) 0%, transparent 80%)',
          }}
        />
        
        {/* Top: Brand Crest */}
        <div className="relative z-10 flex flex-col items-start">
          <img 
            src="/hgi-logo.png" 
            alt="HYT Global Institute" 
            className="h-28 sm:h-32 xl:h-36 w-auto drop-shadow-[0_6px_16px_rgba(0,0,0,0.4)]" 
          />
        </div>

        {/* Middle: Learning Management System pill placed on top of Building Skills headline */}
        <div className="relative z-10 my-auto py-10 max-w-xl">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-400">
                Learning Management System
              </span>
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[2.85rem] xl:text-[3.75rem] font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-sm">
            Building Skills for a <span className="text-white">Better Tomorrow</span>
          </h1>
          <p className="mt-4 text-xs sm:text-sm leading-relaxed text-slate-200/95 font-medium max-w-lg">
            HYTech is a centralized learning management system designed to support structured training programs, simplify
            course management, and enhance collaboration between administrators, trainers, and students.
          </p>
        </div>

        {/* Bottom: Subdued Footer Stamps */}
        <div className="relative z-10 border-t border-white/10 pt-6">
          <p className="text-xs font-bold tracking-[0.12em] text-white/90 uppercase">HYT GLOBAL INSTITUTE INC.</p>
          <p className="mt-1 text-[10px] sm:text-xs text-slate-400/90 font-medium">© {new Date().getFullYear()} All Rights Reserved. Securing world-class excellence.</p>
        </div>
      </aside>

      {/* ------------------------- Right Panel (Immersive Form) ------------------------- */}
      <div className="flex w-full flex-col justify-center bg-white px-6 py-12 sm:px-14 lg:w-[48%] xl:w-[45%] xl:px-20 min-h-screen">
        
        <div className="mx-auto w-full max-w-sm sm:max-w-md space-y-7">
          
          <div className="text-left">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {mfa ? 'Two-Factor Authentication' : 'Sign In'}
            </h2>
            <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-500/90 leading-snug">
              {mfa ? 'Enter the 6-digit code from your authenticator app.' : 'Sign in with your password account.'}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mfa ? (
              <FormField label="Verification code" htmlFor="mfa-code" error={error}>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="mfa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    className="pl-9.5 text-base tracking-[0.4em] py-2.5 border-slate-300 focus:border-blue-700 focus:ring-blue-700 rounded-lg text-xs"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                    required
                  />
                </div>
              </FormField>
            ) : (
              <>
                <FormField label="Email" htmlFor="email">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="username"
                      placeholder="Email address"
                      className="pl-10 py-2.5 text-xs sm:text-sm border-slate-300 focus:border-blue-700 focus:ring-blue-700 rounded-lg font-medium placeholder-slate-400"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </FormField>

                <FormField label="Password" htmlFor="password" error={error}>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Password"
                      className="pl-10 pr-12 py-2.5 text-xs sm:text-sm border-slate-300 focus:border-blue-700 focus:ring-blue-700 rounded-lg font-medium placeholder-slate-400"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </FormField>

                <div className="flex items-center justify-between pt-0.5">
                  <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email)
                      setForgotOpen(true)
                    }}
                    className="text-xs sm:text-sm font-extrabold text-blue-900 hover:text-blue-950 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              </>
            )}

            <Button 
              type="submit" 
              className="w-full py-3 text-xs sm:text-sm font-extrabold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-600 hover:to-orange-600 border-0 rounded-lg shadow-sm shadow-orange-500/10 transition" 
              size="md" 
              loading={loading} 
              iconRight={ArrowRight}
            >
              {mfa ? 'Verify & sign in' : 'SIGN IN'}
            </Button>

            {mfa && (
              <button
                type="button"
                onClick={() => {
                  setMfa(null)
                  setCode('')
                  setError('')
                }}
                className="w-full text-center text-xs sm:text-sm font-bold text-blue-900 hover:text-blue-950"
              >
                Use a different account
              </button>
            )}
          </form>

          <p className="text-center text-xs sm:text-sm text-slate-500 font-semibold pt-1">
            Don't have an account?{' '}
            <Link to="/signup" className="font-extrabold text-blue-900 hover:text-blue-950 hover:underline">
              Sign up
            </Link>
          </p>

          {!isSupabaseConfigured && (
            <div className="pt-4 border-t border-slate-100">
              <div className="relative mb-4 text-center">
                <span className="relative z-10 bg-white px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400/90">
                  Quick-Access Demo Accounts
                </span>
                <span className="absolute left-0 top-1/2 h-[1px] w-full bg-slate-200" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {demoAccounts.map((a) => (
                  <button
                    key={a.role}
                    type="button"
                    onClick={() => quickFill(a)}
                    className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-center transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50/10"
                  >
                    <span className={cn('flex h-7.5 w-7.5 items-center justify-center rounded-lg shadow-sm', a.tone)}>
                      <a.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold text-slate-800 tracking-tight">{a.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-[9px] sm:text-[10px] font-semibold text-slate-400">
                Click a role to auto-fill credentials, then press Sign in.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Forgot password */}
      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset your password"
        subtitle="We'll email you a secure link to choose a new password."
        icon={KeyRound}
        size="sm"
      >
        <form onSubmit={sendReset} className="space-y-4">
          <FormField label="Email address" htmlFor="forgot-email">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="forgot-email"
                type="email"
                autoComplete="username"
                placeholder="you@tesda.gov.ph"
                className="pl-9 text-xs sm:text-sm"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
            </div>
          </FormField>
          <div className="flex justify-end gap-2 pt-1.5">
            <Button type="button" variant="secondary" onClick={() => setForgotOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs sm:text-sm" 
              loading={forgotLoading}
            >
              Send reset link
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Login