import { useMemo, useState } from 'react'
import { CalendarDays, Plus, Pencil, Trash2, Video, Clock, MapPin, Search } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerPrograms, programById } from '../../store/selectors'
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
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate, formatTime, startOfDay, combineDateTime, cn } from '../../lib/utils'

const emptyForm = {
  programId: '',
  lessonId: '',
  date: new Date().toISOString().slice(0, 10),
  startTime: '09:00',
  endTime: '11:00',
  classType: 'Online',
  meetingLink: 'https://meet.google.com/abc-defg-hij',
  room: 'Room 101',
  status: 'Upcoming',
}

export function TrainerSchedules() {
  const { db, user, saveSchedule, deleteSchedule, toast } = useApp()
  const programs = trainerPrograms(db, user.id)
  const programIds = programs.map((p) => p.id)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirm, setConfirm] = useState(null)
  const [filter, setFilter] = useState('all')
  const [formError, setFormError] = useState(null)

  const lessons = useMemo(() => (form.programId ? programLessons(form.programId) : []), [form.programId])

  const schedules = db.schedules
    .filter((s) => programIds.includes(s.programId))
    .filter((s) => filter === 'all' || s.programId === filter)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, programId: programs[0]?.id || '' })
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
    const isPast = new Date(form.date) < startOfDay()
    saveSchedule({
      ...form,
      id: editing?.id,
      trainerId: user.id,
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
    { key: 'time', header: 'Time', render: (r) => `${formatTime(r.startTime)} – ${formatTime(r.endTime)}` },
    { key: 'classType', header: 'Type', render: (r) => <Badge tone={r.classType === 'Online' ? 'info' : r.classType === 'Hybrid' ? 'purple' : 'success'}>{r.classType}</Badge> },
    { key: 'room', header: 'Room', render: (r) => <span className="text-slate-500">{r.room}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Dropdown
          items={[
            { label: 'Edit', icon: Pencil, onClick: () => openEdit(r) },
            ...(r.meetingLink ? [{ label: 'Copy Meet link', icon: Video, onClick: () => { navigator.clipboard?.writeText(r.meetingLink); toast('Meeting link copied.', 'info') } }] : []),
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
        description="Create and manage class schedules for your programs."
        action={
          <div className="flex gap-2">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-48">
              <option value="all">All programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
            <Button icon={Plus} onClick={openCreate}>
              New Schedule
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader title="Class Schedule" subtitle={`${schedules.length} sessions`} icon={CalendarDays} />
        <DataTable
          columns={columns}
          data={schedules}
          searchable
          searchPlaceholder="Search sessions…"
          searchKeys={['lessonTitle', 'room', 'date']}
          pageSize={10}
          emptyState={<EmptyState icon={CalendarDays} title="No schedules" description="Create a schedule to get started." action={<Button icon={Plus} onClick={openCreate}>New Schedule</Button>} />}
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
              <Select value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value, lessonId: '' })}>
                <option value="">Select program…</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Lesson / Session" required>
              <Select value={form.lessonId} onChange={(e) => setForm({ ...form, lessonId: e.target.value })} disabled={!form.programId}>
                <option value="">Select lesson…</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.unitTitle ? `${l.unitTitle} — ` : ''}{l.title}
                  </option>
                ))}
              </Select>
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
            <FormField label="Room / Venue">
              <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </FormField>
          </FormRow>
          {form.classType !== 'Face-to-Face' && (
            <FormField label="Google Meet Link" hint="Mock link for demonstration">
              <Input value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} placeholder="https://meet.google.com/xxx-xxxx-xxx" />
            </FormField>
          )}
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Upcoming</option>
              <option>Ongoing</option>
              <option>Completed</option>
            </Select>
          </FormField>
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

export default TrainerSchedules
