import { useMemo, useState } from 'react'
import { FileText, Clock, Eye, BookOpen, VideoOff, Layers } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { programLessons } from '../../data/programs'
import { videoEmbed } from '../../lib/utils'
import { PageHeader, Card, CardHeader, Badge, StatCard, Select, Modal, Button, EmptyState, SearchInput } from '../../components/ui'
import { DataTable } from '../../components/ui/Table'

export function ManageLessons() {
  const { db } = useApp()
  const [programFilter, setProgramFilter] = useState('all')
  const [compFilter, setCompFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const lessons = useMemo(() => {
    const source = programFilter === 'all' ? db.programs : db.programs.filter((p) => p.id === programFilter)
    return source.flatMap((p) =>
      programLessons(p.id).map((l) => ({
        ...l,
        id: l.id,
        programTitle: p.title,
        programEmoji: p.emoji,
        programCode: p.code,
      })),
    )
  }, [db.programs, programFilter])

  const filtered = lessons
    .filter((l) => compFilter === 'all' || l.competency === compFilter)
    .filter((l) => !query || l.title.toLowerCase().includes(query.toLowerCase()))

  const columns = [
    {
      key: 'title',
      header: 'Lesson',
      render: (r) => (
        <div className="flex items-center gap-3">
          <span className="text-lg">{r.programEmoji}</span>
          <div>
            <p className="font-medium text-slate-700">{r.title}</p>
            <p className="text-xs text-slate-400">{r.programTitle}{r.unitTitle ? ` · ${r.unitTitle}` : ''}</p>
          </div>
        </div>
      ),
    },
    { key: 'competency', header: 'Competency', render: (r) => <Badge tone={r.competency === 'Core' ? 'purple' : r.competency === 'Common' ? 'info' : 'brand'}>{r.competency}</Badge> },
    { key: 'duration', header: 'Duration', sortable: true, render: (r) => `${r.duration} min` },
    { key: 'materials', header: 'Materials', render: (r) => r.materials?.length || 0 },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Button size="sm" variant="secondary" icon={Eye} onClick={() => setSelected(r)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Lessons"
        description="All lessons across every training program."
        action={
          <div className="flex flex-wrap gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search lessons…" className="w-48" />
            <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="w-52">
              <option value="all">All programs</option>
              {db.programs.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
            <Select value={compFilter} onChange={(e) => setCompFilter(e.target.value)} className="w-40">
              <option value="all">All competencies</option>
              <option value="Basic">Basic</option>
              <option value="Common">Common</option>
              <option value="Core">Core</option>
            </Select>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Lessons" value={lessons.length} icon={FileText} tone="brand" />
        <StatCard label="Core Lessons" value={lessons.filter((l) => l.competency === 'Core').length} icon={Layers} tone="purple" />
        <StatCard label="With Materials" value={lessons.filter((l) => l.materials?.length).length} icon={BookOpen} tone="success" />
      </div>

      <Card>
        <CardHeader title="Lesson Library" icon={FileText} action={<Badge tone="brand">{filtered.length} lessons</Badge>} />
        <DataTable
          columns={columns}
          data={filtered}
          pageSize={12}
          emptyState={<EmptyState icon={FileText} title="No lessons found" />}
        />
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={`${selected?.programTitle} · ${selected?.competency} Competency`}
        icon={BookOpen}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected && (
          <div className="space-y-4">
            {(() => {
              const embed = videoEmbed(selected.videoUrl)
              if (embed) {
                return (
                  <div className="aspect-video overflow-hidden rounded-xl bg-black">
                    {embed.type === 'iframe' ? (
                      <iframe src={embed.src} title={selected.title} className="h-full w-full" allowFullScreen />
                    ) : (
                      <video src={embed.src} controls className="h-full w-full" />
                    )}
                  </div>
                )
              }
              return (
                <div className="flex aspect-video flex-col items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white/70">
                  <VideoOff className="h-8 w-8 text-white/40" />
                  <p className="mt-2 text-sm">{selected.video || selected.title}</p>
                  <p className="text-xs text-white/40">No video attached</p>
                </div>
              )
            })()}
            <p className="text-sm leading-relaxed text-slate-600">{selected.content}</p>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Materials</p>
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

export default ManageLessons
