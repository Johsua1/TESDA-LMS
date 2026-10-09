import { useState } from 'react'
import { FileCheck2, CalendarDays, Users, TrendingUp, Eye, Plus, Pencil, Trash2, EyeOff } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerPrograms } from '../../store/selectors'
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  Select,
  Modal,
  ConfirmDialog,
  Button,
  Input,
  FormField,
  FormRow,
  Checkbox,
  StatCard,
  ProgressBar,
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { QuestionBuilder } from '../../components/content/QuestionBuilder'
import { average, formatDate, cn } from '../../lib/utils'

const blankExam = () => ({
  id: '',
  title: '',
  competency: 'Core Competency',
  questions: [],
  timeLimit: 30,
  passing: 75,
  date: new Date().toISOString().slice(0, 10),
  status: 'Upcoming',
  published: true,
})

export function TrainerExams() {
  const { db, user, saveExam, deleteExam, toast } = useApp()
  const programs = trainerPrograms(db, user.id)
  const [programFilter, setProgramFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const source = programFilter === 'all' ? programs : programs.filter((p) => p.id === programFilter)
  const exams = source.flatMap((p) =>
    p.exams.map((e) => ({ ...e, programId: p.id, programTitle: p.title, programEmoji: p.emoji, programColor: p.color })),
  )

  const allAttempts = db.examAttempts.filter((a) => exams.some((e) => e.id === a.examId))
  const avgScore = allAttempts.length ? Math.round(average(allAttempts.map((a) => a.percentage))) : 0

  const openCreate = () => {
    const p = programs.find((x) => x.id === (programFilter === 'all' ? programs[0]?.id : programFilter)) || programs[0]
    if (!p) return
    setForm({ programId: p.id, exam: blankExam() })
  }
  const openEdit = (e) => {
    setForm({
      programId: e.programId,
      exam: {
        id: e.id,
        title: e.title,
        competency: e.competency,
        questions: e.questions || [],
        timeLimit: e.timeLimit,
        passing: e.passing,
        date: e.date,
        status: e.status || 'Upcoming',
        published: e.published !== false,
      },
    })
  }
  const setExam = (patch) => setForm((f) => ({ ...f, exam: { ...f.exam, ...patch } }))

  const save = () => {
    if (!form.exam.title.trim()) {
      toast('Exam title is required.', 'error')
      return
    }
    if (!form.exam.questions.length) {
      toast('Add at least one question.', 'error')
      return
    }
    const questions = form.exam.questions.map((q, i) => ({ ...q, id: q.id || `${form.programId}-eq-${Date.now().toString(36)}-${i}` }))
    const exam = {
      ...form.exam,
      id: form.exam.id || `${form.programId}-exam-${Date.now().toString(36)}`,
      programId: form.programId,
      questions,
      questionCount: questions.length,
      timeLimit: Number(form.exam.timeLimit) || 0,
      passing: Number(form.exam.passing) || 0,
    }
    saveExam(form.programId, exam)
    setForm(null)
  }

  return (
    <div>
      <PageHeader
        title="Exams"
        description="Create and manage competency assessment exams for your assigned programs."
        action={
          <div className="flex flex-wrap gap-2">
            <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-56">
              <option value="all">All programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
            <Button icon={Plus} onClick={openCreate} disabled={!programs.length}>
              New Exam
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Exams" value={exams.length} icon={FileCheck2} tone="brand" />
        <StatCard label="Attempts" value={allAttempts.length} icon={Users} tone="purple" />
        <StatCard label="Average Score" value={`${avgScore}%`} icon={TrendingUp} tone="success" />
      </div>

      <div className="space-y-4">
        {exams.map((e) => {
          const attempts = db.examAttempts.filter((a) => a.examId === e.id)
          const passRate = attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : 0
          return (
            <Card key={e.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <span className={cn('flex h-12 w-12 items-center justify-center rounded-xl text-2xl', e.programColor)}>
                    {e.programEmoji}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-800">{e.title}</h4>
                      {e.published === false && (
                        <Badge tone="warning">
                          <EyeOff className="h-3 w-3" /> Draft
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{e.programTitle}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{e.competency}</span>
                      <span>{e.questions?.length ?? e.questionCount} items</span>
                      <span>{e.timeLimit} min</span>
                      <span>{e.passing}% to pass</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {formatDate(e.date)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-32">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>Pass rate</span>
                      <span className="font-semibold text-slate-700">{passRate}%</span>
                    </div>
                    <ProgressBar value={passRate} size="sm" />
                  </div>
                  <StatusBadge status={e.status} />
                  <Button size="sm" variant="secondary" icon={Eye} onClick={() => setSelected({ ...e, attempts })}>
                    View
                  </Button>
                  <Button size="sm" variant="outline" icon={Pencil} onClick={() => openEdit(e)}>
                    Edit
                  </Button>
                  <button
                    onClick={() => setConfirm(e)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete exam"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          )
        })}
        {!exams.length && (
          <Card>
            <EmptyState
              icon={FileCheck2}
              title={programs.length ? 'No exams' : 'No assigned programs'}
              action={programs.length ? <Button icon={Plus} onClick={openCreate}>New Exam</Button> : null}
            />
          </Card>
        )}
      </div>

      {/* ---------------------------- View modal ----------------------------- */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={selected?.programTitle}
        icon={FileCheck2}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Questions', value: selected.questions?.length ?? selected.questionCount },
                { label: 'Time Limit', value: `${selected.timeLimit} min` },
                { label: 'Passing', value: `${selected.passing}%` },
                { label: 'Attempts', value: selected.attempts.length },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-white p-3 text-center">
                  <p className="text-lg font-bold text-slate-800">{s.value}</p>
                  <p className="text-[10px] uppercase text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Exam Results</p>
              {selected.attempts.length ? (
                <div className="space-y-2">
                  {selected.attempts.map((a) => {
                    const t = db.users.find((u) => u.id === a.traineeId)
                    return (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                        <span className="text-slate-500">{t?.name}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-slate-500">
                            {a.score}/{a.total} ({a.percentage}%)
                          </span>
                          <StatusBadge status={a.passed ? 'Passed' : 'Failed'} dot={false} />
                          <span className="text-xs text-slate-400">{formatDate(a.date)}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-slate-400">No attempts yet</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------------------- Form modal ----------------------------- */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.exam.id ? 'Edit Exam' : 'New Exam'}
        subtitle={programs.find((p) => p.id === form?.programId)?.title}
        icon={FileCheck2}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Exam</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <FormRow cols={2}>
              <FormField label="Program" required>
                <Select value={form.programId} onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))} disabled={!!form.exam.id}>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Competency">
                <Input value={form.exam.competency} onChange={(e) => setExam({ competency: e.target.value })} placeholder="Core Competency" />
              </FormField>
            </FormRow>

            <FormField label="Exam Title" required>
              <Input value={form.exam.title} onChange={(e) => setExam({ title: e.target.value })} placeholder="e.g. Competency Assessment Exam" />
            </FormField>

            <FormRow cols={4}>
              <FormField label="Passing Score (%)">
                <Input type="number" min="0" max="100" value={form.exam.passing} onChange={(e) => setExam({ passing: e.target.value })} />
              </FormField>
              <FormField label="Time Limit (min)">
                <Input type="number" min="1" value={form.exam.timeLimit} onChange={(e) => setExam({ timeLimit: e.target.value })} />
              </FormField>
              <FormField label="Exam Schedule">
                <Input type="date" value={form.exam.date} onChange={(e) => setExam({ date: e.target.value })} />
              </FormField>
              <FormField label="Status">
                <Select value={form.exam.status} onChange={(e) => setExam({ status: e.target.value })}>
                  <option>Upcoming</option>
                  <option>Ongoing</option>
                  <option>Completed</option>
                </Select>
              </FormField>
            </FormRow>

            <FormField label="Questions" required>
              <QuestionBuilder questions={form.exam.questions} onChange={(questions) => setExam({ questions })} />
            </FormField>

            <Checkbox
              id="exam-published"
              checked={form.exam.published}
              onChange={(e) => setExam({ published: e.target.checked })}
              label="Published (visible to enrolled trainees)"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteExam(confirm.programId, confirm.id)}
        title="Delete exam?"
        message={`"${confirm?.title}" and its questions will be permanently removed.`}
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  )
}

export default TrainerExams
