import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, UserPlus, Upload, ArrowLeft, ShieldCheck, BookOpen, Award } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { Button, FormField, FormRow, Input, Textarea, Checkbox } from '../components/ui'

const BENEFITS = [
  { icon: BookOpen, text: 'Enroll in the Virtual Assistant program' },
  { icon: Award, text: 'Track lessons, quizzes and exam scores' },
  { icon: ShieldCheck, text: 'Secure access to your own dashboard' },
]

export function SignUp() {
  const { registerTrainee, toast } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    birthDate: '',
    gender: '',
    avatarUrl: '',
  })
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const onPicture = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      toast('Profile picture must be under 1 MB.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => set({ avatarUrl: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const submit = (e) => {
    e.preventDefault()
    setError('')
    if (!form.firstName.trim() || !form.lastName.trim()) return setError('Please enter your first and last name.')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Please enter a valid email address.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')
    if (!agree) return setError('Please agree to the Terms and Conditions and Privacy Policy.')

    setLoading(true)
    setTimeout(() => {
      const res = registerTrainee({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: form.email,
        password: form.password,
        phone: form.phone,
        address: form.address,
        birthDate: form.birthDate || null,
        gender: form.gender,
        avatarUrl: form.avatarUrl || '',
      })
      setLoading(false)
      if (!res.ok) {
        setError(res.error)
        return
      }
      toast('Account created successfully! You can now sign in.', 'success', 'Welcome!')
      navigate('/login')
    }, 400)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:px-8 lg:py-14">
        {/* Brand panel */}
        <aside className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-tesda-blue via-brand-800 to-brand-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 85% 12%, rgba(246,192,0,0.5) 0, transparent 45%), radial-gradient(circle at 5% 95%, rgba(120,140,255,0.35) 0, transparent 45%)',
            }}
          />
          <div className="relative">
            <img src="/hgi-logo.png" alt="HYT Global Institute" className="h-28 w-auto drop-shadow-xl" />
          </div>
          <div className="relative">
            <h2 className="text-2xl font-bold leading-tight">Create your trainee account</h2>
            <p className="mt-3 text-sm text-white/75">
              Join the Learning Management System and start your training journey today.
            </p>
            <ul className="mt-6 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b.text} className="flex items-start gap-3 text-sm text-white/85">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <b.icon className="h-4 w-4" />
                  </span>
                  {b.text}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-white/40">© {new Date().getFullYear()} HYT Global Institute</p>
        </aside>

        {/* Form */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Link>

          <h1 className="mt-4 text-2xl font-bold text-slate-800">Sign Up</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register as a trainee. Trainer and Super Admin accounts are created by the administrator.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <FormRow>
              <FormField label="First Name" required htmlFor="firstName">
                <Input id="firstName" value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} placeholder="Juan" required />
              </FormField>
              <FormField label="Last Name" required htmlFor="lastName">
                <Input id="lastName" value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} placeholder="Dela Cruz" required />
              </FormField>
            </FormRow>

            <FormRow>
              <FormField label="Email" required htmlFor="email">
                <Input id="email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@email.com" required />
              </FormField>
              <FormField label="Contact Number" htmlFor="phone">
                <Input id="phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+63 917 000 0000" />
              </FormField>
            </FormRow>

            <FormRow>
              <FormField label="Password" required htmlFor="password" hint="At least 6 characters">
                <Input id="password" type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} placeholder="••••••••" required />
              </FormField>
              <FormField label="Confirm Password" required htmlFor="confirmPassword">
                <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => set({ confirmPassword: e.target.value })} placeholder="••••••••" required />
              </FormField>
            </FormRow>

            <FormRow>
              <FormField label="Date of Birth" htmlFor="birthDate" hint="Optional">
                <Input id="birthDate" type="date" value={form.birthDate} onChange={(e) => set({ birthDate: e.target.value })} />
              </FormField>
              <FormField label="Profile Picture" htmlFor="avatar" hint="Optional, max 1 MB">
                <div className="flex items-center gap-3">
                  {form.avatarUrl ? (
                    <img src={form.avatarUrl} alt="Preview" className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-200" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Upload className="h-4 w-4" />
                    </span>
                  )}
                  <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    Choose file
                    <input id="avatar" type="file" accept="image/*" className="hidden" onChange={onPicture} />
                  </label>
                </div>
              </FormField>
            </FormRow>

            <FormField label="Address" htmlFor="address">
              <Textarea id="address" rows={2} value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="House no., street, barangay, city" />
            </FormField>

            <Checkbox
              id="terms"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              label={
                <span>
                  I agree to the <span className="font-semibold text-brand-600">Terms and Conditions</span> and{' '}
                  <span className="font-semibold text-brand-600">Privacy Policy</span>.
                </span>
              }
            />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={loading} icon={UserPlus}>
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default SignUp
