import { useState } from 'react'
import { Megaphone, Plus, Pencil, Trash2, Pin, Search, CheckCheck } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { announcementsFor, programById, readAnnouncementIds, trainerPrograms } from '../../store/selectors'
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
  Checkbox,
} from '../../components/ui'
import { formatDate, cn } from '../../lib/utils'

const empty = { title: '', body: '', audience: 'all', programId: '', audienceIds: [], priority: 'normal', pinned: false }

export function AnnouncementsPage({ canManage = false }) {
  const { db, user, saveAnnouncement, deleteAnnouncement, markAnnouncementRead, markAnnouncementsRead, toast } = useApp()
  const list = announcementsFor(db, user)
  const readIds = readAnnouncementIds(db, user.id)
  const unreadCount = list.filter((a) => !readIds.has(a.id)).length
  const isAdmin = user.role === 'admin'
  const myPrograms = user.role === 'trainer' ? trainerPrograms(db, user.id) : []
  const formPrograms = isAdmin ? db.programs : myPrograms
  const trainers = db.users.filter((u) => u.role === 'trainer')
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

  const toggleAudienceId = (id) =>
    setForm((f) => ({
      ...f,
      audienceIds: (f.audienceIds || []).includes(id)
        ? f.audienceIds.filter((x) => x !== id)
        : [...(f.audienceIds || []), id],
    }))

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
    if (!isAdmin && !myPrograms.length) {
      toast('You have no assigned program to announce to.', 'warning')
      return
    }
    if (isAdmin && form.audience === 'selected' && !(form.audienceIds || []).length) {
      toast('Select at least one trainer.', 'warning')
      return
    }
    saveAnnouncement({
      ...form,
      id: editing?.id,
      // A trainer's notice always goes to trainees and never leaves their own
      // programs, whatever the stored form says.
      audience: isAdmin ? form.audience : 'trainee',
      audienceIds: isAdmin && form.audience === 'selected' ? form.audienceIds : [],
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
            const unread = !readIds.has(a.id)
            return (
              <Card key={a.id} className={cn('p-5', a.pinned && 'ring-1 ring-amber-200', unread && 'bg-brand-50/40')}>
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
                      {unread && <Badge tone="brand">Unread</Badge>}
                      {a.pinned && <Badge tone="warning">📌 Pinned</Badge>}
                      <Badge tone={a.priority === 'high' ? 'danger' : a.priority === 'low' ? 'neutral' : 'info'}>
                        {a.priority === 'high' ? 'High priority' : a.priority === 'low' ? 'Low' : 'Normal'}
                      </Badge>
                      <Badge tone="neutral">
                        {a.audience === 'all'
                          ? 'Everyone'
                          : a.audience === 'trainee'
                            ? 'Trainees'
                            : a.audience === 'selected'
                              ? `Selected trainers (${(a.audienceIds || []).length})`
                              : 'Trainers'}
                      </Badge>
                      {program && <Badge tone="brand">{program.title}</Badge>}
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-800">{a.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{a.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <p className="text-xs text-slate-400">
                        Posted by {author?.name || 'Administration'} · {formatDate(a.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      {unread && (
                        <button
                          type="button"
                          onClick={() => markAnnouncementRead(a.id)}
                          className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
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
              {isAdmin ? (
                <Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                  <option value="all">Everyone (trainers &amp; trainees)</option>
                  <option value="trainee">All trainees</option>
                  <option value="selected">Specific trainers</option>
                </Select>
              ) : (
                <Input value="My trainees (own programs)" disabled />
              )}
            </FormField>
            <FormField label={isAdmin ? 'Program (optional)' : 'Program'}>
              <Select value={form.programId || ''} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
                <option value="">{isAdmin ? 'All programs' : 'All my programs'}</option>
                {formPrograms.map((p) => (
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
          {isAdmin && form.audience === 'selected' && (
            <FormField label="Trainers" hint="Only the trainers you tick will see this announcement.">
              <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-3">
                {trainers.map((t) => (
                  <Checkbox
                    key={t.id}
                    checked={(form.audienceIds || []).includes(t.id)}
                    onChange={() => toggleAudienceId(t.id)}
                    label={`${t.name}${t.position ? ' · ' + t.position : ''}`}
                  />
                ))}
                {!trainers.length && <p className="text-sm text-slate-400">No trainers yet.</p>}
              </div>
            </FormField>
          )}

          <Checkbox
            checked={!!form.pinned}
            onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            label="Pin this announcement to the top"
          />
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
