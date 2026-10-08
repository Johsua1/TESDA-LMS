import { useState } from 'react'
import { Target, Plus, Pencil, Star, Users, TrendingUp } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { trainerPrograms, trainerTrainees, trainerEvaluations, programById } from '../../store/selectors'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Modal,
  Select,
  Textarea,
  FormField,
  FormRow,
  EmptyState,
  Avatar,
  Badge,
  StatCard,
  Input,
  Stars,
} from '../../components/ui'
import { DataTable } from '../../components/ui/Table'
import { formatDate, average } from '../../lib/utils'

const CRITERIA = [
  { key: 'workAttitude', label: 'Work Attitude' },
  { key: 'attendance', label: 'Attendance & Punctuality' },
  { key: 'skills', label: 'Skills & Competence' },
  { key: 'safety', label: 'Safety Practices' },
  { key: 'teamwork', label: 'Teamwork & Communication' },
]

export function TrainerEvaluations() {
  const { db, user, saveEvaluation, toast } = useApp()
  const programs = trainerPrograms(db, user.id)
  const trainees = trainerTrainees(db, user.id)
  const evaluations = trainerEvaluations(db, user.id)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [traineeId, setTraineeId] = useState('')
  const [programId, setProgramId] = useState(programs[0]?.id || '')
  const [scores, setScores] = useState({ workAttitude: 4, attendance: 4, skills: 4, safety: 4, teamwork: 4 })
  const [remarks, setRemarks] = useState('')
  const [period, setPeriod] = useState('Mid-Term Evaluation')

  const overall = Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / 5) * 20) / 20

  const openCreate = () => {
    setEditing(null)
    setTraineeId('')
    setProgramId(programs[0]?.id || '')
    setScores({ workAttitude: 4, attendance: 4, skills: 4, safety: 4, teamwork: 4 })
    setRemarks('')
    setPeriod('Mid-Term Evaluation')
    setModalOpen(true)
  }

  const openEdit = (ev) => {
    setEditing(ev)
    setTraineeId(ev.traineeId)
    setProgramId(ev.programId)
    setScores(ev.scores)
    setRemarks(ev.remarks)
    setPeriod(ev.period)
    setModalOpen(true)
  }

  const save = () => {
    if (!traineeId) {
      toast('Please select a trainee.', 'warning')
      return
    }
    saveEvaluation({
      id: editing?.id,
      traineeId,
      trainerId: user.id,
      programId,
      period,
      scores,
      overall,
      remarks: remarks || (overall >= 4.5 ? 'Excellent performance and attitude.' : overall >= 3.5 ? 'Satisfactory progress.' : 'Needs improvement.'),
      date: editing?.date || new Date().toISOString().slice(0, 10),
    })
    setModalOpen(false)
  }

  const avgOverall = evaluations.length ? average(evaluations.map((e) => e.overall)) : 0

  const columns = [
    {
      key: 'trainee',
      header: 'Trainee',
      render: (r) => {
        const t = db.users.find((u) => u.id === r.traineeId)
        return (
          <div className="flex items-center gap-3">
            <Avatar name={t?.name} color={t?.avatarColor} size="sm" />
            <div>
              <p className="font-medium text-slate-700">{t?.name}</p>
              <p className="text-xs text-slate-400">{programById(r.programId)?.code}</p>
            </div>
          </div>
        )
      },
    },
    { key: 'period', header: 'Period' },
    { key: 'overall', header: 'Rating', sortable: true, render: (r) => (
      <div className="flex items-center gap-2">
        <Stars value={Math.round(r.overall)} />
        <span className="text-sm font-semibold text-slate-700">{r.overall}</span>
      </div>
    ) },
    { key: 'remarks', header: 'Remarks', render: (r) => <span className="text-slate-500">{r.remarks}</span> },
    { key: 'date', header: 'Date', sortable: true, render: (r) => formatDate(r.date) },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Button size="sm" variant="secondary" icon={Pencil} onClick={() => openEdit(r)}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Student Evaluation"
        description="Evaluate trainee performance across key competency criteria."
        action={<Button icon={Plus} onClick={openCreate}>New Evaluation</Button>}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Evaluations" value={evaluations.length} icon={Target} tone="brand" />
        <StatCard label="Average Rating" value={avgOverall ? `${avgOverall.toFixed(1)}/5` : '—'} icon={Star} tone="warning" />
        <StatCard label="Trainees Evaluated" value={new Set(evaluations.map((e) => e.traineeId)).size} icon={Users} tone="success" />
      </div>

      <Card>
        <CardHeader title="Evaluations" icon={Target} />
        <DataTable
          columns={columns}
          data={evaluations}
          searchable
          searchPlaceholder="Search evaluations…"
          searchKeys={['period', 'remarks']}
          pageSize={10}
          emptyState={<EmptyState icon={Target} title="No evaluations yet" description="Create an evaluation to assess your trainees." action={<Button icon={Plus} onClick={openCreate}>New Evaluation</Button>} />}
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Evaluation' : 'New Student Evaluation'}
        icon={Target}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save Changes' : 'Submit Evaluation'}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <FormRow>
            <FormField label="Trainee" required>
              <Select value={traineeId} onChange={(e) => setTraineeId(e.target.value)}>
                <option value="">Select trainee…</option>
                {trainees.map((t) => (
                  <option key={t.trainee.id} value={t.trainee.id}>{t.trainee.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Program">
              <Select value={programId} onChange={(e) => setProgramId(e.target.value)}>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </Select>
            </FormField>
          </FormRow>

          <FormField label="Evaluation Period">
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
          </FormField>

          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            {CRITERIA.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">{c.label}</span>
                <Stars value={scores[c.key]} onChange={(v) => setScores({ ...scores, [c.key]: v })} />
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-sm font-semibold text-slate-700">Overall Rating</span>
              <div className="flex items-center gap-2">
                <Stars value={Math.round(overall)} />
                <span className="text-lg font-bold text-amber-600">{overall}</span>
                <span className="text-xs text-slate-400">/ 5.0</span>
              </div>
            </div>
          </div>

          <FormField label="Remarks / Comments">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Provide feedback on the trainee's performance…" rows={3} />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}

export default TrainerEvaluations
