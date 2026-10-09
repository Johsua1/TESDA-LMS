import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Keyboard,
  Timer,
  Target,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  Gauge,
  AlertTriangle,
  Award,
  TrendingUp,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { traineeTypingTests, programById } from '../../store/selectors'
import { Card, CardBody, CardHeader, Button, Badge, StatCard, ProgressBar, EmptyState } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate, clamp, cn } from '../../lib/utils'

const PASSING = 40
const TARGET_WPM = 40

const PASSAGES = [
  'A virtual assistant helps business owners manage their daily tasks from a remote location. Strong communication skills and attention to detail are essential for success in this profession. You must be organized, reliable, and able to work independently while staying connected with your client through email, chat, and video calls.',
  'The quick brown fox jumps over the lazy dog while the efficient assistant schedules meetings, answers emails, and organizes files. Accuracy matters more than speed at first, but with regular practice you will develop both. Remember to maintain a comfortable posture and keep your wrists relaxed while typing.',
  'Managing a calendar requires careful planning and clear communication. A professional virtual assistant confirms appointments, sends reminders, and keeps every document organized in the cloud. Good time management allows you to handle multiple clients without sacrificing the quality of your work or your personal wellbeing.',
]

export function TypingTest() {
  const { db, user, recordTypingTest, toast, settings } = useApp()
  const history = traineeTypingTests(db, user.id)
  const vaProgram = programById('virtual-assistant')
  const enrolled = (user.enrolledPrograms || []).includes('virtual-assistant')

  const [phase, setPhase] = useState('intro') // intro | test | result
  const [passageIndex, setPassageIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [started, setStarted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)

  const passage = PASSAGES[passageIndex]

  useEffect(() => {
    if (!started || phase !== 'test') return undefined
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [started, phase])

  const stats = useMemo(() => {
    const target = passage
    let correctChars = 0
    let errors = 0
    for (let i = 0; i < typed.length; i += 1) {
      if (typed[i] === target[i]) correctChars += 1
      else errors += 1
    }
    const minutes = Math.max(elapsed / 60, 1 / 60)
    const wpm = elapsed > 0 ? Math.round(correctChars / 5 / minutes) : 0
    const accuracy = typed.length ? Math.round((correctChars / typed.length) * 100) : 100
    const targetWords = target.trim().split(/\s+/)
    const typedWords = typed.trim().split(/\s+/).filter(Boolean)
    let correctWords = 0
    let incorrectWords = 0
    typedWords.forEach((w, i) => {
      if (w === targetWords[i]) correctWords += 1
      else incorrectWords += 1
    })
    return {
      correctChars,
      errors,
      wpm,
      accuracy,
      totalWords: targetWords.length,
      correctWords,
      incorrectWords,
      typedWords: typedWords.length,
    }
  }, [typed, passage, elapsed])

  const score = clamp(Math.round((stats.wpm / TARGET_WPM) * stats.accuracy), 0, 100)
  const passed = score >= PASSING

  const handleChange = (e) => {
    const value = e.target.value.slice(0, passage.length)
    if (!started && value.length > 0) setStarted(true)
    setTyped(value)
  }

  const finish = () => {
    if (!started) {
      toast('Start typing to begin the test.', 'warning')
      return
    }
    const res = {
      traineeId: user.id,
      programId: 'virtual-assistant',
      trainerId: vaProgram?.trainerId,
      wpm: stats.wpm,
      accuracy: stats.accuracy,
      errors: stats.errors,
      totalWords: stats.totalWords,
      correctWords: stats.correctWords,
      incorrectWords: stats.incorrectWords,
      duration: Math.max(1, Math.round(elapsed / 60)),
      score,
      passed,
      date: new Date().toISOString().slice(0, 10),
      remarks: passed ? 'Meets minimum typing requirement.' : 'Needs more practice. Retake required.',
    }
    recordTypingTest(res)
    setResult(res)
    setPhase('result')
  }

  const reset = () => {
    setPhase('intro')
    setTyped('')
    setStarted(false)
    setElapsed(0)
    setResult(null)
    setPassageIndex((i) => (i + 1) % PASSAGES.length)
  }

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
        <StatCard label="Attempts" value={history.length} icon={Keyboard} tone="purple" />
      </div>

      {/* INTRO */}
      {phase === 'intro' && (
        <Card>
          <div className="bg-indigo-600 p-6 text-white sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Keyboard className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-bold sm:text-2xl">Virtual Assistant Typing Test</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              Type the passage as quickly and accurately as you can. Your words-per-minute, accuracy and errors are
              measured automatically. You need a score of at least {PASSING}% to pass.
            </p>
          </div>
          <CardBody className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { icon: Gauge, title: 'Words per Minute', desc: 'Measures your typing speed based on correctly typed characters.' },
                { icon: Target, title: 'Accuracy', desc: 'Percentage of characters typed correctly against the target passage.' },
                { icon: Award, title: 'Passing Score', desc: `Score is computed from speed and accuracy. Minimum passing is ${PASSING}%.` },
              ].map((c) => (
                <div key={c.title} className="rounded-xl border border-slate-100 bg-white/60 p-4">
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
                Score = (WPM ÷ {TARGET_WPM}) × Accuracy, capped at 100%. For example, 25 WPM at 88% accuracy gives a score
                of 55% — a passing result.
              </p>
            </div>
            <Button size="lg" className="w-full" icon={Keyboard} onClick={() => setPhase('test')}>
              Start Typing Test
            </Button>
          </CardBody>
        </Card>
      )}

      {/* TEST */}
      {phase === 'test' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Time', value: `${elapsed}s`, icon: Timer },
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
              subtitle={started ? 'Timer running — good luck!' : 'Start typing to begin the timer'}
              icon={Keyboard}
              action={<Badge tone={started ? 'success' : 'neutral'}>{started ? 'In progress' : 'Ready'}</Badge>}
            />
            <CardBody className="space-y-4">
              <div className="rounded-xl bg-white p-4 font-mono text-sm leading-relaxed">
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
                placeholder="Click here and start typing…"
                rows={5}
                spellCheck={false}
                className="input-base font-mono"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  {typed.length}/{passage.length} characters · {stats.typedWords}/{stats.totalWords} words
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" icon={RotateCcw} onClick={reset}>
                    Cancel
                  </Button>
                  <Button variant="success" icon={CheckCircle2} onClick={finish}>
                    Submit Test
                  </Button>
                </div>
              </div>
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
              result.passed ? 'bg-emerald-500' : 'bg-red-500',
            )}
          >
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              {result.passed ? <Trophy className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
            </span>
            <h1 className="mt-4 text-2xl font-bold">{result.passed ? 'You Passed!' : 'Test Failed'}</h1>
            <p className="mt-1 text-sm text-white/85">Typing Test Score: {result.score}%</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'WPM', value: result.wpm },
                { label: 'Accuracy', value: `${result.accuracy}%` },
                { label: 'Errors', value: result.errors },
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
                { label: 'Total Words', value: result.totalWords },
                { label: 'Correct Words', value: result.correctWords },
                { label: 'Incorrect Words', value: result.incorrectWords },
                { label: 'Duration', value: `${result.duration} min` },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-white p-3 text-center">
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
            <div className="flex flex-wrap gap-3">
              <Button icon={RotateCcw} onClick={reset}>
                Take Another Test
              </Button>
              <span className="flex items-center gap-2 text-xs text-slate-400">
                <TrendingUp className="h-3.5 w-3.5" /> Trainer will review your result.
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
