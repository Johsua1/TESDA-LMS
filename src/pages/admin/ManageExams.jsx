import { useMemo, useState } from 'react'
import { FileCheck2, CalendarDays, Eye, Users, TrendingUp, Award } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { PageHeader, Card, CardHeader, Badge, StatCard, Select, Modal, Button, EmptyState, ProgressBar, SearchInput } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { average, formatDate } from '../../lib/utils'

export function ManageExams() {
  const { db } = useApp()
  const [programFilter, setProgramFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const exams = useMemo(() => {
    const source = programFilter === 'all' ? db.programs : db.programs.filter((p) => p.id === programFilter)
    return source.flatMap((p) => p.exams.map((e) => ({ ...e, programTitle: p.title, programCode: p.code, programEmoji: p.emoji })))
  }, [db.programs, programFilter])

  const filtered = exams.filter((e) => !query || e.title.toLowerCase().includes(query.toLowerCase()))
  const allAttempts = db.examAttempts

  const columns = [
    {
      key: 'title',
      header: 'Exam',
      render: (r) => (
        <div className="flex items-center gap-3">
          <span className="text-lg">{r.programEmoji}</span>
          <div>
            <p className="font-medium text-slate-700">{r.title}</p>
            <p className="text-xs text-slate-400">{r.programTitle}</p>
          </div>
        </div>
      ),
    },
    { key: 'competency', header: 'Competency', render: (r) => <Badge tone="purple">{r.competency}</Badge> },
    { key: 'questionCount', header: 'Items', sortable: true },
    { key: 'timeLimit', header: 'Time', render: (r) => `${r.timeLimit} min` },
    { key: 'passing', header: 'Passing', render: (r) => `${r.passing}%` },
    { key: 'date', header: 'Exam Date', sortable: true, render: (r) => formatDate(r.date) },
    {
      key: 'passRate',
      header: 'Pass Rate',
      render: (r) => {
        const at = db.examAttempts.filter((a) => a.examId === r.id)
        const rate = at.length ? Math.round((at.filter((a) => a.passed).length / at.length) * 100) : 0
        return at.length ? (
          <div className="w-24">
            <ProgressBar value={rate} size="sm" showLabel />
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => <Button size="sm" variant="secondary" icon={Eye} onClick={() => setSelected(r)}>View</Button> },
  ]

  return (
    <div>
      <PageHeader
        title="Exams"
        description="All competency assessment exams across programs."
        action={
          <div className="flex gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search exams…" className="w-48" />
            <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-52">
              <option value="all">All programs</option>
              {db.programs.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Exams" value={exams.length} icon={FileCheck2} tone="brand" />
        <StatCard label="Attempts" value={allAttempts.length} icon={Users} tone="purple" />
        <StatCard
          label="Avg Score"
          value={`${allAttempts.length ? Math.round(average(allAttempts.map((a) => a.percentage))) : 0}%`}
          icon={TrendingUp}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader title="Exam Registry" icon={FileCheck2} />
        <DataTable columns={columns} data={filtered} pageSize={10} emptyState={<EmptyState icon={FileCheck2} title="No exams" />} />
      </Card>

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
                { label: 'Exam Date', value: formatDate(selected.date) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-base font-bold text-slate-800">{s.value}</p>
                  <p className="text-[10px] uppercase text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Exam Results</p>
              {db.examAttempts.filter((a) => a.examId === selected.id).length ? (
                <div className="space-y-2">
                  {db.examAttempts.filter((a) => a.examId === selected.id).map((a) => {
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
                <p className="py-4 text-center text-sm text-slate-400">No attempts recorded</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ManageExams
