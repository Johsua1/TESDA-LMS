import { useState } from 'react'
import { BookOpen, Eye, Pencil, Users, Layers, FileText, ClipboardList, FileCheck2, Clock, Award, ChevronDown } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { programStats, courseProgress } from '../../store/selectors'
import { programLessons, programLessonCount, programQuizCount } from '../../data/programs'
import {
  PageHeader,
  Card,
  CardBody,
  CardHeader,
  Button,
  Modal,
  Select,
  Input,
  FormField,
  FormRow,
  Badge,
  ProgressBar,
  StatCard,
  EmptyState,
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { currency, average, cn } from '../../lib/utils'

export function ManageCourses() {
  const { db, saveProgram, toast } = useApp()
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ trainerId: '', fee: 0 })
  const [openComp, setOpenComp] = useState(null)

  const trainers = db.users.filter((u) => u.role === 'trainer')

  const openDetail = (p) => {
    setSelected(p)
    setEditing(false)
    setEditForm({ trainerId: p.trainerId, fee: p.fee })
    setOpenComp(null)
  }

  const saveEdit = () => {
    saveProgram(selected.id, { trainerId: editForm.trainerId, fee: Number(editForm.fee) })
    setSelected((s) => ({ ...s, ...editForm }))
    setEditing(false)
  }

  const totalEnrollments = db.enrollments.length

  return (
    <div>
      <PageHeader title="Courses" description="Manage training programs, competencies and trainer assignments." />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Programs" value={db.programs.length} icon={BookOpen} tone="brand" />
        <StatCard label="Total Lessons" value={db.programs.reduce((s, p) => s + programLessonCount(p.id), 0)} icon={FileText} tone="purple" />
        <StatCard label="Total Enrollments" value={totalEnrollments} icon={Users} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {db.programs.map((p) => {
          const stats = programStats(db, p.id)
          const enrs = db.enrollments.filter((e) => e.programId === p.id && ['Enrolled', 'Approved'].includes(e.status))
          const avg = enrs.length ? Math.round(average(enrs.map((e) => courseProgress(e, p.id).percent))) : 0
          const trainer = db.users.find((u) => u.id === p.trainerId)
          return (
            <Card key={p.id} hover className="overflow-hidden">
              <div className={cn('relative h-28 bg-gradient-to-br', p.color)}>
                <div className="absolute inset-0 flex items-start justify-between p-4 text-white">
                  <span className="text-3xl">{p.emoji}</span>
                  <div className="flex flex-col items-end gap-1">
                    {p.special && <Badge className="bg-white/20 text-white ring-white/30">Special</Badge>}
                    <Badge className="bg-white/20 text-white ring-white/30">{p.level}</Badge>
                  </div>
                </div>
                <div className="absolute bottom-2 left-4 right-4">
                  <h3 className="text-base font-bold text-white drop-shadow">{p.title}</h3>
                </div>
              </div>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{p.code}</span>
                  <span className="font-semibold text-slate-700">{currency(p.fee)}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Lessons', value: programLessonCount(p.id) },
                    { label: 'Quizzes', value: programQuizCount(p.id) },
                    { label: 'Exams', value: p.exams.length },
                    { label: 'Enrolled', value: stats.enrolled },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-slate-50 p-2 text-center">
                      <p className="text-sm font-bold text-slate-800">{s.value}</p>
                      <p className="text-[10px] uppercase text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Trainer: <strong className="text-slate-700">{trainer?.name}</strong></span>
                  <span className="text-slate-500">Avg: <strong className="text-slate-700">{avg}%</strong></span>
                </div>
                <ProgressBar value={avg} size="sm" />
                <Button className="w-full" size="sm" variant="secondary" icon={Eye} onClick={() => openDetail(p)}>
                  View & Manage
                </Button>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={`${selected?.code} · ${selected?.level}`}
        icon={BookOpen}
        size="xl"
        footer={
          <>
            {!editing ? (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit Course</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
                <Button onClick={saveEdit}>Save Changes</Button>
              </>
            )}
          </>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className={cn('rounded-xl bg-gradient-to-br p-5 text-white', selected.color)}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selected.emoji}</span>
                <div>
                  <p className="text-sm font-semibold">{selected.title}</p>
                  <p className="text-xs text-white/80">{selected.category} · {selected.duration} · {selected.hours} hrs</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/85">{selected.overview}</p>
            </div>

            {editing ? (
              <FormRow>
                <FormField label="Assigned Trainer">
                  <Select value={editForm.trainerId} onChange={(e) => setEditForm({ ...editForm, trainerId: e.target.value })}>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Training Fee (₱)">
                  <Input type="number" value={editForm.fee} onChange={(e) => setEditForm({ ...editForm, fee: e.target.value })} />
                </FormField>
              </FormRow>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Trainer', value: db.users.find((u) => u.id === selected.trainerId)?.name },
                  { label: 'Training Fee', value: currency(selected.fee) },
                  { label: 'Lessons', value: programLessonCount(selected.id) },
                  { label: 'Quizzes', value: programQuizCount(selected.id) },
                ].map((i) => (
                  <div key={i.label} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">{i.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-700">{i.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Competency Structure</p>
              <div className="space-y-2">
                {selected.competencies.map((comp) => {
                  const units = comp.units || [{ id: comp.id, title: comp.title, lessons: comp.lessons }]
                  const count = units.reduce((s, u) => s + u.lessons.length, 0)
                  return (
                    <div key={comp.id} className="overflow-hidden rounded-xl border border-slate-100">
                      <button
                        onClick={() => setOpenComp(openComp === comp.id ? null : comp.id)}
                        className="flex w-full items-center gap-3 p-3.5 text-left transition hover:bg-slate-50"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <Layers className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge tone={comp.type === 'Core' ? 'purple' : comp.type === 'Common' ? 'info' : 'brand'}>{comp.type}</Badge>
                            <span className="text-xs text-slate-400">{count} lessons</span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{comp.description}</p>
                        </div>
                        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', openComp === comp.id && 'rotate-180')} />
                      </button>
                      {openComp === comp.id && (
                        <div className="animate-fade-in border-t border-slate-100 bg-slate-50/50 p-3">
                          {units.map((u) => (
                            <div key={u.id} className="mb-2 last:mb-0">
                              {comp.type === 'Core' && <p className="mb-1 text-[11px] font-semibold uppercase text-slate-500">{u.title}</p>}
                              <ul className="space-y-1">
                                {u.lessons.map((l) => (
                                  <li key={l.id} className="flex items-center gap-2 text-xs text-slate-600">
                                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                                    {l.title}
                                    <span className="ml-auto text-slate-400">{l.duration} min</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Admission Requirements</p>
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {selected.requirements.map((r) => (
                  <li key={r} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ManageCourses
