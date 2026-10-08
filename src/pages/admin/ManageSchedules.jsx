import { useMemo, useState } from 'react'
import { CalendarDays, Plus, Pencil, Trash2, Video, Copy } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { programById } from '../../store/selectors'
import { programLessons } from '../../data/programs'
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Modal,
  AlertDialog,
  Input,
  Select,
  FormField,
  FormRow,
  ConfirmDialog,
  EmptyState,
  Dropdown,
  Badge,
  StatCard,
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate, formatTime, startOfDay, combineDateTime } from '../../lib/utils'

const emptyForm = {
  programId: '',
  lessonId: '',
  trainerId: '',
  date: new Date().toISOString().slice(0, 10),
  startTime: '09:00',
  endTime: '11:00',
  classType: 'Online',
  meetingLink: 'https://meet.google.com/abc-defg-hij',
  room: 'Room 101',
  status: 'Upcoming',
}

export function ManageSchedules() {
  const { db, saveSchedule, deleteSchedule, toast } = useApp()
  const trainers = db.users.filter((u) => u.role === 'trainer')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirm, setConfirm] = useState(null)
  const [programFilter, setProgramFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [formError, setFormError] = useState(null)

  const lessons = useMemo(() => (form.programId ? programLessons(form.programId) : []), [form.programId])

  const schedules = db.schedules
    .filter((s) => programFilter === 'all' || s.programId === programFilter)
    .filter((s) => typeFilter === 'all' || s.classType === typeFilter)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const today = startOfDay()
  const upcoming = schedules.filter((s) => new Date(s.date) >= today).length
  const online = schedules.filter((s) => s.classType !== 'Face-to-Face').length

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, programId: db.programs[0]?.id || '', trainerId: db.programs[0]?.trainerId || '' })
    setModalOpen(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({ ...s })
    setModalOpen(true)
  }

  const save = () => {
    if (!form.programId || !form.lessonId || !form.date) {
      toast('Please complete the required fields.', 'warning')
      return
    }
    const start = combineDateTime(form.date, form.startTime)
    const originalStart = editing ? combineDateTime(editing.date, editing.startTime) : null
    const unchanged = originalStart && start && start.getTime() === originalStart.getTime()
    if (start && !unchanged && start < new Date()) {
      setFormError(
        `The session start (${formatDate(form.date, { month: 'long', day: 'numeric', year: 'numeric' })} at ${formatTime(form.startTime)}) is already in the past. Please choose a date and time that is not earlier than the current date and time.`,
      )
      return
    }
    const lesson = programLessons(form.programId).find((l) => l.id === form.lessonId)
    const isPast = new Date(form.date) < today
    saveSchedule({
      ...form,
      id: editing?.id,
      lessonTitle: lesson?.title,
      unitTitle: lesson?.unitTitle,
      competency: lesson?.competency,
      competencyId: lesson?.competencyId,
      meetingLink: form.classType === 'Face-to-Face' ? null : form.meetingLink,
      status: isPast ? 'Completed' : form.status,
    })
    setModalOpen(false)
  }

  const columns = [
    { key: 'date', header: 'Date', sortable: true, render: (r) => formatDate(r.date, { weekday: 'short', month: 'short', day: 'numeric' }) },
    {
      key: 'lessonTitle',
      header: 'Session',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-700">{r.lessonTitle}</p>
          <p className="text-xs text-slate-400">{programById(r.programId)?.code} · {r.unitTitle}</p>
        </div>
      ),
    },
    { key: 'trainerId', header: 'Trainer', render: (r) => db.users.find((u) => u.id === r.trainerId)?.name || '—' },
    { key: 'time', header: 'Time', render: (r) => `${formatTime(r.startTime)} – ${formatTime(r.endTime)}` },
    { key: 'classType', header: 'Type', render: (r) => <Badge tone={r.classType === 'Online' ? 'info' : r.classType === 'Hybrid' ? 'purple' : 'success'}>{r.classType}</Badge> },
    { key: 'room', header: 'Room' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Dropdown
          items={[
            { label: 'Edit', icon: Pencil, onClick: () => openEdit(r) },
            ...(r.meetingLink ? [{ label: 'Copy Meet link', icon: Copy, onClick: () => { navigator.clipboard?.writeText(r.meetingLink); toast('Meeting link copied.', 'info') } }] : []),
            { divider: true },
            { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirm(r) },
          ]}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Schedules"
        description="Manage class schedules across all training programs."
        action={
          <div className="flex flex-wrap gap-2">
            <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-48">
              <option value="all">All programs</option>
              {db.programs.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-40">
              <option value="all">All types</option>
              <option value="Online">Online</option>
              <option value="Face-to-Face">Face-to-Face</option>
              <option value="Hybrid">Hybrid</option>
            </Select>
            <Button icon={Plus} onClick={openCreate}>New Schedule</Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Sessions" value={schedules.length} icon={CalendarDays} tone="brand" />
        <StatCard label="Upcoming" value={upcoming} icon={CalendarDays} tone="success" />
        <StatCard label="Online / Hybrid" value={online} icon={Video} tone="info" />
      </div>

      <Card>
        <CardHeader title="Class Schedule" subtitle={`${schedules.length} sessions`} icon={CalendarDays} />
        <DataTable
          columns={columns}
          data={schedules}
          searchable
          searchPlaceholder="Search sessions…"
          searchKeys={['lessonTitle', 'room', 'date']}
          pageSize={12}
          emptyState={<EmptyState icon={CalendarDays} title="No schedules" action={<Button icon={Plus} onClick={openCreate}>New Schedule</Button>} />}
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Schedule' : 'New Schedule'}
        icon={CalendarDays}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save Changes' : 'Create Schedule'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormRow>
            <FormField label="Program" required>
              <Select
                value={form.programId}
                onChange={(e) => {
                  const p = db.programs.find((x) => x.id === e.target.value)
                  setForm({ ...form, programId: e.target.value, lessonId: '', trainerId: p?.trainerId || form.trainerId })
                }}
              >
                <option value="">Select program…</option>
                {db.programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Lesson / Session" required>
              <Select value={form.lessonId} onChange={(e) => setForm({ ...form, lessonId: e.target.value })} disabled={!form.programId}>
                <option value="">Select lesson…</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>{l.unitTitle ? `${l.unitTitle} — ` : ''}{l.title}</option>
                ))}
              </Select>
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Trainer" required>
              <Select value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
                <option value="">Select trainer…</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Room / Venue">
              <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </FormField>
          </FormRow>
          <FormRow cols={3}>
            <FormField label="Date" required>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </FormField>
            <FormField label="Start Time">
              <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </FormField>
            <FormField label="End Time">
              <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Class Type">
              <Select value={form.classType} onChange={(e) => setForm({ ...form, classType: e.target.value })}>
                <option>Online</option>
                <option>Face-to-Face</option>
                <option>Hybrid</option>
              </Select>
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Upcoming</option>
                <option>Ongoing</option>
                <option>Completed</option>
              </Select>
            </FormField>
          </FormRow>
          {form.classType !== 'Face-to-Face' && (
            <FormField label="Google Meet Link" hint="Mock link for demonstration">
              <Input value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} />
            </FormField>
          )}
        </div>
      </Modal>

      <AlertDialog
        open={!!formError}
        onClose={() => setFormError(null)}
        title="Invalid schedule date/time"
        message={formError}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteSchedule(confirm.id)}
        title="Delete schedule?"
        message={`The session "${confirm?.lessonTitle}" on ${formatDate(confirm?.date)} will be removed.`}
        confirmLabel="Delete"
      />
    </div>
  )
}

export default ManageSchedules
