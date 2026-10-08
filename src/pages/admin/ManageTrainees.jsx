import { useState } from 'react'
import { Users, Plus, Pencil, Trash2, Eye, Mail, Phone, MapPin, GraduationCap, TrendingUp } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { courseProgress, attendanceStats, programById } from '../../store/selectors'
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
  password: 'trainee123',
  phone: '',
  address: '',
  birthDate: '',
  gender: '',
  education: 'High School Graduate',
  enrolledPrograms: [],
}

export function ManageTrainees() {
  const { db, user, saveUser, deleteUser, toast } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirm, setConfirm] = useState(null)
  const [viewing, setViewing] = useState(null)

  const trainees = db.users.filter((u) => u.role === 'trainee')
  const rows = trainees.map((t) => {
    const enrs = db.enrollments.filter((e) => e.traineeId === t.id)
    const active = enrs.filter((e) => ['Enrolled', 'Approved'].includes(e.status))
    const progress = active.length ? Math.round(average(active.map((e) => courseProgress(e, e.programId).percent))) : 0
    return { id: t.id, trainee: t, enrs, progress, att: attendanceStats(db, t.id) }
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({ ...emptyForm, ...t, enrolledPrograms: t.enrolledPrograms || [] })
    setModalOpen(true)
  }

  const save = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast('Name and email are required.', 'warning')
      return
    }
    const colors = ['from-rose-500 to-pink-600', 'from-cyan-500 to-sky-600', 'from-violet-500 to-purple-600', 'from-teal-500 to-emerald-600', 'from-orange-500 to-amber-600', 'from-blue-500 to-indigo-600']
    saveUser({
      ...form,
      id: editing?.id,
      avatarColor: editing?.avatarColor || colors[Math.floor(Math.random() * colors.length)],
      since: editing?.since || new Date().toISOString().slice(0, 10),
    })
    setModalOpen(false)
  }

  const toggleProgram = (programId) => {
    setForm((f) => ({
      ...f,
      enrolledPrograms: f.enrolledPrograms.includes(programId)
        ? f.enrolledPrograms.filter((p) => p !== programId)
        : [...f.enrolledPrograms, programId],
    }))
  }

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
        r.enrs.length ? (
          <div className="flex flex-wrap gap-1">
            {r.enrs.map((e) => (
              <Badge key={e.id} tone="brand">{programById(e.programId)?.code}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">No enrollment</span>
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
          <button onClick={() => setViewing(r)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600" aria-label="View">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={() => openEdit(r.trainee)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600" aria-label="Edit">
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
          searchKeys={['name']}
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
            <Button onClick={save}>{editing ? 'Save Changes' : 'Create Trainee'}</Button>
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
            <FormField label="Password">
              <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
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
          <FormField label="Program Assignments" hint="Select the programs this trainee can access">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {programs.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition',
                    form.enrolledPrograms.includes(p.id) ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={form.enrolledPrograms.includes(p.id)}
                    onChange={() => toggleProgram(p.id)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-lg">{p.emoji}</span>
                  <span className="text-sm text-slate-700">{p.title}</span>
                </label>
              ))}
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
                <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                  <p className="text-base font-bold text-slate-800">{viewing.att.rate}%</p>
                  <p className="text-[10px] uppercase text-slate-400">Attendance</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                  <p className="text-base font-bold text-slate-800">{viewing.progress}%</p>
                  <p className="text-[10px] uppercase text-slate-400">Progress</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 text-center">
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
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
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
