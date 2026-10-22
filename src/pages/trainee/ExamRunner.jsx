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
  AlertTriangle,
  ListChecks,
  RotateCcw,
  Trophy,
  FileCheck2,
  CalendarDays,
  Lock,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { enrollmentOf, programById, traineeExamAttempts, hasCourseAccess } from '../../store/selectors'
import { Card, CardBody, Button, Badge, ProgressBar } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { cn, formatDate } from '../../lib/utils'
import { quizWindow, formatQuizSchedule } from '../../lib/quizAccess'
import { attemptSeconds, formatCountdown } from '../../lib/quizTimer'
import { getServerExamAttempt } from '../../lib/assessments'
import { isAnswered, unansweredQuestions, firstUnansweredIndex } from '../../lib/quizAnswers'

const typeLabel = { mcq: 'Multiple Choice', tf: 'True or False', id: 'Identification' }

// Use the exam's own question bank when present; otherwise fall back to
// pooling questions from the program's quizzes (legacy exams).
function buildExamQuestions(program, exam) {
  if (exam.questions?.length) {
    return exam.questions.map((qq, i) => ({ ...qq, examQid: qq.id || `${exam.id}-q${i + 1}` }))
  }
  const pool = program.quizzes.flatMap((q) => q.questions.map((qq) => ({ ...qq, quizId: q.id })))
  if (!pool.length) return []
  const count = exam.questionCount || pool.length
  const out = []
  for (let i = 0; i < count; i += 1) {
    out.push({ ...pool[i % pool.length], examQid: `${exam.id}-q${i + 1}` })
  }
  return out
}

