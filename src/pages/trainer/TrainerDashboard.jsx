import { Link } from 'react-router-dom'
import {
  Users,
  BookOpen,
  CalendarDays,
  ClipboardList,
  TrendingUp,
  ArrowRight,
  Clock,
  Video,
  Award,
  CheckCircle2,
  Keyboard,
  Target,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerPrograms, trainerTrainees, trainerEnrollments, trainerTypingTests, trainerEvaluations, courseProgress, attendanceStats } from '../../store/selectors'
import { programLessonCount } from '../../data/programs'
import { Card, CardBody, CardHeader, StatCard, ProgressBar, Button, Badge, EmptyState, SectionTitle } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Avatar } from '../../components/ui'
import { ScheduleCard } from '../../components/cards/Cards'
import { formatDate, formatTime, relativeDay, average, cn } from '../../lib/utils'

export function TrainerDashboard() {
  const { db, user } = useApp()
  const programs = trainerPrograms(db, user.id)
  const programIds = programs.map((p) => p.id)
  const trainees = trainerTrainees(db, user.id)
  const typingTests = trainerTypingTests(db, user.id)
  const evaluations = trainerEvaluations(db, user.id)

  const today = new Date()
  const upcoming = db.schedules
    .filter((s) => programIds.includes(s.programId) && new Date(s.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4)

  const totalLessons = programs.reduce((sum, p) => sum + programLessonCount(p.id), 0)
  const avgProgress = trainees.length
    ? Math.round(average(trainees.flatMap((t) => t.enrollments.map((e) => courseProgress(e, e.programId).percent))))
    : 0

  // pending grading / submissions
  const recentQuizAttempts = db.quizAttempts
    .filter((a) => programIds.includes(a.programId))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-blue-900 p-6 text-white sm:p-8">
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: 'radial-gradient(circle at 85% 20%, rgba(255,255,255,0.35) 0, transparent 45%)' }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="bg-white/15 text-white ring-white/20">Trainer Dashboard</Badge>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl text-white">Good day, {user.name.split(' ')[0]}!</h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              You are handling {programs.length} program{programs.length !== 1 ? 's' : ''} with {trainees.length} trainee
              {trainees.length !== 1 ? 's' : ''}. {upcoming.length} upcoming class{upcoming.length !== 1 ? 'es' : ''} this period.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/trainer/attendance">
              <Button variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white border-none" icon={CalendarDays}>
                Record Attendance
              </Button>
            </Link>
            <Link to="/trainer/trainees">
              <Button variant="ghost" className="text-white hover:bg-white/10" icon={Users}>
                View Trainees
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My Programs" value={programs.length} icon={BookOpen} tone="brand" hint={`${totalLessons} total lessons`} />
        <StatCard label="My Trainees" value={trainees.length} icon={Users} tone="success" />
        <StatCard label="Upcoming Classes" value={upcoming.length} icon={CalendarDays} tone="warning" />
        <StatCard
          label="Avg. Trainee Progress"
          value={`${avgProgress}%`}
          icon={TrendingUp}
          tone="purple"
          trend={<ProgressBar value={avgProgress} size="sm" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* My programs */}
          <div>
            <SectionTitle action={<Link to="/trainer/courses" className="text-xs font-semibold text-blue-900 hover:text-blue-800">View all</Link>}>
              My Programs
            </SectionTitle>
            <div className="space-y-3">
              {programs.map((p) => {
                const enrs = trainerEnrollments(db, user.id, p.id).filter((e) => ['Enrolled', 'Approved'].includes(e.status))
                const avg = enrs.length ? Math.round(average(enrs.map((e) => courseProgress(e, p.id).percent))) : 0
                return (
                  <Card key={p.id} hover className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl', p.color)}>
                      {p.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">{p.title}</p>
                      <p className="text-xs text-slate-400">
                        {p.code} · {enrs.length} trainees · {programLessonCount(p.id)} lessons
                      </p>
                      <ProgressBar value={avg} className="mt-2" size="sm" showLabel />
                    </div>
                    <Link to={`/trainer/courses/${p.id}`}>
                      <Button size="sm" variant="secondary" iconRight={ArrowRight}>
                        Manage
                      </Button>
                    </Link>
                  </Card>
                )
              })}
              {!programs.length && (
                <Card>
                  <EmptyState icon={BookOpen} title="No assigned programs" />
                </Card>
              )}
            </div>
          </div>

          {/* Upcoming classes */}
          <div>
            <SectionTitle action={<Link to="/trainer/schedules" className="text-xs font-semibold text-blue-900 hover:text-blue-800">Manage schedule</Link>}>
              Upcoming Classes
            </SectionTitle>
            <div className="space-y-3">
              {upcoming.length ? (
                upcoming.map((s) => (
                  <ScheduleCard key={s.id} schedule={s} trainer={user} program={programs.find((p) => p.id === s.programId)} />
                ))
              ) : (
                <Card>
                  <EmptyState icon={CalendarDays} title="No upcoming classes" />
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Recent Submissions" icon={ClipboardList} />
            <CardBody className="space-y-3 pt-4">
              {recentQuizAttempts.length ? (
                recentQuizAttempts.map((a) => {
                  const trainee = db.users.find((u) => u.id === a.traineeId)
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <Avatar name={trainee?.name} color={trainee?.avatarColor} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700">{trainee?.name}</p>
                        <p className="truncate text-xs text-slate-400">{a.quizTitle}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-bold', a.passed ? 'text-emerald-600' : 'text-red-600')}>{a.percentage}%</p>
                        <p className="text-[11px] text-slate-400">{formatDate(a.date)}</p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="py-4 text-center text-sm text-slate-400">No recent submissions</p>
              )}
            </CardBody>
          </Card>

          {typingTests.length > 0 && (
            <Card>
              <CardHeader title="Typing Test Results" icon={Keyboard} action={<Link to="/trainer/typing-tests" className="text-xs font-semibold text-blue-900 hover:text-blue-800">View</Link>} />
              <CardBody className="space-y-3 pt-4">
                {typingTests.slice(0, 4).map((t) => {
                  const trainee = db.users.find((u) => u.id === t.traineeId)
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">{trainee?.name}</p>
                        <p className="text-xs text-slate-400">{t.wpm} WPM · {t.accuracy}% accuracy</p>
                      </div>
                      <StatusBadge status={t.passed ? 'Passed' : 'Failed'} />
                    </div>
                  )
                })}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Evaluations" icon={Target} action={<Link to="/trainer/evaluations" className="text-xs font-semibold text-blue-900 hover:text-blue-800">View</Link>} />
            <CardBody className="pt-4">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl font-bold text-amber-600">
                  {evaluations.length ? average(evaluations.map((e) => e.overall)).toFixed(1) : '—'}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Average trainee rating</p>
                  <p className="text-xs text-slate-400">{evaluations.length} evaluations submitted</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default TrainerDashboard