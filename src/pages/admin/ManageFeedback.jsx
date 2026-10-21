import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, MessageSquareQuote, PencilLine, RefreshCw, ShieldAlert, Star } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  EmptyState,
  Modal,
  Input,
  Select,
  Textarea,
  FormField,
  FormRow,
  Stars,
  Avatar,
} from '../../components/ui'
import { Table, THead, Th, TBody, Tr, Td } from '../../components/ui/Table'
import { formatDate } from '../../lib/utils'
import {
  feedbackBackendAvailable,
  fetchAdminFeedbackPage,
  correctTrainerFeedback,
  downloadFeedbackCsv,
} from '../../lib/feedback'

const PAGE_SIZE = 25

const EMPTY_FILTERS = { trainer_id: '', program_id: '', date_from: '', date_to: '', search: '' }

export function ManageFeedback() {
  const { db, toast } = useApp()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [applied, setApplied] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [correcting, setCorrecting] = useState(false)
  const [correction, setCorrection] = useState(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const trainers = useMemo(() => db.users.filter((u) => u.role === 'trainer'), [db.users])
  const programs = useMemo(() => db.programs, [db.programs])

  const load = useCallback(async () => {
    if (!feedbackBackendAvailable) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminFeedbackPage(applied, PAGE_SIZE + 1, page * PAGE_SIZE)
      setRows(data)
    } catch (e) {
      setError(e.message || 'Could not load feedback.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [applied, page])

  useEffect(() => {
    load()
  }, [load])

  const hasNext = rows.length > PAGE_SIZE
  const visible = hasNext ? rows.slice(0, PAGE_SIZE) : rows

  const apply = () => {
    setPage(0)
    setApplied(filters)
  }

  const reset = () => {
    setFilters(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    setPage(0)
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      await downloadFeedbackCsv(applied)
      toast('Export started. The download was recorded in the audit log.', 'success')
    } catch (e) {
      toast(e.message || 'Export failed.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const openCorrection = (row) => {
    setCorrection({
      id: row.id,
      feedbackText: row.feedback_text || '',
      learningExperience: row.learning_experience || '',
      trainerStrengths: row.trainer_strengths || '',
      areasForImprovement: row.areas_for_improvement || '',
      recommendation: row.recommendation || '',
    })
    setReason('')
  }

  const saveCorrection = async () => {
    if (!correction.feedbackText.trim()) {
      toast('Feedback text cannot be empty.', 'warning')
      return
    }
    if (!reason.trim()) {
      toast('A reason is required for the audit trail.', 'warning')
      return
    }
    setSaving(true)
    try {
      await correctTrainerFeedback({ ...correction, reason: reason.trim() })
      toast('Correction saved. The original values were kept in the revision history.', 'success')
      setCorrection(null)
      setDetail(null)
      await load()
    } catch (e) {
      toast(e.message || 'Could not save the correction.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const mfaRequired = /mfa|aal2/i.test(error)

  if (!feedbackBackendAvailable) {
    return (
      <div>
        <PageHeader title="Trainer Feedback" description="Qualitative feedback submitted by trainees." />
        <Card>
          <EmptyState icon={MessageSquareQuote} title="Backend not configured" description="Connect Supabase to read feedback." />
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Trainer Feedback"
        description="Every submitted trainee evaluation, filterable and exportable."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>
              Refresh
            </Button>
            <Button icon={Download} onClick={exportCsv} loading={exporting}>
              Export CSV
            </Button>
          </div>
        }
      />

      {mfaRequired ? (
        <Card className="mb-5 border-amber-200">
          <CardBody className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-slate-800">Multi-factor authentication required</p>
              <p className="mt-1 text-sm text-slate-600">
                Feedback contains trainee evaluations and is only readable by a Super Admin at AAL2. Verify your
                authenticator in <span className="font-medium">System Settings → Security</span> and reload this page.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-5">
        <CardBody className="space-y-4">
          <FormRow cols={3}>
            <FormField label="Trainer">
              <Select value={filters.trainer_id} onChange={(e) => setFilters({ ...filters, trainer_id: e.target.value })}>
                <option value="">All trainers</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Program">
              <Select value={filters.program_id} onChange={(e) => setFilters({ ...filters, program_id: e.target.value })}>
                <option value="">All programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Search">
              <Input
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Words from the feedback"
              />
            </FormField>
          </FormRow>
          <FormRow cols={3}>
            <FormField label="Submitted from">
              <Input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
            </FormField>
            <FormField label="Submitted to">
              <Input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
            </FormField>
            <div className="flex items-end gap-2">
              <Button onClick={apply} className="w-full">
                Apply filters
              </Button>
              <Button variant="ghost" onClick={reset}>
                Reset
              </Button>
            </div>
          </FormRow>
        </CardBody>
      </Card>

      {error && !mfaRequired ? (
        <Card className="mb-5">
          <CardBody>
            <p className="text-sm text-red-600">{error}</p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        {loading ? (
          <CardBody>
            <p className="text-sm text-slate-500">Loading…</p>
          </CardBody>
        ) : visible.length ? (
          <Table>
            <THead>
              <Th>Submitted</Th>
              <Th>Trainer</Th>
              <Th>Trainee</Th>
              <Th>Program</Th>
              <Th>Rating</Th>
              <Th>Feedback</Th>
              <Th />
            </THead>
            <TBody>
              {visible.map((row) => (
                <Tr key={row.id} className="cursor-pointer" onClick={() => setDetail(row)}>
                  <Td className="whitespace-nowrap text-slate-500">{formatDate(row.submitted_at)}</Td>
                  <Td className="font-medium text-slate-800">{row.trainer_name}</Td>
                  <Td>{row.trainee_name}</Td>
                  <Td className="max-w-[16rem] truncate text-slate-600">{row.course_title}</Td>
                  <Td>
                    {row.rating ? (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {row.rating}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="max-w-[22rem]">
                    <span className="line-clamp-2 text-slate-600">{row.feedback_text}</span>
                    {row.corrected_at ? (
                      <Badge tone="info" className="ml-2">
                        corrected
                      </Badge>
                    ) : null}
                  </Td>
                  <Td>
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState
            icon={MessageSquareQuote}
            title="No feedback found"
            description="No submitted feedback matches these filters."
          />
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Page {page + 1}
          {visible.length ? ` · ${visible.length} row${visible.length === 1 ? '' : 's'}` : ''}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Feedback detail"
        subtitle={detail ? `${detail.trainer_name} · ${detail.course_title}` : ''}
        icon={MessageSquareQuote}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              Close
            </Button>
            <Button icon={PencilLine} onClick={() => openCorrection(detail)}>
              Correct record
            </Button>
          </>
        }
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <Avatar name={detail.trainee_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">{detail.trainee_name}</p>
                <p className="text-xs text-slate-500">
                  {detail.course_title} · submitted {formatDate(detail.submitted_at)}
                </p>
              </div>
              {detail.rating ? <Stars value={detail.rating} size="sm" /> : <Badge tone="neutral">No rating</Badge>}
            </div>
            <Section label="Feedback" value={detail.feedback_text} />
            <Section label="Learning experience" value={detail.learning_experience} />
            <Section label="Trainer strengths" value={detail.trainer_strengths} />
            <Section label="Areas for improvement" value={detail.areas_for_improvement} />
            <Section label="Recommendation" value={detail.recommendation} />
            {detail.corrected_at ? (
              <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                Corrected {formatDate(detail.corrected_at)}
                {detail.correction_reason ? ` — ${detail.correction_reason}` : ''}
              </div>
            ) : null}
            <p className="text-xs text-slate-400">
              Enrollment {detail.enrollment_id} · Trainee {detail.trainee_id}
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(correction)}
        onClose={() => (saving ? null : setCorrection(null))}
        title="Correct feedback"
        subtitle="The original values are archived before the change."
        icon={PencilLine}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCorrection(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveCorrection} loading={saving}>
              Save correction
            </Button>
          </>
        }
      >
        {correction ? (
          <div className="space-y-4">
            <FormField label="Feedback" required>
              <Textarea
                rows={4}
                value={correction.feedbackText}
                onChange={(e) => setCorrection({ ...correction, feedbackText: e.target.value })}
              />
            </FormField>
            <FormField label="Learning experience">
              <Textarea
                rows={3}
                value={correction.learningExperience}
                onChange={(e) => setCorrection({ ...correction, learningExperience: e.target.value })}
              />
            </FormField>
            <FormField label="Trainer strengths">
              <Textarea
                rows={3}
                value={correction.trainerStrengths}
                onChange={(e) => setCorrection({ ...correction, trainerStrengths: e.target.value })}
              />
            </FormField>
            <FormField label="Areas for improvement">
              <Textarea
                rows={3}
                value={correction.areasForImprovement}
                onChange={(e) => setCorrection({ ...correction, areasForImprovement: e.target.value })}
              />
            </FormField>
            <FormField label="Recommendation">
              <Textarea
                rows={2}
                value={correction.recommendation}
                onChange={(e) => setCorrection({ ...correction, recommendation: e.target.value })}
              />
            </FormField>
            <FormField label="Reason for correction" required hint="Stored in the audit trail and the revision history.">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. typo reported by the trainee" />
            </FormField>
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

export default ManageFeedback
