import { useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Users,
  ClipboardList,
  FileCheck2,
  ChevronDown,
  Clock,
  Award,
  TrendingUp,
  BarChart3,
  Layers,
  Settings2,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { programById, courseProgress, attendanceStats, courseGrade } from '../../store/selectors'
import { programLessons, programLessonCount } from '../../data/programs'
import { Card, CardBody, CardHeader, StatCard, Tabs, Badge, ProgressBar, EmptyState, Avatar, Button } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate, average, cn } from '../../lib/utils'

export function TrainerCourseDetail() {
  const { programId } = useParams()
  const { db, user } = useApp()
  const program = programById(programId)
  const [tab, setTab] = useState('overview')
  const [openComp, setOpenComp] = useState('Core')

  if (!program) return <Navigate to="/trainer/courses" replace />
  if (program.trainerId !== user.id) return <Navigate to="/trainer/courses" replace />

  const lessons = programLessons(programId)
  const enrollments = db.enrollments.filter((e) => e.programId === programId)
  const activeEnrs = enrollments.filter((e) => ['Enrolled', 'Approved'].includes(e.status))
  const avgProgress = activeEnrs.length ? Math.round(average(activeEnrs.map((e) => courseProgress(e, programId).percent))) : 0

  const traineeRows = activeEnrs.map((e) => {
    const trainee = db.users.find((u) => u.id === e.traineeId)
    return { id: e.id, trainee, enrollment: e, progress: courseProgress(e, programId), att: attendanceStats(db, e.traineeId, programId), grade: courseGrade(db, e.traineeId, programId) }
  })

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'lessons', label: 'Lessons', badge: lessons.length },
    { key: 'quizzes', label: 'Quizzes', badge: program.quizzes.length },
    { key: 'exams', label: 'Exams', badge: program.exams.length },
    { key: 'trainees', label: 'Trainees', badge: activeEnrs.length },
  ]

  const traineeCols = [
    {
      key: 'name',
      header: 'Trainee',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.trainee?.name} color={r.trainee?.avatarColor} size="sm" />
          <div>
            <p className="font-medium text-slate-700">{r.trainee?.name}</p>
            <p className="text-xs text-slate-400">{r.trainee?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      sortable: true,
      sortValue: (r) => r.progress.percent,
      render: (r) => (
        <div className="w-32">
          <ProgressBar value={r.progress.percent} size="sm" showLabel />
        </div>
      ),
    },
    {
      key: 'attendance',
      header: 'Attendance',
      sortable: true,
      sortValue: (r) => r.att.rate,
      render: (r) => <span className="font-medium text-slate-700">{r.att.rate}%</span>,
    },
    { key: 'grade', header: 'Grade', sortable: true, render: (r) => <span className="font-semibold text-slate-700">{r.grade}%</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.enrollment.status} /> },
  ]

  return (
    <div className="space-y-5">
      <Link to="/trainer/courses" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> My Courses
      </Link>

      <div className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white sm:p-8', program.color)}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-4xl">{program.emoji}</span>
              <div>
                <p className="text-xs opacity-90">{program.code} · {program.level}</p>
                <h1 className="text-2xl font-bold sm:text-3xl">{program.title}</h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-white/85">{program.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Trainees', value: activeEnrs.length },
              { label: 'Lessons', value: lessons.length },
              { label: 'Avg Progress', value: `${avgProgress}%` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/15 px-4 py-3 text-center backdrop-blur">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[11px] text-white/75">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Course Overview" icon={BookOpen} />
            <CardBody>
              <p className="text-sm leading-relaxed text-slate-600">{program.overview}</p>
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { label: 'Duration', value: program.duration },
                  { label: 'Training Hours', value: `${program.hours} hrs` },
                  { label: 'Category', value: program.category },
                  { label: 'Fee', value: `₱${program.fee.toLocaleString()}` },
                  { label: 'Exam Date', value: formatDate(program.exams[0]?.date) },
                  { label: 'Total Enrolled', value: enrollments.length },
                ].map((i) => (
                  <div key={i.label} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{i.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-700">{i.value}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Class Performance" icon={BarChart3} />
            <CardBody className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Average progress</span>
                  <span className="font-semibold text-slate-700">{avgProgress}%</span>
                </div>
                <ProgressBar value={avgProgress} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Completed</span>
                <Badge tone="info">{enrollments.filter((e) => e.status === 'Completed').length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Pending review</span>
                <Badge tone="warning">{enrollments.filter((e) => ['Pending', 'Under Review'].includes(e.status)).length}</Badge>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'lessons' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link to="/trainer/lessons">
              <Button size="sm" variant="secondary" icon={Settings2}>
                Manage lessons
              </Button>
            </Link>
          </div>
          {program.competencies.map((comp) => {
            const units = comp.units || [{ id: comp.id, title: comp.title, lessons: comp.lessons }]
            const all = units.flatMap((u) => u.lessons)
            return (
              <Card key={comp.id} className="overflow-hidden">
                <button
                  onClick={() => setOpenComp(openComp === comp.id ? null : comp.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Layers className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge tone={comp.type === 'Core' ? 'purple' : comp.type === 'Common' ? 'info' : 'brand'}>{comp.type}</Badge>
                      <span className="text-xs text-slate-400">{all.length} lessons</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{comp.description}</p>
                  </div>
                  <ChevronDown className={cn('h-5 w-5 text-slate-400 transition-transform', openComp === comp.id && 'rotate-180')} />
                </button>
                {openComp === comp.id && (
                  <div className="animate-fade-in border-t border-slate-100">
                    {units.map((unit) => (
                      <div key={unit.id} className="border-b border-slate-50 last:border-0">
                        {comp.type === 'Core' && (
                          <p className="bg-slate-50/70 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {unit.title}
                          </p>
                        )}
                        <ul className="divide-y divide-slate-50">
                          {unit.lessons.map((l, li) => {
                            const quiz = program.quizzes.find((q) => q.id === l.quizId)
                            return (
                              <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
                                  {li + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-slate-700">{l.title}</p>
                                  <p className="flex items-center gap-3 text-xs text-slate-400">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" /> {l.duration} min
                                    </span>
                                    <span>{l.materials?.length || 0} materials</span>
                                  </p>
                                </div>
                                {quiz && <Badge tone="violet">{quiz.title}</Badge>}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'quizzes' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link to="/trainer/quizzes">
              <Button size="sm" variant="secondary" icon={Settings2}>
                Manage quizzes
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {program.quizzes.map((quiz) => {
            const attempts = db.quizAttempts.filter((a) => a.quizId === quiz.id)
            const passRate = attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : 0
            const avgScore = attempts.length ? Math.round(average(attempts.map((a) => a.percentage))) : 0
            return (
              <Card key={quiz.id} className="p-4">
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <Badge tone={passRate >= 75 ? 'success' : 'warning'}>{passRate}% pass rate</Badge>
                </div>
                <h4 className="mt-3 text-sm font-semibold text-slate-800">{quiz.title}</h4>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{quiz.questions.length} items</span>
                  <span>{quiz.timeLimit} min</span>
                  <span>{quiz.passing}% to pass</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                    <p className="text-base font-bold text-slate-800">{attempts.length}</p>
                    <p className="text-[10px] uppercase text-slate-400">Attempts</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                    <p className="text-base font-bold text-slate-800">{avgScore}%</p>
                    <p className="text-[10px] uppercase text-slate-400">Avg Score</p>
                  </div>
                </div>
              </Card>
            )
          })}
          </div>
        </div>
      )}

      {tab === 'exams' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link to="/trainer/exams">
              <Button size="sm" variant="secondary" icon={Settings2}>
                Manage exams
              </Button>
            </Link>
          </div>
          {program.exams.map((exam) => {
            const attempts = db.examAttempts.filter((a) => a.examId === exam.id)
            const passRate = attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : 0
            return (
              <Card key={exam.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <FileCheck2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{exam.title}</h4>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>{exam.competency}</span>
                        <span>{exam.questionCount} items</span>
                        <span>{exam.timeLimit} min</span>
                        <span>{exam.passing}% to pass</span>
                        <span>{formatDate(exam.date)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-800">{attempts.length}</p>
                      <p className="text-[10px] uppercase text-slate-400">Attempts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-800">{passRate}%</p>
                      <p className="text-[10px] uppercase text-slate-400">Pass rate</p>
                    </div>
                    <StatusBadge status={exam.status} />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'trainees' && (
        <Card>
          <CardHeader title="Enrolled Trainees" subtitle={`${activeEnrs.length} active trainees`} icon={Users} />
          <DataTable
            columns={traineeCols}
            data={traineeRows}
            searchable
            searchKeys={['name']}
            pageSize={10}
            emptyState={<EmptyState icon={Users} title="No trainees enrolled" />}
          />
        </Card>
      )}
    </div>
  )
}

export default TrainerCourseDetail
