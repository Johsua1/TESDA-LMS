import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Search, Filter, GraduationCap, Plus } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { enrollmentsOf, courseProgress, nextScheduleFor, hasCourseAccess, enrollmentTrainerId } from '../../store/selectors'
import { programById } from '../../data/programs'
import { CourseCard } from '../../components/cards/CourseCard'
import { PageHeader, EmptyState, Tabs, Button, SearchInput, Select } from '../../components/ui'

export function MyCourses() {
  const { db, user } = useApp()
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const all = enrollmentsOf(db, user.id)
  const active = all.filter((e) => ['Enrolled', 'Approved'].includes(e.status))
  const pending = all.filter((e) => ['Pending', 'Under Review'].includes(e.status))
  const completed = all.filter((e) => e.status === 'Completed')

  const source = tab === 'active' ? active : tab === 'pending' ? pending : completed
  const filtered = source.filter((e) => {
    const program = programById(e.programId)
    const matchQuery = !query || program?.title.toLowerCase().includes(query.toLowerCase())
    const matchType = typeFilter === 'all' || e.type === typeFilter
    return matchQuery && matchType
  })

  const tabs = [
    { key: 'active', label: 'In Progress', icon: BookOpen, badge: active.length },
    { key: 'pending', label: 'Pending', icon: GraduationCap, badge: pending.length },
    { key: 'completed', label: 'Completed', icon: GraduationCap, badge: completed.length },
  ]

  return (
    <div>
      <PageHeader
        title="My Courses"
        description="Courses you are enrolled in. You only have access to programs assigned to your account."
        action={
          <Link to="/trainee/enrollment">
            <Button icon={Plus}>Enroll in a program</Button>
          </Link>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        <div className="flex items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search course…" className="sm:w-56" />
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="sm:w-40">
            <option value="all">All types</option>
            <option value="scholarship">Scholarship</option>
            <option value="self-pay">Self-Pay</option>
          </Select>
        </div>
      </div>

      {filtered.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((enr) => {
            const program = programById(enr.programId)
            if (!program) return null
            return (
              <CourseCard
                key={enr.id}
                program={program}
                enrollment={enr}
                trainer={db.users.find((u) => u.id === enrollmentTrainerId(db, enr))}
                nextSchedule={nextScheduleFor(db, program.id)}
                progress={courseProgress(enr, program.id).percent}
                basePath="/trainee/courses"
                locked={!hasCourseAccess(enr)}
              />
            )
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title={tab === 'active' ? 'No active courses' : tab === 'pending' ? 'No pending enrollments' : 'No completed courses'}
            description="Browse the available training programs and submit an enrollment application."
            action={
              <Link to="/trainee/enrollment">
                <Button icon={Plus}>Browse programs</Button>
              </Link>
            }
          />
        </div>
      )}
    </div>
  )
}

export default MyCourses
