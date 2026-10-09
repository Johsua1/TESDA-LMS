import { useMemo, useState } from 'react'
import {
  BarChart3,
  Users,
  Wallet,
  CalendarCheck,
  Printer,
  Download,
  GraduationCap,
  Target,
  Search,
  Filter,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useApp } from '../../store/AppContext'
import { overallProgress, courseProgress, trainerPrograms } from '../../store/selectors'
import {
  PageHeader,
  Card,
  CardBody,
  CardHeader,
  StatCard,
  Button,
  Badge,
  Avatar,
  ProgressBar,
  EmptyState,
  Input,
  Select,
  FormField,
} from '../../components/ui'
import { average, currency, cn } from '../../lib/utils'

const COLORS = ['#e68a00', '#2572eb', '#10b981', '#8b5cf6', '#ef4444', '#0ea5e9']

function SectionCard({ title, subtitle, icon, children, className }) {
  return (
    <Card className={cn('mt-6', className)}>
      <CardHeader title={title} subtitle={subtitle} icon={icon} />
      <CardBody>{children}</CardBody>
    </Card>
  )
}

function MiniStat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white text-slate-700',
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-warm-50 text-warm-700',
    danger: 'bg-red-50 text-red-700',
    info: 'bg-sky-50 text-sky-700',
  }
  return (
    <div className={cn('rounded-lg p-3 text-center', tones[tone])}>
      <p className="text-xl font-bold">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide opacity-80">{label}</p>
    </div>
  )
}

