import { useMemo, useState } from 'react'
import { FileText, Clock, Play, Search, BookOpen, Layers } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerPrograms } from '../../store/selectors'
import { programLessons } from '../../data/programs'
import { PageHeader, Card, CardBody, CardHeader, Badge, EmptyState, Select, SearchInput, Modal, Button } from '../../components/ui'
import { cn } from '../../lib/utils'

export function TrainerLessons() {
  const { db, user } = useApp()
  const programs = trainerPrograms(db, user.id)
  const [programFilter, setProgramFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const lessons = useMemo(() => {
    const source = programFilter === 'all' ? programs : programs.filter((p) => p.id === programFilter)
    return source.flatMap((p) => programLessons(p.id).map((l) => ({ ...l, programTitle: p.title, programEmoji: p.emoji, programColor: p.color })))
  }, [programs, programFilter])

  const filtered = lessons.filter((l) => !query || l.title.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <PageHeader
        title="Lessons"
        description="All lessons across your assigned programs, organized by competency."
        action={
          <div className="flex gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search lessons…" className="w-52" />
            <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-52">
              <option value="all">All programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </div>
        }
      />

      {filtered.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((l) => (
            <Card key={l.id} hover className="flex flex-col p-4">
              <div className="flex items-start justify-between">
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-lg', l.programColor)}>
                  {l.programEmoji}
                </span>
                <Badge tone={l.competency === 'Core' ? 'purple' : l.competency === 'Common' ? 'info' : 'brand'}>{l.competency}</Badge>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-slate-800">{l.title}</h4>
              {l.unitTitle && <p className="text-xs text-slate-400">{l.unitTitle}</p>}
              <p className="mt-1 line-clamp-2 flex-1 text-xs text-slate-500">{l.description}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {l.duration} min</span>
                <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {l.materials?.length || 0} files</span>
              </div>
              <Button size="sm" variant="secondary" className="mt-4" onClick={() => setSelected(l)}>
                View lesson
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={FileText} title="No lessons found" />
        </Card>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={`${selected?.competency} Competency${selected?.unitTitle ? ' · ' + selected.unitTitle : ''}`}
        icon={BookOpen}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex aspect-video items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white/80">
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
                  <Play className="h-6 w-6 translate-x-0.5" />
                </span>
                <p className="mt-2 text-sm">{selected.video || selected.title}</p>
                <p className="text-xs text-white/50">Video placeholder</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{selected.content}</p>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Learning Materials</p>
              <div className="space-y-2">
                {selected.materials?.length ? (
                  selected.materials.map((m) => (
                    <div key={m.name} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">{m.name}</span>
                      <Badge tone="neutral" className="ml-auto">{m.type}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No materials</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default TrainerLessons
