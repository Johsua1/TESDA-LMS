import { useState } from 'react'
import { FileCheck2, CalendarDays, Award, Users, TrendingUp, Eye } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerPrograms } from '../../store/selectors'
import { PageHeader, Card, CardBody, CardHeader, Badge, EmptyState, Select, Modal, Button, StatCard, ProgressBar } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { average, formatDate, cn } from '../../lib/utils'

export function TrainerExams() {
  const { db, user } = useApp()
  const programs = trainerPrograms(db, user.id)
  const [programFilter, setProgramFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const source = programFilter === 'all' ? programs : programs.filter((p) => p.id === programFilter)
  const exams = source.flatMap((p) => p.exams.map((e) => ({ ...e, programTitle: p.title, programEmoji: p.emoji, programColor: p.color })))

  const allAttempts = db.examAttempts.filter((a) => exams.some((e) => e.id === a.examId))
  const avgScore = allAttempts.length ? Math.round(average(allAttempts.map((a) => a.percentage))) : 0

  return (
    <div>
      <PageHeader
        title="Exams"
        description="Manage and monitor competency assessment exams."
        action={
          <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-56">
            <option value="all">All programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Exams" value={exams.length} icon={FileCheck2} tone="brand" />
        <StatCard label="Attempts" value={allAttempts.length} icon={Users} tone="purple" />
        <StatCard label="Average Score" value={`${avgScore}%`} icon={TrendingUp} tone="success" />
      </div>

      <div className="space-y-4">
        {exams.map((e) => {
          const attempts = db.examAttempts.filter((a) => a.examId === e.id)
          const passRate = attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : 0
          return (
            <Card key={e.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <span className={cn('flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-2xl', e.programColor)}>
                    {e.programEmoji}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{e.title}</h4>
                    <p className="text-xs text-slate-400">{e.programTitle}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{e.competency}</span>
                      <span>{e.questionCount} items</span>
                      <span>{e.timeLimit} min</span>
                      <span>{e.passing}% to pass</span>
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {formatDate(e.date)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="w-32">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>Pass rate</span>
                      <span className="font-semibold text-slate-700">{passRate}%</span>
                    </div>
                    <ProgressBar value={passRate} size="sm" />
                  </div>
                  <StatusBadge status={e.status} />
                  <Button size="sm" variant="secondary" icon={Eye} onClick={() => setSelected({ ...e, attempts })}>
                    View
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
        {!exams.length && (
          <Card>
            <EmptyState icon={FileCheck2} title="No exams" />
          </Card>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={selected?.programTitle}
        icon={FileCheck2}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Questions', value: selected.questionCount },
                { label: 'Time Limit', value: `${selected.timeLimit} min` },
                { label: 'Passing', value: `${selected.passing}%` },
                { label: 'Attempts', value: selected.attempts.length },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-800">{s.value}</p>
                  <p className="text-[10px] uppercase text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Exam Results</p>
              {selected.attempts.length ? (
                <div className="space-y-2">
                  {selected.attempts.map((a) => {
                    const t = db.users.find((u) => u.id === a.traineeId)
                    return (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                        <span className="text-slate-600">{t?.name}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-slate-500">{a.score}/{a.total} ({a.percentage}%)</span>
                          <StatusBadge status={a.passed ? 'Passed' : 'Failed'} dot={false} />
                          <span className="text-xs text-slate-400">{formatDate(a.date)}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-slate-400">No attempts yet</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default TrainerExams
