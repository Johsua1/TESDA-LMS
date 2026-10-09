import { useMemo, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  CalendarDays,
  User,
  ChevronDown,
  CheckCircle2,
  Circle,
  PlayCircle,
  ClipboardList,
  FileText,
  Award,
  Layers,
  Lock,
  TrendingUp,
  Timer,
  Video,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import {
  enrollmentOf,
  courseProgress,
  traineeQuizAttempts,
  traineeExamAttempts,
  nextScheduleFor,
  programById,
  hasCourseAccess,
  enrollmentTrainerId,
} from '../../store/selectors'
import { programLessonCount, programQuizCount } from '../../data/programs'
import { Card, CardBody, CardHeader, Badge, Button, ProgressBar, Tabs, EmptyState } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { cn, formatDate, formatTime, relativeDay } from '../../lib/utils'

function CompetencyAccordion({ competency, programId, progress, quizzes, attempts, open, onToggle }) {
  const isCore = competency.type === 'Core'
  const units = competency.units || [{ id: competency.id, title: competency.title, description: competency.description, lessons: competency.lessons }]
  const allLessons = units.flatMap((u) => u.lessons)
  const done = allLessons.filter((l) => progress[l.id]).length
  const percent = allLessons.length ? Math.round((done / allLessons.length) * 100) : 0

  const toneMap = { Basic: 'brand', Common: 'info', Core: 'purple' }

  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-brand-50"
        aria-expanded={open}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-slate-500">
          <Layers className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge tone={toneMap[competency.type]}>{competency.type} Competency</Badge>
            <span className="text-xs text-slate-400">{allLessons.length} lessons</span>
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-slate-800">
            {isCore ? 'Core skills for this program' : competency.title}
          </h3>
          <div className="mt-2 max-w-md">
            <ProgressBar value={percent} size="sm" showLabel />
          </div>
        </div>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="animate-fade-in border-t border-slate-100">
          {units.map((unit) => (
            <div key={unit.id} className="border-b border-slate-50 last:border-0">
              {isCore && (
                <div className="bg-white/70 px-5 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{unit.title}</p>
                  {unit.description && <p className="mt-0.5 text-xs text-slate-400">{unit.description}</p>}
                </div>
              )}
              <ul className="divide-y divide-slate-50">
                {unit.lessons.map((lesson, li) => {
                  const complete = progress[lesson.id]
                  const quiz = quizzes.find((q) => q.id === lesson.quizId)
                  const attempt = attempts.find((a) => a.quizId === lesson.quizId)
                  return (
                    <li key={lesson.id}>
                      <div className="flex flex-col gap-3 px-5 py-3.5 transition hover:bg-brand-50 sm:flex-row sm:items-center">
                        <Link
                          to={`/trainee/courses/${programId}/lesson/${lesson.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <span
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs',
                              complete ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-slate-500',
                            )}
                          >
                            {complete ? <CheckCircle2 className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-700">
                              {isCore ? `Lesson ${li + 1} – ` : ''}
                              {lesson.title}
                            </p>
                            <p className="flex items-center gap-3 text-xs text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {lesson.duration} min
                              </span>
                              {lesson.materials?.length > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> {lesson.materials.length} files
                                </span>
                              )}
                            </p>
                          </div>
                        </Link>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {quiz && (
                            <>
                              {attempt ? (
                                <StatusBadge status={attempt.passed ? 'Passed' : 'Failed'} />
                              ) : (
                                <Badge tone="neutral">Quiz not taken</Badge>
                              )}
                              <Link to={`/trainee/courses/${programId}/quiz/${quiz.id}`}>
                                <Button size="sm" variant={attempt ? 'secondary' : 'primary'} icon={ClipboardList}>
                                  {attempt ? 'Retake' : 'Take Quiz'}
                                </Button>
                              </Link>
                            </>
                          )}
                          <Link to={`/trainee/courses/${programId}/lesson/${lesson.id}`}>
                            <Button size="sm" variant="ghost">
                              Open
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {/* Assessment row */}
          <div className="flex items-center justify-between gap-3 bg-white/70 px-5 py-3">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Award className="h-4 w-4" /> Competency Assessment
            </span>
            <Badge tone={percent === 100 ? 'success' : 'neutral'}>
              {percent === 100 ? 'Ready for assessment' : `${100 - percent}% remaining`}
            </Badge>
          </div>
        </div>
      )}
    </Card>
  )
}

export function CourseDetail() {
  const { programId } = useParams()
  const { db, user } = useApp()
  const enrollment = enrollmentOf(db, user.id, programId)
  const program = programById(programId)
  const [openComp, setOpenComp] = useState('Core')
  const [tab, setTab] = useState('overview')

  const progress = useMemo(() => courseProgress(enrollment, programId), [enrollment, programId])
  const attempts = traineeQuizAttempts(db, user.id, programId)
  const exams = traineeExamAttempts(db, user.id, programId)

  if (!program) return <Navigate to="/trainee/courses" replace />

  if (!enrollment) {
    return (
      <div className="card">
        <EmptyState
          icon={Lock}
          title="You are not enrolled in this program"
          description="Only trainees assigned to this program can access its lessons, quizzes and schedules."
          action={
            <Link to="/trainee/enrollment">
              <Button>Browse programs</Button>
            </Link>
          }
        />
      </div>
    )
  }

  // Course content is locked until the enrollment is approved.
  if (!hasCourseAccess(enrollment)) {
    const rejected = ['Rejected', 'Cancelled'].includes(enrollment.status)
    return (
      <div className="mx-auto max-w-xl">
        <div className="card">
          <EmptyState
            icon={rejected ? Lock : Clock}
            title={`Enrollment ${enrollment.status}`}
            description={
              rejected
                ? 'Your enrollment application was not approved. Please contact the administrator for details.'
                : 'Your enrollment is pending review. You will be able to open the course once the administrator approves your application.'
            }
            action={
              <div className="flex items-center gap-2">
                <Link to="/trainee/enrollment">
                  <Button variant="secondary">View Application</Button>
                </Link>
                <Link to="/trainee/courses">
                  <Button>Back to My Courses</Button>
                </Link>
              </div>
            }
          />
        </div>
      </div>
    )
  }

  const trainer = db.users.find((u) => u.id === enrollmentTrainerId(db, enrollment))
  const next = nextScheduleFor(db, programId)
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'competencies', label: 'Competencies' },
    { key: 'quizzes', label: 'Quizzes', badge: program.quizzes.length },
    { key: 'exams', label: 'Exams', badge: program.exams.length },
  ]

  return (
    <div className="space-y-6">
      <Link to="/trainee/courses" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to My Courses
      </Link>

      {/* Hero */}
      <div className={cn('relative overflow-hidden rounded-2xl p-6 text-white sm:p-8', program.color)}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{program.emoji}</span>
              <div>
                <p className="text-xs font-medium opacity-90">{program.code} · {program.level}</p>
                <h1 className="text-2xl font-bold sm:text-3xl">{program.title}</h1>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/85">{program.description}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {trainer?.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {program.duration} · {program.hours} hrs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> {programLessonCount(programId)} lessons
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> {programQuizCount(programId)} quizzes
              </span>
            </div>
          </div>
          <div className="w-full max-w-xs rounded-xl bg-white/15 p-4 backdrop-blur ring-1 ring-white/20">
            <div className="flex items-center justify-between text-xs">
              <span>Progress</span>
              <span className="font-bold">{progress.percent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-white/70">
              {progress.completed}/{progress.total} lessons · Status: {enrollment.status}
            </p>
            {next && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-white/70">
                <CalendarDays className="h-3 w-3" /> Next: {relativeDay(next.date)} {formatTime(next.startTime)}
              </p>
            )}
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Course Overview" icon={BookOpen} />
            <CardBody>
              <p className="text-sm leading-relaxed text-slate-500">{program.overview}</p>
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { label: 'Duration', value: program.duration },
                  { label: 'Training Hours', value: `${program.hours} hrs` },
                  { label: 'Level', value: program.level },
                  { label: 'Start Date', value: formatDate(enrollment.startDate) },
                  { label: 'End Date', value: formatDate(enrollment.endDate) },
                  { label: 'Trainer', value: trainer?.name },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-white p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{item.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-700">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Enrollment Details" icon={Award} />
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Status</span>
                <StatusBadge status={enrollment.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Type</span>
                <Badge tone={enrollment.type === 'scholarship' ? 'success' : 'brand'}>
                  {enrollment.type === 'scholarship' ? 'Scholarship / Voucher' : 'Self-Pay'}
                </Badge>
              </div>
              {enrollment.type === 'scholarship' && enrollment.voucher && (
                <div className="rounded-lg bg-emerald-50/60 p-3 text-xs">
                  <p className="font-semibold text-emerald-800">{enrollment.voucher.name}</p>
                  <p className="mt-0.5 text-emerald-700">Voucher No: {enrollment.voucher.number}</p>
                  <p className="text-emerald-700">Sponsor: {enrollment.voucher.sponsor}</p>
                </div>
              )}
              {enrollment.type === 'self-pay' && enrollment.payment && (
                <div className="rounded-lg bg-white p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Payment status</span>
                    <StatusBadge status={enrollment.payment.status} dot={false} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-slate-500">
                    <span>Balance</span>
                    <span className="font-semibold">₱{enrollment.payment.balance.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <Link to="/trainee/grades" className="block">
                <Button variant="secondary" className="w-full" icon={TrendingUp}>
                  View grades
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'competencies' && (
        <div className="space-y-3">
          {program.competencies.map((comp) => (
            <CompetencyAccordion
              key={comp.id}
              competency={comp}
              programId={programId}
              progress={enrollment.progress || {}}
              quizzes={program.quizzes}
              attempts={attempts}
              open={openComp === comp.type}
              onToggle={() => setOpenComp(openComp === comp.type ? null : comp.type)}
            />
          ))}
        </div>
      )}

      {tab === 'quizzes' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {program.quizzes.map((quiz) => {
            const quizAttempts = attempts.filter((a) => a.quizId === quiz.id)
            const best = quizAttempts.sort((a, b) => b.percentage - a.percentage)[0]
            return (
              <Card key={quiz.id} className="flex flex-col p-4" hover>
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  {best ? <StatusBadge status={best.passed ? 'Passed' : 'Failed'} /> : <Badge tone="neutral">Not taken</Badge>}
                </div>
                <h4 className="mt-3 text-sm font-semibold text-slate-800">{quiz.title}</h4>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <ClipboardList className="h-3 w-3" /> {quiz.questions.length} items
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3 w-3" /> {quiz.timeLimit} min
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Award className="h-3 w-3" /> {quiz.passing}%
                  </span>
                </div>
                {best && (
                  <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-500">
                    Best: <strong>{best.score}/{best.total}</strong> ({best.percentage}%)
                  </p>
                )}
                <Link to={`/trainee/courses/${programId}/quiz/${quiz.id}`} className="mt-4 block">
                  <Button size="sm" className="w-full" variant={best ? 'secondary' : 'primary'}>
                    {best ? 'Retake Quiz' : 'Start Quiz'}
                  </Button>
                </Link>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'exams' && (
        <div className="space-y-4">
          {program.exams.map((exam) => {
            const attempt = exams.find((e) => e.examId === exam.id)
            return (
              <Card key={exam.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warm-50 text-warm-600">
                      <Award className="h-5 w-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{exam.title}</h4>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>{exam.competency}</span>
                        <span>{exam.questionCount} items</span>
                        <span>{exam.timeLimit} min</span>
                        <span>{exam.passing}% to pass</span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> {formatDate(exam.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {attempt ? (
                      <>
                        <div className="text-right">
                          <p className={cn('text-lg font-bold', attempt.passed ? 'text-emerald-600' : 'text-red-600')}>
                            {attempt.percentage}%
                          </p>
                          <p className="text-xs text-slate-400">
                            {attempt.score}/{attempt.total}
                          </p>
                        </div>
                        <StatusBadge status={attempt.passed ? 'Passed' : 'Failed'} />
                      </>
                    ) : (
                      <>
                        <StatusBadge status={exam.status} />
                        <Link to={`/trainee/courses/${programId}/exam/${exam.id}`}>
                          <Button size="sm" icon={Video}>
                            Take Exam
                          </Button>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CourseDetail
