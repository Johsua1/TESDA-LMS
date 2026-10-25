import { Link } from 'react-router-dom'
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  CalendarDays,
  TrendingUp,
  ArrowRight,
  Megaphone,
  Award,
  Video,
  Clock,
  GraduationCap,
  Target,
  CreditCard,
  Pin,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import {
  activeEnrollmentsOf,
  courseProgress,
  attendanceStats,
  upcomingSessions,
  traineeQuizAttempts,
  overallProgress,
  announcementsFor,
  nextScheduleFor,
  outstandingPayments,
} from '../../store/selectors'
import { programById, publishedLessonCount, publishedLessons } from '../../data/programs'
import {
  Card,
  CardBody,
  CardHeader,
  StatCard,
  ProgressBar,
  Badge,
  Button,
  EmptyState,
  SectionTitle,
  Avatar,
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ScheduleCard } from '../../components/cards/Cards'
import { CourseIcon } from '../../components/courses/CourseIcon'
import { formatDate, formatTime, relativeDay, currency, cn, toExternalUrl, scheduleStatus } from '../../lib/utils'
import { ATTEMPT_MINUTES } from '../../lib/quizTimer'
import { useNow } from '../../lib/useNow'
import { traineeQuizRequests } from '../../lib/quizAccess'

// Announcement priority drives the badge tone, the accent rail on the featured
// card and the icon chip in the compact list — one source of truth.
const priorityMeta = {
  high: { tone: 'danger', label: 'High priority', accent: 'bg-rose-400' },
  normal: { tone: 'info', label: 'Announcement', accent: 'bg-brand-500' },
  low: { tone: 'neutral', label: 'Low priority', accent: 'bg-slate-300' },
}
const priorityOf = (announcement) => priorityMeta[announcement?.priority] || priorityMeta.normal

