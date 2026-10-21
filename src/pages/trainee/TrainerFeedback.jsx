import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquareQuote, Send, Star, CheckCircle2, Clock3, GraduationCap } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { programById } from '../../data/programs'
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  EmptyState,
  Modal,
  Textarea,
  FormField,
  Stars,
  StatCard,
  Avatar,
} from '../../components/ui'
import { formatDate } from '../../lib/utils'
import {
  feedbackBackendAvailable,
  fetchMyFeedbackStatus,
  fetchMyFeedbackRows,
  submitTrainerFeedback,
} from '../../lib/feedback'

const EMPTY = {
  feedbackText: '',
  learningExperience: '',
  trainerStrengths: '',
  areasForImprovement: '',
  recommendation: '',
  rating: 0,
}

const statusMeta = {
  pending: { tone: 'warning', label: 'Awaiting your feedback' },
  submitted: { tone: 'success', label: 'Submitted' },
  not_required: { tone: 'neutral', label: 'Not yet available' },
}

export function TrainerFeedback() {
  const { db, user, toast } = useApp()
  const [rows, setRows] = useState([])
  const [submitted, setSubmitted] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [viewing, setViewing] = useState(null)

  const load = useCallback(async () => {
    if (!feedbackBackendAvailable) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [status, mine] = await Promise.all([fetchMyFeedbackStatus(), fetchMyFeedbackRows()])
      setRows(status)
      setSubmitted(mine)
    } catch (e) {
      setError(e.message || 'Could not load your feedback.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const byEnrollment = useMemo(() => {
    const map = new Map()
    submitted.forEach((f) => map.set(f.enrollment_id, f))
    return map
  }, [submitted])

  const pending = rows.filter((r) => r.status === 'pending')
  const done = rows.filter((r) => r.status === 'submitted')

  const openForm = (row) => {
    setTarget(row)
    setForm(EMPTY)
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    if (!form.rating) {
      toast('Please choose a star rating first.', 'warning')
      return
    }
    if (!form.feedbackText.trim()) {
      toast('Please write your feedback before submitting.', 'warning')
      return
    }
    setSaving(true)
    try {
      await submitTrainerFeedback({
        enrollmentId: target.enrollment_id,
        feedbackText: form.feedbackText.trim(),
        learningExperience: form.learningExperience.trim(),
        trainerStrengths: form.trainerStrengths.trim(),
        areasForImprovement: form.areasForImprovement.trim(),
        recommendation: form.recommendation.trim(),
        rating: form.rating || null,
      })
      toast('Thank you — your feedback was submitted.', 'success')
      setTarget(null)
      await load()
    } catch (e) {
      toast(e.message || 'Could not submit your feedback.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!feedbackBackendAvailable) {
    return (
      <div>
        <PageHeader title="Trainer Feedback" description="Evaluate the trainer of each completed program." />
        <Card>
          <EmptyState
            icon={MessageSquareQuote}
            title="Backend not configured"
            description="Connect Supabase to submit trainer feedback."
          />
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Trainer Feedback"
        description="Once a program is completed, tell us how your trainer did. Feedback is permanent once submitted."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting feedback" value={pending.length} icon={Clock3} tone="warning" />
        <StatCard label="Submitted" value={done.length} icon={CheckCircle2} tone="success" />
        <StatCard label="Programs" value={rows.length} icon={GraduationCap} tone="brand" />
      </div>

      {error ? (
        <Card className="mb-5">
          <CardBody>
            <p className="text-sm text-red-600">{error}</p>
          </CardBody>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Loading…</p>
          </CardBody>
        </Card>
      ) : rows.length ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {rows.map((row) => {
            const meta = statusMeta[row.status] || statusMeta.not_required
            const program = programById(row.program_id)
            const trainer = db.users.find((u) => u.id === row.trainer_id)
            const record = byEnrollment.get(row.enrollment_id)
            const completion = row.completion || {}
            return (
              <Card key={row.enrollment_id}>
                <CardBody className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={row.trainer_name || 'Trainer'} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">{row.trainer_name || 'Unassigned trainer'}</p>
                      <p className="text-xs text-slate-400">{trainer?.position || 'Trainer'}</p>
                    </div>
                    <Badge tone={meta.tone} dot>
                      {meta.label}
                    </Badge>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-sm font-medium text-slate-700">{row.program_title || program?.title}</p>
                    <p className="text-xs text-slate-500">
                      {program?.code || row.program_id}
                      {completion.complete ? ' · Program completed' : ''}
                    </p>
                  </div>

                  {row.status === 'submitted' ? (
                    <>
                      <div className="space-y-2 text-sm text-slate-600">
                        <p className="line-clamp-3 whitespace-pre-line">{record?.feedback_text}</p>
                        {record?.rating ? (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Stars value={record.rating} size="sm" />
                            <span>{record.rating}/5</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                          Submitted {formatDate(row.submitted_at || record?.submitted_at)}
                        </p>
                        <Button variant="secondary" onClick={() => setViewing(record)}>
                          View
                        </Button>
                      </div>
                    </>
                  ) : row.status === 'pending' ? (
                    <>
                      <p className="text-sm text-slate-500">
                        You completed this program. Share how the training went while it is still fresh.
                      </p>
                      <Button icon={MessageSquareQuote} onClick={() => openForm(row)} className="w-full">
                        Write feedback
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Feedback opens once every lesson, quiz and exam of this program is completed.
                    </p>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Star}
            title="No programs yet"
            description="Once you are enrolled in a program, it will appear here."
          />
        </Card>
      )}

      <Modal
        open={Boolean(target)}
        onClose={() => (saving ? null : setTarget(null))}
        title="Trainer feedback"
        subtitle={target ? `${target.trainer_name} · ${target.program_title}` : ''}
        icon={MessageSquareQuote}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button icon={Send} onClick={save} loading={saving}>
              Submit feedback
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">
              Your rating <span className="text-red-500">*</span>
            </p>
            <Stars value={form.rating} onChange={(n) => set('rating', n)} />
            <p className="mt-1 text-xs text-slate-400">
              1–5 stars. This is submitted once, together with your written feedback.
            </p>
          </div>

          <FormField
            label="Your feedback"
            required
            hint="Required. This is read by the Super Admin."
          >
            <Textarea
              rows={4}
              value={form.feedbackText}
              onChange={(e) => set('feedbackText', e.target.value)}
              placeholder="How was the training overall?"
            />
          </FormField>

          <FormField label="Learning experience">
            <Textarea
              rows={3}
              value={form.learningExperience}
              onChange={(e) => set('learningExperience', e.target.value)}
              placeholder="What did you learn, and how was the pace?"
            />
          </FormField>

          <FormField label="Trainer strengths">
            <Textarea
              rows={3}
              value={form.trainerStrengths}
              onChange={(e) => set('trainerStrengths', e.target.value)}
              placeholder="What did your trainer do well?"
            />
          </FormField>

          <FormField label="Areas for improvement">
            <Textarea
              rows={3}
              value={form.areasForImprovement}
              onChange={(e) => set('areasForImprovement', e.target.value)}
              placeholder="What could be improved?"
            />
          </FormField>

          <FormField label="Recommendation">
            <Textarea
              rows={2}
              value={form.recommendation}
              onChange={(e) => set('recommendation', e.target.value)}
              placeholder="Would you recommend this trainer or program?"
            />
          </FormField>

        </div>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title="Your submitted feedback"
        subtitle={viewing ? formatDate(viewing.submitted_at) : ''}
        icon={CheckCircle2}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Close
          </Button>
        }
      >
        {viewing ? (
          <div className="space-y-4 text-sm text-slate-600">
            {viewing.rating ? (
              <div className="flex items-center gap-2">
                <Stars value={viewing.rating} size="sm" />
                <span className="text-xs text-slate-500">{viewing.rating}/5</span>
              </div>
            ) : null}
            <Section label="Feedback" value={viewing.feedback_text} />
            <Section label="Learning experience" value={viewing.learning_experience} />
            <Section label="Trainer strengths" value={viewing.trainer_strengths} />
            <Section label="Areas for improvement" value={viewing.areas_for_improvement} />
            <Section label="Recommendation" value={viewing.recommendation} />
            <p className="text-xs text-slate-400">
              Submitted feedback cannot be edited. Contact the Super Admin if a correction is needed.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function Section({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-line text-slate-700">{value}</p>
    </div>
  )
}

export default TrainerFeedback
