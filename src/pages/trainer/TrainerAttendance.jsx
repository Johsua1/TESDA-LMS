import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CalendarCheck, Save, Users, CheckCircle2, Clock, UserX, FileCheck2 } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerPrograms, trainerEnrollments, programById } from '../../store/selectors'
import { PageHeader, Card, CardBody, CardHeader, Button, Select, Badge, EmptyState, StatCard, Avatar } from '../../components/ui'
import { formatDate, formatTime, isSessionRecordable, cn } from '../../lib/utils'
import { useNow } from '../../lib/useNow'

const STATUSES = [
  { key: 'Present', icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { key: 'Late', icon: Clock, tone: 'text-amber-600 bg-amber-50 border-amber-200' },
  { key: 'Absent', icon: UserX, tone: 'text-red-600 bg-red-50 border-red-200' },
  { key: 'Excused', icon: FileCheck2, tone: 'text-sky-600 bg-sky-50 border-sky-200' },
]

export function TrainerAttendance() {
  const { db, user, bulkSaveAttendance, toast } = useApp()
  const location = useLocation()
  const now = useNow()
  const programs = trainerPrograms(db, user.id)

  // A "Take attendance" click from the Schedules page lands here with the
  // session preselected, so open that session's program.
  const preselectedId = location.state?.scheduleId || ''
  const preselected = preselectedId ? db.schedules.find((s) => s.id === preselectedId) : null

  const [programId, setProgramId] = useState(preselected?.programId || programs[0]?.id || '')
  const [scheduleId, setScheduleId] = useState(preselectedId)

  // Only THIS trainer's own sessions that have already started (Ongoing or
  // Completed) — a shared program must not let a trainer mark another
  // trainer's class, and future sessions have nothing to record yet.
  const sessions = useMemo(
    () =>
      db.schedules
        .filter((s) => s.trainerId === user.id && s.programId === programId && isSessionRecordable(s, now))
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [db.schedules, user.id, programId, now],
  )

  const schedule = sessions.find((s) => s.id === scheduleId) || sessions[0]

  const roster = useMemo(() => {
    if (!programId) return []
    // Only this trainer's own students for the program, not every enrollee.
    const enrs = trainerEnrollments(db, user.id, programId).filter((e) =>
      ['Enrolled', 'Approved', 'Completed'].includes(e.status),
    )
    return enrs.map((e) => {
      const trainee = db.users.find((u) => u.id === e.traineeId)
      const existing = schedule
        ? db.attendance.find((a) => a.traineeId === e.traineeId && a.scheduleId === schedule.id)
        : null
      return { trainee, existing }
    })
  }, [db, programId, schedule, user.id])

  const [marks, setMarks] = useState({})

  // (Re)seed the form from the saved records whenever the selected session
  // changes — INCLUDING on first mount. The old render-phase guard only ran
  // when the id *changed*, so a session that was already selected when the page
  // loaded (the app renders behind a `ready` gate, so it always mounts with a
  // session) never loaded its saved marks — saved attendance looked "lost".
  // Statuses start EMPTY so the trainer must consciously mark each trainee.
  useEffect(() => {
    const initial = {}
    roster.forEach((r) => {
      initial[r.trainee.id] = {
        status: r.existing?.status || '',
        timeIn: r.existing?.timeIn || schedule?.startTime || '',
        timeOut: r.existing?.timeOut || schedule?.endTime || '',
      }
    })
    setMarks(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule?.id])

  const setMark = (traineeId, patch) => setMarks((m) => ({ ...m, [traineeId]: { ...m[traineeId], ...patch } }))

  // A late arrival can't be earlier than the session start — a time before the
  // start would mean they were on time. Clamp anything earlier back to start.
  const setLateTimeIn = (traineeId, value) => {
    const clamped = value && schedule && value < schedule.startTime ? schedule.startTime : value
    setMark(traineeId, { timeIn: clamped })
  }

  // The departure can't be later than the session end. Clamp anything later
  // back to the end time.
  const setLateTimeOut = (traineeId, value) => {
    const clamped = value && schedule && value > schedule.endTime ? schedule.endTime : value
    setMark(traineeId, { timeOut: clamped })
  }

  const markAllPresent = () =>
    setMarks((m) => {
      const next = { ...m }
      roster.forEach((r) => {
        next[r.trainee.id] = { ...(next[r.trainee.id] || {}), status: 'Present' }
      })
      return next
    })

  const total = roster.length
  const markedCount = Object.values(marks).filter((m) => m.status).length
  const allMarked = total > 0 && markedCount === total

  const save = () => {
    if (!allMarked) {
      toast('Please mark every trainee before saving.', 'warning')
      return
    }
    const stamp = new Date().toISOString()
    const records = roster.map((r) => {
      const m = marks[r.trainee.id] || {}
      const status = m.status
      // Late time-in is floored at the session start (never earlier) and the
      // time-out is capped at the session end (never later).
      const lateIn = m.timeIn && m.timeIn >= schedule.startTime ? m.timeIn : schedule.startTime
      const lateOut = m.timeOut && m.timeOut <= schedule.endTime ? m.timeOut : schedule.endTime
      return {
        traineeId: r.trainee.id,
        programId,
        scheduleId: schedule.id,
        lessonTitle: schedule.lessonTitle,
        trainerId: user.id,
        date: schedule.date,
        // Present -> times come from the class schedule; Late -> the trainer's
        // manual input (floored at start, capped at end); Absent/Excused -> none.
        timeIn: status === 'Present' ? schedule.startTime : status === 'Late' ? lateIn : null,
        timeOut: status === 'Present' ? schedule.endTime : status === 'Late' ? lateOut : null,
        status,
        updatedAt: stamp,
        updatedBy: user.id,
      }
    })
    bulkSaveAttendance(records)
  }

  const counts = Object.values(marks).reduce((acc, m) => {
    if (m.status) acc[m.status] = (acc[m.status] || 0) + 1
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
                <option>No sessions to record</option>
              )}
            </Select>
          </div>
        }
      />

      {!schedule ? (
        <Card>
          <EmptyState icon={CalendarCheck} title="No sessions to record" description="Attendance can be recorded once a class session has started." />
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
              action={<Badge tone={allMarked ? 'success' : 'brand'}>{markedCount}/{total} marked</Badge>}
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
                          const active = m.status === s.key
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
                      {m.status === 'Present' && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
                          <span className="font-normal text-emerald-600/70">(schedule)</span>
                        </span>
                      )}
                      {m.status === 'Late' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={m.timeIn || ''}
                            min={schedule.startTime}
                            onChange={(e) => setLateTimeIn(r.trainee.id, e.target.value)}
                            className="input-base w-28 py-1.5 text-xs"
                          />
                          <span className="text-xs text-slate-400">to</span>
                          <input
                            type="time"
                            value={m.timeOut || ''}
                            max={schedule.endTime}
                            onChange={(e) => setLateTimeOut(r.trainee.id, e.target.value)}
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
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <Button variant="secondary" icon={CheckCircle2} onClick={markAllPresent}>
                  Mark all present
                </Button>
                <Button icon={Save} onClick={save} disabled={!allMarked}>
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
