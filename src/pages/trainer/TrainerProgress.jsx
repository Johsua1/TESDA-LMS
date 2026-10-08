import { useState } from 'react'
import { LineChart as LineIcon, TrendingUp, Users, Target, Award, BarChart3 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts'
import { useApp } from '../../store/AppContext'
import { trainerPrograms, trainerTrainees, courseProgress, courseGrade, attendanceStats, programById } from '../../store/selectors'
import { PageHeader, Card, CardBody, CardHeader, StatCard, Select, ProgressBar, EmptyState, Avatar, Badge } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { average, cn } from '../../lib/utils'

export function TrainerProgress() {
  const { db, user } = useApp()
  const programs = trainerPrograms(db, user.id)
  const [programFilter, setProgramFilter] = useState('all')

  const all = trainerTrainees(db, user.id)
  const rows = all
    .filter((t) => programFilter === 'all' || t.enrollments.some((e) => e.programId === programFilter))
    .map((t) => {
      const enrs = programFilter === 'all' ? t.enrollments : t.enrollments.filter((e) => e.programId === programFilter)
      const progress = Math.round(average(enrs.map((e) => courseProgress(e, e.programId).percent)))
      const grade = Math.round(average(enrs.map((e) => courseGrade(db, t.trainee.id, e.programId))))
      const att = attendanceStats(db, t.trainee.id)
      return { id: t.trainee.id, trainee: t.trainee, progress, grade, att, enrollments: enrs }
    })
    .sort((a, b) => b.progress - a.progress)

  const chartData = rows.slice(0, 10).map((r) => ({
    name: r.trainee.name.split(' ')[0],
    Progress: r.progress,
    Grade: r.grade,
    Attendance: r.att.rate,
  }))

  const avgProgress = rows.length ? Math.round(average(rows.map((r) => r.progress))) : 0
  const atRisk = rows.filter((r) => r.progress < 50 || r.att.rate < 80).length

  const columns = [
    { key: 'rank', header: '#', render: (r) => <span className="text-slate-400">{rows.indexOf(r) + 1}</span> },
    {
      key: 'name',
      header: 'Trainee',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.trainee.name} color={r.trainee.avatarColor} size="sm" />
          <div>
            <p className="font-medium text-slate-700">{r.trainee.name}</p>
            <p className="text-xs text-slate-400">{r.enrollments.map((e) => programById(e.programId)?.code).join(', ')}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Course Progress',
      sortable: true,
      render: (r) => (
        <div className="w-36">
          <ProgressBar value={r.progress} size="sm" showLabel />
        </div>
      ),
    },
    { key: 'att', header: 'Attendance', sortable: true, sortValue: (r) => r.att.rate, render: (r) => `${r.att.rate}%` },
    { key: 'grade', header: 'Grade', sortable: true, render: (r) => <span className="font-semibold">{r.grade}%</span> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <StatusBadge status={r.progress >= 75 ? 'On Track' : r.progress >= 50 ? 'In Progress' : 'At Risk'} />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Progress Monitoring"
        description="Track trainee progress, grades and attendance across your programs."
        action={
          <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-56">
            <option value="all">All programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Trainees" value={rows.length} icon={Users} tone="brand" />
        <StatCard label="Avg Progress" value={`${avgProgress}%`} icon={TrendingUp} tone="success" />
        <StatCard label="At Risk" value={atRisk} icon={Target} tone={atRisk ? 'danger' : 'success'} hint="Progress < 50% or attendance < 80%" />
        <StatCard label="Avg Grade" value={`${rows.length ? Math.round(average(rows.map((r) => r.grade))) : 0}%`} icon={Award} tone="purple" />
      </div>

      {chartData.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Performance Comparison" subtitle="Progress, grade and attendance per trainee" icon={BarChart3} />
          <CardBody>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Progress" fill="#3b91f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Grade" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Attendance" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Trainee Progress" icon={LineIcon} action={<Badge tone="brand">{rows.length} trainees</Badge>} />
        <DataTable
          columns={columns}
          data={rows}
          searchable
          searchKeys={['name']}
          pageSize={10}
          emptyState={<EmptyState icon={LineIcon} title="No trainees found" />}
        />
      </Card>
    </div>
  )
}

export default TrainerProgress
