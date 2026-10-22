import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Keyboard,
  Timer,
  Target,
  XCircle,
  RotateCcw,
  Trophy,
  Gauge,
  AlertTriangle,
  Award,
  TrendingUp,
  Send,
  Hourglass,
  Lock,
  ClipboardCheck,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { traineeTypingTests, enrollmentTrainerId } from '../../store/selectors'
import { getTypingAccess, typingTestsOf, typingRequestsOf, TYPING_PROGRAM_ID } from '../../lib/typingAccess'
import { Card, CardBody, CardHeader, Button, Badge, StatCard, ProgressBar, EmptyState } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate, cn } from '../../lib/utils'
import {
  computeTypingStats,
  typingScore,
  formatDuration,
  isPassageComplete,
  TYPING_TARGET_WPM,
} from '../../lib/typingMetrics'

// Fallback only: the live value comes from System Settings
// (typingPassingRate), read inside the component.
const DEFAULT_PASSING = 40

const PASSAGES = [
  'A virtual assistant helps business owners manage their daily tasks from a remote location. Strong communication skills and attention to detail are essential for success in this profession. You must be organized, reliable, and able to work independently while staying connected with your client through email, chat, and video calls.',
  'The quick brown fox jumps over the lazy dog while the efficient assistant schedules meetings, answers emails, and organizes files. Accuracy matters more than speed at first, but with regular practice you will develop both. Remember to maintain a comfortable posture and keep your wrists relaxed while typing.',
  'Managing a calendar requires careful planning and clear communication. A professional virtual assistant confirms appointments, sends reminders, and keeps every document organized in the cloud. Good time management allows you to handle multiple clients without sacrificing the quality of your work or your personal wellbeing.',
]

