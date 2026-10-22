import { useState } from 'react'
import {
  FileCheck2,
  CalendarDays,
  Users,
  TrendingUp,
  Eye,
  Plus,
  Pencil,
  Trash2,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  UserX,
} from 'lucide-react'
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
import { formatQuizSchedule, validateSchedule, combineDateTime } from '../../lib/quizAccess'
import { validateExam } from '../../lib/assessmentValidation'
import { ATTEMPT_MINUTES } from '../../lib/quizTimer'
import { CourseIcon } from '../../components/courses/CourseIcon'

const blankExam = (passing = 75) => ({
  id: '',
  title: '',
  competency: 'Core Competency',
  questions: [],
  passing,
  date: '',
  startDate: '',
  startTime: '',
  deadlineDate: '',
  deadlineTime: '',
  originalStartDate: '',
  originalStartTime: '',
  status: 'Upcoming',
  published: true,
})

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const localTime = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export function TrainerExams() {
  const { db, user, settings, saveExam, deleteExam, toast } = useApp()
  const programs = trainerPrograms(db, user.id)
  const [programFilter, setProgramFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [scheduleError, setScheduleError] = useState(null)
  // Shown inside the form: a toast can be missed while the modal covers it.
  const [formError, setFormError] = useState('')

  const source = programFilter === 'all' ? programs : programs.filter((p) => p.id === programFilter)
  const exams = source.flatMap((p) =>
    p.exams.map((e) => ({ ...e, programId: p.id, programTitle: p.title, program: p, programColor: p.color })),
  )

  const allAttempts = db.examAttempts.filter((a) => exams.some((e) => e.id === a.examId))
  const avgScore = allAttempts.length ? Math.round(average(allAttempts.map((a) => a.percentage))) : 0

  // Everyone actively enrolled in a program — used for the "not taken" roster,
  // the same way the quiz view lists who has and has not submitted.
  const programTrainees = (programId) => {
    const ids = [
      ...new Set(
        db.enrollments
          .filter((e) => e.programId === programId && ['Enrolled', 'Approved', 'Completed'].includes(e.status))
          .map((e) => e.traineeId),
      ),
    ]
    return ids.map((id) => db.users.find((u) => u.id === id)).filter(Boolean)
  }

  const selectedTrainees = selected ? programTrainees(selected.programId) : []
  const selectedTakenIds = new Set((selected?.attempts || []).map((a) => a.traineeId))
  const selectedCompleted = selectedTrainees.filter((t) => selectedTakenIds.has(t.id))
  const selectedNotTaken = selectedTrainees.filter((t) => !selectedTakenIds.has(t.id))

  const openCreate = () => {
    const p = programs.find((x) => x.id === (programFilter === 'all' ? programs[0]?.id : programFilter)) || programs[0]
    if (!p) return
    setFormError('')
    setForm({ programId: p.id, exam: blankExam(settings.passingScore || 75) })
  }
  const openEdit = (e) => {
    setFormError('')
    setForm({
      programId: e.programId,
      exam: {
        id: e.id,
        title: e.title,
        competency: e.competency,
        questions: e.questions || [],
        passing: e.passing,
        date: e.date || '',
        startDate: e.startDate || e.date || '',
        startTime: e.startTime || '',
        deadlineDate: e.deadlineDate || '',
        deadlineTime: e.deadlineTime || '',
        originalStartDate: e.startDate || e.date || '',
        originalStartTime: e.startTime || '',
        status: e.status || 'Upcoming',
        published: e.published !== false,
      },
    })
  }
  const setExam = (patch) => {
    setFormError('')
    setForm((f) => ({ ...f, exam: { ...f.exam, ...patch } }))
  }
  const todayISO = localDate()
  const nowTime = localTime()

  const originalStart = form ? combineDateTime(form.originalStartDate, form.originalStartTime, 'start') : null
  const currentStart = form ? combineDateTime(form.exam.startDate, form.exam.startTime, 'start') : null
  const allowPastStart = Boolean(
    form?.exam.id && originalStart && currentStart && originalStart.getTime() === currentStart.getTime(),
  )
  const scheduleCheck = form
    ? validateSchedule({
        startDate: form.exam.startDate,
        startTime: form.exam.startTime,
        deadlineDate: form.exam.deadlineDate,
        deadlineTime: form.exam.deadlineTime,
        allowPastStart,
      })
    : { ok: true, error: '' }

  const save = () => {
    const check = validateExam(form.exam)
    if (!check.ok) {
      setFormError(check.error)
      toast(check.error, 'error')
      return
    }
    if (!scheduleCheck.ok) {
      setScheduleError(scheduleCheck.error)
      return
    }
    const questions = form.exam.questions.map((q, i) => ({ ...q, id: q.id || `${form.programId}-eq-${Date.now().toString(36)}-${i}` }))
    const exam = {
      ...form.exam,
      id: form.exam.id || `${form.programId}-exam-${Date.now().toString(36)}`,
      programId: form.programId,
      questions,
      questionCount: questions.length,
      timeLimit: ATTEMPT_MINUTES.exam,
      passing: Number(form.exam.passing) || 0,
      // Keep the legacy single-date field in sync for older views.
      date: form.exam.startDate || form.exam.date || '',
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
                  <span className={cn('flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br', e.programColor)}>
                    <CourseIcon program={e.program} className="h-6 w-6" />
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
                      <span>{ATTEMPT_MINUTES.exam} min</span>
                      <span>{e.passing}% to pass</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {formatQuizSchedule(e)}
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
                { label: 'Time Limit', value: `${ATTEMPT_MINUTES.exam} min` },
                { label: 'Passing', value: `${selected.passing}%` },
                { label: 'Attempts', value: selected.attempts.length },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-800">{s.value}</p>
                  <p className="text-[10px] uppercase text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Completed ({selectedCompleted.length})
                </p>
                <div className="space-y-1.5">
                  {selectedCompleted.length ? (
                    selectedCompleted.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-1.5 text-sm"
                      >
                        <span className="truncate text-slate-700">{t.name}</span>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">No submissions yet.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Not taken ({selectedNotTaken.length})
                </p>
                <div className="space-y-1.5">
                  {selectedNotTaken.length ? (
                    selectedNotTaken.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-sm"
                      >
                        <span className="truncate text-slate-600">{t.name}</span>
                        <UserX className="h-4 w-4 shrink-0 text-slate-400" />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">Everyone has taken this exam.</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Exam Results</p>
              {selected.attempts.length ? (
                <div className="space-y-2">
                  {selected.attempts.map((a) => {
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
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{formError}</p>
              </div>
            )}
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

            <FormRow cols={3}>
              <FormField label="Passing Score (%)" required>
                <Input type="number" min="0" max="100" value={form.exam.passing} onChange={(e) => setExam({ passing: e.target.value })} />
              </FormField>
              <FormField label="Status">
                <Select value={form.exam.status} onChange={(e) => setExam({ status: e.target.value })}>
                  <option>Upcoming</option>
                  <option>Ongoing</option>
                  <option>Completed</option>
                </Select>
              </FormField>
            </FormRow>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" /> Schedule &amp; Deadline
              </p>
              <FormRow>
                <FormField label="Start Date">
                  <Input type="date" min={todayISO} value={form.exam.startDate} onChange={(e) => setExam({ startDate: e.target.value })} />
                </FormField>
                <FormField label="Start Time">
                  <Input
                    type="time"
                    min={form.exam.startDate === todayISO ? nowTime : undefined}
                    value={form.exam.startTime}
                    onChange={(e) => setExam({ startTime: e.target.value })}
                  />
                </FormField>
              </FormRow>
              <div className="mt-3">
                <FormRow>
                  <FormField label="Deadline Date">
                    <Input type="date" min={todayISO} value={form.exam.deadlineDate} onChange={(e) => setExam({ deadlineDate: e.target.value })} />
                  </FormField>
                  <FormField label="Deadline Time">
                    <Input
                      type="time"
                      min={form.exam.deadlineDate === todayISO ? nowTime : undefined}
                      value={form.exam.deadlineTime}
                      onChange={(e) => setExam({ deadlineTime: e.target.value })}
                    />
                  </FormField>
                </FormRow>
              </div>
            </div>

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

      <Modal
        open={!!scheduleError}
        onClose={() => setScheduleError(null)}
        title="Invalid schedule"
        icon={AlertTriangle}
        footer={<Button onClick={() => setScheduleError(null)}>Fix schedule</Button>}
      >
        <p className="text-sm text-slate-600">{scheduleError}</p>
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
