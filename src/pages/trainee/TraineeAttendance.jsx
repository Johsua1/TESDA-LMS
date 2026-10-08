import { useState } from 'react'
import { CalendarCheck, UserCheck, Clock, UserX, FileCheck2, PieChart } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { activeEnrollmentsOf, attendanceStats, programById } from '../../store/selectors'
import { PageHeader, Card, CardBody, CardHeader, StatCard, Select, ProgressBar, EmptyState } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate, formatTime } from '../../lib/utils'

export function TraineeAttendance() {
  const { db, user, settings } = useApp()
  const enrollments = activeEnrollmentsOf(db, user.id)
  const [programFilter, setProgramFilter] = useState('all')

  const stats = attendanceStats(db, user.id, programFilter === 'all' ? undefined : programFilter)
  const records = [...stats.records].sort((a, b) => new Date(b.date) - new Date(a.date))
  const requirement = settings.attendanceRequirement || 80

  const columns = [
    { key: 'date', header: 'Date', sortable: true, render: (r) => formatDate(r.date, { month: 'short', day: 'numeric', year: 'numeric' }) },
    { key: 'programId', header: 'Course', render: (r) => programById(r.programId)?.title },
    { key: 'lessonTitle', header: 'Session', render: (r) => <span className="text-slate-600">{r.lessonTitle}</span> },
    {
      key: 'trainerId',
      header: 'Trainer',
      render: (r) => db.users.find((u) => u.id === r.trainerId)?.name || '—',
    },
    { key: 'timeIn', header: 'Time In', render: (r) => (r.timeIn ? formatTime(r.timeIn) : '—') },
    { key: 'timeOut', header: 'Time Out', render: (r) => (r.timeOut ? formatTime(r.timeOut) : '—') },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="My Attendance"
        description="Track your attendance record across all enrolled programs."
        action={
          <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-56">
            <option value="all">All programs</option>
            {enrollments.map((e) => (
              <option key={e.programId} value={e.programId}>
                {programById(e.programId)?.title}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Present" value={stats.present} icon={UserCheck} tone="success" />
        <StatCard label="Late" value={stats.late} icon={Clock} tone="warning" />
        <StatCard label="Absent" value={stats.absent} icon={UserX} tone="danger" />
        <StatCard label="Excused" value={stats.excused} icon={FileCheck2} tone="info" />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Attendance Rate"
          subtitle={`Minimum required attendance is ${requirement}%`}
          icon={PieChart}
          action={
            <span className={`text-2xl font-bold ${stats.rate >= requirement ? 'text-emerald-600' : 'text-amber-600'}`}>
              {stats.rate}%
            </span>
          }
        />
        <CardBody>
          <ProgressBar value={stats.rate} size="lg" tone={stats.rate >= requirement ? 'bg-emerald-500' : 'bg-amber-500'} />
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
            <span>{stats.total} total sessions</span>
            <span>{(stats.present + stats.late)} attended</span>
            <span>{stats.absent} missed</span>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Attendance Records" icon={CalendarCheck} />
        <DataTable
          columns={columns}
          data={records}
          searchable
          searchPlaceholder="Search by session or course…"
          searchKeys={['lessonTitle', 'date']}
          pageSize={10}
          emptyState={<EmptyState icon={CalendarCheck} title="No attendance records" />}
        />
      </Card>
    </div>
  )
}

export default TraineeAttendance
