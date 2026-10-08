import { useState } from 'react'
import { UserCircle, Mail, Phone, MapPin, Calendar, Save, Shield, GraduationCap, BookOpen, Star } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { programById, activeEnrollmentsOf, courseProgress } from '../../store/selectors'
import { PageHeader, Card, CardBody, CardHeader, Avatar, Button, Input, Select, FormField, FormRow, Badge, ProgressBar } from '../../components/ui'
import { roleMeta } from '../../config/navigation'
import { formatDate } from '../../lib/utils'

export function ProfilePage() {
  const { db, user, updateProfile } = useApp()
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
  const trainerPrograms = user.role === 'trainer' ? db.programs.filter((p) => p.trainerId === user.id) : []

  const save = (e) => {
    e.preventDefault()
    updateProfile(form)
  }

  return (
    <div>
      <PageHeader title="My Profile" description="Manage your personal information and account details." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="lg:col-span-1">
          <CardBody className="text-center">
            <Avatar name={user.name} color={user.avatarColor} size="xl" className="mx-auto" />
            <h2 className="mt-4 text-lg font-bold text-slate-800">{user.name}</h2>
            <p className="text-sm text-slate-500">{user.email}</p>
            <Badge tone="brand" className="mt-3">
              {meta.label}
            </Badge>

            <div className="mt-6 space-y-3 text-left">
              {[
                { icon: Mail, label: 'Email', value: user.email },
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
          </CardBody>
        </Card>

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
                <div className="flex justify-end">
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
                  Trainer rating: <strong>{user.rating || '—'}</strong> / 5.0
                </div>
                {trainerPrograms.map((p) => (
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
            <CardBody className="space-y-4">
              <FormRow>
                <FormField label="Current Password">
                  <Input type="password" placeholder="••••••••" />
                </FormField>
                <FormField label="New Password">
                  <Input type="password" placeholder="••••••••" />
                </FormField>
              </FormRow>
              <p className="text-xs text-slate-400">
                Password changes are simulated in this frontend demonstration and are not persisted.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
