import { useState } from 'react'
import { Users, Plus, Pencil, Trash2, Eye, Mail, Phone, MapPin, GraduationCap, TrendingUp, Copy, CheckCircle2 } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { courseProgress, attendanceStats, programById, programTrainers as trainersForProgram, enrollmentTrainerId } from '../../store/selectors'
import { programs } from '../../data/programs'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Modal,
  Input,
  Select,
  FormField,
  FormRow,
  ConfirmDialog,
  EmptyState,
  Avatar,
  Badge,
  ProgressBar,
  StatCard,
  Checkbox,
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate, average, cn } from '../../lib/utils'

const emptyForm = {
  role: 'trainee',
  name: '',
  email: '',
  password: '',
  phone: '',
  address: '',
  birthDate: '',
  gender: '',
  education: 'High School Graduate',
  enrolledPrograms: [],
  programTrainers: {}, // programId -> trainerId (who handles this trainee)
}

export function ManageTrainees() {
  const { db, createTrainee, updateTrainee, deleteUser, toast, isSupabaseConfigured } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirm, setConfirm] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [created, setCreated] = useState(null)
  const [saving, setSaving] = useState(false)

  const trainees = db.users.filter((u) => u.role === 'trainee')

  // A trainee's courses = their profile assignments UNION their actual
  // enrollments (a trainee may also self-enroll, which only creates an
  // enrollment). Keeping both in view means an unrelated edit never silently
  // drops a self-enrolled course.
  const courseProgramIds = (t) =>
    [...new Set([...(t.enrolledPrograms || []), ...db.enrollments.filter((e) => e.traineeId === t.id).map((e) => e.programId)])]

  const rows = trainees.map((t) => {
    const enrs = db.enrollments.filter((e) => e.traineeId === t.id)
    const active = enrs.filter((e) => ['Enrolled', 'Approved'].includes(e.status))
    const progress = active.length ? Math.round(average(active.map((e) => courseProgress(e, e.programId).percent))) : 0
    const trainerNames = [
      ...new Set(enrs.map((e) => enrollmentTrainerId(db, e)).filter(Boolean)),
    ]
      .map((id) => db.users.find((u) => u.id === id)?.name)
      .filter(Boolean)
    return { id: t.id, trainee: t, enrs, assigned: courseProgramIds(t), trainerNames, progress, att: attendanceStats(db, t.id) }
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (t) => {
    // Pre-fill the trainer assigned to each of the trainee's existing courses.
    const programTrainers = {}
    db.enrollments
      .filter((e) => e.traineeId === t.id)
      .forEach((e) => {
        const tid = enrollmentTrainerId(db, e)
        if (tid) programTrainers[e.programId] = tid
      })
    setEditing(t)
    setForm({ ...emptyForm, ...t, enrolledPrograms: courseProgramIds(t), programTrainers })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast('Name and email are required.', 'warning')
      return
    }
    // A course may only be assigned when it has a trainer. A course with no
    // assigned trainer can't be checked, but guard against stale state too.
    const missing = form.enrolledPrograms.filter((pid) => !form.programTrainers[pid])
    if (missing.length) {
      const names = missing.map((pid) => programById(pid)?.title || pid).join(', ')
      toast(`Select a trainer for: ${names}. Uncheck any course with no assigned trainer.`, 'warning')
      return
    }
    const colors = ['bg-rose-500', 'bg-cyan-500', 'bg-violet-500', 'bg-teal-500', 'bg-orange-500', 'bg-blue-500']
    const base = {
      ...form,
      avatarColor: editing?.avatarColor || colors[Math.floor(Math.random() * colors.length)],
      since: editing?.since || new Date().toISOString().slice(0, 10),
    }

    // Editing updates the record + reconciles the trainee's courses to match
    // their program assignments.
    if (editing) {
      updateTrainee({ ...base, id: editing.id })
      setModalOpen(false)
      return
    }

    // Creating mirrors the trainer flow: real account + activation email, with
    // the generated temp password surfaced for manual sharing.
    setSaving(true)
    const res = await createTrainee(base)
    setSaving(false)
    if (!res.ok) {
      toast(res.error || 'Failed to create the trainee.', 'error')
      return
    }
    setModalOpen(false)
    setCreated({ name: form.name, email: form.email, password: res.tempPassword, emailed: res.emailed })
  }

  const copyCreatedPassword = async () => {
    try {
      await navigator.clipboard.writeText(created?.password || '')
      toast('Temporary password copied.', 'success')
    } catch {
      toast('Copy failed — select it manually.', 'warning')
    }
  }

  const toggleProgram = (programId) => {
    setForm((f) => {
      const on = f.enrolledPrograms.includes(programId)
      const enrolledPrograms = on
        ? f.enrolledPrograms.filter((p) => p !== programId)
        : [...f.enrolledPrograms, programId]
      const programTrainers = { ...f.programTrainers }
      if (on) {
        delete programTrainers[programId]
      } else if (!programTrainers[programId]) {
        // Default to the only qualified trainer, if there's exactly one.
        const options = trainersForProgram(db, programId)
        programTrainers[programId] = options.length === 1 ? options[0].id : ''
      }
      return { ...f, enrolledPrograms, programTrainers }
    })
  }

  const setProgramTrainer = (programId, trainerId) =>
    setForm((f) => ({ ...f, programTrainers: { ...f.programTrainers, [programId]: trainerId } }))

  // Trainer options for a program: ONLY trainers assigned to that course. If
  // none are assigned yet, the list is empty — there is no fallback.
  const trainerOptions = (programId) => trainersForProgram(db, programId)

  const columns = [
    {
      key: 'name',
      header: 'Trainee',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.trainee.name} color={r.trainee.avatarColor} size="sm" />
          <div>
            <p className="font-medium text-slate-700">{r.trainee.name}</p>
            <p className="text-xs text-slate-400">{r.trainee.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'programs',
      header: 'Programs',
      render: (r) =>
        r.assigned.length ? (
          <div className="flex flex-wrap gap-1">
            {r.assigned.map((pid) => (
              <Badge key={pid} tone="brand">{programById(pid)?.code || pid}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">None</span>
        ),
    },
    {
      key: 'trainers',
      header: 'Trainer',
      render: (r) =>
        r.trainerNames.length ? (
          <div className="flex flex-wrap gap-1">
            {r.trainerNames.map((name) => (
              <Badge key={name} tone="info">{name}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">Unassigned</span>
        ),
    },
    {
      key: 'progress',
      header: 'Progress',
      sortable: true,
      sortValue: (r) => r.progress,
      render: (r) => (
        <div className="w-28">
          <ProgressBar value={r.progress} size="sm" showLabel />
        </div>
      ),
    },
    { key: 'att', header: 'Attendance', sortable: true, sortValue: (r) => r.att.rate, render: (r) => `${r.att.rate}%` },
    { key: 'since', header: 'Enrolled Since', sortable: true, render: (r) => formatDate(r.trainee.since) },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setViewing(r)} className="rounded-lg p-2 text-slate-400 transition hover:bg-gray-50 hover:text-brand-600" aria-label="View">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={() => openEdit(r.trainee)} className="rounded-lg p-2 text-slate-400 transition hover:bg-gray-50 hover:text-brand-600" aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setConfirm(r.trainee)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Trainees"
        description="Manage trainee accounts, program assignments and enrollment."
        action={<Button icon={Plus} onClick={openCreate}>Add Trainee</Button>}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Trainees" value={trainees.length} icon={Users} tone="brand" />
        <StatCard label="With Active Enrollment" value={rows.filter((r) => r.enrs.some((e) => ['Enrolled', 'Approved'].includes(e.status))).length} icon={GraduationCap} tone="success" />
        <StatCard label="Avg Progress" value={`${rows.length ? Math.round(average(rows.map((r) => r.progress))) : 0}%`} icon={TrendingUp} tone="purple" />
      </div>

      <Card>
        <CardHeader title="Trainee Directory" icon={Users} />
        <DataTable
          columns={columns}
          data={rows}
          searchable
          searchPlaceholder="Search trainees…"
          searchKeys={['trainee.name', 'trainee.email']}
          pageSize={10}
          emptyState={<EmptyState icon={Users} title="No trainees" action={<Button icon={Plus} onClick={openCreate}>Add Trainee</Button>} />}
        />
      </Card>

      {/* Create / edit */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Trainee' : 'Add New Trainee'}
        icon={Users}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save Changes' : 'Create Trainee'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormRow>
            <FormField label="Full Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Dela Cruz" />
            </FormField>
            <FormField label="Email Address" required>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@trainee.ph" />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField
              label="Temporary password"
              hint={!editing && isSupabaseConfigured ? 'Leave blank to auto-generate a secure password.' : undefined}
            >
              <Input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={!editing && isSupabaseConfigured ? 'Auto-generated' : ''}
              />
            </FormField>
            <FormField label="Phone Number">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+63 9xx xxx xxxx" />
            </FormField>
          </FormRow>
          <FormRow cols={3}>
            <FormField label="Date of Birth">
              <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            </FormField>
            <FormField label="Gender">
              <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select…</option>
                <option>Male</option>
                <option>Female</option>
              </Select>
            </FormField>
            <FormField label="Education">
              <Select value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })}>
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
          <FormField label="Program Assignments" hint="Choose the programs and the trainer who will handle this trainee">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {programs.map((p) => {
                const on = form.enrolledPrograms.includes(p.id)
                const options = trainerOptions(p.id)
                const noTrainer = !options.length
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'rounded-lg border p-3 transition',
                      on ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-brand-50',
                      noTrainer && !on && 'opacity-70',
                    )}
                  >
                    <label className={cn('flex items-center gap-3', noTrainer && !on ? 'cursor-not-allowed' : 'cursor-pointer')}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={noTrainer && !on}
                        onChange={() => toggleProgram(p.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed"
                      />
                      <span className="text-lg">{p.emoji}</span>
                      <span className="text-sm text-slate-700">{p.title}</span>
                    </label>

                    {on && (
                      <div className="mt-2.5">
                        {noTrainer ? (
                          <p className="text-[11px] text-warm-600">
                            No trainer assigned to this course. Uncheck to remove it, or assign a trainer in Manage
                            Trainers.
                          </p>
                        ) : (
                          <Select
                            value={form.programTrainers[p.id] || ''}
                            onChange={(e) => setProgramTrainer(p.id, e.target.value)}
                          >
                            <option value="">Select trainer…</option>
                            {options.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </div>
                    )}

                    {!on && noTrainer && (
                      <p className="mt-1.5 text-[11px] text-slate-400">No trainer assigned to this course.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </FormField>
        </div>
      </Modal>

      {/* View detail */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.trainee?.name}
        subtitle={viewing?.trainee?.email}
        icon={Users}
        footer={<Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>}
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={viewing.trainee.name} color={viewing.trainee.avatarColor} size="lg" />
              <div className="grid flex-1 grid-cols-3 gap-3">
                <div className="rounded-lg bg-white p-2.5 text-center">
                  <p className="text-base font-bold text-slate-800">{viewing.att.rate}%</p>
                  <p className="text-[10px] uppercase text-slate-400">Attendance</p>
                </div>
                <div className="rounded-lg bg-white p-2.5 text-center">
                  <p className="text-base font-bold text-slate-800">{viewing.progress}%</p>
                  <p className="text-[10px] uppercase text-slate-400">Progress</p>
                </div>
                <div className="rounded-lg bg-white p-2.5 text-center">
                  <p className="text-base font-bold text-slate-800">{viewing.enrs.length}</p>
                  <p className="text-[10px] uppercase text-slate-400">Programs</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { icon: Mail, label: 'Email', value: viewing.trainee.email },
                { icon: Phone, label: 'Phone', value: viewing.trainee.phone || '—' },
                { icon: MapPin, label: 'Address', value: viewing.trainee.address || '—' },
                { icon: GraduationCap, label: 'Education', value: viewing.trainee.education || '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-slate-500">
                    <row.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{row.label}</p>
                    <p className="text-sm text-slate-700">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Enrollments</p>
              <div className="space-y-2">
                {viewing.enrs.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{programById(e.programId)?.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{programById(e.programId)?.title}</p>
                        <p className="text-xs text-slate-400">{e.type === 'scholarship' ? 'Scholarship' : 'Self-Pay'}</p>
                      </div>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                ))}
                {!viewing.enrs.length && <p className="text-sm text-slate-400">No enrollments</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        title="Trainee account created"
        subtitle={created?.name}
        icon={CheckCircle2}
        footer={<Button onClick={() => setCreated(null)}>Done</Button>}
      >
        {created && (
          <div className="space-y-4">
            <div
              className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset',
                created.emailed ? 'bg-emerald-50 ring-emerald-200' : 'bg-warm-50 ring-warm-200',
              )}
            >
              <CheckCircle2
                className={cn('mt-0.5 h-4 w-4 shrink-0', created.emailed ? 'text-emerald-600' : 'text-warm-600')}
              />
              <p className={cn('text-xs', created.emailed ? 'text-emerald-800' : 'text-warm-800')}>
                {created.emailed
                  ? 'An activation email has been sent to the trainee. They can set their own password from the link.'
                  : 'Account created, but the activation email could not be sent (check the email/SMTP settings). Share the temporary password below instead.'}
              </p>
            </div>

            <div className="space-y-3 rounded-lg bg-white p-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Email (LMS Portal login)</p>
                <p className="text-sm font-medium text-slate-700">{created.email}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Temporary password</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 select-all break-all rounded-md bg-white px-2 py-1.5 font-mono text-xs text-slate-700 ring-1 ring-inset ring-slate-200">
                    {created.password || '—'}
                  </code>
                  <Button size="sm" variant="secondary" icon={Copy} onClick={copyCreatedPassword} disabled={!created.password}>
                    Copy
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              The trainee can sign in at the LMS Portal with this email and temporary password, then change it. Their
              assigned programs are now their courses.
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteUser(confirm.id)}
        title="Delete trainee?"
        message={`${confirm?.name} and their account will be permanently removed.`}
        confirmLabel="Delete"
      />
    </div>
  )
}

export default ManageTrainees
