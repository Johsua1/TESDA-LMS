import { Link } from 'react-router-dom'
import { BookOpen, ClipboardList, User, CalendarDays, Clock, ArrowRight, Lock } from 'lucide-react'
import { Card, ProgressBar, Badge } from '../ui'
import { StatusBadge } from '../ui/StatusBadge'
import { cn, formatDate, relativeDay, formatTime } from '../../lib/utils'
import { programLessonCount, programQuizCount } from '../../data/programs'

export function CourseCard({ program, enrollment, trainer, nextSchedule, progress, basePath, className, locked = false }) {
  const lessons = programLessonCount(program.id)
  const quizzes = programQuizCount(program.id)
  const percent = progress ?? 0
  const link = !locked && basePath ? `${basePath}/${program.id}` : undefined

  const inner = (
    <Card hover className={cn('group flex h-full flex-col overflow-hidden', className)}>
      <div className="relative h-36 overflow-hidden bg-slate-100">
        <img
          src={program.image}
          alt={program.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <div className={cn('absolute inset-0 bg-gradient-to-t opacity-80', program.color)} />
        <div className="absolute inset-0 flex items-start justify-between p-4">
          <span className="text-3xl drop-shadow" aria-hidden="true">
            {program.emoji}
          </span>
          <div className="flex flex-col items-end gap-1.5">
            {program.special && <Badge tone="purple">Special</Badge>}
            {enrollment && <StatusBadge status={enrollment.status} />}
          </div>
        </div>
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <p className="text-xs font-medium opacity-90">{program.code}</p>
          <h3 className="text-base font-bold leading-tight drop-shadow-sm">{program.title}</h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {trainer?.name || '—'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            {lessons} lessons
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            {quizzes} quizzes
          </span>
        </div>

        <div className="mt-auto space-y-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500">Progress</span>
              <span className="font-semibold text-slate-700">{percent}%</span>
            </div>
            <ProgressBar value={percent} />
          </div>

          {nextSchedule ? (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-brand-500" />
              <span className="truncate">
                Next: {relativeDay(nextSchedule.date)} · {formatTime(nextSchedule.startTime)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              No upcoming schedule
            </div>
          )}

          {locked ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600">
              <Lock className="h-4 w-4" /> Awaiting approval
            </span>
          ) : (
            link && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition group-hover:gap-2">
                Open course <ArrowRight className="h-4 w-4" />
              </span>
            )
          )}
        </div>
      </div>
    </Card>
  )

  return link ? (
    <Link to={link} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  )
}

export default CourseCard
