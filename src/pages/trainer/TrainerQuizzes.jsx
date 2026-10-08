import { useState } from 'react'
import { ClipboardList, Clock, Award, Users, Eye, TrendingUp, Plus, Pencil, Trash2, EyeOff } from 'lucide-react'
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

const typeLabel = { mcq: 'Multiple Choice', tf: 'True or False', id: 'Identification' }

const blankQuiz = () => ({ id: '', title: '', passing: 75, timeLimit: 15, published: true, questions: [] })

export function TrainerQuizzes() {
  const { db, user, saveQuiz, deleteQuiz, toast } = useApp()
  const programs = trainerPrograms(db, user.id)
  const [programFilter, setProgramFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const source = programFilter === 'all' ? programs : programs.filter((p) => p.id === programFilter)
  const quizzes = source.flatMap((p) =>
    p.quizzes.map((q) => ({ ...q, programId: p.id, programTitle: p.title, programEmoji: p.emoji, programColor: p.color })),
  )

  const allAttempts = db.quizAttempts.filter((a) => quizzes.some((q) => q.id === a.quizId))
  const avgScore = allAttempts.length ? Math.round(average(allAttempts.map((a) => a.percentage))) : 0

  const openCreate = () => {
    const p = programs.find((x) => x.id === (programFilter === 'all' ? programs[0]?.id : programFilter)) || programs[0]
    if (!p) return
    setForm({ programId: p.id, quiz: blankQuiz() })
  }
  const openEdit = (q) => {
    setForm({
      programId: q.programId,
      quiz: { id: q.id, title: q.title, passing: q.passing, timeLimit: q.timeLimit, published: q.published !== false, questions: q.questions || [] },
    })
  }
  const setQuiz = (patch) => setForm((f) => ({ ...f, quiz: { ...f.quiz, ...patch } }))

  const save = () => {
    if (!form.quiz.title.trim()) {
      toast('Quiz title is required.', 'error')
      return
    }
    if (!form.quiz.questions.length) {
      toast('Add at least one question.', 'error')
      return
    }
    const quiz = {
      ...form.quiz,
      id: form.quiz.id || `${form.programId}-quiz-${Date.now().toString(36)}`,
      programId: form.programId,
      passing: Number(form.quiz.passing) || 0,
      timeLimit: Number(form.quiz.timeLimit) || 0,
      questions: form.quiz.questions.map((q, i) => ({ ...q, id: q.id || `${form.programId}-q-${Date.now().toString(36)}-${i}` })),
    }
    saveQuiz(form.programId, quiz)
    setForm(null)
  }

  return (
    <div>
      <PageHeader
        title="Quizzes"
        description="Create, manage and monitor quizzes across your assigned programs."
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
              New Quiz
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Quizzes" value={quizzes.length} icon={ClipboardList} tone="brand" />
        <StatCard label="Total Attempts" value={allAttempts.length} icon={Users} tone="purple" />
        <StatCard label="Average Score" value={`${avgScore}%`} icon={TrendingUp} tone="success" />
      </div>

      {quizzes.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quizzes.map((q) => {
            const attempts = db.quizAttempts.filter((a) => a.quizId === q.id)
            const passRate = attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : 0
            const avg = attempts.length ? Math.round(average(attempts.map((a) => a.percentage))) : 0
            return (
              <Card key={q.id} hover className="flex flex-col p-4">
                <div className="flex items-start justify-between">
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-lg', q.programColor)}>
                    {q.programEmoji}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {q.published === false && (
                      <Badge tone="warning">
                        <EyeOff className="h-3 w-3" /> Draft
                      </Badge>
                    )}
                    <Badge tone={attempts.length ? (passRate >= 75 ? 'success' : 'warning') : 'neutral'}>
                      {attempts.length ? `${passRate}% pass` : 'No attempts'}
                    </Badge>
                  </div>
                </div>
                <h4 className="mt-3 text-sm font-semibold text-slate-800">{q.title}</h4>
                <p className="text-xs text-slate-400">{q.programTitle}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <ClipboardList className="h-3 w-3" /> {q.questions.length} items
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {q.timeLimit} min
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Award className="h-3 w-3" /> {q.passing}%
                  </span>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Average score</span>
                    <span className="font-semibold text-slate-700">{avg}%</span>
                  </div>
                  <ProgressBar value={avg} size="sm" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="secondary" icon={Eye} onClick={() => setSelected({ ...q, attempts })}>
                    View
                  </Button>
                  <Button size="sm" variant="outline" icon={Pencil} onClick={() => openEdit(q)}>
                    Edit
                  </Button>
                  <button
                    onClick={() => setConfirm(q)}
                    className="ml-auto rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete quiz"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={programs.length ? 'No quizzes' : 'No assigned programs'}
            action={programs.length ? <Button icon={Plus} onClick={openCreate}>New Quiz</Button> : null}
          />
        </Card>
      )}

      {/* ---------------------------- View modal ----------------------------- */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={`${selected?.programTitle} · ${selected?.questions.length} questions`}
        icon={ClipboardList}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-lg font-bold text-slate-800">{selected.attempts.length}</p>
                <p className="text-[10px] uppercase text-slate-400">Attempts</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-lg font-bold text-slate-800">
                  {selected.attempts.length ? Math.round(average(selected.attempts.map((a) => a.percentage))) : 0}%
                </p>
                <p className="text-[10px] uppercase text-slate-400">Avg Score</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-lg font-bold text-slate-800">
                  {selected.attempts.length ? Math.round((selected.attempts.filter((a) => a.passed).length / selected.attempts.length) * 100) : 0}%
                </p>
                <p className="text-[10px] uppercase text-slate-400">Pass Rate</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Question Bank</p>
              <div className="space-y-3">
                {selected.questions.map((q, i) => (
                  <div key={q.id || i} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400">Q{i + 1}</span>
                      <Badge tone="neutral">{typeLabel[q.type]}</Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800">{q.q}</p>
                    <p className="mt-2 text-xs text-emerald-600">
                      <span className="font-semibold">Answer:</span> {q.answer === true ? 'True' : q.answer === false ? 'False' : q.answer}
                    </p>
                    {q.options && (
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs text-slate-500">
                        {q.options.map((o) => (
                          <span key={o} className={cn('rounded px-2 py-1', o === q.answer ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50')}>
                            {o}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selected.attempts.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Attempts</p>
                <div className="space-y-2">
                  {selected.attempts.slice(0, 6).map((a) => {
                    const t = db.users.find((u) => u.id === a.traineeId)
                    return (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                        <span className="text-slate-600">{t?.name}</span>
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
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ---------------------------- Form modal ----------------------------- */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.quiz.id ? 'Edit Quiz' : 'New Quiz'}
        subtitle={programs.find((p) => p.id === form?.programId)?.title}
        icon={ClipboardList}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Quiz</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <FormRow cols={3}>
              <FormField label="Program" required>
                <Select value={form.programId} onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))} disabled={!!form.quiz.id}>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Passing Score (%)">
                <Input type="number" min="0" max="100" value={form.quiz.passing} onChange={(e) => setQuiz({ passing: e.target.value })} />
              </FormField>
              <FormField label="Time Limit (minutes)">
                <Input type="number" min="1" value={form.quiz.timeLimit} onChange={(e) => setQuiz({ timeLimit: e.target.value })} />
              </FormField>
            </FormRow>

            <FormField label="Quiz Title" required>
              <Input value={form.quiz.title} onChange={(e) => setQuiz({ title: e.target.value })} placeholder="e.g. Module 1 Assessment" />
            </FormField>

            <FormField label="Questions" required>
              <QuestionBuilder questions={form.quiz.questions} onChange={(questions) => setQuiz({ questions })} />
            </FormField>

            <Checkbox
              id="quiz-published"
              checked={form.quiz.published}
              onChange={(e) => setQuiz({ published: e.target.checked })}
              label="Published (visible to enrolled trainees)"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteQuiz(confirm.programId, confirm.id)}
        title="Delete quiz?"
        message={`"${confirm?.title}" and its questions will be permanently removed.`}
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  )
}

export default TrainerQuizzes
