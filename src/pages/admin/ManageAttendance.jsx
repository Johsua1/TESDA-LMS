import { useState } from 'react'
import { CalendarCheck, UserCheck, Clock, UserX, FileCheck2, PieChart, TrendingUp } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { programById } from '../../store/selectors'
import { PageHeader, Card, CardHeader, CardBody, StatCard, Select, ProgressBar, EmptyState, Avatar, Badge } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { formatDate, formatTime, average } from '../../lib/utils'

export function ManageAttendance() {
  const { db } = useApp()
  const [programFilter, setProgramFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const records = db.attendance
    .filter((a) => programFilter === 'all' || a.programId === programFilter)
    .filter((a) => statusFilter === 'all' || a.status === statusFilter)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const present = records.filter((a) => a.status === 'Present').length
  const late = records.filter((a) => a.status === 'Late').length
  const absent = records.filter((a) => a.status === 'Absent').length
  const excused = records.filter((a) => a.status === 'Excused').length
  const rate = records.length ? Math.round(((present + late) / records.length) * 100) : 0

  const byProgram = db.programs.map((p) => {
    const recs = db.attendance.filter((a) => a.programId === p.id)
    const r = recs.length ? Math.round((recs.filter((a) => a.status === 'Present' || a.status === 'Late').length / recs.length) * 100) : 0
    return { program: p, rate: r, count: recs.length }
  })

  const columns = [
    { key: 'date', header: 'Date', sortable: true, render: (r) => formatDate(r.date, { month: 'short', day: 'numeric', year: 'numeric' }) },
    {
      key: 'trainee',
      header: 'Trainee',
      render: (r) => {
        const t = db.users.find((u) => u.id === r.traineeId)
        return (
          <div className="flex items-center gap-2">
            <Avatar name={t?.name} color={t?.avatarColor} size="sm" />
            <span className="text-slate-700">{t?.name}</span>
          </div>
        )
      },
    },
    { key: 'program', header: 'Program', render: (r) => programById(r.programId)?.title },
    { key: 'lessonTitle', header: 'Session', render: (r) => <span className="text-slate-500">{r.lessonTitle}</span> },
    { key: 'timeIn', header: 'Time In', render: (r) => (r.timeIn ? formatTime(r.timeIn) : '—') },
    { key: 'timeOut', header: 'Time Out', render: (r) => (r.timeOut ? formatTime(r.timeOut) : '—') },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Monitor attendance records across all programs and trainees."
        action={
          <div className="flex flex-wrap gap-2">
            <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-52">
              <option value="all">All programs</option>
              {db.programs.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
              <option value="all">All statuses</option>
              <option>Present</option>
              <option>Late</option>
              <option>Absent</option>
              <option>Excused</option>
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Present" value={present} icon={UserCheck} tone="success" />
        <StatCard label="Late" value={late} icon={Clock} tone="warning" />
        <StatCard label="Absent" value={absent} icon={UserX} tone="danger" />
        <StatCard label="Excused" value={excused} icon={FileCheck2} tone="info" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Overall Attendance Rate" icon={PieChart} />
          <CardBody>
            <div className="text-center">
              <p className="text-4xl font-bold text-slate-800">{rate}%</p>
              <p className="mt-1 text-xs text-slate-400">{records.length} total records</p>
            </div>
            <ProgressBar value={rate} className="mt-4" size="lg" />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Attendance Rate by Program" icon={TrendingUp} />
          <CardBody className="space-y-3">
            {byProgram.map((b) => (
              <div key={b.program.id} className="flex items-center gap-3">
                <span className="text-xl">{b.program.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium text-slate-600">{b.program.title}</span>
                    <span className="ml-2 font-semibold text-slate-700">{b.rate}%</span>
                  </div>
                  <ProgressBar value={b.rate} size="sm" className="mt-1" />
                </div>
                <Badge tone="neutral">{b.count}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Attendance Records" icon={CalendarCheck} />
        <DataTable
          columns={columns}
          data={records}
          searchable
          searchPlaceholder="Search records…"
          searchKeys={['lessonTitle', 'date']}
          pageSize={12}
          emptyState={<EmptyState icon={CalendarCheck} title="No attendance records" />}
        />
      </Card>
    </div>
  )
}

export default ManageAttendance
