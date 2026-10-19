import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Award,
  RotateCcw,
  ClipboardList,
  AlertTriangle,
  ListChecks,
  Trophy,
  CalendarDays,
  Hourglass,
  Lock,
  Send,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { enrollmentOf, programById, traineeQuizAttempts, hasCourseAccess } from '../../store/selectors'
import { Card, CardBody, CardHeader, Button, Badge, ProgressBar } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { cn, formatDate } from '../../lib/utils'
import { getQuizAccess, formatQuizSchedule, quizBlockedMessage } from '../../lib/quizAccess'
import { attemptSeconds, remainingSeconds, formatCountdown } from '../../lib/quizTimer'

const typeLabel = { mcq: 'Multiple Choice', tf: 'True or False', id: 'Identification' }

export function QuizRunner() {
  const { programId, quizId } = useParams()
  const { db, user, recordQuizAttempt, startQuizAttempt, requestQuizAccess, toast } = useApp()

  const program = programById(programId)
  const enrollment = enrollmentOf(db, user.id, programId)
  const quiz = program?.quizzes.find((q) => q.id === quizId)

  const [phase, setPhase] = useState('intro') // intro | taking | result
  const [answers, setAnswers] = useState({})
  const [current, setCurrent] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(attemptSeconds('quiz'))
  const [result, setResult] = useState(null)
  const submittedRef = useRef(false)
  // Captured when the trainee presses Start; the store checks access against
  // this instant so a quiz that runs past the deadline still submits.
  const startedAtRef = useRef(null)

  const history = traineeQuizAttempts(db, user.id, programId).filter((a) => a.quizId === quizId)
  const best = useMemo(() => [...history].sort((a, b) => b.percentage - a.percentage)[0], [history])

  const requests = (db.quizRequests || []).filter((r) => r.traineeId === user.id && r.quizId === quizId)
  const sessions = (db.quizSessions || []).filter((s) => s.traineeId === user.id && s.quizId === quizId)
  const access = getQuizAccess({ quiz: quiz || {}, attempts: history, requests, sessions })
  // The session timing the current attempt (set on start and on resume).
  const sessionRef = useRef(null)

  // Returning to a quiz that is already running continues the same clock: the
  // remaining time comes from the session's original start, never a fresh 30.
  useEffect(() => {
    if (phase !== 'intro' || !access.canResume) return
    sessionRef.current = access.session
    startedAtRef.current = access.session.startedAt
    setSecondsLeft(access.resumeSeconds)
    setAnswers({})
    setCurrent(0)
    setResult(null)
    submittedRef.current = false
    setPhase('taking')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.canResume])

  // countdown timer
  useEffect(() => {
    if (phase !== 'taking') return undefined
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'taking' && secondsLeft === 0 && !submittedRef.current) {
      submit(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase])

  if (!program || !enrollment || !quiz) return <Navigate to="/trainee/courses" replace />
  if (!hasCourseAccess(enrollment)) return <Navigate to={`/trainee/courses/${programId}`} replace />

  const requestAccess = (type) => {
    const res = requestQuizAccess({ programId, quizId, type })
    if (!res.ok) toast(res.error, 'error')
  }

  const total = quiz.questions.length
  const answeredCount = Object.values(answers).filter((v) => v !== undefined && v !== '').length

  const setAnswer = (qid, value) => setAnswers((a) => ({ ...a, [qid]: value }))

  const normalize = (v) => String(v ?? '').trim().toLowerCase()

  function submit(auto = false) {
    if (submittedRef.current) return
    submittedRef.current = true
    const graded = quiz.questions.map((q) => {
      const given = answers[q.id]
      const correct = normalize(given) === normalize(q.answer)
      return { questionId: q.id, given: given ?? '', correct }
    })
    const score = graded.filter((g) => g.correct).length
    const percentage = Math.round((score / total) * 100)
    const passed = percentage >= quiz.passing
    const attempt = {
      traineeId: user.id,
      programId,
      quizId,
      quizTitle: quiz.title,
      score,
      total,
      percentage,
      passed,
      date: new Date().toISOString().slice(0, 10),
      startedAt: startedAtRef.current || new Date().toISOString(),
      answers: graded,
    }
    // The store re-validates schedule, attempt limit and trainer approval, and
    // closes the session that was timing this attempt.
    const res = recordQuizAttempt(attempt, sessionRef.current?.id || null)
    if (!res.ok) {
      submittedRef.current = false
      toast(res.error || 'This attempt is not authorized.', 'error')
      setPhase('intro')
      return
    }
    setResult(attempt)
    setPhase('result')
    toast(auto ? 'Time is up — quiz submitted automatically.' : 'Quiz submitted successfully.', auto ? 'warning' : 'success')
  }

  const start = () => {
    const res = startQuizAttempt({ programId, quizId })
    if (!res.ok) {
      toast(res.error || quizBlockedMessage(access) || 'This quiz is not available.', 'warning')
      return
    }
    sessionRef.current = res.session
    startedAtRef.current = res.session.startedAt
    setAnswers({})
    setCurrent(0)
    setSecondsLeft(
      res.resumed
        ? remainingSeconds(res.session.startedAt, attemptSeconds('quiz'))
        : attemptSeconds('quiz'),
    )
    setResult(null)
    submittedRef.current = false
    setPhase('taking')
  }

  // ------------------------------- INTRO ------------------------------------
  if (phase === 'intro') {
    const availabilityLabel = access.approvedRequest
      ? 'Approved'
      : access.pendingRequest
        ? 'Pending approval'
        : access.blockedReason === 'attempt_expired'
          ? 'Time expired'
          : !access.window.scheduled
          ? 'Not scheduled'
          : access.window.beforeStart
            ? 'Scheduled'
            : access.window.afterDeadline
              ? 'Closed'
              : access.attemptCount
                ? 'Completed'
                : 'Open'
    const availabilityTone = access.approvedRequest
      ? 'success'
      : access.pendingRequest
        ? 'warning'
        : access.blockedReason === 'attempt_expired'
          ? 'danger'
          : !access.window.scheduled
          ? 'neutral'
          : access.window.beforeStart
            ? 'info'
            : access.window.afterDeadline
              ? 'danger'
              : access.attemptCount
                ? 'neutral'
                : 'success'

    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Link to={`/trainee/courses/${programId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> {program.title}
        </Link>

        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <ClipboardList className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-bold sm:text-2xl">{quiz.title}</h1>
            <p className="mt-1 text-sm text-white/80">{program.title}</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: 'Questions', value: total },
                { label: 'Time limit', value: '30 min' },
                { label: 'Passing score', value: `${quiz.passing}%` },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-white/10 p-3 text-center">
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[11px] text-white/70">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <CardBody className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Instructions</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="text-brand-500">•</span> The quiz contains {total} questions (multiple choice, true/false and identification).
                </li>
                <li className="flex gap-2">
                  <span className="text-brand-500">•</span> You have 30 minutes. The quiz auto-submits when time runs out.
                </li>
                <li className="flex gap-2">
                  <span className="text-brand-500">•</span> You need at least {quiz.passing}% to pass. Additional attempts require trainer approval.
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule &amp; access</p>
                <Badge tone={availabilityTone}>{availabilityLabel}</Badge>
              </div>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-600">
                <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" /> {formatQuizSchedule(quiz)}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                <span>Attempts used: {access.attemptCount}</span>
                {best && (
                  <span>
                    Best score: {best.percentage}% ({best.score}/{best.total})
                  </span>
                )}
              </div>

              {access.pendingRequest && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  Your {access.pendingRequest.type === 'late' ? 'late access' : 'retake'} request is waiting for trainer
                  approval.
                </p>
              )}
              {access.approvedRequest && (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  Your trainer approved one additional attempt. You can take the quiz now.
                </p>
              )}
              {access.latestRejected && !access.pendingRequest && !access.approvedRequest && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  Your {access.latestRejected.type === 'late' ? 'late access' : 'retake'} request was rejected
                  {access.latestRejected.note ? `: ${access.latestRejected.note}` : '.'}
                </p>
              )}
            </div>

            {best && (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your best attempt</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-slate-600">
                    {best.score}/{best.total} correct · {formatDate(best.date)}
                  </span>
                  <StatusBadge status={best.passed ? 'Passed' : 'Failed'} />
                </div>
              </div>
            )}

            {access.canStart ? (
              <Button className="w-full" size="lg" onClick={start} icon={ClipboardList}>
                {access.approvedRequest ? 'Start Approved Attempt' : access.attemptCount ? 'Start New Attempt' : 'Start Quiz'}
              </Button>
            ) : access.pendingRequest ? (
              <Button className="w-full" size="lg" variant="secondary" icon={Hourglass} disabled>
                Waiting for trainer approval
              </Button>
            ) : access.canRequestLate ? (
              <Button className="w-full" size="lg" icon={Send} onClick={() => requestAccess('late')}>
                Request Late Quiz Access
              </Button>
            ) : access.canRequestRetake ? (
              <Button className="w-full" size="lg" icon={Send} onClick={() => requestAccess('retake')}>
                Request Retake
              </Button>
            ) : (
              <Button className="w-full" size="lg" variant="secondary" icon={Lock} disabled>
                {access.blockedReason === 'attempt_expired'
                  ? 'Time expired'
                  : !access.window.scheduled
                    ? 'Not scheduled yet'
                    : access.window.beforeStart
                      ? 'Quiz not yet available'
                      : 'Quiz locked'}
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    )
  }

  // ------------------------------- TAKING -----------------------------------
  if (phase === 'taking') {
    const q = quiz.questions[current]
    const low = secondsLeft <= 60
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{quiz.title}</h1>
            <p className="text-xs text-slate-500">
              Question {current + 1} of {total} · {answeredCount} answered
            </p>
          </div>
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold',
              low ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700',
            )}
          >
            <Clock className="h-4 w-4" />
            {formatCountdown(secondsLeft)}
          </div>
        </div>

        <ProgressBar value={((current + 1) / total) * 100} />

        <Card>
          <CardBody className="space-y-5">
            <div className="flex items-center gap-2">
              <Badge tone="brand">{typeLabel[q.type]}</Badge>
              <span className="text-xs text-slate-400">Question {current + 1}</span>
            </div>
            <p className="text-base font-medium leading-relaxed text-slate-800">{q.q}</p>

            {/* answer input */}
            {q.type === 'mcq' && (
              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  const selected = answers[q.id] === opt
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswer(q.id, opt)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition',
                        selected
                          ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-500'
                          : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                          selected ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 text-slate-500',
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            {q.type === 'tf' && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'True', value: true },
                  { label: 'False', value: false },
                ].map((opt) => {
                  const selected = answers[q.id] === opt.value
                  return (
                    <button
                      key={opt.label}
                      onClick={() => setAnswer(q.id, opt.value)}
                      className={cn(
                        'rounded-xl border p-4 text-center text-sm font-semibold transition',
                        selected
                          ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-500'
                          : 'border-slate-200 text-slate-600 hover:border-brand-200 hover:bg-slate-50',
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}

            {q.type === 'id' && (
              <input
                type="text"
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Type your answer…"
                className="input-base"
                autoComplete="off"
              />
            )}
          </CardBody>
        </Card>

        {/* question navigator */}
        <div className="flex flex-wrap gap-2">
          {quiz.questions.map((qq, i) => {
            const isAnswered = answers[qq.id] !== undefined && answers[qq.id] !== ''
            return (
              <button
                key={qq.id}
                onClick={() => setCurrent(i)}
                className={cn(
                  'h-9 w-9 rounded-lg text-xs font-semibold transition',
                  i === current
                    ? 'bg-brand-600 text-white'
                    : isAnswered
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                )}
              >
                {i + 1}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" icon={ChevronLeft} disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
            Previous
          </Button>
          {current < total - 1 ? (
            <Button onClick={() => setCurrent((c) => c + 1)} iconRight={ChevronRight}>
              Next
            </Button>
          ) : (
            <Button variant="success" icon={CheckCircle2} onClick={() => submit(false)}>
              Submit Quiz
            </Button>
          )}
        </div>

        {answeredCount < total && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {total - answeredCount} question(s) unanswered
          </p>
        )}
      </div>
    )
  }

  // ------------------------------- RESULT -----------------------------------
  const r = result
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={`/trainee/courses/${programId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> {program.title}
      </Link>

      <Card className="overflow-hidden">
        <div
          className={cn(
            'p-6 text-center text-white sm:p-8',
            r.passed ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-red-500 to-rose-600',
          )}
        >
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            {r.passed ? <Trophy className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
          </span>
          <h1 className="mt-4 text-2xl font-bold">{r.passed ? 'Congratulations, you passed!' : 'Better luck next time'}</h1>
          <p className="mt-1 text-sm text-white/85">{quiz.title}</p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/15 p-3">
              <p className="text-2xl font-bold">
                {r.score}/{r.total}
              </p>
              <p className="text-[11px] text-white/75">Score</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3">
              <p className="text-2xl font-bold">{r.percentage}%</p>
              <p className="text-[11px] text-white/75">Percentage</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3">
              <p className="text-2xl font-bold">{r.passed ? 'PASSED' : 'FAILED'}</p>
              <p className="text-[11px] text-white/75">Status</p>
            </div>
          </div>
        </div>

        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Award className="h-4 w-4 text-slate-400" />
              Passing score: {quiz.passing}%
            </div>
            <div className="flex flex-wrap gap-2">
              {access.pendingRequest ? (
                <Button variant="secondary" icon={Hourglass} disabled>
                  Retake request pending
                </Button>
              ) : access.approvedRequest ? (
                <Button icon={RotateCcw} onClick={start}>
                  Start Approved Attempt
                </Button>
              ) : (
                <Button variant="secondary" icon={Send} onClick={() => requestAccess('retake')}>
                  Request Retake
                </Button>
              )}
              <Link to={`/trainee/courses/${programId}`}>
                <Button>Back to course</Button>
              </Link>
            </div>
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ListChecks className="h-4 w-4" /> Answer Review
            </h3>
            <div className="space-y-3">
              {quiz.questions.map((q, i) => {
                const graded = r.answers.find((a) => a.questionId === q.id)
                const given = graded?.given
                const correct = graded?.correct
                const display = (v) => {
                  if (v === true) return 'True'
                  if (v === false) return 'False'
                  if (v === '' || v == null) return '(no answer)'
                  return v
                }
                const correctDisplay = display(q.answer)
                return (
                  <div
                    key={q.id}
                    className={cn(
                      'rounded-xl border p-4',
                      correct ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white',
                          correct ? 'bg-emerald-500' : 'bg-red-500',
                        )}
                      >
                        {correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-400">Q{i + 1}</span>
                          <Badge tone="neutral">{typeLabel[q.type]}</Badge>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-800">{q.q}</p>
                        <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                          <p className={correct ? 'text-emerald-700' : 'text-red-700'}>
                            <span className="font-semibold">Your answer:</span> {display(given)}
                          </p>
                          {!correct && (
                            <p className="text-emerald-700">
                              <span className="font-semibold">Correct answer:</span> {correctDisplay}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {history.length > 0 && (
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attempt History</p>
              <div className="mt-2 space-y-1.5">
                {history.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{formatDate(a.date)}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-slate-600">
                        {a.score}/{a.total} ({a.percentage}%)
                      </span>
                      <StatusBadge status={a.passed ? 'Passed' : 'Failed'} dot={false} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

export default QuizRunner
