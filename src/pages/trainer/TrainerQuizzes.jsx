import { useState } from 'react'
import {
  ClipboardList,
  Clock,
  Award,
  Users,
  Eye,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  EyeOff,
  CalendarDays,
  Inbox,
  CheckCircle2,
  XCircle,
  RotateCcw,
  UserX,
  AlertTriangle,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerPrograms } from '../../store/selectors'
import { programLessons } from '../../data/programs'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
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
import { average, formatDate, formatDateTime, cn } from '../../lib/utils'
import { usePersistentState } from '../../lib/usePersistentState'
import { formatQuizSchedule, validateSchedule, combineDateTime } from '../../lib/quizAccess'
import { validateQuiz } from '../../lib/assessmentValidation'
import { ATTEMPT_MINUTES } from '../../lib/quizTimer'
import { CourseIcon } from '../../components/courses/CourseIcon'

const typeLabel = { mcq: 'Multiple Choice', tf: 'True or False', id: 'Identification' }

// Local (not UTC) date/time strings, used for the date-picker minimums.
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const localTime = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

// Short, human timestamp for the decision log ("2h ago"); the exact date/time
// stays available in the tooltip so nothing is lost for auditing.
const timeAgo = (value) => {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(value)
}

const DECISION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]
const HISTORY_PREVIEW = 5

const blankQuiz = (passing = 75) => ({
  id: '',
  lessonId: '',
  title: '',
  passing,
  published: true,
  startDate: '',
  startTime: '',
  deadlineDate: '',
  deadlineTime: '',
  questions: [],
})

