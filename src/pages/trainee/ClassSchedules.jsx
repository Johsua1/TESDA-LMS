import { useState } from 'react'
import { CalendarDays, Video, Clock, MapPin, Filter, CalendarClock, History } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { activeEnrollmentsOf, programById } from '../../store/selectors'
import { PageHeader, Card, CardBody, CardHeader, EmptyState, Tabs, Select, Badge, Button } from '../../components/ui'
import { ScheduleCard } from '../../components/cards/Cards'
import { startOfDay, formatDate, formatTime, relativeDay, cn } from '../../lib/utils'

export function ClassSchedules() {
  const { db, user } = useApp()
  const enrollments = activeEnrollmentsOf(db, user.id)
  const programIds = enrollments.map((e) => e.programId)

  const [tab, setTab] = useState('upcoming')
  const [programFilter, setProgramFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const today = startOfDay()
  const sessions = db.schedules
    .filter((s) => programIds.includes(s.programId))
    .filter((s) => programFilter === 'all' || s.programId === programFilter)
    .filter((s) => typeFilter === 'all' || s.classType === typeFilter)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const upcoming = sessions.filter((s) => new Date(s.date) >= today)
  const past = sessions.filter((s) => new Date(s.date) < today).reverse()
  const list = tab === 'upcoming' ? upcoming : past

  // group by date
  const grouped = list.reduce((acc, s) => {
    const key = s.date
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const onlineCount = upcoming.filter((s) => s.classType !== 'Face-to-Face').length

  return (
    <div>
      <PageHeader
        title="Class Schedules"
        description="Your online, face-to-face and hybrid class schedule for enrolled programs."
        action={
          <div className="flex flex-wrap gap-2">
            <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-48">
              <option value="all">All programs</option>
              {enrollments.map((e) => (
                <option key={e.programId} value={e.programId}>
                  {programById(e.programId)?.title}
                </option>
              ))}
            </Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-40">
              <option value="all">All class types</option>
              <option value="Online">Online</option>
              <option value="Face-to-Face">Face-to-Face</option>
              <option value="Hybrid">Hybrid</option>
            </Select>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Upcoming</p>
            <p className="text-xl font-bold text-slate-800">{upcoming.length} sessions</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Video className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Online / Hybrid</p>
            <p className="text-xl font-bold text-slate-800">{onlineCount} sessions</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-slate-500">
            <History className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Completed</p>
            <p className="text-xl font-bold text-slate-800">{past.length} sessions</p>
          </div>
        </Card>
      </div>

      <div className="mb-5">
        <Tabs
          tabs={[
            { key: 'upcoming', label: 'Upcoming', icon: CalendarClock, badge: upcoming.length },
            { key: 'past', label: 'Past Sessions', icon: History, badge: past.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {list.length ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">{relativeDay(date)}</h3>
                <span className="text-xs text-slate-400">{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="space-y-3">
                {items.map((s) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    trainer={db.users.find((u) => u.id === s.trainerId)}
                    program={programById(s.programId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title={tab === 'upcoming' ? 'No upcoming classes' : 'No past sessions'}
            description="Classes will appear here once scheduled by your trainer."
          />
        </Card>
      )}
    </div>
  )
}

export default ClassSchedules
