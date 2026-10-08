import { useMemo, useState } from 'react'
import { CalendarCheck, Save, Users, CheckCircle2, Clock, UserX, FileCheck2 } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerPrograms, programById } from '../../store/selectors'
import { PageHeader, Card, CardBody, CardHeader, Button, Select, Badge, EmptyState, StatCard, Avatar } from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { formatDate, formatTime, startOfDay, cn } from '../../lib/utils'

const STATUSES = [
  { key: 'Present', icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { key: 'Late', icon: Clock, tone: 'text-amber-600 bg-amber-50 border-amber-200' },
  { key: 'Absent', icon: UserX, tone: 'text-red-600 bg-red-50 border-red-200' },
  { key: 'Excused', icon: FileCheck2, tone: 'text-sky-600 bg-sky-50 border-sky-200' },
]

export function TrainerAttendance() {
  const { db, user, bulkSaveAttendance } = useApp()
  const programs = trainerPrograms(db, user.id)

  const [programId, setProgramId] = useState(programs[0]?.id || '')
  const [scheduleId, setScheduleId] = useState('')

  const sessions = useMemo(
    () =>
      db.schedules
        .filter((s) => s.programId === programId && new Date(s.date) <= startOfDay())
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [db.schedules, programId],
  )

  const schedule = sessions.find((s) => s.id === scheduleId) || sessions[0]

  const roster = useMemo(() => {
    if (!programId) return []
    const enrs = db.enrollments.filter((e) => e.programId === programId && ['Enrolled', 'Approved', 'Completed'].includes(e.status))
    return enrs.map((e) => {
      const trainee = db.users.find((u) => u.id === e.traineeId)
      const existing = schedule
        ? db.attendance.find((a) => a.traineeId === e.traineeId && a.scheduleId === schedule.id)
        : null
      return { trainee, existing }
    })
  }, [db, programId, schedule])

  const [marks, setMarks] = useState({})

  // reset marks when schedule changes
  const key = schedule?.id
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    const initial = {}
    roster.forEach((r) => {
      initial[r.trainee.id] = {
        status: r.existing?.status || 'Present',
        timeIn: r.existing?.timeIn || schedule?.startTime || '',
        timeOut: r.existing?.timeOut || schedule?.endTime || '',
      }
    })
    setMarks(initial)
  }

  const setMark = (traineeId, patch) => setMarks((m) => ({ ...m, [traineeId]: { ...m[traineeId], ...patch } }))

  const save = () => {
    const records = roster.map((r) => {
      const m = marks[r.trainee.id] || {}
      const status = m.status || 'Present'
      return {
        traineeId: r.trainee.id,
        programId,
        scheduleId: schedule.id,
        lessonTitle: schedule.lessonTitle,
        trainerId: user.id,
        date: schedule.date,
        timeIn: status === 'Absent' || status === 'Excused' ? null : m.timeIn || schedule.startTime,
        timeOut: status === 'Absent' || status === 'Excused' ? null : m.timeOut || schedule.endTime,
        status,
      }
    })
    bulkSaveAttendance(records)
  }

  const counts = Object.values(marks).reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Record and update attendance for your class sessions."
        action={
          <div className="flex flex-wrap gap-2">
            <Select value={programId} onChange={(e) => { setProgramId(e.target.value); setScheduleId('') }} className="w-56">
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
            <Select value={schedule?.id || ''} onChange={(e) => setScheduleId(e.target.value)} className="w-64">
              {sessions.length ? (
                sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDate(s.date, { month: 'short', day: 'numeric' })} — {s.lessonTitle}
                  </option>
                ))
              ) : (
                <option>No past sessions</option>
              )}
            </Select>
          </div>
        }
      />

      {!schedule ? (
        <Card>
          <EmptyState icon={CalendarCheck} title="No past sessions to record" description="Attendance can be recorded once a class session has started." />
        </Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATUSES.map((s) => (
              <StatCard key={s.key} label={s.key} value={counts[s.key] || 0} icon={s.icon} tone={s.key === 'Present' ? 'success' : s.key === 'Late' ? 'warning' : s.key === 'Absent' ? 'danger' : 'info'} />
            ))}
          </div>

          <Card>
            <CardHeader
              title={schedule.lessonTitle}
              subtitle={`${programById(programId)?.title} · ${formatDate(schedule.date, { weekday: 'long', month: 'long', day: 'numeric' })} · ${formatTime(schedule.startTime)}`}
              icon={Users}
              action={<Badge tone="brand">{roster.length} trainees</Badge>}
            />
            <CardBody className="space-y-3">
              {roster.map((r) => {
                const m = marks[r.trainee.id] || {}
                return (
                  <div key={r.trainee.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.trainee.name} color={r.trainee.avatarColor} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{r.trainee.name}</p>
                        <p className="text-xs text-slate-400">{r.trainee.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map((s) => {
                          const active = (m.status || 'Present') === s.key
                          return (
                            <button
                              key={s.key}
                              onClick={() => setMark(r.trainee.id, { status: s.key })}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                                active ? s.tone : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                              )}
                            >
                              <s.icon className="h-3.5 w-3.5" />
                              {s.key}
                            </button>
                          )
                        })}
                      </div>
                      {(m.status || 'Present') !== 'Absent' && (m.status || 'Present') !== 'Excused' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={m.timeIn || ''}
                            onChange={(e) => setMark(r.trainee.id, { timeIn: e.target.value })}
                            className="input-base w-28 py-1.5 text-xs"
                          />
                          <span className="text-xs text-slate-400">to</span>
                          <input
                            type="time"
                            value={m.timeOut || ''}
                            onChange={(e) => setMark(r.trainee.id, { timeOut: e.target.value })}
                            className="input-base w-28 py-1.5 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {!roster.length && <EmptyState icon={Users} title="No trainees enrolled in this program" />}
            </CardBody>
            {roster.length > 0 && (
              <div className="flex justify-end border-t border-slate-100 px-5 py-4">
                <Button icon={Save} onClick={save}>
                  Save Attendance
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default TrainerAttendance