export function TrainerQuizzes() {
  const { db, user, settings, saveQuiz, deleteQuiz, decideQuizRequest, toast } = useApp()
  const programs = trainerPrograms(db, user.id)
  const [programFilter, setProgramFilter] = usePersistentState(
    'tesda-lms-quiz-program-filter-v1',
    'all',
    (v) => typeof v === 'string',
  )
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [scheduleError, setScheduleError] = useState(null)
  const [historyFilter, setHistoryFilter] = usePersistentState(
    'tesda-lms-quiz-history-filter-v1',
    'all',
    (v) => DECISION_FILTERS.some((f) => f.key === v),
  )
  const [showAllHistory, setShowAllHistory] = usePersistentState(
    'tesda-lms-quiz-history-expanded-v1',
    false,
    (v) => typeof v === 'boolean',
  )
  // Shown inside the form: a toast can be missed while the modal covers it.
  const [formError, setFormError] = useState('')

  // The remembered program can be revoked or deleted between sessions; fall
  // back to "All programs" instead of rendering an empty page.
  const activeProgramFilter =
    programFilter === 'all' || programs.some((p) => p.id === programFilter) ? programFilter : 'all'
  const source = activeProgramFilter === 'all' ? programs : programs.filter((p) => p.id === activeProgramFilter)
  const quizzes = source.flatMap((p) =>
    p.quizzes.map((q) => ({ ...q, programId: p.id, programTitle: p.title, program: p, programColor: p.color })),
  )

  const allAttempts = db.quizAttempts.filter((a) => quizzes.some((q) => q.id === a.quizId))
  const avgScore = allAttempts.length ? Math.round(average(allAttempts.map((a) => a.percentage))) : 0

  // Access requests for every quiz the trainer owns (not just the filtered
  // program), so a pending request is never hidden by the program filter.
  const programIds = new Set(programs.map((p) => p.id))
  const requests = (db.quizRequests || []).filter((r) => programIds.has(r.programId))
  const pendingRequests = requests.filter((r) => r.status === 'pending')
  const decidedRequests = requests
    .filter((r) => r.status !== 'pending')
    .sort((a, b) => new Date(b.decidedAt || 0) - new Date(a.decidedAt || 0))

  // Decision log: counts per outcome for the filter chips, then the visible
  // slice (collapsed until the trainer asks for the full audit trail).
  const decisionCounts = {
    all: decidedRequests.length,
    approved: decidedRequests.filter((r) => r.status === 'approved').length,
    rejected: decidedRequests.filter((r) => r.status === 'rejected').length,
  }
  const filteredHistory =
    historyFilter === 'all' ? decidedRequests : decidedRequests.filter((r) => r.status === historyFilter)
  const visibleHistory = showAllHistory ? filteredHistory : filteredHistory.slice(0, HISTORY_PREVIEW)

  // Everyone actively enrolled in a program — used for the "not taken" list.
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

  const decide = (request, decision) => {
    const res = decideQuizRequest(request.id, decision)
    if (!res.ok) toast(res.error, 'error')
  }

  // Data for the per-quiz view modal.
  const selectedTrainees = selected ? programTrainees(selected.programId) : []
  const selectedAttemptedIds = new Set((selected?.attempts || []).map((a) => a.traineeId))
  const selectedCompleted = selectedTrainees.filter((t) => selectedAttemptedIds.has(t.id))
  const selectedNotTaken = selectedTrainees.filter((t) => !selectedAttemptedIds.has(t.id))
  const selectedRequests = selected ? (db.quizRequests || []).filter((r) => r.quizId === selected.id) : []

  const openCreate = () => {
    const p = programs.find((x) => x.id === (activeProgramFilter === 'all' ? programs[0]?.id : activeProgramFilter)) || programs[0]
    if (!p) return
    setFormError('')
    setForm({ programId: p.id, quiz: blankQuiz(settings.passingScore || 75) })
  }
  const openEdit = (q) => {
    setFormError('')
    setForm({
      programId: q.programId,
      quiz: {
        id: q.id,
        // Legacy quizzes only carry the link on the lesson side, so fall back
        // to whichever lesson points at this quiz.
        lessonId: q.lessonId || programLessons(q.programId).find((l) => l.quizId === q.id)?.id || '',
        title: q.title,
        passing: q.passing,
        published: q.published !== false,
        startDate: q.startDate || '',
        startTime: q.startTime || '',
        deadlineDate: q.deadlineDate || '',
        deadlineTime: q.deadlineTime || '',
        originalStartDate: q.startDate || '',
        originalStartTime: q.startTime || '',
        questions: q.questions || [],
      },
    })
  }
  const setQuiz = (patch) => {
    setFormError('')
    setForm((f) => ({ ...f, quiz: { ...f.quiz, ...patch } }))
  }
  const todayISO = localDate()
  const nowTime = localTime()

  // Live schedule check: shows the error as soon as a past start/deadline is
  // entered and keeps the Save button disabled until it is fixed.
  const originalStart = form ? combineDateTime(form.originalStartDate, form.originalStartTime, 'start') : null
  const currentStart = form ? combineDateTime(form.quiz.startDate, form.quiz.startTime, 'start') : null
  const allowPastStart = Boolean(
    form?.quiz.id && originalStart && currentStart && originalStart.getTime() === currentStart.getTime(),
  )
  const scheduleCheck = form
    ? validateSchedule({
        startDate: form.quiz.startDate,
        startTime: form.quiz.startTime,
        deadlineDate: form.quiz.deadlineDate,
        deadlineTime: form.quiz.deadlineTime,
        allowPastStart,
      })
    : { ok: true, error: '' }

  const save = () => {
    // Same rules as exams: title, passing score, at least one question and
    // every question answerable.
    const check = validateQuiz(form.quiz)
    if (!check.ok) {
      setFormError(check.error)
      toast(check.error, 'error')
      return
    }
    if (!scheduleCheck.ok) {
      setScheduleError(scheduleCheck.error)
      return
    }
    const quiz = {
      ...form.quiz,
      id: form.quiz.id || `${form.programId}-quiz-${Date.now().toString(36)}`,
      programId: form.programId,
      passing: Number(form.quiz.passing) || 0,
      timeLimit: ATTEMPT_MINUTES.quiz,
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
            <Select value={activeProgramFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-56">
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

      <Card className="mb-5">
        <CardHeader
          title="Quiz Access Requests"
          icon={Inbox}
          action={
            pendingRequests.length ? (
              <Badge tone="warning">{pendingRequests.length} pending</Badge>
            ) : (
              <Badge tone="neutral">None pending</Badge>
            )
          }
        />
        <CardBody className="space-y-3">
          {pendingRequests.length ? (
            pendingRequests.map((r) => (
              <div key={r.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{r.traineeName || 'Trainee'}</p>
                    <p className="truncate text-xs text-slate-500">{r.quizTitle}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
                      {r.type === 'late' ? <Clock className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
                      {r.type === 'late' ? 'Late quiz access' : 'Retake request'} · {formatDate(r.requestedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => decide(r, 'approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" icon={XCircle} onClick={() => decide(r, 'rejected')}>
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No pending retake or late-access requests.</p>
          )}

          {decidedRequests.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                    <History className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Decision history</p>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
                    {decidedRequests.length}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
                  {DECISION_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={historyFilter === f.key}
                      onClick={() => setHistoryFilter(f.key)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                        historyFilter === f.key
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700',
                      )}
                    >
                      {f.label}
                      <span className="ml-1 tabular-nums text-slate-400">{decisionCounts[f.key]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {visibleHistory.length ? (
                <ol>
                  {visibleHistory.map((r, i) => {
                    const approved = r.status === 'approved'
                    return (
                      <li key={r.id} className="group relative flex animate-fade-in gap-3">
                        <div className="relative flex w-8 shrink-0 justify-center">
                          <span
                            className={cn(
                              'relative z-10 mt-1 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white',
                              approved ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
                            )}
                          >
                            {approved ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </span>
                          {i < visibleHistory.length - 1 && (
                            <span className="absolute bottom-0 left-1/2 top-8 w-px -translate-x-1/2 bg-slate-200" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 rounded-xl border border-transparent px-3 py-2 transition-colors group-hover:border-slate-200 group-hover:bg-slate-50/70">
                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">
                                {r.traineeName || 'Trainee'}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                {r.type === 'late' ? (
                                  <Clock className="h-3 w-3 shrink-0 text-slate-400" />
                                ) : (
                                  <RotateCcw className="h-3 w-3 shrink-0 text-slate-400" />
                                )}
                                <span className="shrink-0">{r.type === 'late' ? 'Late access' : 'Retake'}</span>
                                <span className="text-slate-300">/</span>
                                <span className="truncate">{r.quizTitle}</span>
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
                                  approved
                                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                    : 'bg-rose-50 text-rose-700 ring-rose-200',
                                )}
                              >
                                {approved ? 'Approved' : 'Rejected'}
                              </span>
                              <span
                                className="whitespace-nowrap text-[11px] text-slate-400"
                                title={formatDateTime(r.decidedAt)}
                              >
                                {timeAgo(r.decidedAt)}
                              </span>
                            </div>
                          </div>

                          {(r.note || (r.decidedByName && r.decidedByName !== user.name)) && (
                            <p className="mt-1.5 border-l-2 border-slate-200 pl-2 text-[11px] italic leading-relaxed text-slate-500">
                              {r.note || 'Decided by ' + r.decidedByName}
                            </p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="py-3 text-center text-xs text-slate-400">
                  No {historyFilter === 'approved' ? 'approved' : 'rejected'} decisions yet.
                </p>
              )}

              {filteredHistory.length > HISTORY_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllHistory((v) => !v)}
                  className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-600 transition-colors hover:bg-brand-50"
                >
                  {showAllHistory ? 'Show less' : 'Show all ' + filteredHistory.length}
                  {showAllHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {quizzes.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quizzes.map((q) => {
            const attempts = db.quizAttempts.filter((a) => a.quizId === q.id)
            const pendingCount = requests.filter((r) => r.quizId === q.id && r.status === 'pending').length
            const passRate = attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : 0
            const avg = attempts.length ? Math.round(average(attempts.map((a) => a.percentage))) : 0
            const linkedLesson = programLessons(q.programId).find((l) => l.id === q.lessonId || l.quizId === q.id)
            return (
              <Card key={q.id} hover className="flex flex-col p-4">
                <div className="flex items-start justify-between">
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br', q.programColor)}>
                    <CourseIcon program={q.program} className="h-5 w-5" />
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
                <p className="text-[11px] text-slate-500">
                  {linkedLesson ? `Lesson: ${linkedLesson.title}` : 'Standalone quiz — not shown on a lesson'}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <CalendarDays className="h-3 w-3" /> {formatQuizSchedule(q)}
                </p>
                {pendingCount > 0 && (
                  <p className="mt-1">
                    <Badge tone="warning">
                      <Inbox className="h-3 w-3" /> {pendingCount} request{pendingCount > 1 ? 's' : ''}
                    </Badge>
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <ClipboardList className="h-3 w-3" /> {q.questions.length} items
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {ATTEMPT_MINUTES.quiz} min
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

            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Schedule</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-700">
                <CalendarDays className="h-4 w-4 text-slate-400" /> {formatQuizSchedule(selected)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Completed ({selectedCompleted.length})
                </p>
                <div className="space-y-1.5">
                  {selectedCompleted.length ? (
                    selectedCompleted.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-1.5 text-sm">
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
                      <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-sm">
                        <span className="truncate text-slate-600">{t.name}</span>
                        <UserX className="h-4 w-4 shrink-0 text-slate-400" />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">Everyone has taken this quiz.</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Access Requests ({selectedRequests.length})
              </p>
              <div className="space-y-2">
                {selectedRequests.length ? (
                  selectedRequests
                    .slice()
                    .sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0))
                    .map((r) => (
                      <div key={r.id} className="rounded-lg border border-slate-100 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-slate-700">
                              {r.traineeName} · {r.type === 'late' ? 'Late access' : 'Retake'}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Requested {formatDate(r.requestedAt)}
                              {r.decidedAt ? ` · Decided ${formatDate(r.decidedAt)}` : ''}
                            </p>
                          </div>
                          {r.status === 'pending' ? (
                            <div className="flex shrink-0 gap-1.5">
                              <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => decide(r, 'approved')}>
                                Approve
                              </Button>
                              <Button size="sm" variant="secondary" icon={XCircle} onClick={() => decide(r, 'rejected')}>
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <Badge tone={r.status === 'approved' ? 'success' : 'danger'}>
                              {r.status === 'approved' ? 'Approved' : 'Rejected'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-slate-400">No requests for this quiz.</p>
                )}
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
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{formError}</p>
              </div>
            )}
            <FormRow cols={3}>
              <FormField label="Program" required>
                <Select
                  value={form.programId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, programId: e.target.value, quiz: { ...f.quiz, lessonId: '' } }))
                  }
                  disabled={!!form.quiz.id}
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Passing Score (%)" required>
                <Input type="number" min="0" max="100" value={form.quiz.passing} onChange={(e) => setQuiz({ passing: e.target.value })} />
              </FormField>
            </FormRow>

            <FormField label="Quiz Title" required>
              <Input value={form.quiz.title} onChange={(e) => setQuiz({ title: e.target.value })} placeholder="e.g. Module 1 Assessment" />
            </FormField>

            <FormField
              label="Lesson"
              hint="Attach the quiz to one of your lessons so trainees see it on that lesson. Leave it empty for a standalone quiz."
            >
              <Select value={form.quiz.lessonId} onChange={(e) => setQuiz({ lessonId: e.target.value })}>
                <option value="">No lesson — standalone quiz</option>
                {programLessons(form.programId).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.competency} · {l.title}
                    {l.published === false ? ' (unpublished)' : ''}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" /> Schedule &amp; Deadline
              </p>
              <FormRow>
                <FormField label="Start Date">
                  <Input type="date" min={todayISO} value={form.quiz.startDate} onChange={(e) => setQuiz({ startDate: e.target.value })} />
                </FormField>
                <FormField label="Start Time">
                  <Input
                    type="time"
                    min={form.quiz.startDate === todayISO ? nowTime : undefined}
                    value={form.quiz.startTime}
                    onChange={(e) => setQuiz({ startTime: e.target.value })}
                  />
                </FormField>
              </FormRow>
              <div className="mt-3">
                <FormRow>
                  <FormField label="Deadline Date">
                    <Input type="date" min={todayISO} value={form.quiz.deadlineDate} onChange={(e) => setQuiz({ deadlineDate: e.target.value })} />
                  </FormField>
                  <FormField label="Deadline Time">
                    <Input
                      type="time"
                      min={form.quiz.deadlineDate === todayISO ? nowTime : undefined}
                      value={form.quiz.deadlineTime}
                      onChange={(e) => setQuiz({ deadlineTime: e.target.value })}
                    />
                  </FormField>
                </FormRow>
              </div>
            </div>

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
