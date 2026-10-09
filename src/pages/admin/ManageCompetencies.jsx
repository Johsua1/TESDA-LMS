import { useState } from 'react'
import { Layers, ChevronDown, BookOpen, ClipboardList, FileText, Award, Target } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { programLessons } from '../../data/programs'
import { PageHeader, Card, CardBody, CardHeader, Badge, StatCard, Select, EmptyState, ProgressBar } from '../../components/ui'
import { cn } from '../../lib/utils'

export function ManageCompetencies() {
  const { db } = useApp()
  const [programFilter, setProgramFilter] = useState('all')
  const [open, setOpen] = useState({})

  const programs = programFilter === 'all' ? db.programs : db.programs.filter((p) => p.id === programFilter)

  const totalCompetencies = db.programs.reduce((s, p) => s + p.competencies.length, 0)
  const totalLessons = db.programs.reduce((s, p) => s + programLessons(p.id).length, 0)
  const totalQuizzes = db.programs.reduce((s, p) => s + p.quizzes.length, 0)

  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }))

  return (
    <div>
      <PageHeader
        title="Competencies"
        description="Review the TESDA competency structure — Basic, Common and Core — for each training program."
        action={
          <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-56">
            <option value="all">All programs</option>
            {db.programs.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Competency Groups" value={totalCompetencies} icon={Layers} tone="brand" />
        <StatCard label="Total Lessons" value={totalLessons} icon={FileText} tone="purple" />
        <StatCard label="Total Quizzes" value={totalQuizzes} icon={ClipboardList} tone="success" />
      </div>

      <div className="space-y-6">
        {programs.map((p) => (
          <Card key={p.id}>
            <CardHeader
              title={p.title}
              subtitle={`${p.code} · ${p.competencies.length} competency groups`}
              icon={BookOpen}
              action={<Badge tone="brand">{programLessons(p.id).length} lessons</Badge>}
            />
            <CardBody className="space-y-3">
              {p.competencies.map((comp) => {
                const units = comp.units || [{ id: comp.id, title: comp.title, description: comp.description, lessons: comp.lessons }]
                const lessonCount = units.reduce((s, u) => s + u.lessons.length, 0)
                const key = `${p.id}-${comp.id}`
                return (
                  <div key={comp.id} className="overflow-hidden rounded-xl border border-slate-100">
                    <button onClick={() => toggle(key)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-brand-50">
                      <span
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl',
                          comp.type === 'Core' ? 'bg-violet-50 text-violet-600' : comp.type === 'Common' ? 'bg-sky-50 text-sky-600' : 'bg-brand-50 text-brand-600',
                        )}
                      >
                        <Target className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={comp.type === 'Core' ? 'purple' : comp.type === 'Common' ? 'info' : 'brand'}>{comp.type} Competency</Badge>
                          <span className="text-xs text-slate-400">{lessonCount} lessons</span>
                          {comp.type === 'Core' && <span className="text-xs text-slate-400">· {units.length} units</span>}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{comp.description}</p>
                      </div>
                      <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', open[key] && 'rotate-180')} />
                    </button>
                    {open[key] && (
                      <div className="animate-fade-in border-t border-slate-100">
                        {units.map((unit) => (
                          <div key={unit.id} className="border-b border-slate-50 last:border-0">
                            {comp.type === 'Core' && (
                              <div className="bg-white/70 px-4 py-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{unit.title}</p>
                                {unit.description && <p className="text-xs text-slate-400">{unit.description}</p>}
                              </div>
                            )}
                            <ul className="divide-y divide-slate-50">
                              {unit.lessons.map((l, i) => {
                                const quiz = p.quizzes.find((q) => q.id === l.quizId)
                                return (
                                  <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-50 text-[11px] font-semibold text-slate-500">
                                      {i + 1}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-sm text-slate-500">{l.title}</span>
                                    <span className="shrink-0 text-xs text-slate-400">{l.duration} min</span>
                                    {quiz && (
                                      <Badge tone="violet" className="shrink-0">
                                        <ClipboardList className="h-3 w-3" /> Quiz
                                      </Badge>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        ))}
                        <div className="flex items-center justify-between bg-white/70 px-4 py-2.5">
                          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Award className="h-3.5 w-3.5" /> Assessment
                          </span>
                          <Badge tone="neutral">{lessonCount} lessons to complete</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardBody>
          </Card>
        ))}
        {!programs.length && (
          <Card>
            <EmptyState icon={Layers} title="No programs" />
          </Card>
        )}
      </div>
    </div>
  )
}

export default ManageCompetencies
