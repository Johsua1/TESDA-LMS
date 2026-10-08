import { useState } from 'react'
import { GraduationCap, Plus, Pencil, Trash2, Eye, Mail, Phone, MapPin, Star, Users, BookOpen } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerTrainees, programById } from '../../store/selectors'
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
} from '../../components/ui'
import { DataTable } from '../../components/ui/Table'
import { formatDate, average, cn } from '../../lib/utils'

const emptyForm = {
  role: 'trainer',
  name: '',
  email: '',
  password: 'trainer123',
  phone: '',
  address: '',
  position: '',
  specialization: '',
  programs: [],
  rating: 4.5,
}

export function ManageTrainers() {
  const { db, saveUser, deleteUser, toast } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirm, setConfirm] = useState(null)
  const [viewing, setViewing] = useState(null)

  const trainers = db.users.filter((u) => u.role === 'trainer')
  const rows = trainers.map((t) => {
    const assigned = db.programs.filter((p) => p.trainerId === t.id)
    const traineeCount = trainerTrainees(db, t.id).length
    return { id: t.id, trainer: t, assigned, traineeCount }
  })

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

  const save = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast('Name and email are required.', 'warning')
      return
    }
    const colors = ['from-emerald-500 to-teal-600', 'from-sky-500 to-blue-600', 'from-amber-500 to-orange-600', 'from-fuchsia-500 to-purple-600', 'from-indigo-500 to-violet-600']
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
      sortValue: (r) => r.trainer.rating || 0,
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-sm text-slate-600">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {r.trainer.rating || '—'}
        </span>
      ),
    },
    { key: 'since', header: 'Since', sortable: true, render: (r) => formatDate(r.trainer.since) },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
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
        <StatCard label="Programs Assigned" value={db.programs.filter((p) => p.trainerId).length} icon={BookOpen} tone="brand" />
        <StatCard label="Avg Rating" value={trainers.length ? `${average(trainers.map((t) => t.rating || 0)).toFixed(1)}` : '—'} icon={Star} tone="warning" />
      </div>

      <Card>
        <CardHeader title="Trainer Directory" icon={GraduationCap} />
        <DataTable
          columns={columns}
          data={rows}
          searchable
          searchPlaceholder="Search trainers…"
          searchKeys={['name']}
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
            <Button onClick={save}>{editing ? 'Save Changes' : 'Create Trainer'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormRow>
            <FormField label="Full Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Juan Dela Cruz" />
            </FormField>
            <FormField label="Email Address" required>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@tesda.gov.ph" />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Password">
              <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </FormField>
            <FormField label="Phone Number">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
          </FormRow>
          <FormRow cols={3}>
            <FormField label="Position">
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Trainer / Assessor" />
            </FormField>
            <FormField label="Specialization">
              <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Housekeeping NC II" />
            </FormField>
            <FormField label="Rating">
              <Input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} />
            </FormField>
          </FormRow>
          <FormField label="Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FormField>
          <FormField label="Assigned Programs">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {programs.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition',
                    form.programs.includes(p.id) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={form.programs.includes(p.id)}
                    onChange={() => toggleProgram(p.id)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-lg">{p.emoji}</span>
                  <span className="text-sm text-slate-700">{p.title}</span>
                </label>
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
                  <p className="text-base font-bold text-slate-800">{viewing.trainer.rating || '—'}</p>
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
                    <span className="text-xl">{p.emoji}</span>
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
