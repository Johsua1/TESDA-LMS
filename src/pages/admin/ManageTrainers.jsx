import { useState } from 'react'
import { GraduationCap, Plus, Pencil, Trash2, Eye, Mail, Phone, MapPin, Star, Users, BookOpen, CheckCircle2 } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerTrainees, trainerPrograms, trainerRatingSummary, programById } from '../../store/selectors'
import { programs } from '../../data/programs'
import {
  PageHeader,
  Card,
  CardHeader,
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
  StatCard,
  Stars,
  Checkbox,
} from '../../components/ui'
import { DataTable } from '../../components/ui/Table'
import { sendActivationEmail } from '../../lib/backend'
import { formatDate, average, cn, sanitizePhone, isValidPhone, PHONE_LENGTH } from '../../lib/utils'
import { CourseIcon } from '../../components/courses/CourseIcon'

const emptyForm = {
  role: 'trainer',
  name: '',
  email: '',
  phone: '',
  address: '',
  position: '',
  specialization: '',
  programs: [],
}

export function ManageTrainers() {
  const { db, createTrainer, updateTrainer, deleteUser, toast } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirm, setConfirm] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [created, setCreated] = useState(null)
  const [saving, setSaving] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendingId, setResendingId] = useState(null)

  const trainers = db.users.filter((u) => u.role === 'trainer')
  const rows = trainers.map((t) => {
    const assigned = trainerPrograms(db, t.id)
    const traineeCount = trainerTrainees(db, t.id).length
    // A trainer stays pending_activation until they open the emailed link and
    // set their own password (activate_my_account flips it to active).
    const awaiting = t.status === 'pending_activation'
    return { id: t.id, trainer: t, assigned, traineeCount, rating: trainerRatingSummary(db, t.id), awaiting }
  })
  // Average across trainers that actually have trainee ratings.
  const ratedRows = rows.filter((r) => r.rating.count > 0)
  const avgRating = ratedRows.length ? average(ratedRows.map((r) => r.rating.average)) : 0

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({ ...emptyForm, ...t, programs: t.programs || [] })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast('Name and email are required.', 'warning')
      return
    }
    if (form.phone.trim() && !isValidPhone(form.phone)) {
      toast(`Phone number must be exactly ${PHONE_LENGTH} digits.`, 'warning')
      return
    }
    const colors = ['from-emerald-500 to-teal-600', 'from-sky-500 to-blue-600', 'from-amber-500 to-orange-600', 'from-fuchsia-500 to-purple-600', 'from-indigo-500 to-violet-600']
    // A trainer's rating is derived from trainee feedback, never set here.
    const { rating: _rating, ...fields } = form
    const base = {
      ...fields,
      avatarColor: editing?.avatarColor || colors[Math.floor(Math.random() * colors.length)],
      since: editing?.since || new Date().toISOString().slice(0, 10),
    }

    // Editing an existing trainer updates the record + program assignments.
    if (editing) {
      updateTrainer({ ...base, id: editing.id })
      setModalOpen(false)
      return
    }

    // Creating: the backend creates the account and emails an activation link.
    // The trainer sets their OWN password from that link.
    setSaving(true)
    const res = await createTrainer(base)
    setSaving(false)
    if (!res.ok) {
      toast(res.error || 'Failed to create the trainer.', 'error')
      return
    }
    setModalOpen(false)
    setCreated({ name: form.name, email: form.email, emailed: res.emailed })
  }

  const resendActivation = async () => {
    if (!created?.email) return
    setResending(true)
    try {
      await sendActivationEmail(created.email)
      setCreated((c) => (c ? { ...c, emailed: true } : c))
      toast('Activation email sent again.', 'success')
    } catch (e) {
      toast(e?.message || 'Could not resend the email.', 'error')
    } finally {
      setResending(false)
    }
  }

  // Resend the activation link for a trainer still waiting to set their
  // password — the case where the original email bounced or was never opened.
  const resendRowActivation = async (row) => {
    setResendingId(row.id)
    try {
      await sendActivationEmail(row.trainer.email)
      toast(`Activation email sent to ${row.trainer.email}.`, 'success')
    } catch (e) {
      toast(e?.message || 'Could not send the email.', 'error')
    } finally {
      setResendingId(null)
    }
  }

  const toggleProgram = (programId) => {
    setForm((f) => ({
      ...f,
      programs: f.programs.includes(programId) ? f.programs.filter((p) => p !== programId) : [...f.programs, programId],
    }))
  }

  const columns = [
    {
      key: 'name',
      header: 'Trainer',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.trainer.name} color={r.trainer.avatarColor} size="sm" />
          <div>
            <p className="font-medium text-slate-700">{r.trainer.name}</p>
            <p className="text-xs text-slate-400">{r.trainer.position}</p>
            {r.awaiting && (
              <Badge tone="warning" dot className="mt-1">
                Awaiting activation
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'programs',
      header: 'Assigned Programs',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.assigned.length ? r.assigned.map((p) => <Badge key={p.id} tone="success">{p.code}</Badge>) : <span className="text-xs text-slate-400">None</span>}
        </div>
      ),
    },
    { key: 'trainees', header: 'Trainees', sortable: true, sortValue: (r) => r.traineeCount, render: (r) => r.traineeCount },
    {
      key: 'rating',
      header: 'Rating',
      sortable: true,
      sortValue: (r) => r.rating.average,
      render: (r) =>
        r.rating.count ? (
          <span className="inline-flex items-center gap-2 text-sm text-slate-600">
            <Stars value={Math.round(r.rating.average)} size="sm" />
            {r.rating.average.toFixed(1)}
            <span className="text-xs text-slate-400">({r.rating.count})</span>
          </span>
        ) : (
          <span className="text-xs text-slate-400">No ratings yet</span>
        ),
    },
    { key: 'since', header: 'Since', sortable: true, render: (r) => formatDate(r.trainer.since) },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.awaiting && (
            <button
              onClick={() => resendRowActivation(r)}
              disabled={resendingId === r.id}
              className="rounded-lg p-2 text-amber-500 transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
              aria-label="Resend activation email"
              title="Resend activation email"
            >
              <Mail className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => setViewing(r)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600" aria-label="View">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={() => openEdit(r.trainer)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600" aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setConfirm(r.trainer)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Trainers"
        description="Manage trainer accounts and program assignments."
        action={<Button icon={Plus} onClick={openCreate}>Add Trainer</Button>}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Trainers" value={trainers.length} icon={GraduationCap} tone="success" />
        <StatCard label="Programs Assigned" value={trainers.reduce((n, t) => n + trainerPrograms(db, t.id).length, 0)} icon={BookOpen} tone="brand" />
        <StatCard label="Avg Rating" value={avgRating ? avgRating.toFixed(1) : '—'} icon={Star} tone="warning" hint={ratedRows.length ? `${ratedRows.length} rated` : 'No ratings yet'} />
      </div>

      <Card>
        <CardHeader title="Trainer Directory" icon={GraduationCap} />
        <DataTable
          columns={columns}
          data={rows}
          searchable
          searchPlaceholder="Search trainers…"
          searchKeys={['trainer.name', 'trainer.email']}
          pageSize={10}
          emptyState={<EmptyState icon={GraduationCap} title="No trainers" action={<Button icon={Plus} onClick={openCreate}>Add Trainer</Button>} />}
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Trainer' : 'Add New Trainer'}
        icon={GraduationCap}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save Changes' : 'Create Trainer'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormRow>
            <FormField label="Full Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Dela Cruz" />
            </FormField>
            <FormField label="Email Address" required hint="We email an activation link here so they create their own password.">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@tesda.gov.ph" />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Phone Number">
              <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: sanitizePhone(e.target.value) })} placeholder="09171234567" />
            </FormField>
            <FormField label="Position">
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Trainer / Assessor" />
            </FormField>
          </FormRow>
          <FormField label="Specialization">
            <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Housekeeping NC II" />
          </FormField>
          <FormField label="Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FormField>
          <FormField label="Assigned Programs">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {programs.map((p) => (
                <Checkbox
                  key={p.id}
                  accent="emerald"
                  checked={form.programs.includes(p.id)}
                  onChange={() => toggleProgram(p.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition',
                    form.programs.includes(p.id) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50',
                  )}
                  label={
                    <>
                      <CourseIcon program={p} tone="dark" className="h-5 w-5" />
                      <span className="text-sm text-slate-700">{p.title}</span>
                    </>
                  }
                />
              ))}
            </div>
          </FormField>
        </div>
      </Modal>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.trainer?.name}
        subtitle={viewing?.trainer?.position}
        icon={GraduationCap}
        footer={<Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>}
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={viewing.trainer.name} color={viewing.trainer.avatarColor} size="lg" />
              <div className="grid flex-1 grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                  <p className="text-base font-bold text-slate-800">{viewing.assigned.length}</p>
                  <p className="text-[10px] uppercase text-slate-400">Programs</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                  <p className="text-base font-bold text-slate-800">{viewing.traineeCount}</p>
                  <p className="text-[10px] uppercase text-slate-400">Trainees</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                  <p className="text-base font-bold text-slate-800">
                    {viewing.rating.count ? viewing.rating.average.toFixed(1) : '—'}
                  </p>
                  <p className="text-[10px] uppercase text-slate-400">Rating</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { icon: Mail, label: 'Email', value: viewing.trainer.email },
                { icon: Phone, label: 'Phone', value: viewing.trainer.phone || '—' },
                { icon: MapPin, label: 'Address', value: viewing.trainer.address || '—' },
                { icon: Star, label: 'Specialization', value: viewing.trainer.specialization || '—' },
                { icon: CheckCircle2, label: 'Account Status', value: viewing.awaiting ? 'Awaiting activation' : 'Active' },
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
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned Programs</p>
              <div className="space-y-2">
                {viewing.assigned.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                    <CourseIcon program={p} tone="dark" className="h-6 w-6" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{p.title}</p>
                      <p className="text-xs text-slate-400">{p.code}</p>
                    </div>
                  </div>
                ))}
                {!viewing.assigned.length && <p className="text-sm text-slate-400">No assigned programs</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        title="Trainer account created"
        subtitle={created?.name}
        icon={CheckCircle2}
        footer={<Button onClick={() => setCreated(null)}>Done</Button>}
      >
        {created && (
          <div className="space-y-4">
            <div
              className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset',
                created.emailed ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200',
              )}
            >
              <CheckCircle2
                className={cn('mt-0.5 h-4 w-4 shrink-0', created.emailed ? 'text-emerald-600' : 'text-amber-600')}
              />
              <p className={cn('text-xs', created.emailed ? 'text-emerald-800' : 'text-amber-800')}>
                {created.emailed
                  ? 'An activation email has been sent. The trainer will create their OWN password from the link, then land straight on their dashboard.'
                  : 'Account created, but the activation email could not be sent. Check the email/SMTP settings, then resend it below.'}
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Email (LMS Portal login)</p>
              <p className="text-sm font-medium text-slate-700">{created.email}</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Didn&apos;t get the email? Send it again.</p>
              <Button size="sm" variant="secondary" icon={Mail} loading={resending} onClick={resendActivation}>
                Resend email
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              There is no temporary password to share — the trainer chooses their own password from the email link.
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteUser(confirm.id)}
        title="Delete trainer?"
        message={`${confirm?.name} and their account will be permanently removed.`}
        confirmLabel="Delete"
      />
    </div>
  )
}

export default ManageTrainers