export function TypingTest() {
  const { db, user, settings, recordTypingTest, requestTypingRetake, toast } = useApp()
  const PASSING = Number(settings?.typingPassingRate) || DEFAULT_PASSING
  const history = traineeTypingTests(db, user.id)
  // One attempt per trainee; any further attempt needs a trainer approval.
  const access = getTypingAccess({
    tests: typingTestsOf(db, user.id, TYPING_PROGRAM_ID),
    requests: typingRequestsOf(db, user.id, TYPING_PROGRAM_ID),
  })
  const enrolled = (user.enrolledPrograms || []).includes('virtual-assistant')
  // The trainer who owns this result: the one the VA enrollment is assigned to.
  // The program's legacy `trainerId` points at a seed id with no profile, so a
  // result stored against it would never reach a trainer.
  const vaEnrollment = db.enrollments.find(
    (e) =>
      e.traineeId === user.id &&
      e.programId === 'virtual-assistant' &&
      ['Enrolled', 'Approved', 'Completed'].includes(e.status),
  )
  const vaTrainer = db.users.find((u) => u.id === enrollmentTrainerId(db, vaEnrollment) && u.role === 'trainer')
  const vaTrainerId = vaTrainer?.id || null
  // Trainer who evaluated the latest result (for the remarks panel).
  const evaluator = access.latest?.evaluatedBy
    ? db.users.find((u) => u.id === access.latest.evaluatedBy)
    : null

  const [phase, setPhase] = useState('intro') // intro | test | result
  const [passageIndex, setPassageIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [started, setStarted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)
  // Wall-clock start of the attempt, so WPM stays accurate even when the last
  // character lands between two timer ticks.
  const startedAtRef = useRef(null)
  // Guards the auto-submit effect so one attempt is never recorded twice.
  const finishedRef = useRef(false)

  const passage = PASSAGES[passageIndex]

  useEffect(() => {
    if (!started || phase !== 'test') return undefined
    const t = setInterval(() => {
      if (startedAtRef.current) setElapsed((Date.now() - startedAtRef.current) / 1000)
    }, 200)
    return () => clearInterval(t)
  }, [started, phase])

  const stats = useMemo(() => computeTypingStats(passage, typed, elapsed), [typed, passage, elapsed])

  const handleChange = (e) => {
    const value = e.target.value.slice(0, passage.length)
    if (!started && value.length > 0) {
      startedAtRef.current = Date.now()
      setStarted(true)
    }
    setTyped(value)
  }

  const resetAttempt = () => {
    setTyped('')
    setStarted(false)
    setElapsed(0)
    setResult(null)
    startedAtRef.current = null
    finishedRef.current = false
  }

  // The first attempt and an approved retake both start here; nothing else can
  // open the test phase.
  const startTest = (retake = false) => {
    if (!access.canStart) {
      toast('You already took the typing test. Request a retake from your trainer.', 'error')
      return
    }
    resetAttempt()
    // A retake uses a fresh passage so the previous attempt cannot be reused.
    if (retake) setPassageIndex((i) => (i + 1) % PASSAGES.length)
    setPhase('test')
  }

  const cancelTest = () => {
    resetAttempt()
    setPhase('intro')
  }

  const requestRetake = () => {
    const res = requestTypingRetake({ programId: TYPING_PROGRAM_ID })
    if (!res.ok) toast(res.error, 'error')
  }

  // Ends the test. The auto-submit effect calls this the moment the last
  // character is typed, so there is no Submit button to press.
  const finish = () => {
    if (finishedRef.current) return
    if (!started) {
      toast('Start typing to begin the test.', 'warning')
      return
    }
    finishedRef.current = true

    const seconds = startedAtRef.current ? Math.max(1, (Date.now() - startedAtRef.current) / 1000) : 0
    const finalStats = computeTypingStats(passage, typed, seconds)
    const finalScore = typingScore(finalStats.netWpm)
    const finalPassed = finalScore >= PASSING

    const res = {
      traineeId: user.id,
      programId: TYPING_PROGRAM_ID,
      trainerId: vaTrainerId,
      wpm: finalStats.netWpm,
      rawWpm: finalStats.grossWpm,
      accuracy: finalStats.accuracy,
      errors: finalStats.errors,
      totalWords: finalStats.totalWords,
      correctWords: finalStats.correctWords,
      incorrectWords: finalStats.incorrectWords,
      durationSeconds: finalStats.seconds,
      duration: Math.max(1, Math.round(seconds / 60)),
      score: finalScore,
      passed: finalPassed,
      date: new Date().toISOString().slice(0, 10),
      submittedAt: new Date().toISOString(),
      remarks: finalPassed ? 'Meets minimum typing requirement.' : 'Needs more practice. Retake required.',
    }
    const saved = recordTypingTest(res)
    if (saved?.ok === false) {
      finishedRef.current = false
      toast(saved.error, 'error')
      setPhase('intro')
      return
    }
    setResult(res)
    setPhase('result')
  }

  // Auto-submit once the passage is fully typed. The final character must be
  // the right one — otherwise a stray space where the closing period belongs
  // would end the attempt before the trainee types it.
  useEffect(() => {
    if (phase !== 'test' || !started) return
    if (!isPassageComplete(passage, typed)) return
    finish()
    // Reads the latest render; re-running on every finish identity is unwanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, phase, started, passage.length])

  if (!enrolled) {
    return (
      <div className="card">
        <EmptyState
          icon={Keyboard}
          title="Typing test is exclusive to the Virtual Assistant program"
          description="This evaluation is part of the Virtual Assistant special program. Enroll to gain access."
        />
      </div>
    )
  }

  const columns = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date), sortable: true },
    { key: 'wpm', header: 'WPM', render: (r) => <span className="font-semibold">{r.wpm}</span>, sortable: true },
    { key: 'accuracy', header: 'Accuracy', render: (r) => `${r.accuracy}%`, sortable: true },
    { key: 'errors', header: 'Errors', render: (r) => r.errors },
    {
      key: 'score',
      header: 'Score',
      sortable: true,
      render: (r) => <span className="font-semibold text-slate-700">{r.score}%</span>,
    },
    { key: 'passed', header: 'Result', render: (r) => <StatusBadge status={r.passed ? 'Passed' : 'Failed'} /> },
    {
      key: 'evaluated',
      header: 'Evaluation',
      render: (r) =>
        r.evaluated === false ? (
          <Badge tone="warning">Awaiting evaluation</Badge>
        ) : (
          <Badge tone="success">Evaluated</Badge>
        ),
    },
    {
      key: 'remarks',
      header: 'Trainer Remarks',
      render: (r) =>
        r.evaluated === false ? (
          <span className="text-slate-400">Awaiting evaluation</span>
        ) : (
          <span className="text-slate-600">{r.remarks || '—'}</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Passing Requirement" value={`${PASSING}%`} icon={Target} tone="warning" hint="Minimum score to pass" />
        <StatCard
          label="Best Score"
          value={history.length ? `${Math.max(...history.map((h) => h.score))}%` : '—'}
          icon={Trophy}
          tone="success"
        />
        <StatCard
          label="Best WPM"
          value={history.length ? Math.max(...history.map((h) => h.wpm)) : '—'}
          icon={Gauge}
          tone="brand"
        />
        <StatCard
          label="Attempts"
          value={access.attemptCount}
          icon={Keyboard}
          tone="purple"
          hint={access.canStart ? 'One attempt allowed' : 'Attempt used'}
        />
      </div>

      {/* INTRO */}
      {phase === 'intro' && (
        <Card>
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Keyboard className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-bold sm:text-2xl">Virtual Assistant Typing Test</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              Type the passage as quickly and accurately as you can. Your words-per-minute, accuracy and errors are
              measured automatically. You need a score of at least {PASSING}% to pass. The test submits by itself once
              you type the last character. You get one attempt — your trainer evaluates it, and you can request a retake
              if you need another try.
            </p>
          </div>
          <CardBody className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { icon: Gauge, title: 'Words per Minute', desc: 'Measures your typing speed based on correctly typed characters.' },
                { icon: Target, title: 'Accuracy', desc: 'Percentage of characters typed correctly against the target passage.' },
                { icon: Award, title: 'Passing Score', desc: `Score is computed from speed and accuracy. Minimum passing is ${PASSING}%.` },
              ].map((c) => (
                <div key={c.title} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <c.icon className="h-5 w-5 text-brand-600" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">{c.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{c.desc}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-indigo-50 p-4 text-sm text-indigo-800">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> How scoring works
              </p>
              <p className="mt-1 text-indigo-700">
                Score = net WPM (correct characters only) ÷ {TYPING_TARGET_WPM} WPM × 100, capped at 100%. Wrong characters
                never count toward your speed, so accuracy is already included. For example, 25 net WPM gives a score of
                63% — a passing result.
              </p>
            </div>
            {access.waitingForEvaluation && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                Your result is waiting for trainer evaluation. You can request a retake once it has been evaluated.
              </p>
            )}
            {access.pendingRequest && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                Your retake request is waiting for trainer approval.
              </p>
            )}
            {access.approvedRequest && (
              <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                Your trainer approved one more attempt. Start it below.
              </p>
            )}
            {access.latestRejected && !access.pendingRequest && !access.approvedRequest && !access.waitingForEvaluation && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                Your retake request was rejected{access.latestRejected.note ? ': ' + access.latestRejected.note : '.'}
              </p>
            )}

            {access.latest && access.evaluated && access.latest.remarks && (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Trainer&apos;s Remarks</p>
                <p className="mt-1 text-sm text-slate-700">{access.latest.remarks}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {evaluator ? `Evaluated by ${evaluator.name}` : 'Evaluated'}
                  {access.latest.evaluatedAt ? ` · ${formatDate(access.latest.evaluatedAt)}` : ''}
                </p>
              </div>
            )}

            {access.canStart ? (
              <Button size="lg" className="w-full" icon={Keyboard} onClick={() => startTest(access.attemptCount > 0)}>
                {access.attemptCount > 0 ? 'Start Approved Retake' : 'Start Typing Test'}
              </Button>
            ) : access.waitingForEvaluation ? (
              <Button size="lg" variant="secondary" className="w-full" icon={Hourglass} disabled>
                Waiting for trainer evaluation
              </Button>
            ) : access.pendingRequest ? (
              <Button size="lg" variant="secondary" className="w-full" icon={Hourglass} disabled>
                Retake request pending approval
              </Button>
            ) : access.canRequest ? (
              <Button size="lg" className="w-full" icon={Send} onClick={requestRetake}>
                Request Retake
              </Button>
            ) : (
              <Button size="lg" variant="secondary" className="w-full" icon={Lock} disabled>
                Attempt already used
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      {/* TEST */}
      {phase === 'test' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Time', value: `${Math.floor(elapsed)}s`, icon: Timer },
              { label: 'WPM', value: stats.wpm, icon: Gauge },
              { label: 'Accuracy', value: `${stats.accuracy}%`, icon: Target },
              { label: 'Errors', value: stats.errors, icon: XCircle },
            ].map((s) => (
              <Card key={s.label} className="p-3 text-center">
                <s.icon className="mx-auto h-4 w-4 text-slate-400" />
                <p className="mt-1 text-lg font-bold text-slate-800">{s.value}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{s.label}</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              title="Type the passage below"
              subtitle={
                started
                  ? 'Timer running — the test ends automatically at the last character'
                  : 'Start typing to begin the timer'
              }
              icon={Keyboard}
              action={<Badge tone={started ? 'success' : 'neutral'}>{started ? 'In progress' : 'Ready'}</Badge>}
            />
            <CardBody className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 font-mono text-sm leading-relaxed">
                {passage.split('').map((char, i) => {
                  let cls = 'text-slate-400'
                  if (i < typed.length) cls = typed[i] === char ? 'text-emerald-600' : 'bg-red-100 text-red-600'
                  else if (i === typed.length) cls = 'border-l-2 border-brand-500 text-slate-700'
                  return (
                    <span key={i} className={cls}>
                      {char}
                    </span>
                  )
                })}
              </div>
              <textarea
                ref={inputRef}
                value={typed}
                onChange={handleChange}
                onPaste={(e) => e.preventDefault()}
                placeholder="Click here and start typing…"
                rows={5}
                spellCheck={false}
                autoComplete="off"
                className="input-base font-mono"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  {typed.length}/{passage.length} characters · {stats.typedWords}/{stats.totalWords} words
                </span>
                <Button variant="secondary" icon={RotateCcw} onClick={cancelTest}>
                  Cancel
                </Button>
              </div>
              {typed.length >= passage.length && !isPassageComplete(passage, typed) && (
                <p className="text-xs font-medium text-red-600">
                  The last character is not correct yet — fix it to finish the test.
                </p>
              )}
              <ProgressBar value={(typed.length / passage.length) * 100} showLabel />
            </CardBody>
          </Card>
        </div>
      )}

      {/* RESULT */}
      {phase === 'result' && result && (
        <Card className="overflow-hidden">
          <div
            className={cn(
              'p-6 text-center text-white sm:p-8',
              result.passed ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-red-500 to-rose-600',
            )}
          >
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              {result.passed ? <Trophy className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
            </span>
            <h1 className="mt-4 text-2xl font-bold">{result.passed ? 'You Passed!' : 'Test Failed'}</h1>
            <p className="mt-1 text-sm text-white/85">Typing Test Score: {result.score}%</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'WPM (net)', value: result.wpm },
                { label: 'Raw WPM', value: result.rawWpm ?? result.wpm },
                { label: 'Accuracy', value: `${result.accuracy}%` },
                { label: 'Score', value: `${result.score}%` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-white/15 p-3">
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-[11px] text-white/75">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <CardBody className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Errors', value: result.errors },
                { label: 'Correct Words', value: result.correctWords },
                { label: 'Incorrect Words', value: result.incorrectWords },
                { label: 'Duration', value: formatDuration(result.durationSeconds ?? result.duration * 60) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-800">{s.value}</p>
                  <p className="text-[11px] text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
            <div
              className={cn(
                'flex items-center justify-between rounded-lg p-4',
                result.passed ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800',
              )}
            >
              <span className="text-sm font-medium">{result.remarks}</span>
              <StatusBadge status={result.passed ? 'Passed' : 'Failed'} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {access.canStart ? (
                <Button icon={Keyboard} onClick={() => startTest(true)}>
                  Start Approved Retake
                </Button>
              ) : access.canRequest ? (
                <Button icon={Send} onClick={requestRetake}>
                  Request Retake
                </Button>
              ) : access.pendingRequest ? (
                <Button variant="secondary" icon={Hourglass} disabled>
                  Retake request pending
                </Button>
              ) : (
                <Button variant="secondary" icon={ClipboardCheck} disabled>
                  Submitted — awaiting trainer evaluation
                </Button>
              )}
              <span className="flex items-center gap-2 text-xs text-slate-400">
                <TrendingUp className="h-3.5 w-3.5" /> One attempt per test — your trainer reviews this result.
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader title="My Typing Test History" icon={Keyboard} />
        <DataTable
          columns={columns}
          data={history}
          pageSize={5}
          emptyState={<EmptyState icon={Keyboard} title="No typing tests yet" description="Take your first typing test above." />}
        />
      </Card>
    </div>
  )
}

export default TypingTest
