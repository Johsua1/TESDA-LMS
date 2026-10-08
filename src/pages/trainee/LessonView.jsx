import { Link, useParams, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Play,
  FileText,
  Download,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  ListChecks,
  ClipboardList,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { enrollmentOf, programById, traineeQuizAttempts, hasCourseAccess } from '../../store/selectors'
import { programLessons } from '../../data/programs'
import { Card, CardBody, CardHeader, Button, Badge, ProgressBar } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { cn } from '../../lib/utils'

const fileIcon = { pdf: '📄', doc: '📝', xls: '📊', zip: '🗜️' }

export function LessonView() {
  const { programId, lessonId } = useParams()
  const { db, user, toggleLessonComplete, toast } = useApp()

  const program = programById(programId)
  const enrollment = enrollmentOf(db, user.id, programId)
  const lessons = programLessons(programId)
  const index = lessons.findIndex((l) => l.id === lessonId)
  const lesson = lessons[index]

  if (!program || !enrollment || !lesson) return <Navigate to="/trainee/courses" replace />
  if (!hasCourseAccess(enrollment)) return <Navigate to={`/trainee/courses/${programId}`} replace />

  const prev = lessons[index - 1]
  const next = lessons[index + 1]
  const completed = !!enrollment.progress?.[lesson.id]
  const quiz = program.quizzes.find((q) => q.id === lesson.quizId)
  const attempt = traineeQuizAttempts(db, user.id, programId).find((a) => a.quizId === lesson.quizId)
  const doneCount = Object.keys(enrollment.progress || {}).length
  const percent = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0

  const handleToggle = () => {
    toggleLessonComplete(user.id, programId, lesson.id)
    toast(completed ? 'Marked as incomplete.' : 'Lesson marked as complete!', completed ? 'info' : 'success')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/trainee/courses/${programId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> {program.title}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Lesson {index + 1} of {lessons.length}
          </span>
          <div className="w-32">
            <ProgressBar value={percent} size="sm" showLabel />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="overflow-hidden">
            {/* Video placeholder */}
            <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <div className="text-center text-white/80">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur transition hover:scale-105">
                  <Play className="h-7 w-7 translate-x-0.5" />
                </span>
                <p className="mt-3 text-sm font-medium">{lesson.video || lesson.title}</p>
                <p className="text-xs text-white/50">Video lesson placeholder · {lesson.duration} minutes</p>
              </div>
              <Badge className="absolute left-4 top-4 bg-black/40 text-white ring-white/20">{lesson.competency}</Badge>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{lesson.competency} Competency</Badge>
                {lesson.unitTitle && <Badge tone="neutral">{lesson.unitTitle}</Badge>}
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5" /> {lesson.duration} min
                </span>
              </div>
              <h1 className="mt-3 text-xl font-bold text-slate-800 sm:text-2xl">{lesson.title}</h1>
              <p className="mt-2 text-sm text-slate-500">{lesson.description}</p>

              <div className="prose prose-sm mt-5 max-w-none">
                <h3 className="text-sm font-semibold text-slate-700">Lesson Content</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{lesson.content}</p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  variant={completed ? 'secondary' : 'success'}
                  icon={completed ? Circle : CheckCircle2}
                  onClick={handleToggle}
                >
                  {completed ? 'Mark as Incomplete' : 'Mark as Complete'}
                </Button>
                {quiz && (
                  <Link to={`/trainee/courses/${programId}/quiz/${quiz.id}`}>
                    <Button variant="outline" icon={ClipboardList}>
                      {attempt ? 'Retake Quiz' : 'Take Quiz'}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </Card>

          {/* Prev / Next */}
          <div className="flex items-center justify-between gap-3">
            {prev ? (
              <Link to={`/trainee/courses/${programId}/lesson/${prev.id}`} className="min-w-0 flex-1">
                <Card hover className="flex items-center gap-3 p-3">
                  <ArrowLeft className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Previous</p>
                    <p className="truncate text-sm font-medium text-slate-700">{prev.title}</p>
                  </div>
                </Card>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
            {next ? (
              <Link to={`/trainee/courses/${programId}/lesson/${next.id}`} className="min-w-0 flex-1">
                <Card hover className="flex items-center justify-end gap-3 p-3 text-right">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Next</p>
                    <p className="truncate text-sm font-medium text-slate-700">{next.title}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Card>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Learning Materials" icon={FileText} />
            <CardBody className="space-y-2 pt-4">
              {lesson.materials?.length ? (
                lesson.materials.map((m) => (
                  <button
                    key={m.name}
                    onClick={() => toast('Material download is disabled in this demo.', 'info')}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <span className="text-xl">{fileIcon[m.type] || '📎'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-700">{m.name}</span>
                      <span className="block text-xs uppercase text-slate-400">{m.type}</span>
                    </span>
                    <Download className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                ))
              ) : (
                <p className="py-3 text-center text-sm text-slate-400">No materials for this lesson</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Course Lessons" icon={ListChecks} />
            <CardBody className="max-h-96 space-y-1 overflow-y-auto p-2">
              {lessons.map((l, i) => {
                const isCurrent = l.id === lesson.id
                const isDone = enrollment.progress?.[l.id]
                return (
                  <Link
                    key={l.id}
                    to={`/trainee/courses/${programId}/lesson/${l.id}`}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
                      isCurrent ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {i + 1}. {l.title}
                    </span>
                  </Link>
                )
              })}
            </CardBody>
          </Card>

          {quiz && (
            <Card>
              <CardHeader title="Lesson Quiz" icon={ClipboardList} />
              <CardBody className="pt-4">
                <p className="text-sm font-medium text-slate-700">{quiz.title}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{quiz.questions.length} items</span>
                  <span>{quiz.timeLimit} min</span>
                  <span>{quiz.passing}% to pass</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Status</span>
                  {attempt ? (
                    <StatusBadge status={attempt.passed ? 'Passed' : 'Failed'} />
                  ) : (
                    <Badge tone="neutral">Not taken</Badge>
                  )}
                </div>
                <Link to={`/trainee/courses/${programId}/quiz/${quiz.id}`} className="mt-4 block">
                  <Button size="sm" className="w-full">
                    {attempt ? 'Retake Quiz' : 'Start Quiz'}
                  </Button>
                </Link>
              </CardBody>
            </Card>
          )}

          <Card className="bg-brand-50/50">
            <CardBody className="flex items-start gap-3">
              <BookOpen className="h-5 w-5 shrink-0 text-brand-600" />
              <p className="text-xs leading-relaxed text-slate-600">
                Complete all lessons in a competency to unlock its assessment. Your progress updates automatically as you
                mark lessons complete.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default LessonView