export function TraineeDashboard() {
  const { db, user, settings } = useApp()
  const now = useNow()
  const enrollments = activeEnrollmentsOf(db, user.id)
  const primary = enrollments[0]
  const primaryProgram = primary ? programById(primary.programId) : null
  const progress = primary ? courseProgress(primary, primary.programId) : { percent: 0, completed: 0, total: 0 }
  const att = attendanceStats(db, user.id)
  const programIds = enrollments.map((e) => e.programId)
  const upcoming = upcomingSessions(db, programIds, 3)
  const nextClass = upcoming[0]
  const scores = traineeQuizAttempts(db, user.id).slice(0, 4)
  const announcements = announcementsFor(db, user).slice(0, 3)
  // When nothing is scheduled, the left column would collapse to a single
  // empty card. Surface the next unpublished-by-progress lesson instead so the
  // space does something useful.
  const nextLessons = enrollments
    .map((e) => {
      const program = programById(e.programId)
      const lessons = publishedLessons(e.programId)
      const lesson = lessons.find((l) => !(e.progress || {})[l.id]) || null
      return { enrollment: e, program, lesson, percent: courseProgress(e, e.programId).percent }
    })
    .filter((x) => x.program)

  const overall = overallProgress(db, user.id)
  const duePayments = outstandingPayments(db, user.id)
  const quizNotices = traineeQuizRequests(db, user.id).slice(0, 4)
  const paymentDue = duePayments.reduce((sum, e) => sum + (Number(e.payment?.balance) || 0), 0)

  // next quiz to take (unattempted or not yet passed)
  let nextQuiz = null
  let nextQuizProgram = null
  for (const enr of enrollments) {
    const program = programById(enr.programId)
    const attempts = traineeQuizAttempts(db, user.id, enr.programId)
    const passedIds = new Set(attempts.filter((a) => a.passed).map((a) => a.quizId))
    const candidate = program?.quizzes.filter((q) => q.published !== false).find((q) => !passedIds.has(q.id))
    if (candidate) {
      nextQuiz = candidate
      nextQuizProgram = program
      break
    }
  }

  // Unpublished lessons are invisible to the trainee, so they are excluded
  // from both sides of the "x of y lessons" figure.
  const completedLessons = enrollments.reduce((sum, e) => {
    const visible = new Set(publishedLessons(e.programId).map((l) => l.id))
    return sum + Object.keys(e.progress || {}).filter((id) => visible.has(id)).length
  }, 0)
  const totalLessons = enrollments.reduce((sum, e) => sum + publishedLessonCount(e.programId), 0)

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-tesda-blue via-brand-700 to-brand-900 p-6 text-white sm:p-8">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 20%, rgba(246,192,0,0.5) 0, transparent 45%), radial-gradient(circle at 10% 90%, rgba(255,255,255,0.3) 0, transparent 40%)',
          }}
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <Badge className="bg-white/15 text-white ring-white/20">Trainee Dashboard</Badge>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Welcome back, {user.name.split(' ')[0]}! 👋</h1>
            <p className="mt-2 text-sm text-white/80">
              {primaryProgram
                ? `You are currently enrolled in ${primaryProgram.title}. Keep going — you're ${progress.percent}% complete.`
                : 'You have no active enrollment yet. Browse available programs to get started.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/trainee/courses">
                <Button variant="secondary" className="bg-white/95 hover:bg-white" icon={BookOpen}>
                  My Courses
                </Button>
              </Link>
              {nextClass?.meetingLink && (
                <a href={toExternalUrl(nextClass.meetingLink)} target="_blank" rel="noreferrer">
                  <Button variant="ghost" className="text-white hover:bg-white/10" icon={Video}>
                    Join next class
                  </Button>
                </a>
              )}
            </div>
          </div>

          {primaryProgram && (
            <div className="w-full max-w-xs rounded-xl bg-white/10 p-5 backdrop-blur-sm ring-1 ring-white/20">
              <div className="flex items-center gap-3">
                <CourseIcon program={primaryProgram} className="h-8 w-8" />
                <div className="min-w-0">
                  <p className="text-xs text-white/70">{primaryProgram.code}</p>
                  <p className="truncate text-sm font-semibold">{primaryProgram.title}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-white/80">
                <span>Course Progress</span>
                <span className="font-bold text-white">{progress.percent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-tesda-yellow transition-all duration-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-white/60">
                {progress.completed} of {progress.total} lessons completed
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Outstanding balance nudge */}
      {paymentDue > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-900">You have an outstanding balance</p>
                <p className="text-xs text-amber-700">
                  {currency(paymentDue)} due across {duePayments.length} program{duePayments.length > 1 ? 's' : ''}. Settle
                  it to keep your enrollment in good standing.
                </p>
              </div>
            </div>
            <Link to="/trainee/payments" className="shrink-0">
              <Button size="sm" icon={CreditCard}>
                Pay Now
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My Course"
          value={primaryProgram ? primaryProgram.title.split(' ')[0] : '—'}
          hint={primaryProgram ? `${progress.percent}% complete` : 'No active course'}
          icon={BookOpen}
          tone="brand"
        />
        <StatCard
          label="Attendance"
          value={`${att.rate}%`}
          hint={`${att.present} present · ${att.late} late · ${att.absent} absent`}
          icon={CalendarCheck}
          tone={att.rate >= (settings.attendanceRequirement || 80) ? 'success' : 'warning'}
        />
        <StatCard
          label="Lessons Completed"
          value={`${completedLessons}/${totalLessons}`}
          hint={`Overall progress ${overall}%`}
          icon={TrendingUp}
          tone="purple"
        />
        <StatCard
          label="Enrollments"
          value={enrollments.length}
          hint={`${db.enrollments.filter((e) => e.traineeId === user.id).length} total applications`}
          icon={GraduationCap}
          tone="info"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Upcoming class + quiz highlight */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader title="Next Class" icon={CalendarDays} />
              <CardBody className="pt-4">
                {nextClass ? (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{nextClass.lessonTitle || nextClass.unitTitle}</p>
                      <StatusBadge status={scheduleStatus(nextClass, now)} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{programById(nextClass.programId)?.title}</p>
                    <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                      <p className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-brand-500" />
                        {relativeDay(nextClass.date)} · {formatTime(nextClass.startTime)}
                      </p>
                      <p className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-brand-500" />
                        {nextClass.classType} · {nextClass.room}
                      </p>
                    </div>
                    {nextClass.meetingLink && (
                      <a href={toExternalUrl(nextClass.meetingLink)} target="_blank" rel="noreferrer" className="mt-4 block">
                        <Button size="sm" variant="success" icon={Video} className="w-full">
                          Join Class
                        </Button>
                      </a>
                    )}
                  </>
                ) : (
                  <EmptyState icon={CalendarDays} title="No upcoming class" />
                )}
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="Upcoming Quiz" icon={ClipboardList} />
              <CardBody className="pt-4">
                {nextQuiz ? (
                  <>
                    <p className="text-sm font-semibold text-slate-800">{nextQuiz.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{nextQuizProgram?.title}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{nextQuiz.questions.length} items</span>
                      <span>{ATTEMPT_MINUTES.quiz} min</span>
                      <span>{nextQuiz.passing}% to pass</span>
                    </div>
                    <Link to={`/trainee/courses/${nextQuizProgram.id}`} className="mt-4 block">
                      <Button size="sm" className="w-full" icon={ArrowRight}>
                        Go to course
                      </Button>
                    </Link>
                  </>
                ) : (
                  <EmptyState icon={ClipboardList} title="All quizzes completed" description="Great work!" />
                )}
              </CardBody>
            </Card>
          </div>

          {/* Upcoming schedule list — or, when nothing is scheduled, the next
              lesson to work on. One block either way, so the column never
              collapses into empty space. */}
          {upcoming.length ? (
            <div>
              <SectionTitle
                action={
                  <Link to="/trainee/schedules" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    View all
                  </Link>
                }
              >
                Class Schedule
              </SectionTitle>
              <div className="space-y-3">
                {upcoming.map((s) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    trainer={db.users.find((u) => u.id === s.trainerId)}
                    program={programById(s.programId)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardHeader
                title="Continue Learning"
                icon={BookOpen}
                action={
                  <Link to="/trainee/courses" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    View courses
                  </Link>
                }
              />
              <CardBody className="space-y-3 pt-4">
                {nextLessons.length ? (
                  nextLessons.map(({ enrollment, program, lesson, percent }) => (
                    <div key={enrollment.id} className="rounded-xl border border-slate-100 p-3">
                      <div className="flex items-center gap-3">
                        <CourseIcon program={program} tone="dark" className="h-7 w-7 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-700">{program.title}</p>
                          <p className="text-[11px] text-slate-400">{percent}% complete</p>
                        </div>
                        <Link to={`/trainee/courses/${program.id}`} className="shrink-0">
                          <Button size="sm" variant="secondary" iconRight={ArrowRight}>
                            Resume
                          </Button>
                        </Link>
                      </div>
                      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                        <span className="truncate">
                          {lesson ? lesson.title : 'All lessons completed — review any lesson'}
                        </span>
                      </p>
                      <ProgressBar value={percent} className="mt-2" size="sm" />
                    </div>
                  ))
                ) : (
                  <EmptyState icon={BookOpen} title="No active course" description="Enroll in a program to start learning." />
                )}
              </CardBody>
            </Card>
          )}

          {/* Announcements — inside the left column, right under the schedule /
              continue-learning block, so the page never ends in a separate band
              below two columns of very different heights. */}
          <div>
            <SectionTitle
              action={
                <Link to="/trainee/announcements" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  View all
                </Link>
              }
            >
              Announcements
            </SectionTitle>

            {announcements.length ? (
              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
                {announcements.map((a) => {
                  const meta = priorityOf(a)
                  const author = db.users.find((u) => u.id === a.authorId)
                  return (
                    <Card key={a.id} className="relative overflow-hidden">
                      <span className={cn('absolute inset-y-0 left-0 w-1', meta.accent)} aria-hidden="true" />
                      <div className="p-4 pl-5">
                        <div className="flex items-center gap-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          {a.pinned && (
                            <Badge tone="warning">
                              <Pin className="h-3 w-3" /> Pinned
                            </Badge>
                          )}
                          <span className="ml-auto whitespace-nowrap text-[11px] text-slate-400">
                            {formatDate(a.date)}
                          </span>
                        </div>
                        <h3 className="mt-2.5 line-clamp-2 text-sm font-bold leading-snug text-slate-800">{a.title}</h3>
                        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{a.body}</p>
                        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
                          <Avatar name={author?.name || 'Administration'} color={author?.avatarColor} size="sm" />
                          <p className="truncate text-[11px] text-slate-500">{author?.name || 'Administration'}</p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card>
                <EmptyState
                  icon={Megaphone}
                  title="No announcements yet"
                  description="Notices from your trainer and administrator will appear here."
                />
              </Card>
            )}
          </div>
        </div>

        {/* right column */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Latest Scores" icon={Award} />
            <CardBody className="space-y-3 pt-4">
              {scores.length ? (
                scores.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{s.quizTitle}</p>
                      <p className="text-xs text-slate-400">{formatDate(s.date)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cn('text-sm font-bold', s.passed ? 'text-emerald-600' : 'text-red-600')}>
                        {s.percentage}%
                      </span>
                      <StatusBadge status={s.passed ? 'Passed' : 'Failed'} dot={false} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-slate-400">No scores yet</p>
              )}
              <Link to="/trainee/grades" className="block pt-1">
                <Button size="sm" variant="secondary" className="w-full" iconRight={ArrowRight}>
                  View all grades
                </Button>
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="My Enrollments" icon={GraduationCap} />
            <CardBody className="space-y-3 pt-4">
              {enrollments.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{programById(e.programId)?.title}</p>
                    <p className="text-xs text-slate-400 capitalize">{e.type === 'scholarship' ? 'Scholarship / Voucher' : 'Self-Pay'}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
              ))}
              {!enrollments.length && <p className="py-4 text-center text-sm text-slate-400">No active enrollment</p>}
            </CardBody>
          </Card>

          {quizNotices.length > 0 && (
            <Card>
              <CardHeader title="Quiz Access Requests" icon={ClipboardList} />
              <CardBody className="space-y-3 pt-4">
                {quizNotices.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-700">{r.quizTitle}</p>
                        <p className="text-[11px] text-slate-400">
                          {r.type === 'late' ? 'Late access' : 'Retake'} ·{' '}
                          {formatDate(r.decidedAt || r.requestedAt)}
                        </p>
                      </div>
                      <Badge tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}>
                        {r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : 'Pending'}
                      </Badge>
                    </div>
                    {r.note && <p className="mt-1 text-xs text-slate-500">Trainer note: {r.note}</p>}
                    <p className="mt-1 text-[11px] text-slate-500">
                      {r.status === 'approved'
                        ? 'Approved — open the quiz to take your extra attempt.'
                        : r.status === 'rejected'
                          ? 'Rejected — the quiz stays locked.'
                          : 'Waiting for your trainer’s decision.'}
                    </p>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

    </div>
  )
}

export default TraineeDashboard
