import { Link } from 'react-router-dom'
import {
  PlayCircle,
  FileText,
  CheckCircle2,
  Circle,
  Clock,
  ClipboardList,
  Timer,
  CalendarDays,
  MapPin,
  Video,
  Users,
  Award,
  ExternalLink,
} from 'lucide-react'
import { Card, Badge, Button } from '../ui'
import { StatusBadge } from '../ui/StatusBadge'
import { useApp } from '../../store/AppContext'
import { meetPath } from '../../config/navigation'
import { cn, formatDate, relativeDay, formatTime } from '../../lib/utils'

// ------------------------------- LessonCard ---------------------------------
export function LessonCard({ lesson, index, completed, to, competency, unitTitle }) {
  return (
    <Link to={to || '#'} className="block">
      <Card hover className="flex items-center gap-4 p-4">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            completed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500',
          )}
        >
          {completed ? <CheckCircle2 className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {typeof index === 'number' && (
              <span className="text-xs font-semibold text-slate-400">Lesson {index + 1}</span>
            )}
            {competency && <Badge tone="brand">{competency}</Badge>}
          </div>
          <h4 className="truncate text-sm font-semibold text-slate-800">{lesson.title}</h4>
          {unitTitle && <p className="truncate text-xs text-slate-400">{unitTitle}</p>}
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {lesson.duration} min
            </span>
            {lesson.materials?.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> {lesson.materials.length} materials
              </span>
            )}
          </div>
        </div>
        {completed ? (
          <Badge tone="success">Completed</Badge>
        ) : (
          <Circle className="h-4 w-4 shrink-0 text-slate-300" />
        )}
      </Card>
    </Link>
  )
}

// -------------------------------- QuizCard ----------------------------------
export function QuizCard({ quiz, bestAttempt, attempts = 0, onStart, locked = false, programId }) {
  const passed = bestAttempt?.passed
  return (
    <Card hover className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <ClipboardList className="h-5 w-5" />
        </span>
        {attempts > 0 ? (
          <StatusBadge status={passed ? 'Passed' : 'Failed'} />
        ) : (
          <Badge tone="neutral">Not taken</Badge>
        )}
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
          <Award className="h-3 w-3" /> {quiz.passing}% to pass
        </span>
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {bestAttempt ? (
          <span>
            Best score: <strong className="text-slate-800">{bestAttempt.score}/{bestAttempt.total}</strong> ({bestAttempt.percentage}%) · {attempts} attempt{attempts > 1 ? 's' : ''}
          </span>
        ) : (
          <span>No attempts yet</span>
        )}
      </div>
      <div className="mt-4">
        <Button
          size="sm"
          variant={attempts ? 'secondary' : 'primary'}
          className="w-full"
          disabled={locked}
          onClick={() => onStart?.(quiz)}
        >
          {locked ? 'Locked' : attempts ? 'Retake Quiz' : 'Start Quiz'}
        </Button>
      </div>
    </Card>
  )
}

// ------------------------------ ScheduleCard --------------------------------
const classTypeTone = { Online: 'info', 'Face-to-Face': 'success', Hybrid: 'purple' }

export function ScheduleCard({ schedule, trainer, program, className }) {
  const { user } = useApp()
  const isOnline = schedule.classType === 'Online' || schedule.classType === 'Hybrid'
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex">
        <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-slate-100 bg-slate-50 py-3">
          <span className="text-[10px] font-semibold uppercase text-slate-400">
            {formatDate(schedule.date, { month: 'short' })}
          </span>
          <span className="text-xl font-bold text-slate-800">
            {new Date(schedule.date).getDate()}
          </span>
          <span className="text-[10px] font-medium text-slate-400">
            {new Date(schedule.date).toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-slate-800">{schedule.lessonTitle || schedule.unitTitle}</h4>
              <p className="mt-0.5 text-xs text-slate-500">{program?.title}</p>
            </div>
            <Badge tone={classTypeTone[schedule.classType] || 'neutral'}>{schedule.classType}</Badge>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs text-slate-500 sm:grid-cols-2">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-brand-500" />
              {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-brand-500" />
              {schedule.room}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-brand-500" />
              {trainer?.name || '—'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-brand-500" />
              {relativeDay(schedule.date)}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <StatusBadge status={schedule.status} />
            {isOnline ? (
              <div className="flex items-center gap-2">
                {schedule.meetingLink && (
                  <a
                    href={schedule.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    title="Open mock Google Meet link"
                    className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:border-brand-300 hover:text-brand-600"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <Link to={meetPath(user?.role, schedule.id)}>
                  <Button size="sm" variant="success" icon={Video}>
                    Join Class
                  </Button>
                </Link>
              </div>
            ) : (
              <Badge tone="neutral">{schedule.status === 'Completed' ? 'Session ended' : 'On-site'}</Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------- AnnouncementCard ------------------------------
const priorityTone = { high: 'danger', normal: 'info', low: 'neutral' }

export function AnnouncementCard({ announcement, author }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={priorityTone[announcement.priority] || 'neutral'}>
            {announcement.priority === 'high' ? 'High priority' : announcement.priority === 'low' ? 'Low' : 'Announcement'}
          </Badge>
          {announcement.pinned && <Badge tone="warning">Pinned</Badge>}
        </div>
        <span className="shrink-0 text-xs text-slate-400">{formatDate(announcement.date)}</span>
      </div>
      <h4 className="mt-2 text-sm font-semibold text-slate-800">{announcement.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{announcement.body}</p>
      <p className="mt-3 text-xs text-slate-400">Posted by {author?.name || 'Administration'}</p>
    </Card>
  )
}

export default LessonCard