export function Reports() {
  const { db, toast } = useApp()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [programFilter, setProgramFilter] = useState('all')
  const [query, setQuery] = useState('')

  const data = useMemo(() => {
    const inRange = (d) => {
      if (!d) return true
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    }
    const matchProgram = (pid) => programFilter === 'all' || pid === programFilter

    const trainees = db.users.filter((u) => u.role === 'trainee')
    const trainers = db.users.filter((u) => u.role === 'trainer')

    const enrollments = db.enrollments.filter((e) => matchProgram(e.programId) && inRange(e.appliedDate))
    const attendance = db.attendance.filter((a) => matchProgram(a.programId) && inRange(a.date))
    const quizAttempts = db.quizAttempts.filter((a) => matchProgram(a.programId) && inRange(a.date))
    const examAttempts = db.examAttempts.filter((a) => matchProgram(a.programId) && inRange(a.date))

    // -------- Enrollment --------
    const enrollment = {
      total: enrollments.length,
      pending: enrollments.filter((e) => ['Pending', 'Under Review'].includes(e.status)).length,
      approved: enrollments.filter((e) => ['Approved', 'Enrolled'].includes(e.status)).length,
      completed: enrollments.filter((e) => e.status === 'Completed').length,
      rejected: enrollments.filter((e) => ['Rejected', 'Cancelled'].includes(e.status)).length,
    }
    const enrollmentByCourse = db.programs.map((p) => ({
      name: p.code,
      title: p.title,
      emoji: p.emoji,
      Enrolled: enrollments.filter((e) => e.programId === p.id && ['Approved', 'Enrolled'].includes(e.status)).length,
      Pending: enrollments.filter((e) => e.programId === p.id && ['Pending', 'Under Review'].includes(e.status)).length,
      Completed: enrollments.filter((e) => e.programId === p.id && e.status === 'Completed').length,
    }))

    // -------- Trainee --------
    const activeIds = new Set(
      db.enrollments.filter((e) => ['Approved', 'Enrolled'].includes(e.status)).map((e) => e.traineeId),
    )
    const completedIds = new Set(db.enrollments.filter((e) => e.status === 'Completed').map((e) => e.traineeId))
    const trainee = {
      total: trainees.length,
      active: trainees.filter((t) => activeIds.has(t.id)).length,
      completed: trainees.filter((t) => completedIds.has(t.id)).length,
      avgProgress: trainees.length ? Math.round(average(trainees.map((t) => overallProgress(db, t.id)))) : 0,
    }

    // -------- Trainer --------
    const trainerRows = trainers.map((t) => {
      const programs = trainerPrograms(db, t.id)
      const programIds = programs.map((p) => p.id)
      const assigned = db.enrollments.filter((e) => programIds.includes(e.programId))
      return {
        trainer: t,
        programs,
        trainees: new Set(assigned.map((e) => e.traineeId)).size,
        active: assigned.filter((e) => ['Approved', 'Enrolled'].includes(e.status)).length,
      }
    })
    const trainer = {
      total: trainers.length,
      active: trainerRows.filter((r) => r.programs.length).length,
      assignments: trainerRows.reduce((n, r) => n + r.programs.length, 0),
    }

    // -------- Attendance --------
    const att = {
      present: attendance.filter((a) => a.status === 'Present').length,
      late: attendance.filter((a) => a.status === 'Late').length,
      absent: attendance.filter((a) => a.status === 'Absent').length,
      excused: attendance.filter((a) => a.status === 'Excused').length,
    }
    const attTotal = att.present + att.late + att.absent + att.excused
    att.rate = attTotal ? Math.round(((att.present + att.late) / attTotal) * 100) : 0

    // -------- Performance --------
    const performance = {
      quizAvg: quizAttempts.length ? Math.round(average(quizAttempts.map((a) => a.percentage))) : 0,
      examAvg: examAttempts.length ? Math.round(average(examAttempts.map((a) => a.percentage))) : 0,
      passed: [...quizAttempts, ...examAttempts].filter((a) => a.passed).length,
      failed: [...quizAttempts, ...examAttempts].filter((a) => !a.passed).length,
      completion: enrollments.length ? Math.round((enrollment.completed / enrollments.length) * 100) : 0,
    }
    const performanceByCourse = db.programs.map((p) => {
      const qa = quizAttempts.filter((a) => a.programId === p.id)
      const ea = examAttempts.filter((a) => a.programId === p.id)
      return {
        name: p.code,
        Quiz: qa.length ? Math.round(average(qa.map((a) => a.percentage))) : 0,
        Exam: ea.length ? Math.round(average(ea.map((a) => a.percentage))) : 0,
      }
    })

    // -------- Accounting --------
    const selfPay = enrollments.filter((e) => e.type === 'self-pay')
    const billed = selfPay.reduce((s, e) => s + (e.payment?.fee || 0), 0)
    const paid = selfPay.reduce((s, e) => s + (e.payment?.amountPaid || 0), 0)
    const accounting = {
      billed,
      paid,
      balance: Math.max(0, billed - paid),
      fullyPaid: selfPay.filter((e) => e.payment?.status === 'Fully Paid').length,
      partiallyPaid: selfPay.filter((e) => e.payment?.status === 'Partially Paid').length,
      unpaid: selfPay.filter((e) => e.payment?.status === 'Unpaid').length,
      collection: billed ? Math.round((paid / billed) * 100) : 0,
    }
    const revenueByCourse = db.programs.map((p) => {
      const enrs = selfPay.filter((e) => e.programId === p.id)
      const b = enrs.reduce((s, e) => s + (e.payment?.fee || 0), 0)
      const c = enrs.reduce((s, e) => s + (e.payment?.amountPaid || 0), 0)
      return { name: p.code, Billed: b, Collected: c, Balance: Math.max(0, b - c) }
    })

    return {
      enrollment,
      enrollmentByCourse,
      trainee,
      trainer,
      trainerRows,
      att,
      attTotal,
      performance,
      performanceByCourse,
      accounting,
      revenueByCourse,
    }
  }, [db, from, to, programFilter])

  const q = query.trim().toLowerCase()
  const courseRows = data.enrollmentByCourse.filter(
    (r) => !q || r.title.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
  )
  const trainerRows = data.trainerRows.filter((r) => !q || r.trainer.name.toLowerCase().includes(q))

  const attendancePie = [
    { name: 'Present', value: data.att.present, color: '#10b981' },
    { name: 'Late', value: data.att.late, color: '#f59e0b' },
    { name: 'Absent', value: data.att.absent, color: '#ef4444' },
    { name: 'Excused', value: data.att.excused, color: '#0ea5e9' },
  ].filter((d) => d.value > 0)

  const exportCSV = () => {
    const rows = [
      ['Report', 'Metric', 'Value'],
      ['Enrollment', 'Total', data.enrollment.total],
      ['Enrollment', 'Pending', data.enrollment.pending],
      ['Enrollment', 'Approved', data.enrollment.approved],
      ['Enrollment', 'Completed', data.enrollment.completed],
      ['Trainee', 'Total', data.trainee.total],
      ['Trainee', 'Active', data.trainee.active],
      ['Trainee', 'Completed', data.trainee.completed],
      ['Trainer', 'Total', data.trainer.total],
      ['Trainer', 'Active', data.trainer.active],
      ['Attendance', 'Present', data.att.present],
      ['Attendance', 'Late', data.att.late],
      ['Attendance', 'Absent', data.att.absent],
      ['Attendance', 'Rate %', data.att.rate],
      ['Performance', 'Quiz Average', data.performance.quizAvg],
      ['Performance', 'Exam Average', data.performance.examAvg],
      ['Performance', 'Completion %', data.performance.completion],
      ['Performance', 'Passed', data.performance.passed],
      ['Performance', 'Failed', data.performance.failed],
      ['Accounting', 'Total Revenue', data.accounting.billed],
      ['Accounting', 'Paid', data.accounting.paid],
      ['Accounting', 'Partially Paid', data.accounting.partiallyPaid],
      ['Accounting', 'Unpaid', data.accounting.unpaid],
      ['Accounting', 'Outstanding Balance', data.accounting.balance],
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lms-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast('Report exported as CSV.')
  }

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Institution-wide enrollment, trainee, trainer, attendance, performance and financial reports."
        action={
          <div className="flex gap-2 no-print">
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
            <Button variant="secondary" icon={Download} onClick={exportCSV}>
              Export CSV
            </Button>
          </div>
        }
      />

      {/* ------------------------------ Filters ------------------------------ */}
      <Card className="no-print mb-6">
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="From date">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FormField>
          <FormField label="To date">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </FormField>
          <FormField label="Course">
            <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
              <option value="all">All courses</option>
              {db.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Course or trainer…" />
            </div>
          </FormField>
        </CardBody>
      </Card>

      {/* --------------------------- Summary cards --------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Enrollments" value={data.enrollment.total} icon={Users} tone="brand" hint={`${data.enrollment.pending} pending`} />
        <StatCard label="Active Trainees" value={data.trainee.active} icon={GraduationCap} tone="success" hint={`${data.trainee.total} total trainees`} />
        <StatCard label="Attendance Rate" value={`${data.att.rate}%`} icon={CalendarCheck} tone={data.att.rate >= 80 ? 'success' : 'warning'} hint={`${data.attTotal} records`} />
        <StatCard label="Total Revenue" value={currency(data.accounting.paid)} icon={Wallet} tone="warning" hint={`${data.accounting.collection}% collected`} />
      </div>

      {/* ------------------------------ Charts ------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Enrollment by Course" subtitle="Approved, pending and completed" icon={BarChart3} />
          <CardBody>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.enrollmentByCourse} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Enrolled" fill="#2572eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Attendance Distribution" icon={CalendarCheck} />
          <CardBody>
            {attendancePie.length ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={attendancePie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                      {attendancePie.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={CalendarCheck} title="No attendance data" description="Adjust the filters to see records." />
            )}
          </CardBody>
        </Card>
      </div>

      {/* --------------------------- Enrollment ----------------------------- */}
      <SectionCard title="Enrollment Report" subtitle="Application volume and status breakdown" icon={Users}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MiniStat label="Total" value={data.enrollment.total} tone="brand" />
          <MiniStat label="Pending" value={data.enrollment.pending} tone="warning" />
          <MiniStat label="Approved" value={data.enrollment.approved} tone="info" />
          <MiniStat label="Completed" value={data.enrollment.completed} tone="success" />
          <MiniStat label="Rejected" value={data.enrollment.rejected} tone="danger" />
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Course</th>
                <th className="px-4 py-2.5 text-right font-medium">Enrolled</th>
                <th className="px-4 py-2.5 text-right font-medium">Pending</th>
                <th className="px-4 py-2.5 text-right font-medium">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courseRows.map((r) => (
                <tr key={r.name} className="text-slate-500">
                  <td className="px-4 py-2.5">
                    <span className="mr-2">{r.emoji}</span>
                    {r.title}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{r.Enrolled}</td>
                  <td className="px-4 py-2.5 text-right">{r.Pending}</td>
                  <td className="px-4 py-2.5 text-right">{r.Completed}</td>
                </tr>
              ))}
              {!courseRows.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                    No matching courses.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ---------------------------- Trainee -------------------------------- */}
      <SectionCard title="Trainee Report" subtitle="Learner population and progress" icon={GraduationCap}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Total Trainees" value={data.trainee.total} tone="brand" />
          <MiniStat label="Active" value={data.trainee.active} tone="info" />
          <MiniStat label="Completed" value={data.trainee.completed} tone="success" />
          <MiniStat label="Avg Progress" value={`${data.trainee.avgProgress}%`} tone="warning" />
        </div>
        <div className="mt-5">
          <p className="mb-1.5 text-xs text-slate-500">Average progress across all trainees</p>
          <ProgressBar value={data.trainee.avgProgress} showLabel />
        </div>
      </SectionCard>

      {/* ---------------------------- Trainer -------------------------------- */}
      <SectionCard title="Trainer Report" subtitle="Trainer assignments and active load" icon={Users}>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Total Trainers" value={data.trainer.total} tone="brand" />
          <MiniStat label="Active" value={data.trainer.active} tone="success" />
          <MiniStat label="Assignments" value={data.trainer.assignments} tone="info" />
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Trainer</th>
                <th className="px-4 py-2.5 font-medium">Assigned Course(s)</th>
                <th className="px-4 py-2.5 text-right font-medium">Trainees</th>
                <th className="px-4 py-2.5 text-right font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trainerRows.map((r) => (
                <tr key={r.trainer.id} className="text-slate-500">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar name={r.trainer.name} color={r.trainer.avatarColor} size="sm" />
                      <span className="font-medium text-slate-700">{r.trainer.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.programs.length ? (
                      <span className="flex flex-wrap gap-1">
                        {r.programs.map((p) => (
                          <Badge key={p.id} tone="brand">
                            {p.code}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">No assignment</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">{r.trainees}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{r.active}</td>
                </tr>
              ))}
              {!trainerRows.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                    No matching trainers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* --------------------------- Attendance ------------------------------ */}
      <SectionCard title="Attendance Report" subtitle="Present, late, absent and excused records" icon={CalendarCheck}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MiniStat label="Present" value={data.att.present} tone="success" />
          <MiniStat label="Late" value={data.att.late} tone="warning" />
          <MiniStat label="Absent" value={data.att.absent} tone="danger" />
          <MiniStat label="Excused" value={data.att.excused} tone="info" />
          <MiniStat label="Rate" value={`${data.att.rate}%`} tone="brand" />
        </div>
      </SectionCard>

      {/* -------------------------- Performance ------------------------------ */}
      <SectionCard title="Performance Report" subtitle="Assessment averages and completion" icon={Target}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MiniStat label="Quiz Average" value={`${data.performance.quizAvg}%`} tone="brand" />
          <MiniStat label="Exam Average" value={`${data.performance.examAvg}%`} tone="purple" />
          <MiniStat label="Completion" value={`${data.performance.completion}%`} tone="success" />
          <MiniStat label="Passed" value={data.performance.passed} tone="success" />
          <MiniStat label="Failed" value={data.performance.failed} tone="danger" />
        </div>
        <div className="mt-5 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.performanceByCourse} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Quiz" fill="#2572eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Exam" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* --------------------------- Accounting ------------------------------ */}
      <SectionCard title="Accounting Report" subtitle="Revenue, collections and outstanding balance" icon={Wallet}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <MiniStat label="Total Revenue" value={currency(data.accounting.billed)} tone="brand" />
          <MiniStat label="Paid" value={data.accounting.fullyPaid} tone="success" />
          <MiniStat label="Partially Paid" value={data.accounting.partiallyPaid} tone="warning" />
          <MiniStat label="Unpaid" value={data.accounting.unpaid} tone="danger" />
          <MiniStat label="Outstanding" value={currency(data.accounting.balance)} tone="danger" />
        </div>
        <div className="mt-5 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.revenueByCourse} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tickFormatter={(v) => `₱${v / 1000}k`} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip formatter={(v) => currency(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Billed" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Balance" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <Filter className="h-3.5 w-3.5" /> Filters apply to enrollment dates, attendance, assessments and payments.
      </p>
    </div>
  )
}

export default Reports
