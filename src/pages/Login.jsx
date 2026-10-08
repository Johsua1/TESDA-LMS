import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, UserCog, User, ArrowRight } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { Button, Input, FormField } from '../components/ui'
import { roleMeta } from '../config/navigation'
import { cn } from '../lib/utils'

const demoAccounts = [
  { role: 'admin', label: 'Super Admin', email: 'admin@tesda.gov.ph', password: 'admin123', icon: ShieldCheck, tone: 'bg-tesda-blue' },
  { role: 'trainer', label: 'Trainer', email: 'juan@tesda.gov.ph', password: 'trainer123', icon: UserCog, tone: 'bg-emerald-600' },
  { role: 'trainee', label: 'Trainee', email: 'angel@trainee.ph', password: 'trainee123', icon: User, tone: 'bg-brand-600' },
]

export function Login() {
  const { user, login, toast } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={roleMeta[user.role]?.home || '/login'} replace />

  const submit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setTimeout(() => {
      const res = login(email, password)
      setLoading(false)
      if (!res.ok) {
        setError(res.error)
        return
      }
      toast(`Welcome back, ${res.user.name.split(' ')[0]}!`, 'success', 'Signed in')
      const dest = location.state?.from || roleMeta[res.user.role]?.home || '/'
      navigate(dest, { replace: true })
    }, 350)
  }

  const quickFill = (acct) => {
    setEmail(acct.email)
    setPassword(acct.password)
    setError('')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ------------------------- Brand / hero panel ------------------------- */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 lg:flex xl:w-[55%] xl:p-14">
        <img
          src="/login-building.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(9,13,46,0.96) 0%, rgba(20,26,88,0.90) 45%, rgba(35,43,126,0.82) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(60% 50% at 85% 10%, rgba(120,140,255,0.28) 0%, transparent 70%)',
          }}
        />

        {/* logo */}
        <div className="relative">
          <img src="/hgi-logo.png" alt="HYT Global Institute" className="h-40 w-auto drop-shadow-xl xl:h-48" />
        </div>

        {/* hero copy */}
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-white/25 bg-white/5 px-4 py-1.5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">
              International Standard Learning
            </span>
          </span>

          <h1 className="mt-6 text-3xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-4xl xl:text-5xl">
            Building Skills for a Better Tomorrow
          </h1>

          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/75 xl:text-[15px]">
            HYTech is a centralized learning management system designed to support structured training programs, simplify
            course management, and enhance collaboration between administrators, trainers, and students.
          </p>
        </div>

        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} HYT Global Institute</p>
      </aside>

      {/* ------------------------------ Form panel ---------------------------- */}
      <div className="flex w-full flex-col items-center justify-center px-5 py-10 sm:px-8 lg:w-1/2 xl:w-[45%]">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#141a58] p-1.5">
              <img src="/hgi-logo.png" alt="HYT Global Institute" className="h-full w-full object-contain" />
            </span>
            <div>
              <p className="font-bold text-slate-800">HYT Global Institute</p>
              <p className="text-xs text-slate-500">Learning Management System</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-800">Sign in to your account</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your credentials to access the portal.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <FormField label="Email address" htmlFor="email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@tesda.gov.ph"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </FormField>

            <FormField label="Password" htmlFor="password" error={error}>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                Remember me
              </label>
              <button type="button" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={loading} iconRight={ArrowRight}>
              Sign in
            </Button>
          </form>

          <div className="mt-8">
            <div className="relative mb-4 text-center">
              <span className="relative z-10 bg-slate-50 px-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                Demo accounts
              </span>
              <span className="absolute left-0 top-1/2 h-px w-full bg-slate-200" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {demoAccounts.map((a) => (
                <button
                  key={a.role}
                  onClick={() => quickFill(a)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card',
                  )}
                >
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-white', a.tone)}>
                    <a.icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold text-slate-700">{a.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">
              Click a role to auto-fill credentials, then press Sign in.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
