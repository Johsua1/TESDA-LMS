import { useState } from 'react'
import { Megaphone, Plus, Pencil, Trash2, Pin, Search } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { announcementsFor, programById } from '../../store/selectors'
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Textarea,
  FormField,
  FormRow,
  ConfirmDialog,
  EmptyState,
  SearchInput,
  Dropdown,
} from '../../components/ui'
import { formatDate, cn } from '../../lib/utils'

const empty = { title: '', body: '', audience: 'all', programId: '', priority: 'normal', pinned: false }

export function AnnouncementsPage({ canManage = false }) {
  const { db, user, saveAnnouncement, deleteAnnouncement, toast } = useApp()
  const list = announcementsFor(db, user)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [confirm, setConfirm] = useState(null)

  const filtered = list.filter((a) => {
    const matchQuery = !query || a.title.toLowerCase().includes(query.toLowerCase()) || a.body.toLowerCase().includes(query.toLowerCase())
    const matchFilter = filter === 'all' || a.priority === filter
    return matchQuery && matchFilter
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...empty, audience: user.role === 'trainer' ? 'trainee' : 'all' })
    setModalOpen(true)
  }

  const openEdit = (a) => {
    setEditing(a)
    setForm({ ...a })
    setModalOpen(true)
  }

  const save = () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast('Title and body are required.', 'warning')
      return
    }
    saveAnnouncement({
      ...form,
      id: editing?.id,
      programId: form.programId || null,
      authorId: editing?.authorId || user.id,
      date: editing?.date || new Date().toISOString().slice(0, 10),
    })
    setModalOpen(false)
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        description={canManage ? 'Post and manage announcements for trainees and trainers.' : 'Latest announcements relevant to your programs.'}
        action={canManage && <Button icon={Plus} onClick={openCreate}>New Announcement</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={query} onChange={setQuery} placeholder="Search announcements…" className="sm:max-w-sm" />
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:w-44">
          <option value="all">All priorities</option>
          <option value="high">High priority</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </Select>
      </div>

      {filtered.length ? (
        <div className="space-y-4">
          {filtered.map((a) => {
            const author = db.users.find((u) => u.id === a.authorId)
            const program = a.programId ? programById(a.programId) : null
            return (
              <Card key={a.id} className={cn('p-5', a.pinned && 'ring-1 ring-amber-200')}>
                <div className="flex items-start gap-4">
                  <span
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                      a.priority === 'high' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600',
                    )}
                  >
                    <Megaphone className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.pinned && <Badge tone="warning">📌 Pinned</Badge>}
                      <Badge tone={a.priority === 'high' ? 'danger' : a.priority === 'low' ? 'neutral' : 'info'}>
                        {a.priority === 'high' ? 'High priority' : a.priority === 'low' ? 'Low' : 'Normal'}
                      </Badge>
                      <Badge tone="neutral">
                        {a.audience === 'all' ? 'Everyone' : a.audience === 'trainee' ? 'Trainees' : 'Trainers'}
                      </Badge>
                      {program && <Badge tone="brand">{program.title}</Badge>}
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-800">{a.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{a.body}</p>
                    <p className="mt-3 text-xs text-slate-400">
                      Posted by {author?.name || 'Administration'} · {formatDate(a.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  {canManage && (
                    <Dropdown
                      items={[
                        { label: 'Edit', icon: Pencil, onClick: () => openEdit(a) },
                        { label: a.pinned ? 'Unpin' : 'Pin', icon: Pin, onClick: () => saveAnnouncement({ ...a, pinned: !a.pinned }) },
                        { divider: true },
                        { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirm(a) },
                      ]}
                    />
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No announcements"
            description={canManage ? 'Post your first announcement to keep everyone informed.' : 'Check back later for updates.'}
            action={canManage && <Button icon={Plus} onClick={openCreate}>New Announcement</Button>}
          />
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Announcement' : 'New Announcement'}
        icon={Megaphone}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? 'Save Changes' : 'Post Announcement'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Announcement title" />
          </FormField>
          <FormField label="Message" required>
            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write your announcement…" rows={5} />
          </FormField>
          <FormRow cols={3}>
            <FormField label="Audience">
              <Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                <option value="all">Everyone</option>
                <option value="trainee">Trainees</option>
                <option value="trainer">Trainers</option>
              </Select>
            </FormField>
            <FormField label="Program (optional)">
              <Select value={form.programId || ''} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
                <option value="">All programs</option>
                {db.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </Select>
            </FormField>
          </FormRow>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={!!form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Pin this announcement to the top
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteAnnouncement(confirm.id)}
        title="Delete announcement?"
        message={`"${confirm?.title}" will be permanently removed.`}
        confirmLabel="Delete"
      />
    </div>
  )
}

export default AnnouncementsPage
