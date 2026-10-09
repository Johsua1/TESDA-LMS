import { useState } from 'react'
import { UserCircle, Mail, Phone, MapPin, Calendar, Save, Shield, GraduationCap, BookOpen, Star } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { programById, activeEnrollmentsOf, courseProgress, trainerPrograms, trainerRatingSummary } from '../../store/selectors'
import { PageHeader, Card, CardBody, CardHeader, Avatar, Button, Input, Select, FormField, FormRow, Badge, ProgressBar } from '../../components/ui'
import { roleMeta } from '../../config/navigation'
import { formatDate } from '../../lib/utils'

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
    if (pw.next.length < 6) {
      setPwError('New password must be at least 6 characters.')
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

      <div className="mx-auto max-w-5xl space-y-6">
        {/* Combined Display Info & Form Card */}
        <Card>
          <CardBody className="p-6">
            {/* Header / Avatar Section */}
            <div className="mb-6 flex flex-col items-center sm:flex-row sm:items-center sm:gap-5">
              <Avatar
                name={user.name}
                color={user.avatarColor}
                size="xl"
                className="shrink-0 bg-white shadow-sm ring-1 ring-slate-200"
              />
              <div className="mt-4 flex-1 text-center sm:mt-0 sm:text-left">
                <h2 className="text-2xl font-bold text-slate-800">{user.name}</h2>
                <p className="text-sm font-medium text-slate-500">{user.email}</p>
              </div>
              <div className="mt-3 sm:mt-0">
                <Badge tone="brand" className="px-3 py-1 text-xs">
                  {meta.label}
                </Badge>
              </div>
            </div>

            {/* Read-Only Info Grid */}
            <div className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Mail, label: 'Email', value: user.email },
                { icon: Phone, label: 'Phone', value: user.phone || '—' },
                { icon: MapPin, label: 'Address', value: user.address || '—' },
                ...(user.role === 'trainee'
                  ? [{ icon: Calendar, label: 'Date of Birth', value: user.birthDate ? formatDate(user.birthDate) : '—' }]
                  : []),
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-100">
                    <row.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{row.label}</p>
                    <p className="truncate text-sm font-medium text-slate-700">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Editable Form Section */}
            <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4">
              <UserCircle className="h-5 w-5 text-slate-400" />
              <h3 className="text-base font-semibold text-slate-800">Edit Personal Information</h3>
            </div>

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
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+63 9xx xxx xxxx" />
                </FormField>
                {user.role === 'trainee' ? (
                  <FormField label="Date of Birth">
                    <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                  </FormField>
                ) : (
                  <FormField label="Position">
                    <Input value={user.position || ''} disabled />
                  </FormField>
                )}
              </FormRow>
              <FormRow>
                {user.role === 'trainee' ? (
                  <>
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
                  </>
                ) : (
                  <FormField label="Specialization">
                    <Input value={user.specialization || ''} disabled />
                  </FormField>
                )}
              </FormRow>
              <FormField label="Address">
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </FormField>
              <div className="flex justify-end pt-2">
                <Button type="submit" icon={Save}>
                  Save Changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Role-specific */}
        {user.role === 'trainee' && (
          <Card>
            <CardHeader title="My Enrolled Programs" icon={BookOpen} />
            <CardBody className="space-y-4">
              {enrollments.length ? (
                enrollments.map((e) => {
                  const p = programById(e.programId)
                  const prog = courseProgress(e, e.programId)
                  return (
                    <div key={e.id} className="rounded-lg border border-slate-100 p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{p?.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-700">{p?.title}</p>
                          <p className="text-xs text-slate-400">
                            {p?.code} · Enrolled {formatDate(e.appliedDate)}
                          </p>
                        </div>
                        <Badge tone="brand">{prog.percent}%</Badge>
                      </div>
                      <ProgressBar value={prog.percent} className="mt-3" size="sm" />
                    </div>
                  )
                })
              ) : (
                <p className="py-4 text-center text-sm text-slate-400">No active enrollment</p>
              )}
            </CardBody>
          </Card>
        )}

        {user.role === 'trainer' && (
          <Card>
            <CardHeader title="Assigned Programs" icon={GraduationCap} />
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Star className="h-4 w-4 text-amber-500" />
                {ratingSummary.count ? (
                  <>
                    Trainee rating: <strong>{ratingSummary.average.toFixed(1)}</strong> / 5.0
                    <span className="text-xs text-slate-400">({ratingSummary.count})</span>
                  </>
                ) : (
                  <>No trainee ratings yet</>
                )}
              </div>
              {assignedPrograms.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                  <span className="text-2xl">{p.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{p.title}</p>
                    <p className="text-xs text-slate-400">{p.code} · {p.duration}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

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
              <FormRow>
                <FormField label="New Password">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={pw.next}
                    onChange={(e) => setPw({ ...pw, next: e.target.value })}
                  />
                </FormField>
                <FormField label="Confirm New Password" error={pwError}>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={pw.confirm}
                    onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                  />
                </FormField>
              </FormRow>
              <div className="flex justify-end pt-2">
                <Button type="submit" icon={Shield} loading={pwLoading}>
                  Update Password
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export default ProfilePage