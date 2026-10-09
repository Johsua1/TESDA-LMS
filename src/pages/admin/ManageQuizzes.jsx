import { useMemo, useState } from 'react'
import { ClipboardList, Clock, Award, Eye, Users, TrendingUp } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { PageHeader, Card, CardHeader, Badge, StatCard, Select, Modal, Button, EmptyState, ProgressBar, SearchInput } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { average, formatDate } from '../../lib/utils'

const typeLabel = { mcq: 'Multiple Choice', tf: 'True or False', id: 'Identification' }

export function ManageQuizzes() {
  const { db } = useApp()
  const [programFilter, setProgramFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const quizzes = useMemo(() => {
    const source = programFilter === 'all' ? db.programs : db.programs.filter((p) => p.id === programFilter)
    return source.flatMap((p) =>
      p.quizzes.map((q) => ({ ...q, programTitle: p.title, programCode: p.code, programEmoji: p.emoji })),
    )
  }, [db.programs, programFilter])

  const filtered = quizzes.filter((q) => !query || q.title.toLowerCase().includes(query.toLowerCase()))
  const allAttempts = db.quizAttempts

  const columns = [
    {
      key: 'title',
      header: 'Quiz',
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
    { key: 'questions', header: 'Questions', sortable: true, sortValue: (r) => r.questions.length, render: (r) => r.questions.length },
    { key: 'timeLimit', header: 'Time Limit', render: (r) => `${r.timeLimit} min` },
    { key: 'passing', header: 'Passing', render: (r) => `${r.passing}%` },
    {
      key: 'attempts',
      header: 'Attempts',
      sortable: true,
      sortValue: (r) => db.quizAttempts.filter((a) => a.quizId === r.id).length,
      render: (r) => db.quizAttempts.filter((a) => a.quizId === r.id).length,
    },
    {
      key: 'passRate',
      header: 'Pass Rate',
      render: (r) => {
        const at = db.quizAttempts.filter((a) => a.quizId === r.id)
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
    { key: 'actions', header: '', render: (r) => <Button size="sm" variant="secondary" icon={Eye} onClick={() => setSelected(r)}>View</Button> },
  ]

  return (
    <div>
      <PageHeader
        title="Quizzes"
        description="All quizzes across training programs with question banks and performance."
        action={
          <div className="flex gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search quizzes…" className="w-48" />
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
        <StatCard label="Total Quizzes" value={quizzes.length} icon={ClipboardList} tone="brand" />
        <StatCard label="Total Attempts" value={allAttempts.length} icon={Users} tone="purple" />
        <StatCard
          label="Avg Score"
          value={`${allAttempts.length ? Math.round(average(allAttempts.map((a) => a.percentage))) : 0}%`}
          icon={TrendingUp}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader title="Quiz Bank" icon={ClipboardList} />
        <DataTable columns={columns} data={filtered} pageSize={10} emptyState={<EmptyState icon={ClipboardList} title="No quizzes" />} />
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={`${selected?.programTitle} · ${selected?.questions.length} questions`}
        icon={ClipboardList}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Questions', value: selected.questions.length },
                { label: 'Time Limit', value: `${selected.timeLimit} min` },
                { label: 'Passing', value: `${selected.passing}%` },
                { label: 'Attempts', value: db.quizAttempts.filter((a) => a.quizId === selected.id).length },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-white p-3 text-center">
                  <p className="text-lg font-bold text-slate-800">{s.value}</p>
                  <p className="text-[10px] uppercase text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Question Bank</p>
              <div className="space-y-3">
                {selected.questions.map((q, i) => (
                  <div key={q.id} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400">Q{i + 1}</span>
                      <Badge tone="neutral">{typeLabel[q.type]}</Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800">{q.q}</p>
                    {q.options && (
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                        {q.options.map((o) => (
                          <span key={o} className={o === q.answer ? 'rounded bg-emerald-50 px-2 py-1 text-emerald-700' : 'rounded bg-white px-2 py-1 text-slate-500'}>
                            {o}
                          </span>
                        ))}
                      </div>
                    )}
                    {!q.options && (
                      <p className="mt-2 text-xs text-emerald-600">
                        <span className="font-semibold">Answer:</span> {q.answer === true ? 'True' : q.answer === false ? 'False' : q.answer}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {db.quizAttempts.filter((a) => a.quizId === selected.id).length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Attempts</p>
                <div className="space-y-2">
                  {db.quizAttempts.filter((a) => a.quizId === selected.id).slice(0, 6).map((a) => {
                    const t = db.users.find((u) => u.id === a.traineeId)
                    return (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                        <span className="text-slate-500">{t?.name}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-slate-500">{a.percentage}%</span>
                          <StatusBadge status={a.passed ? 'Passed' : 'Failed'} dot={false} />
                          <span className="text-xs text-slate-400">{formatDate(a.date)}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ManageQuizzes
