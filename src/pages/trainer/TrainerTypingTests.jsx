import { useState } from 'react'
import { Keyboard, Gauge, Target, Trophy, Eye, TrendingUp, Send, Check, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { useApp } from '../../store/AppContext'
import { trainerTypingTests, trainerTrainees, trainerPrograms } from '../../store/selectors'
import { PageHeader, Card, CardHeader, CardBody, StatCard, EmptyState, Modal, Button, Badge, Avatar, Select, Textarea, FormField } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate, average, cn } from '../../lib/utils'
import { formatDuration } from '../../lib/typingMetrics'

export function TrainerTypingTests() {
  const { db, user, settings, evaluateTypingTest, decideTypingRequest, toast } = useApp()
  // Configured in System Settings; the stored pass/fail flag is what counts.
  const typingPassing = Number(settings?.typingPassingRate) || 40
  const tests = trainerTypingTests(db, user.id)
  const trainees = trainerTrainees(db, user.id).filter((t) => (t.trainee.enrolledPrograms || []).includes('virtual-assistant'))
  // Retake requests are addressed to the trainer who owns the result, with the
  // program assignment as a fallback (legacy rows have no trainer on the test).
  const programIds = new Set(trainerPrograms(db, user.id).map((p) => p.id))
  const pendingRequests = (db.typingRequests || []).filter(
    (r) => r.status === 'pending' && (r.trainerId === user.id || programIds.has(r.programId)),
  )

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
    // Start blank for a new evaluation so the trainee does not receive the
    // system-generated remark as if the trainer wrote it.
    setRemarks(t.evaluated === false ? '' : t.remarks || '')
  }

  // Saving the evaluation marks the result as reviewed, which is what unlocks
  // the trainee's "Request Retake" button.
  const saveEvaluation = () => {
    const res = evaluateTypingTest(selected.id, remarks)
    if (!res.ok) {
      toast(res.error, 'error')
      return
    }
    setSelected(null)
  }

  const decide = (request, decision) => {
    const res = decideTypingRequest(request.id, decision)
    if (!res.ok) toast(res.error, 'error')
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
    {
      key: 'evaluated',
      header: 'Evaluation',
      render: (r) =>
        r.evaluated === false ? (
          <Badge tone="warning">Awaiting evaluation</Badge>
        ) : (
          <Badge tone="success">Evaluated</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Button size="sm" variant="secondary" icon={Eye} onClick={() => openDetail(r)}>
          {r.evaluated === false ? 'Evaluate' : 'Review'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Typing Test Evaluation"
        description={`Review and evaluate Virtual Assistant typing test results. Minimum passing rate: ${typingPassing}%. Trainees get one attempt; approve a request to let them test again.`}
      />

      {pendingRequests.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader
            title="Retake Requests"
            subtitle="Trainees asking to take the typing test again"
            icon={Send}
            action={<Badge tone="warning">{pendingRequests.length} pending</Badge>}
          />
          <CardBody className="space-y-3">
            {pendingRequests.map((r) => {
              const trainee = db.users.find((u) => u.id === r.traineeId)
              const lastTest = db.typingTests.find((t) => t.id === r.testId)
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={trainee?.name} color={trainee?.avatarColor} size="sm" />
                    <div>
                      <p className="font-medium text-slate-700">{trainee?.name || 'Trainee'}</p>
                      <p className="text-xs text-slate-500">
                        Wants another attempt · requested {formatDate(r.requestedAt)}
                        {lastTest ? ` · last score ${lastTest.score}% (${lastTest.passed ? 'Passed' : 'Failed'})` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" icon={X} onClick={() => decide(r, 'rejected')}>
                      Reject
                    </Button>
                    <Button size="sm" icon={Check} onClick={() => decide(r, 'approved')}>
                      Approve
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tests Taken" value={tests.length} icon={Keyboard} tone="brand" />
        <StatCard label="Pass Rate" value={`${passRate}%`} icon={Trophy} tone={passRate >= 50 ? 'success' : 'warning'} />
        <StatCard label="Average WPM" value={avgWpm} icon={Gauge} tone="purple" />
        <StatCard label="Average Accuracy" value={`${avgAccuracy}%`} icon={Target} tone="info" />
      </div>

      {chartData.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Typing Test Scores" subtitle={`Scores by trainee (passing = ${typingPassing}%)`} icon={TrendingUp} />
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
          searchKeys={[(r) => db.users.find((u) => u.id === r.traineeId)?.name]}
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
            <Button onClick={saveEvaluation}>Save Evaluation</Button>
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
                  <p className="mt-1 text-xs text-white/75">Minimum: {typingPassing}%</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Net WPM', value: selected.wpm },
                { label: 'Raw WPM', value: selected.rawWpm ?? selected.wpm },
                { label: 'Accuracy', value: `${selected.accuracy}%` },
                { label: 'Errors', value: selected.errors },
                { label: 'Total Words', value: selected.totalWords },
                { label: 'Correct Words', value: selected.correctWords },
                { label: 'Incorrect Words', value: selected.incorrectWords },
                {
                  label: 'Test Duration',
                  value: formatDuration(selected.durationSeconds ?? selected.duration * 60),
                },
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
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {selected.evaluated === false
                ? 'Saving the evaluation notifies the trainee and unlocks their retake request.'
                : 'This result has been evaluated. Saving again updates the remarks.'}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default TrainerTypingTests
