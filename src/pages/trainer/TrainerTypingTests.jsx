import { useState } from 'react'
import { Keyboard, Gauge, Target, Trophy, Eye, TrendingUp, Users, Award } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { useApp } from '../../store/AppContext'
import { trainerTypingTests, trainerTrainees } from '../../store/selectors'
import { PageHeader, Card, CardHeader, CardBody, StatCard, EmptyState, Modal, Button, Badge, Avatar, Select, Textarea, FormField } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate, average, clamp, cn } from '../../lib/utils'

export function TrainerTypingTests() {
  const { db, user, recordTypingTest } = useApp()
  const tests = trainerTypingTests(db, user.id)
  const trainees = trainerTrainees(db, user.id).filter((t) => (t.trainee.enrolledPrograms || []).includes('virtual-assistant'))

  const [selected, setSelected] = useState(null)
  const [remarks, setRemarks] = useState('')

  const passRate = tests.length ? Math.round((tests.filter((t) => t.passed).length / tests.length) * 100) : 0
  const avgWpm = tests.length ? Math.round(average(tests.map((t) => t.wpm))) : 0
  const avgAccuracy = tests.length ? Math.round(average(tests.map((t) => t.accuracy))) : 0

  const chartData = tests.slice(0, 8).map((t) => ({
    name: db.users.find((u) => u.id === t.traineeId)?.name?.split(' ')[0] || 'Trainee',
    score: t.score,
    passed: t.passed,
  }))

  const openDetail = (t) => {
    setSelected(t)
    setRemarks(t.remarks || '')
  }

  const updateRemarks = () => {
    recordTypingTest({ ...selected, id: undefined, remarks })
    setSelected(null)
  }

  const columns = [
    {
      key: 'trainee',
      header: 'Trainee',
      render: (r) => {
        const t = db.users.find((u) => u.id === r.traineeId)
        return (
          <div className="flex items-center gap-3">
            <Avatar name={t?.name} color={t?.avatarColor} size="sm" />
            <div>
              <p className="font-medium text-slate-700">{t?.name}</p>
              <p className="text-xs text-slate-400">{formatDate(r.date)}</p>
            </div>
          </div>
        )
      },
    },
    { key: 'wpm', header: 'WPM', sortable: true, render: (r) => <span className="font-semibold">{r.wpm}</span> },
    { key: 'accuracy', header: 'Accuracy', sortable: true, render: (r) => `${r.accuracy}%` },
    { key: 'errors', header: 'Errors', sortable: true },
    { key: 'correctWords', header: 'Correct / Incorrect', render: (r) => `${r.correctWords} / ${r.incorrectWords}` },
    { key: 'score', header: 'Score', sortable: true, render: (r) => <span className="font-bold text-slate-700">{r.score}%</span> },
    { key: 'passed', header: 'Result', render: (r) => <StatusBadge status={r.passed ? 'Passed' : 'Failed'} /> },
    { key: 'actions', header: '', render: (r) => <Button size="sm" variant="secondary" icon={Eye} onClick={() => openDetail(r)}>Evaluate</Button> },
  ]

  return (
    <div>
      <PageHeader
        title="Typing Test Evaluation"
        description="Review and evaluate Virtual Assistant typing test results. Minimum passing rate: 40%."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tests Taken" value={tests.length} icon={Keyboard} tone="brand" />
        <StatCard label="Pass Rate" value={`${passRate}%`} icon={Trophy} tone={passRate >= 50 ? 'success' : 'warning'} />
        <StatCard label="Average WPM" value={avgWpm} icon={Gauge} tone="purple" />
        <StatCard label="Average Accuracy" value={`${avgAccuracy}%`} icon={Target} tone="info" />
      </div>

      {chartData.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Typing Test Scores" subtitle="Scores by trainee (passing = 40%)" icon={TrendingUp} />
          <CardBody>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Score']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.passed ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader title="Typing Test Results" icon={Keyboard} action={<Badge tone="brand">{tests.length} records</Badge>} />
        <DataTable
          columns={columns}
          data={tests}
          searchable
          searchPlaceholder="Search by trainee…"
          pageSize={10}
          emptyState={<EmptyState icon={Keyboard} title="No typing test results" description="Results will appear once VA trainees take the test." />}
        />
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Typing Test Evaluation"
        subtitle={selected ? db.users.find((u) => u.id === selected.traineeId)?.name : ''}
        icon={Keyboard}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            <Button onClick={updateRemarks}>Save Remarks</Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className={cn('rounded-xl p-5 text-white', selected.passed ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-red-500 to-rose-600')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/80">Typing Test Score</p>
                  <p className="text-3xl font-bold">{selected.score}%</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={selected.passed ? 'Passed' : 'Failed'} />
                  <p className="mt-1 text-xs text-white/75">Minimum: 40%</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Words per Minute', value: selected.wpm },
                { label: 'Accuracy', value: `${selected.accuracy}%` },
                { label: 'Errors', value: selected.errors },
                { label: 'Total Words', value: selected.totalWords },
                { label: 'Correct Words', value: selected.correctWords },
                { label: 'Incorrect Words', value: selected.incorrectWords },
                { label: 'Test Duration', value: `${selected.duration} min` },
                { label: 'Date', value: formatDate(selected.date) },
                { label: 'Result', value: selected.passed ? 'PASSED' : 'FAILED' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-base font-bold text-slate-800">{s.value}</p>
                  <p className="text-[10px] uppercase text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>

            <FormField label="Trainer Remarks">
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Add evaluation remarks…" />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default TrainerTypingTests
