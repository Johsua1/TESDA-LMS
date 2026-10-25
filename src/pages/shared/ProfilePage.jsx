import { useState } from 'react'
import {
  UserCircle,
  Phone,
  MapPin,
  Calendar,
  Save,
  Shield,
  GraduationCap,
  BookOpen,
  Lock,
  Briefcase,
  CalendarCheck,
  Award,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import {
  programById,
  activeEnrollmentsOf,
  courseProgress,
  courseGrade,
  attendanceStats,
  trainerPrograms,
  trainerTrainees,
  trainerEnrollments,
  trainerRatingSummary,
  overallProgress,
} from '../../store/selectors'
import { PageHeader, Card, CardBody, CardHeader, Avatar, Button, Input, Select, FormField, FormRow, Badge, ProgressBar } from '../../components/ui'
import { roleMeta } from '../../config/navigation'
import { formatDate, sanitizePhone } from '../../lib/utils'
import { PasswordStrengthMeter, getPasswordStrength } from '../../components/ui/v-meter-7'
import { AssistedPasswordConfirmation } from '../../components/ui/assisted-password-confirmation'
import { CourseIcon } from '../../components/courses/CourseIcon'

export function ProfilePage() {
  const { db, user, updateProfile, changePassword } = useApp()
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    address: user.address || '',
    birthDate: user.birthDate || '',
    gender: user.gender || '',
    education: user.education || '',
  })

  const meta = roleMeta[user.role]
  const enrollments = user.role === 'trainee' ? activeEnrollmentsOf(db, user.id) : []
  const assignedPrograms = user.role === 'trainer' ? trainerPrograms(db, user.id) : []
  const ratingSummary = user.role === 'trainer' ? trainerRatingSummary(db, user.id) : null

  // Headline numbers for the identity card. They give the rail a purpose
  // instead of leaving a tall empty column next to the forms.
  const railStats =
    user.role === 'trainer'
      ? [
          { label: 'Programs', value: assignedPrograms.length },
          { label: 'Trainees', value: trainerTrainees(db, user.id).length },
          {
            label: 'Rating',
            value: ratingSummary.count ? ratingSummary.average.toFixed(1) : '—',
            hint: ratingSummary.count ? `Based on ${ratingSummary.count} trainee ratings` : 'No trainee ratings yet',
          },
        ]
      : user.role === 'trainee'
        ? [
            { label: 'Programs', value: enrollments.length },
            { label: 'Progress', value: `${overallProgress(db, user.id)}%`, hint: 'Average across active programs' },
            { label: 'Completed', value: enrollments.filter((e) => e.status === 'Completed').length },
          ]
        : [
            { label: 'Programs', value: db.programs.length },
            { label: 'Trainers', value: db.users.filter((u) => u.role === 'trainer').length },
            { label: 'Trainees', value: db.users.filter((u) => u.role === 'trainee').length },
          ]

  // Admin-managed attributes live in the rail, next to the identity card, so
  // they no longer sit as inert disabled inputs inside the edit form.
  const roleDetails =
    user.role === 'trainer'
      ? [
          { label: 'Position', value: user.position || '—' },
          { label: 'Specialization', value: user.specialization || '—' },
        ]
      : user.role === 'admin'
        ? [
            { label: 'Access level', value: 'Super Admin' },
            { label: 'Scope', value: 'All programs, accounts and content' },
          ]
        : []

  const save = (e) => {
    e.preventDefault()
    updateProfile(form)
  }

  const submitPassword = async (e) => {
    e.preventDefault()
    setPwError('')
    if (!pw.current) {
      setPwError('Enter your current password.')
      return
    }
    if (getPasswordStrength(pw.next).value < 60) {
      setPwError('New password is too weak. Use a password rated Good, Strong, or Very strong.')
      return
    }
    if (pw.next !== pw.confirm) {
      setPwError('The new passwords do not match.')
      return
    }
    setPwLoading(true)
    const res = await changePassword(pw.current, pw.next)
    setPwLoading(false)
    if (res.ok) {
      setPw({ current: '', next: '', confirm: '' })
    } else {
      setPwError(res.error)
    }
  }

  return (
    <div>
      <PageHeader title="My Profile" description="Manage your personal information and account details." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left rail — identity, at-a-glance numbers and the programs this
            account is attached to. Everything that used to sit alone in this
            column now shares the height with the forms on the right. */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="overflow-hidden">
            <div className="h-20 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800" />
            <div className="px-5 pb-5">
              <div className="-mt-10 flex flex-col items-center text-center">
                <div className="inline-flex rounded-full bg-white p-1 shadow-sm">
                  <Avatar name={user.name} color={user.avatarColor} size="xl" />
                </div>
                <h2 className="mt-3 text-lg font-bold text-slate-800">{user.name}</h2>
                <p className="max-w-full truncate text-sm text-slate-500">{user.email}</p>
                <Badge tone="brand" className="mt-2">
                  {meta.label}
                </Badge>
              </div>

              <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-left">
                {[
                  { icon: Phone, label: 'Phone', value: user.phone || '—' },
                  { icon: MapPin, label: 'Address', value: user.address || '—' },
                  ...(user.role === 'trainee'
                    ? [{ icon: Calendar, label: 'Date of Birth', value: user.birthDate ? formatDate(user.birthDate) : '—' }]
                    : []),
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <row.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">{row.label}</p>
                      <p className="truncate text-sm text-slate-700">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/70">
              {railStats.map((s) => (
                <div key={s.label} className="px-2 py-3 text-center" title={s.hint}>
                  <p className="text-base font-bold tabular-nums text-slate-800">{s.value}</p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
          </Card>

          {roleDetails.length > 0 && (
            <Card>
              <CardHeader title={user.role === 'admin' ? 'Access' : 'Role details'} icon={Briefcase} />
              <CardBody className="space-y-3">
                {roleDetails.map((d) => (
                  <div key={d.label} className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{d.label}</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-700">{d.value}</p>
                  </div>
                ))}
                <p className="flex items-start gap-1.5 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                  Managed by your administrator — ask them to update these.
                </p>
              </CardBody>
            </Card>
          )}

          {user.role === 'trainee' && (
            <Card>
              <CardHeader
                title="My Programs"
                icon={BookOpen}
                action={<Badge tone="neutral">{enrollments.length}</Badge>}
              />
              <CardBody className="space-y-3">
                {enrollments.length ? (
                  enrollments.map((e) => {
                    const p = programById(e.programId)
                    const prog = courseProgress(e, e.programId)
                    const attendance = attendanceStats(db, user.id, e.programId)
                    const grade = courseGrade(db, user.id, e.programId)
                    return (
                      <div key={e.id} className="rounded-lg border border-slate-100 p-3">
                        <div className="flex items-start gap-2.5">
                          <CourseIcon program={p} tone="dark" className="h-6 w-6 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-700" title={p?.title}>
                              {p?.title}
                            </p>
                            <p className="truncate text-[11px] text-slate-400">
                              {p?.code} · Enrolled {formatDate(e.appliedDate)}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-brand-700">
                            {prog.percent}%
                          </span>
                        </div>
                        <ProgressBar value={prog.percent} className="mt-2.5" size="sm" />
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1" title="Attendance rate">
                            <CalendarCheck className="h-3 w-3 text-slate-400" />
                            {attendance.total ? `${attendance.rate}%` : '—'}
                          </span>
                          <span className="inline-flex items-center gap-1" title="Average assessment score">
                            <Award className="h-3 w-3 text-slate-400" />
                            {grade ? `${grade}%` : '—'}
                          </span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="py-2 text-center text-xs text-slate-400">No active enrollment</p>
                )}
              </CardBody>
            </Card>
          )}

          {user.role === 'trainer' && (
            <Card>
              <CardHeader
                title="Assigned Programs"
                icon={GraduationCap}
                action={<Badge tone="neutral">{assignedPrograms.length}</Badge>}
              />
              <CardBody className="space-y-2.5">
                {assignedPrograms.length ? (
                  assignedPrograms.map((p) => {
                    const trainees = trainerEnrollments(db, user.id, p.id).length
                    return (
                      <div key={p.id} className="flex items-center gap-2.5 rounded-lg border border-slate-100 p-2.5">
                        <CourseIcon program={p} tone="dark" className="h-6 w-6 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-700" title={p.title}>
                            {p.title}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {p.code} · {p.duration} · {trainees} trainee{trainees === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="py-2 text-center text-xs text-slate-400">No assigned programs yet</p>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Personal Information" icon={UserCircle} />
            <CardBody>
              <form onSubmit={save} className="space-y-4">
                <FormRow>
                  <FormField label="Full Name">
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </FormField>
                  <FormField label="Email Address">
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </FormField>
                </FormRow>

                <FormRow>
                  <FormField label="Phone Number">
                    <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: sanitizePhone(e.target.value) })} placeholder="+63 9xx xxx xxxx" />
                  </FormField>
                  {user.role === 'trainee' ? (
                    <FormField label="Date of Birth">
                      <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                    </FormField>
                  ) : (
                    <FormField label="Address">
                      <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </FormField>
                  )}
                </FormRow>

                {user.role === 'trainee' && (
                  <>
                    <FormRow>
                      <FormField label="Gender">
                        <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                          <option value="">Select…</option>
                          <option>Male</option>
                          <option>Female</option>
                          <option>Prefer not to say</option>
                        </Select>
                      </FormField>
                      <FormField label="Educational Attainment">
                        <Select value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })}>
                          <option value="">Select…</option>
                          <option>High School Graduate</option>
                          <option>Senior High School Graduate</option>
                          <option>College Level</option>
                          <option>College Graduate</option>
                        </Select>
                      </FormField>
                    </FormRow>
                    <FormField label="Address">
                      <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </FormField>
                  </>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                  <p className="text-[11px] text-slate-400">
                    Name and contact details update immediately across your account.
                  </p>
                  <Button type="submit" icon={Save}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Account Security" icon={Shield} />
            <CardBody>
              <form onSubmit={submitPassword} className="space-y-4">
                <FormField label="Current Password">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={pw.current}
                    onChange={(e) => setPw({ ...pw, current: e.target.value })}
                  />
                </FormField>
                <FormField label="New Password" htmlFor="new-password" hint="Must be rated Good or higher">
                  <PasswordStrengthMeter
                    password={pw.next}
                    onPasswordChange={(value) => setPw({ ...pw, next: value })}
                    id="new-password"
                    name="new-password"
                    autoComplete="new-password"
                  />
                </FormField>
                <FormField label="Confirm New Password" htmlFor="confirm-password" error={pwError}>
                  <AssistedPasswordConfirmation
                    password={pw.next}
                    confirmPassword={pw.confirm}
                    onConfirmPasswordChange={(value) => setPw({ ...pw, confirm: value })}
                    id="confirm-password"
                    name="confirmPassword"
                  />
                </FormField>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                  <p className="text-[11px] text-slate-400">
                    Use a unique password you don't use on any other site.
                  </p>
                  <Button type="submit" icon={Shield} loading={pwLoading}>
                    Update Password
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
