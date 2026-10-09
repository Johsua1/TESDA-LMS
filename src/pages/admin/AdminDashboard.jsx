import { Link } from 'react-router-dom'
import {
  Users,
  GraduationCap,
  BookOpen,
  UserPlus,
  Wallet,
  TrendingUp,
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  Activity,
  Megaphone,
  BarChart3,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { useApp } from '../../store/AppContext'
import { revenueStats, programStats, attendanceStats } from '../../store/selectors'
import { Card, CardBody, CardHeader, StatCard, Badge, Button, ProgressBar, EmptyState, SectionTitle, Avatar } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { formatDate, currency, average, cn } from '../../lib/utils'

const PIE_COLORS = ['#2572eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

export function AdminDashboard() {
  const { db, user } = useApp()
  const revenue = revenueStats(db)
  const allTrainees = db.users.filter((u) => u.role === 'trainee')
  const allTrainers = db.users.filter((u) => u.role === 'trainer')
  const activeEnrollments = db.enrollments.filter((e) => ['Enrolled', 'Approved'].includes(e.status))
  const pendingEnrollments = db.enrollments.filter((e) => ['Pending', 'Under Review'].includes(e.status))

  const enrollmentByProgram = db.programs.map((p) => {
    const s = programStats(db, p.id)
    return { name: p.code, Enrolled: s.enrolled, Completed: s.completed, Pending: s.pending }
  })

  const enrollmentPie = db.programs.map((p) => ({
    name: p.title.split(' ')[0],
    value: db.enrollments.filter((e) => e.programId === p.id).length,
  }))

  const specialPrograms = db.programs.filter((p) => p.special).length
  const ncPrograms = db.programs.length - specialPrograms

  const recentEnrollments = [...db.enrollments]
    .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate))
    .slice(0, 6)

  const announcements = db.announcements.slice(0, 3)

  const attendanceOverall = (() => {
    const total = db.attendance.length
    const present = db.attendance.filter((a) => a.status === 'Present' || a.status === 'Late').length
    return total ? Math.round((present / total) * 100) : 0
  })()

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-blue-900 p-6 text-white sm:p-8">
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: 'radial-gradient(circle at 85% 20%, rgba(246,192,0,0.45) 0, transparent 45%)' }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="bg-white/15 text-white ring-white/20">Super Admin Dashboard</Badge>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">System Overview</h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Managing {allTrainees.length} trainees, {allTrainers.length} trainers and {db.programs.length} training
              programs. {pendingEnrollments.length} enrollment applications are awaiting review.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/enrollments">
              <Button variant="secondary" className="bg-white/95 hover:bg-white" icon={UserPlus}>
                Review Enrollments
              </Button>
            </Link>
            <Link to="/admin/reports">
              <Button variant="ghost" className="text-white hover:bg-white/10" icon={BarChart3}>
                View Reports
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Trainees" value={allTrainees.length} icon={Users} tone="brand" hint={`${activeEnrollments.length} active enrollments`} />
        <StatCard label="Total Trainers" value={allTrainers.length} icon={GraduationCap} tone="success" />
        <StatCard label="Training Programs" value={db.programs.length} icon={BookOpen} tone="purple" hint={`${ncPrograms} NC II · ${specialPrograms} special`} />
        <StatCard
          label="Collections"
          value={currency(revenue.paid)}
          icon={Wallet}
          tone="warning"
          hint={`${revenue.collection}% of ${currency(revenue.billed)} billed`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Enrollment chart */}
          <Card>
            <CardHeader title="Enrollment by Program" subtitle="Enrolled, completed and pending per program" icon={BarChart3} />
            <CardBody>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrollmentByProgram} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Enrolled" fill="#2572eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          {/* Recent enrollments */}
          <Card>
            <CardHeader
              title="Recent Enrollment Applications"
              icon={UserPlus}
              action={<Link to="/admin/enrollments" className="text-xs font-semibold text-brand-600 hover:text-brand-700">View all</Link>}
            />
            <div className="divide-y divide-slate-100">
              {recentEnrollments.map((e) => {
                const t = db.users.find((u) => u.id === e.traineeId)
                const p = db.programs.find((pp) => pp.id === e.programId)
                return (
                  <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={t?.name} color={t?.avatarColor} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">{t?.name}</p>
                        <p className="truncate text-xs text-slate-400">{p?.title} · {formatDate(e.appliedDate)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={e.type === 'scholarship' ? 'success' : 'brand'}>
                        {e.type === 'scholarship' ? 'Scholarship' : 'Self-Pay'}
                      </Badge>
                      <StatusBadge status={e.status} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Enrollment Distribution" icon={TrendingUp} />
            <CardBody>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={enrollmentPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                      {enrollmentPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5">
                {enrollmentPie.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.name}
                    </span>
                    <span className="font-semibold text-slate-700">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="System Health" icon={Activity} />
            <CardBody className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Overall attendance</span>
                  <span className="font-semibold text-slate-700">{attendanceOverall}%</span>
                </div>
                <ProgressBar value={attendanceOverall} size="sm" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Fee collection rate</span>
                  <span className="font-semibold text-slate-700">{revenue.collection}%</span>
                </div>
                <ProgressBar value={revenue.collection} size="sm" tone="bg-amber-500" />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-sm text-slate-600">Pending approvals</span>
                <Badge tone="warning">{pendingEnrollments.length}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-sm text-slate-600">Outstanding balance</span>
                <span className="text-sm font-semibold text-slate-700">{currency(revenue.balance)}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Latest Announcements" icon={Megaphone} action={<Link to="/admin/announcements" className="text-xs font-semibold text-brand-600">Manage</Link>} />
            <CardBody className="space-y-3 pt-4">
              {announcements.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-100 p-3">
                  <p className="text-sm font-medium text-slate-700">{a.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.body}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{formatDate(a.date)}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard