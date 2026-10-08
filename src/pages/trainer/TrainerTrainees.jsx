import { useState } from 'react'
import { Users, Search, Eye, TrendingUp, CalendarCheck, Award, Keyboard, BookOpen, Mail, Phone, MapPin } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import {
  trainerPrograms,
  trainerTrainees,
  courseProgress,
  attendanceStats,
  courseGrade,
  traineeQuizAttempts,
  traineeTypingTests,
  traineeEvaluations,
  programById,
} from '../../store/selectors'
import {
  PageHeader,
  Card,
  CardBody,
  CardHeader,
  Badge,
  ProgressBar,
  EmptyState,
  Modal,
  Select,
  Avatar,
  Button,
  Tabs,
  StatCard,
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate, average, cn } from '../../lib/utils'

export function TrainerTrainees() {
  const { db, user } = useApp()
  const programs = trainerPrograms(db, user.id)
  const [programFilter, setProgramFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('progress')

  const all = trainerTrainees(db, user.id)
  const rows = all
    .filter((t) => programFilter === 'all' || t.enrollments.some((e) => e.programId === programFilter))
    .map((t) => {
      const enrs = programFilter === 'all' ? t.enrollments : t.enrollments.filter((e) => e.programId === programFilter)
      const avgProgress = Math.round(average(enrs.map((e) => courseProgress(e, e.programId).percent)))
      const att = attendanceStats(db, t.trainee.id)
      const grade = Math.round(average(enrs.map((e) => courseGrade(db, t.trainee.id, e.programId))))
      return { id: t.trainee.id, trainee: t.trainee, enrollments: enrs, avgProgress, att, grade }
    })

  const columns = [
    {
      key: 'name',
      header: 'Trainee',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.trainee.name} color={r.trainee.avatarColor} size="sm" />
          <div>
            <p className="font-medium text-slate-700">{r.trainee.name}</p>
            <p className="text-xs text-slate-400">{r.trainee.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'programs',
      header: 'Program(s)',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.enrollments.map((e) => (
            <Badge key={e.id} tone="brand">
              {programById(e.programId)?.code}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      sortable: true,
      sortValue: (r) => r.avgProgress,
      render: (r) => (
        <div className="w-28">
          <ProgressBar value={r.avgProgress} size="sm" showLabel />
        </div>
      ),
    },
    { key: 'att', header: 'Attendance', sortable: true, sortValue: (r) => r.att.rate, render: (r) => `${r.att.rate}%` },
    { key: 'grade', header: 'Grade', sortable: true, render: (r) => <span className="font-semibold text-slate-700">{r.grade}%</span> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Button size="sm" variant="secondary" icon={Eye} onClick={() => { setSelected(r); setTab('progress') }}>
          View
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="My Trainees"
        description="Monitor the trainees enrolled in your programs."
        action={
          <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-56">
            <option value="all">All programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Trainees" value={rows.length} icon={Users} tone="brand" />
        <StatCard
          label="Average Progress"
          value={`${rows.length ? Math.round(average(rows.map((r) => r.avgProgress))) : 0}%`}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Average Attendance"
          value={`${rows.length ? Math.round(average(rows.map((r) => r.att.rate))) : 0}%`}
          icon={CalendarCheck}
          tone="info"
        />
      </div>

      <Card>
        <CardHeader title="Trainee List" icon={Users} />
        <DataTable
          columns={columns}
          data={rows}
          searchable
          searchKeys={['trainee.name', 'trainee.email']}
          pageSize={10}
          emptyState={<EmptyState icon={Users} title="No trainees found" />}
        />
      </Card>

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.trainee?.name}
        subtitle={selected?.trainee?.email}
        icon={Users}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected && <TraineeDetail selected={selected} tab={tab} setTab={setTab} db={db} />}
      </Modal>
    </div>
  )
}

function TraineeDetail({ selected, tab, setTab, db }) {
  const t = selected.trainee
  const quizzes = traineeQuizAttempts(db, t.id)
  const typing = traineeTypingTests(db, t.id)
  const evals = traineeEvaluations(db, t.id)

  const tabs = [
    { key: 'progress', label: 'Progress' },
    { key: 'scores', label: 'Scores', badge: quizzes.length },
    ...(typing.length ? [{ key: 'typing', label: 'Typing', badge: typing.length }] : []),
    { key: 'profile', label: 'Profile' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={t.name} color={t.avatarColor} size="lg" />
        <div className="grid flex-1 grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-50 p-2.5 text-center">
            <p className="text-base font-bold text-slate-800">{selected.att.rate}%</p>
            <p className="text-[10px] uppercase text-slate-400">Attendance</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5 text-center">
            <p className="text-base font-bold text-slate-800">{selected.avgProgress}%</p>
            <p className="text-[10px] uppercase text-slate-400">Progress</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5 text-center">
            <p className="text-base font-bold text-slate-800">{selected.grade}%</p>
            <p className="text-[10px] uppercase text-slate-400">Grade</p>
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} variant="pills" size="sm" />

      {tab === 'progress' && (
        <div className="space-y-3">
          {selected.enrollments.map((e) => {
            const p = programById(e.programId)
            const prog = courseProgress(e, e.programId)
            return (
              <div key={e.id} className="rounded-lg border border-slate-100 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p?.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700">{p?.title}</p>
                    <p className="text-xs text-slate-400">
                      {prog.completed}/{prog.total} lessons · {e.type === 'scholarship' ? 'Scholarship' : 'Self-Pay'}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
                <ProgressBar value={prog.percent} className="mt-3" size="sm" showLabel />
              </div>
            )
          })}
        </div>
      )}

      {tab === 'scores' && (
        <div className="space-y-2">
          {quizzes.length ? (
            quizzes.map((q) => (
              <div key={q.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">{q.quizTitle}</p>
                  <p className="text-xs text-slate-400">{formatDate(q.date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('text-sm font-bold', q.passed ? 'text-emerald-600' : 'text-red-600')}>
                    {q.score}/{q.total} ({q.percentage}%)
                  </span>
                  <StatusBadge status={q.passed ? 'Passed' : 'Failed'} />
                </div>
              </div>
            ))
          ) : (
            <EmptyState icon={Award} title="No quiz attempts yet" />
          )}
        </div>
      )}

      {tab === 'typing' && (
        <div className="space-y-2">
          {typing.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {r.wpm} WPM · {r.accuracy}% accuracy · {r.errors} errors
                </p>
                <p className="text-xs text-slate-400">{formatDate(r.date)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-700">{r.score}%</span>
                <StatusBadge status={r.passed ? 'Passed' : 'Failed'} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'profile' && (
        <div className="space-y-3">
          {[
            { icon: Mail, label: 'Email', value: t.email },
            { icon: Phone, label: 'Phone', value: t.phone || '—' },
            { icon: MapPin, label: 'Address', value: t.address || '—' },
            { icon: BookOpen, label: 'Education', value: t.education || '—' },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <row.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{row.label}</p>
                <p className="text-sm text-slate-700">{row.value}</p>
              </div>
            </div>
          ))}
          {evals.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Latest evaluation</p>
              <p className="mt-1 text-sm text-amber-800">
                Overall {evals[0].overall}/5 — {evals[0].remarks}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TrainerTrainees
