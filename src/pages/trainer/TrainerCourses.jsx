import { Link } from 'react-router-dom'
import { BookOpen, Users, ClipboardList, FileCheck2, ArrowRight, TrendingUp } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerPrograms, trainerEnrollments, courseProgress } from '../../store/selectors'
import { programLessonCount, programQuizCount } from '../../data/programs'
import { PageHeader, Card, CardBody, ProgressBar, Button, Badge, EmptyState } from '../../components/ui'
import { average, cn, formatDate } from '../../lib/utils'

export function TrainerCourses() {
  const { db, user } = useApp()
  const programs = trainerPrograms(db, user.id)

  return (
    <div>
      <PageHeader
        title="My Courses"
        description="Programs assigned to you. Manage lessons, assessments, schedules and your trainees."
      />

      {programs.length ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {programs.map((p) => {
            const enrs = trainerEnrollments(db, user.id, p.id)
            const active = enrs.filter((e) => ['Enrolled', 'Approved'].includes(e.status))
            const avg = active.length ? Math.round(average(active.map((e) => courseProgress(e, p.id).percent))) : 0
            const completed = enrs.filter((e) => e.status === 'Completed').length
            return (
              <Card key={p.id} hover className="overflow-hidden">
                <div className={cn('relative h-32 bg-gradient-to-br', p.color)}>
                  <div className="absolute inset-0 flex items-start justify-between p-4 text-white">
                    <span className="text-4xl">{p.emoji}</span>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className="bg-white/20 text-white ring-white/30">{p.level}</Badge>
                      <Badge className="bg-white/20 text-white ring-white/30">{p.code}</Badge>
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-lg font-bold text-white drop-shadow">{p.title}</h3>
                  </div>
                </div>
                <CardBody className="space-y-4">
                  <p className="line-clamp-2 text-sm text-slate-500">{p.description}</p>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Trainees', value: active.length, icon: Users },
                      { label: 'Lessons', value: programLessonCount(p.id), icon: BookOpen },
                      { label: 'Quizzes', value: programQuizCount(p.id), icon: ClipboardList },
                      { label: 'Exams', value: p.exams.length, icon: FileCheck2 },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg bg-slate-50 p-2.5 text-center">
                        <s.icon className="mx-auto h-3.5 w-3.5 text-slate-400" />
                        <p className="mt-1 text-base font-bold text-slate-800">{s.value}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-500">Average class progress</span>
                      <span className="font-semibold text-slate-700">{avg}%</span>
                    </div>
                    <ProgressBar value={avg} />
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span>{completed} completed · {enrs.length} total enrolled</span>
                    <span>Exam: {formatDate(p.exams[0]?.date)}</span>
                  </div>

                  <Link to={`/trainer/courses/${p.id}`}>
                    <Button className="w-full" iconRight={ArrowRight}>
                      Manage Course
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState icon={BookOpen} title="No assigned courses" description="Contact the administrator to assign programs to your account." />
        </Card>
      )}
    </div>
  )
}

export default TrainerCourses
