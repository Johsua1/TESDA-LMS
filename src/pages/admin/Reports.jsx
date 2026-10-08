import { BarChart3, TrendingUp, Users, Award, Wallet, CalendarCheck, Printer, Download } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useApp } from '../../store/AppContext'
import { revenueStats, programStats, courseGrade, attendanceStats, courseProgress, programById } from '../../store/selectors'
import { PageHeader, Card, CardBody, CardHeader, StatCard, Button, Badge, Avatar, ProgressBar, EmptyState } from '../../components/ui'
import { average, currency, cn } from '../../lib/utils'

const COLORS = ['#2572eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

export function Reports() {
  const { db, toast } = useApp()
  const revenue = revenueStats(db)
  const trainees = db.users.filter((u) => u.role === 'trainee')

  const programData = db.programs.map((p) => {
    const s = programStats(db, p.id)
    const enrs = db.enrollments.filter((e) => e.programId === p.id && ['Enrolled', 'Approved'].includes(e.status))
    const avgProgress = enrs.length ? Math.round(average(enrs.map((e) => courseProgress(e, p.id).percent))) : 0
    const avgGrade = enrs.length ? Math.round(average(enrs.map((e) => courseGrade(db, e.traineeId, p.id)))) : 0
    const att = enrs.length ? Math.round(average(enrs.map((e) => attendanceStats(db, e.traineeId, p.id).rate))) : 0
    return { ...p, stats: s, avgProgress, avgGrade, att, activeCount: enrs.length }
  })

  const chartData = programData.map((p) => ({
    name: p.code,
    Progress: p.avgProgress,
    Grade: p.avgGrade,
    Attendance: p.att,
  }))

  const enrollmentPie = db.programs.map((p) => ({
    name: p.title.split(' ')[0],
    value: db.enrollments.filter((e) => e.programId === p.id).length,
  }))

  const topPerformers = trainees
    .map((t) => {
      const enrs = db.enrollments.filter((e) => e.traineeId === t.id && ['Enrolled', 'Approved', 'Completed'].includes(e.status))
      const grade = enrs.length ? Math.round(average(enrs.map((e) => courseGrade(db, t.id, e.programId)))) : 0
      const progress = enrs.length ? Math.round(average(enrs.map((e) => courseProgress(e, e.programId).percent))) : 0
      return { trainee: t, grade, progress }
    })
    .filter((t) => t.grade > 0)
    .sort((a, b) => b.grade - a.grade)
    .slice(0, 5)

  const completionTrend = db.programs.map((p, i) => ({
    name: p.code,
    Completion: p.stats.total ? Math.round((p.stats.completed / p.stats.total) * 100) : 0,
  }))

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Institution-wide performance, enrollment and financial reports."
        action={
          <div className="flex gap-2 no-print">
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
            <Button variant="secondary" icon={Download} onClick={() => toast('Report export is simulated in this demo.', 'info')}>
              Export
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Enrollments" value={db.enrollments.length} icon={Users} tone="brand" />
        <StatCard label="Completion Rate" value={`${db.enrollments.length ? Math.round((db.enrollments.filter((e) => e.status === 'Completed').length / db.enrollments.length) * 100) : 0}%`} icon={Award} tone="success" />
        <StatCard label="Total Collections" value={currency(revenue.paid)} icon={Wallet} tone="warning" />
        <StatCard label="Programs" value={db.programs.length} icon={BarChart3} tone="purple" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Program Performance" subtitle="Average progress, grade and attendance" icon={TrendingUp} />
          <CardBody>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Progress" fill="#2572eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Grade" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Attendance" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Enrollment Distribution" icon={Users} />
          <CardBody>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={enrollmentPie} dataKey="value" nameKey="name" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                    {enrollmentPie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Completion Rate by Program" icon={Award} />
        <CardBody>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={completionTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Completion']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="Completion" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Program Summary" icon={BarChart3} />
          <div className="divide-y divide-slate-100">
            {programData.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                <span className="text-2xl">{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700">{p.title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
                    <span>{p.stats.enrolled} enrolled</span>
                    <span>{p.stats.completed} completed</span>
                    <span>{p.stats.pending} pending</span>
                  </div>
                </div>
                <div className="hidden w-32 sm:block">
                  <ProgressBar value={p.avgProgress} size="sm" showLabel />
                </div>
                <Badge tone={p.avgGrade >= 75 ? 'success' : 'warning'}>{p.avgGrade}% avg</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Top Performers" icon={Award} />
          <CardBody className="space-y-3">
            {topPerformers.length ? (
              topPerformers.map((t, i) => (
                <div key={t.trainee.id} className="flex items-center gap-3">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white', i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-700' : 'bg-slate-300')}>
                    {i + 1}
                  </span>
                  <Avatar name={t.trainee.name} color={t.trainee.avatarColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{t.trainee.name}</p>
                    <p className="text-xs text-slate-400">{t.progress}% progress</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{t.grade}%</span>
                </div>
              ))
            ) : (
              <EmptyState icon={Award} title="No data" />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export default Reports