export function ExamRunner() {
  const { programId, examId } = useParams()
  const { db, user, settings, recordExamAttempt, flushSync, retrySaveRow, toast } = useApp()

  const program = programById(programId)
  const enrollment = enrollmentOf(db, user.id, programId)
  const exam = program?.exams.find((e) => e.id === examId)

  const questions = useMemo(() => (program && exam ? buildExamQuestions(program, exam) : []), [program, exam])

  const [phase, setPhase] = useState('intro')
  const [answers, setAnswers] = useState({})
  const [current, setCurrent] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(attemptSeconds('exam'))
  const [result, setResult] = useState(null)
  // The result is only announced as saved once Supabase accepted the row.
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [serverResult, setServerResult] = useState(null)
  const [saveError, setSaveError] = useState('')
  // Shown when the trainee tries to submit with questions left blank.
  const [submitError, setSubmitError] = useState('')
  const savedAttemptRef = useRef(null)
  const submittedRef = useRef(false)
  const startedAtRef = useRef(null)

  const history = traineeExamAttempts(db, user.id, programId).filter((a) => a.examId === examId)

  useEffect(() => {
    if (phase !== 'taking') return undefined
    const t = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'taking' && secondsLeft === 0 && !submittedRef.current) submit(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase])

  if (!program || !enrollment || !exam) return <Navigate to="/trainee/courses" replace />
  if (!hasCourseAccess(enrollment)) return <Navigate to={`/trainee/courses/${programId}`} replace />

  const examWindow = quizWindow(exam)
  // An exam needs a trainer schedule before it can be taken.
  const isOpen = examWindow.scheduled && !examWindow.beforeStart && !examWindow.afterDeadline

  const total = questions.length
  // Exams saved before the threshold existed fall back to the system default.
  const passingScore = Number(exam.passing ?? settings?.passingScore ?? 75)
  const byExamQid = (q) => q.examQid
  const unanswered = unansweredQuestions(questions, answers, byExamQid)
  const answeredCount = total - unanswered.length
  const normalize = (v) => String(v ?? '').trim().toLowerCase()
  const setAnswer = (qid, value) => {
    setSubmitError('')
    setAnswers((a) => ({ ...a, [qid]: value }))
  }

  function submit(auto = false) {
    if (submittedRef.current) return
    // Every question must be answered before a manual submit — an unanswered
    // question scores zero. The deadline auto-submit still closes the attempt.
    if (!auto && unanswered.length) {
      setSubmitError(
        `Answer all ${total} questions before submitting. ${unanswered.length} still blank.`,
      )
      setCurrent(firstUnansweredIndex(questions, answers, byExamQid))
      return
    }
    submittedRef.current = true
    const graded = questions.map((q) => {
      const given = answers[q.examQid]
      return { questionId: q.examQid, given: given ?? '', correct: normalize(given) === normalize(q.answer) }
    })
    const score = graded.filter((g) => g.correct).length
    const percentage = Math.round((score / total) * 100)
    const passed = percentage >= passingScore
    const attempt = {
      traineeId: user.id,
      programId,
      examId,
      examTitle: exam.title,
      score,
      total,
      percentage,
      passed,
      date: new Date().toISOString().slice(0, 10),
      startedAt: startedAtRef.current || new Date().toISOString(),
      answers: graded,
    }
    const res = recordExamAttempt(attempt)
    if (!res.ok) {
      submittedRef.current = false
      toast(res.error || 'This exam attempt is not authorized.', 'error')
      setPhase('intro')
      return
    }
    setResult(attempt)
    setPhase('result')
    persist(res.attempt || attempt, auto)
  }

  // Push the attempt to Supabase and only then report success; a rejected save
  // keeps the result on screen with a retry instead of claiming it was stored.
  function persist(stored, auto = false) {
    savedAttemptRef.current = stored
    setSaveState('saving')
    setSaveError('')
    flushSync()
      .then(() => {
        setSaveState('saved')
        toast(auto ? 'Time is up — exam submitted automatically.' : 'Exam submitted successfully.', auto ? 'warning' : 'success')
        // Read back what the server graded so the result screen shows the score
        // of record rather than the browser's calculation.
        return getServerExamAttempt(stored.id).then((state) => {
          if (state && state.status !== 'in_progress') setServerResult(state)
        })
      })
      .catch((e) => {
        setSaveState('error')
        setSaveError(e?.message || String(e))
      })
  }

  function retrySave() {
    const stored = savedAttemptRef.current
    if (!stored) return
    setSaveState('saving')
    setSaveError('')
    retrySaveRow('examAttempts', stored)
      .then(() => {
        setSaveState('saved')
        toast('Exam result saved.')
      })
      .catch((e) => {
        setSaveState('error')
        setSaveError(e?.message || String(e))
      })
  }

  const start = () => {
    if (!isOpen) {
      toast(
        !examWindow.scheduled
          ? 'Your trainer has not scheduled this exam yet.'
          : examWindow.beforeStart
            ? 'This exam is not open yet.'
            : 'The exam deadline has passed.',
        'warning',
      )
      return
    }
    startedAtRef.current = new Date().toISOString()
    setAnswers({})
    setSubmitError('')
    setCurrent(0)
    setSecondsLeft(attemptSeconds('exam'))
    setResult(null)
    setServerResult(null)
    submittedRef.current = false
    setPhase('taking')
  }

  if (phase === 'intro') {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Link to={`/trainee/courses/${programId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> {program.title}
        </Link>
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <FileCheck2 className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-bold sm:text-2xl">{exam.title}</h1>
            <p className="mt-1 text-sm text-white/85">
              {program.title} · {exam.competency}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: 'Questions', value: total },
                { label: 'Time limit', value: '60 min' },
                { label: 'Passing score', value: `${passingScore}%` },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-white/10 p-3 text-center">
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[11px] text-white/70">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <CardBody className="space-y-5">
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> Examination rules
              </p>
              <ul className="mt-2 space-y-1 text-amber-700">
                <li>• This is a supervised competency assessment exam.</li>
                <li>• You have 60 minutes — the exam auto-submits when time expires.</li>
                <li>• A minimum of {passingScore}% is required to pass.</li>
              </ul>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-slate-400" /> {formatQuizSchedule(exam)}
              </span>
              <Badge
                tone={
                  history.length
                    ? 'success'
                    : !examWindow.scheduled
                      ? 'neutral'
                      : examWindow.beforeStart
                        ? 'info'
                        : examWindow.afterDeadline
                          ? 'danger'
                          : 'success'
                }
              >
                {history.length
                  ? 'Done'
                  : !examWindow.scheduled
                    ? 'Not scheduled'
                    : examWindow.beforeStart
                      ? 'Scheduled'
                      : examWindow.afterDeadline
                        ? 'Closed'
                        : 'Open'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Exam status</span>
              <StatusBadge status={exam.status} />
            </div>
            {isOpen ? (
              <Button className="w-full" size="lg" onClick={start} icon={FileCheck2}>
                {history.length ? 'Retake Exam' : 'Start Exam'}
              </Button>
            ) : (
              <Button
                className="w-full"
                size="lg"
                variant="secondary"
                icon={history.length ? CheckCircle2 : Lock}
                disabled
              >
                {history.length
                  ? 'Done'
                  : !examWindow.scheduled
                    ? 'Not scheduled yet'
                    : examWindow.beforeStart
                      ? 'Exam not yet available'
                      : 'Exam closed'}
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    )
  }

  if (phase === 'taking') {
    const q = questions[current]
    const low = secondsLeft <= 60
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{exam.title}</h1>
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
              <Badge tone="warning">{typeLabel[q.type]}</Badge>
              <span className="text-xs text-slate-400">Question {current + 1}</span>
            </div>
            <p className="text-base font-medium leading-relaxed text-slate-800">{q.q}</p>
            {q.type === 'mcq' && (
              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  const selected = answers[q.examQid] === opt
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswer(q.examQid, opt)}
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
                  const selected = answers[q.examQid] === opt.value
                  return (
                    <button
                      key={opt.label}
                      onClick={() => setAnswer(q.examQid, opt.value)}
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
                value={answers[q.examQid] ?? ''}
                onChange={(e) => setAnswer(q.examQid, e.target.value)}
                placeholder="Type your answer…"
                className="input-base"
                autoComplete="off"
              />
            )}
          </CardBody>
        </Card>
        <div className="flex flex-wrap gap-2">
          {questions.map((qq, i) => {
            const done = isAnswered(answers[qq.examQid])
            return (
              <button
                key={qq.examQid}
                onClick={() => setCurrent(i)}
                className={cn(
                  'h-9 w-9 rounded-lg text-xs font-semibold transition',
                  i === current
                    ? 'bg-brand-600 text-white'
                    : done
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
              Submit Exam
            </Button>
          )}
        </div>

        {answeredCount < total && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            <p className="flex items-center justify-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {total - answeredCount} question(s) still unanswered — answer them all before submitting.
            </p>
          </div>
        )}

        {submitError && (
          <p role="alert" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600">
            <XCircle className="h-3.5 w-3.5" />
            {submitError}
          </p>
        )}
      </div>
    )
  }

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
          <h1 className="mt-4 text-2xl font-bold">{r.passed ? 'Exam Passed!' : 'Exam Failed'}</h1>
          <p className="mt-1 text-sm text-white/85">{exam.title}</p>
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
          {saveState === 'saving' && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Saving your result…
            </div>
          )}
          {saveState === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <p className="font-semibold">This result has not been saved yet.</p>
              <p className="mt-1">{saveError}</p>
              <Button size="sm" variant="secondary" className="mt-2" icon={RotateCcw} onClick={retrySave}>
                Retry save
              </Button>
            </div>
          )}
          {serverResult ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <p className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified by the server
              </p>
              <p className="mt-1">
                {serverResult.correct_answers ?? serverResult.score}/{serverResult.total_questions} correct ·{' '}
                {Number(serverResult.percentage ?? 0).toFixed(2)}% · {serverResult.incorrect_answers ?? 0} incorrect ·{' '}
                {serverResult.unanswered_questions ?? 0} unanswered
                {serverResult.auto_submitted ? ' · auto-submitted at the deadline' : ''}
              </p>
              <p className="mt-1 text-emerald-700/80">
                The server re-graded the saved answers with its own answer key. This is the score of record.
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Award className="h-4 w-4 text-slate-400" /> Completed {formatDate(r.date)}
            </div>
            <Link to={`/trainee/courses/${programId}`}>
              <Button>Back to course</Button>
            </Link>
          </div>
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ListChecks className="h-4 w-4" /> Answer Review
            </h3>
            <div className="space-y-3">
              {questions.map((q, i) => {
                const graded = r.answers.find((a) => a.questionId === q.examQid)
                const display = (v) => (v === true ? 'True' : v === false ? 'False' : v === '' || v == null ? '(no answer)' : v)
                return (
                  <div
                    key={q.examQid}
                    className={cn(
                      'rounded-xl border p-4',
                      graded?.correct ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white',
                          graded?.correct ? 'bg-emerald-500' : 'bg-red-500',
                        )}
                      >
                        {graded?.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-400">Q{i + 1}</p>
                        <p className="mt-1 text-sm font-medium text-slate-800">{q.q}</p>
                        <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                          <p className={graded?.correct ? 'text-emerald-700' : 'text-red-700'}>
                            <span className="font-semibold">Your answer:</span> {display(graded?.given)}
                          </p>
                          {!graded?.correct && (
                            <p className="text-emerald-700">
                              <span className="font-semibold">Correct answer:</span> {display(q.answer)}
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
        </CardBody>
      </Card>
    </div>
  )
}

export default ExamRunner
