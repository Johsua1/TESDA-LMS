import { useMemo, useState } from 'react'
import { FileText, Clock, VideoOff, BookOpen, Plus, Pencil, Trash2, EyeOff, Link2 } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerPrograms } from '../../store/selectors'
import { programLessons } from '../../data/programs'
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  Select,
  SearchInput,
  Modal,
  ConfirmDialog,
  Button,
  Input,
  Textarea,
  FormField,
  FormRow,
  Checkbox,
} from '../../components/ui'
import { MaterialEditor } from '../../components/content/MaterialEditor'
import { cn, videoEmbed } from '../../lib/utils'

const blankLesson = () => ({
  id: '',
  title: '',
  description: '',
  content: '',
  duration: 45,
  order: 1,
  videoUrl: '',
  published: true,
  materials: [],
})

export function TrainerLessons() {
  const { db, user, saveLesson, deleteLesson, toast } = useApp()
  const programs = trainerPrograms(db, user.id)
  const [programFilter, setProgramFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState(null)
  const [form, setForm] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const lessons = useMemo(() => {
    const source = programFilter === 'all' ? programs : programs.filter((p) => p.id === programFilter)
    return source.flatMap((p) =>
      programLessons(p.id).map((l) => ({ ...l, programId: p.id, programTitle: p.title, programEmoji: p.emoji, programColor: p.color })),
    )
  }, [programs, programFilter])

  const filtered = lessons.filter((l) => !query || l.title.toLowerCase().includes(query.toLowerCase()))

  const openCreate = () => {
    const p = programs.find((x) => x.id === (programFilter === 'all' ? programs[0]?.id : programFilter)) || programs[0]
    if (!p) return
    const comp = p.competencies[0]
    setForm({
      programId: p.id,
      competencyId: comp.id,
      unitId: comp.units?.[0]?.id || '',
      lesson: blankLesson(),
    })
  }

  const openEdit = (l) => {
    setForm({
      programId: l.programId,
      competencyId: l.competencyId,
      unitId: l.unitId || '',
      lesson: {
        id: l.id,
        title: l.title,
        description: l.description,
        content: l.content,
        duration: l.duration,
        order: l.order,
        videoUrl: l.videoUrl || '',
        published: l.published !== false,
        materials: l.materials || [],
      },
    })
  }

  const formProgram = form ? programs.find((p) => p.id === form.programId) : null
  const formCompetency = formProgram?.competencies.find((c) => c.id === form?.competencyId)
  const formUnits = formCompetency?.units || []

  const changeProgram = (programId) => {
    const p = programs.find((x) => x.id === programId)
    const comp = p?.competencies[0]
    setForm((f) => ({ ...f, programId, competencyId: comp?.id || '', unitId: comp?.units?.[0]?.id || '' }))
  }
  const changeCompetency = (competencyId) => {
    const comp = formProgram?.competencies.find((c) => c.id === competencyId)
    setForm((f) => ({ ...f, competencyId, unitId: comp?.units?.[0]?.id || '' }))
  }
  const setLesson = (patch) => setForm((f) => ({ ...f, lesson: { ...f.lesson, ...patch } }))

  const save = () => {
    if (!form.lesson.title.trim()) {
      toast('Lesson title is required.', 'error')
      return
    }
    const lesson = {
      ...form.lesson,
      id: form.lesson.id || `${form.programId}-${form.unitId || form.competencyId}-l-${Date.now().toString(36)}`,
      order: Number(form.lesson.order) || 1,
      duration: Number(form.lesson.duration) || 0,
    }
    saveLesson(form.programId, { competencyId: form.competencyId, unitId: form.unitId || null, lesson })
    setForm(null)
  }

  return (
    <div>
      <PageHeader
        title="Lessons"
        description="Create and manage lessons for your assigned programs only."
        action={
          <div className="flex flex-wrap gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search lessons…" className="w-52" />
            <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-52">
              <option value="all">All programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
            <Button icon={Plus} onClick={openCreate} disabled={!programs.length}>
              New Lesson
            </Button>
          </div>
        }
      />

      {filtered.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((l) => (
            <Card key={l.id} hover className="flex flex-col p-4">
              <div className="flex items-start justify-between">
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-lg', l.programColor)}>
                  {l.programEmoji}
                </span>
                <div className="flex items-center gap-1.5">
                  {l.published === false && (
                    <Badge tone="warning">
                      <EyeOff className="h-3 w-3" /> Draft
                    </Badge>
                  )}
                  <Badge tone={l.competency === 'Core' ? 'purple' : l.competency === 'Common' ? 'info' : 'brand'}>{l.competency}</Badge>
                </div>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-slate-800">{l.title}</h4>
              <p className="text-xs text-slate-400">
                {l.programTitle}
                {l.unitTitle ? ` · ${l.unitTitle}` : ''}
              </p>
              <p className="mt-1 line-clamp-2 flex-1 text-xs text-slate-500">{l.description}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {l.duration} min
                </span>
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" /> {l.materials?.length || 0} files
                </span>
                <span className="inline-flex items-center gap-1">#{l.order}</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button size="sm" variant="secondary" icon={BookOpen} onClick={() => setViewing(l)}>
                  View
                </Button>
                <Button size="sm" variant="outline" icon={Pencil} onClick={() => openEdit(l)}>
                  Edit
                </Button>
                <button
                  onClick={() => setConfirm(l)}
                  className="ml-auto rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete lesson"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={FileText}
            title={programs.length ? 'No lessons found' : 'No assigned programs'}
            description={programs.length ? 'Try a different filter or create a new lesson.' : 'Contact the administrator to be assigned a course.'}
            action={programs.length ? <Button icon={Plus} onClick={openCreate}>New Lesson</Button> : null}
          />
        </Card>
      )}

      {/* -------------------------- View lesson modal ------------------------- */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title}
        subtitle={`${viewing?.programTitle} · ${viewing?.competency} Competency${viewing?.unitTitle ? ' · ' + viewing.unitTitle : ''}`}
        icon={BookOpen}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>}
      >
        {viewing && (
          <div className="space-y-4">
            {(() => {
              const embed = videoEmbed(viewing.videoUrl)
              if (embed) {
                return (
                  <div className="aspect-video overflow-hidden rounded-xl bg-black">
                    {embed.type === 'iframe' ? (
                      <iframe src={embed.src} title={viewing.title} className="h-full w-full" allowFullScreen />
                    ) : (
                      <video src={embed.src} controls className="h-full w-full" />
                    )}
                  </div>
                )
              }
              return (
                <div className="flex aspect-video flex-col items-center justify-center rounded-xl bg-slate-800 text-white/70">
                  <VideoOff className="h-8 w-8 text-white/40" />
                  <p className="mt-2 text-sm">{viewing.video || viewing.title}</p>
                  <p className="text-xs text-white/40">No video attached</p>
                </div>
              )
            })()}
            {viewing.videoUrl && (
              <a href={viewing.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
                <Link2 className="h-4 w-4" /> Open video link
              </a>
            )}
            <p className="text-sm leading-relaxed text-slate-500">{viewing.content}</p>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Learning Materials</p>
              <div className="space-y-2">
                {viewing.materials?.length ? (
                  viewing.materials.map((m) => (
                    <div key={m.id || m.name} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">{m.name}</span>
                      <Badge tone="neutral" className="ml-auto">{m.type}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No materials</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* --------------------------- Lesson form modal ------------------------ */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.lesson.id ? 'Edit Lesson' : 'New Lesson'}
        subtitle={formProgram?.title}
        icon={FileText}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Lesson</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <FormRow cols={3}>
              <FormField label="Program" required>
                <Select value={form.programId} onChange={(e) => changeProgram(e.target.value)} disabled={!!form.lesson.id}>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Competency" required>
                <Select value={form.competencyId} onChange={(e) => changeCompetency(e.target.value)}>
                  {formProgram?.competencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.type}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Unit" hint={formUnits.length ? undefined : 'Not applicable'}>
                <Select value={form.unitId} onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))} disabled={!formUnits.length}>
                  {formUnits.length ? (
                    formUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.title}
                      </option>
                    ))
                  ) : (
                    <option value="">—</option>
                  )}
                </Select>
              </FormField>
            </FormRow>

            <FormField label="Lesson Title" required>
              <Input value={form.lesson.title} onChange={(e) => setLesson({ title: e.target.value })} placeholder="e.g. Introduction to the Profession" />
            </FormField>

            <FormField label="Short Description">
              <Input value={form.lesson.description} onChange={(e) => setLesson({ description: e.target.value })} placeholder="One-line summary shown on cards" />
            </FormField>

            <FormField label="Lesson Content">
              <Textarea rows={4} value={form.lesson.content} onChange={(e) => setLesson({ content: e.target.value })} placeholder="Full lesson content / notes…" />
            </FormField>

            <FormRow cols={3}>
              <FormField label="Duration (minutes)">
                <Input type="number" min="0" value={form.lesson.duration} onChange={(e) => setLesson({ duration: e.target.value })} />
              </FormField>
              <FormField label="Lesson Order">
                <Input type="number" min="1" value={form.lesson.order} onChange={(e) => setLesson({ order: e.target.value })} />
              </FormField>
              <FormField label="Video Link" hint="YouTube / Drive / Vimeo">
                <Input value={form.lesson.videoUrl} onChange={(e) => setLesson({ videoUrl: e.target.value })} placeholder="https://…" />
              </FormField>
            </FormRow>

            <FormField label="Learning Materials" hint="Upload a PDF/document (max 2 MB) or paste a link">
              <MaterialEditor materials={form.lesson.materials} onChange={(materials) => setLesson({ materials })} />
            </FormField>

            <Checkbox
              id="published"
              checked={form.lesson.published}
              onChange={(e) => setLesson({ published: e.target.checked })}
              label="Published (visible to enrolled trainees)"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteLesson(confirm.programId, confirm.id)}
        title="Delete lesson?"
        message={`"${confirm?.title}" will be permanently removed from ${confirm?.programTitle}.`}
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  )
}

export default TrainerLessons
