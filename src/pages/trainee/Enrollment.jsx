import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UserPlus,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Wallet,
  Ticket,
  ClipboardCheck,
  FileText,
  Info,
  Search,
  CreditCard,
  Lock,
  Eye,
  Upload,
  Download,
  AlertTriangle,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { enrollmentsOf, programById } from '../../store/selectors'
import {
  PageHeader,
  Card,
  CardBody,
  CardHeader,
  Button,
  Badge,
  Input,
  Select,
  FormField,
  FormRow,
  EmptyState,
  SearchInput,
  Modal,
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { CourseIcon } from '../../components/courses/CourseIcon'
import { currency, formatDate, cn, sanitizePhone } from '../../lib/utils'
import { documentRequirements } from '../../lib/requirements'
import {
  PAYABLE_STATUSES,
  applyRequirementResubmission,
  canPayEnrollment,
  isEnrollmentLocked,
  requirementCounts,
} from '../../lib/enrollmentRequirements'

// Admission requirements are stored inline with the enrollment (data URL, like
// lesson materials), so keep each file small enough for the row to stay usable.
const MAX_REQUIREMENT_BYTES = 4 * 1024 * 1024

const VOUCHER_OPTIONS = [
  'TESDA Training for Work Scholarship Program (TWSP)',
  'Special Training for Employment Program (STEP)',
  'Universal Access to Quality Tertiary Education',
  'PESO Skills Training Voucher',
]

const requirementTone = (status) =>
  status === 'Verified' ? 'success' : status === 'Rejected' ? 'danger' : status === 'Submitted' ? 'info' : 'neutral'

// The trainee's own copy of the enrollment form. It stays readable after the
// registrar rejects the application or one of its documents, and a rejected
// document can be replaced without starting a new application.
export function ApplicationModal({ enrollment, onClose, onResubmit }) {
  if (!enrollment) return null

  const program = programById(enrollment.programId)
  const requirements = enrollment.requirements || []
  const applicant = enrollment.applicant || {}
  const closed = isEnrollmentLocked(enrollment)

  return (
    <Modal
      open
      onClose={onClose}
      title="Enrollment Form"
      subtitle={program?.title}
      icon={ClipboardCheck}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        {closed && (
          <div className="space-y-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {enrollment.status === 'Rejected'
                  ? 'Your enrollment application was rejected by the registrar.'
                  : 'This application was cancelled.'}{' '}
                This record is read-only — you can view it here, but it can no longer be modified.
              </p>
            </div>
            {enrollment.decisionRemarks && (
              <div className="rounded-lg bg-white/70 p-3">
                <p className="font-semibold text-red-700">Registrar's remarks</p>
                <p className="mt-1 whitespace-pre-line text-red-800">{enrollment.decisionRemarks}</p>
                {enrollment.decisionAt && (
                  <p className="mt-1 text-[11px] text-red-500">Recorded {formatDate(enrollment.decisionAt)}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Program', value: program?.title },
            { label: 'Applied Date', value: formatDate(enrollment.appliedDate) },
            { label: 'Type', value: enrollment.type === 'scholarship' ? 'Scholarship / Voucher' : 'Self-Pay' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{item.label}</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-700">{item.value || '—'}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
          <span className="text-sm text-slate-500">Application status</span>
          <StatusBadge status={enrollment.status} />
        </div>

        {Object.keys(applicant).length > 0 && (
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Applicant Information</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                { label: 'Full Name', value: applicant.fullName },
                { label: 'Email', value: applicant.email },
                { label: 'Contact Number', value: applicant.contact },
                { label: 'Date of Birth', value: applicant.birthDate ? formatDate(applicant.birthDate) : '' },
                { label: 'Education', value: applicant.education },
                { label: 'Preferred Schedule', value: applicant.preferredSchedule },
                { label: 'Address', value: applicant.address },
                { label: 'Emergency Contact', value: applicant.emergencyContactName || applicant.emergencyContact },
                { label: 'Emergency Number', value: applicant.emergencyContactNumber },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="font-medium text-slate-700">{item.value || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-100 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <FileText className="h-4 w-4" /> Admission Requirements
          </p>
          <p className="mt-1 text-xs text-slate-400">
            If the registrar rejects a document, upload a new copy here. It goes back to the verification queue.
          </p>
          <div className="mt-3 space-y-2">
            {requirements.length ? (
              requirements.map((r) => (
                <div key={r.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700">{r.name}</p>
                      <p className="truncate text-xs text-slate-400">
                        {r.fileName ? r.fileName : r.status === 'Missing' ? 'Not submitted' : 'No file attached'}
                      </p>
                      {r.status === 'Rejected' && (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          Rejected by the registrar. Upload a new copy.
                        </p>
                      )}
                      {r.note && <p className="mt-1 text-xs text-slate-500">Note: {r.note}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={requirementTone(r.status)}>{r.status}</Badge>
                      {r.url && (
                        <a
                          href={r.url}
                          download={r.fileName || r.name}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      )}
                      {!closed && r.status !== 'Verified' && (
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700">
                          <Upload className="h-3.5 w-3.5" />
                          {r.status === 'Missing' ? 'Upload' : 'Replace'}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={(ev) => {
                              const file = ev.target.files?.[0]
                              ev.target.value = ''
                              if (file) onResubmit(r.name, file)
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No document requirements for this program.</p>
            )}
          </div>
        </div>

        {enrollment.type === 'scholarship' && enrollment.voucher && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <Ticket className="h-4 w-4" /> Scholarship / Voucher
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-emerald-700">Voucher</p>
                <p className="font-medium text-emerald-900">{enrollment.voucher.name}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700">Number</p>
                <p className="font-medium text-emerald-900">{enrollment.voucher.number}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700">Sponsor</p>
                <p className="font-medium text-emerald-900">{enrollment.voucher.sponsor}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700">Date</p>
                <p className="font-medium text-emerald-900">{formatDate(enrollment.voucher.date)}</p>
              </div>
            </div>
          </div>
        )}

        {enrollment.type === 'self-pay' && enrollment.payment && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Wallet className="h-4 w-4" /> Payment Details
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Training Fee</p>
                <p className="font-semibold text-slate-700">{currency(enrollment.payment.fee)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Amount Paid</p>
                <p className="font-semibold text-emerald-600">{currency(enrollment.payment.amountPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Balance</p>
                <p className="font-semibold text-red-600">{currency(enrollment.payment.balance)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <StatusBadge status={enrollment.payment.status} />
              </div>
            </div>
            {!closed && !canPayEnrollment(enrollment) && (
              <p className="mt-3 text-xs font-medium text-amber-600">
                {PAYABLE_STATUSES.includes(enrollment.status)
                  ? 'Payment unlocks after the admin verifies all requirements.'
                  : 'Payment unlocks after the admin approves this enrollment.'}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function Enrollment() {
  const { db, user, settings, createEnrollment, resubmitEnrollmentRequirement, toast } = useApp()
  // Online self-enrollment can be switched off by the admin. Existing
  // applications stay visible and editable; only new ones are blocked.
  const selfEnrollOpen = settings?.allowSelfEnroll !== false
  const myEnrollments = [...enrollmentsOf(db, user.id)].sort((a, b) => {
    const dateDiff = new Date(b.appliedDate) - new Date(a.appliedDate)
    if (dateDiff !== 0) return dateDiff
    // Same-day re-application: show the live application above the rejected
    // record it replaces.
    const rank = (status) =>
      ['Pending', 'Under Review', 'Approved', 'Enrolled', 'Completed', 'Rejected', 'Cancelled'].indexOf(status)
    return rank(a.status) - rank(b.status)
  })

  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('scholarship')
  const [form, setForm] = useState({})
  const [reqDocs, setReqDocs] = useState({})
  const [submitted, setSubmitted] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [viewing, setViewing] = useState(null)

  // A rejected/cancelled application no longer blocks the program, so Enroll
  // Now comes back and the trainee can submit a fresh application. The old row
  // stays in the list as a record.
  const enrolledIds = myEnrollments
    .filter((e) => !['Rejected', 'Cancelled'].includes(e.status))
    .map((e) => e.programId)
  const available = db.programs
  const filtered = available.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))

  const reset = () => {
    setStep(1)
    setSelected(null)
    setForm({})
    setReqDocs({})
    setType('scholarship')
    setSubmitted(null)
  }

  const startEnroll = (program) => {
    if (!selfEnrollOpen) {
      toast('Online enrollment is currently closed. Please contact the registrar.', 'warning')
      return
    }
    setSelected(program)
    setForm({
      fullName: user.name || '',
      email: user.email || '',
      contact: user.phone || '',
      address: user.address || '',
      birthDate: user.birthDate || '',
      education: user.education || '',
      emergencyContactName: user.emergencyContactName || '',
      emergencyContactNumber: user.emergencyContactNumber || '',
      preferredSchedule: '',
    })
    setReqDocs({})
    setType('self-pay')
    setStep(2)
  }

  // Read one admission requirement as a data URL (same pattern as lesson
  // materials and the signup avatar — no storage bucket is required).
  const attachRequirement = (name, file) => {
    if (!file) return
    if (file.size > MAX_REQUIREMENT_BYTES) {
      toast('File is too large. Upload a file up to 4 MB.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setReqDocs((docs) => ({
        ...docs,
        [name]: { fileName: file.name, type: file.type, size: file.size, url: String(reader.result || '') },
      }))
    }
    reader.onerror = () => toast('Could not read that file. Please try again.', 'error')
    reader.readAsDataURL(file)
  }

  const removeRequirement = (name) => {
    setReqDocs((docs) => {
      const next = { ...docs }
      delete next[name]
      return next
    })
  }

  // Re-open the live row (not the snapshot captured when the page rendered) so
  // requirement statuses are current.
  const openApplication = (enrollment) => {
    setViewing(db.enrollments.find((e) => e.id === enrollment.id) || enrollment)
  }

  const resubmitRequirement = (name, file) => {
    if (!viewing || !file) return
    if (file.size > MAX_REQUIREMENT_BYTES) {
      toast('File is too large. Upload a file up to 4 MB.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const doc = { fileName: file.name, type: file.type, size: file.size, url: String(reader.result || '') }
      const res = resubmitEnrollmentRequirement(viewing.id, name, doc)
      if (!res.ok) {
        toast(res.error, 'error')
        return
      }
      setViewing((v) => applyRequirementResubmission(v, name, doc))
    }
    reader.onerror = () => toast('Could not read that file. Please try again.', 'error')
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    if (submitting) return
    const base = {
      traineeId: user.id,
      programId: selected.id,
      type,
      status: 'Pending',
      appliedDate: new Date().toISOString().slice(0, 10),
      startDate: null,
      endDate: null,
      progress: {},
      certificateIssued: false,
      applicant: {
        fullName: form.fullName || user.name,
        email: form.email || user.email,
        contact: form.contact || '',
        address: form.address || '',
        birthDate: form.birthDate || '',
        education: form.education || '',
        emergencyContactName: form.emergencyContactName || '',
        emergencyContactNumber: form.emergencyContactNumber || '',
        // Legacy display field for older admin views.
        emergencyContact: [form.emergencyContactName, form.emergencyContactNumber].filter(Boolean).join(' · '),
        preferredSchedule: form.preferredSchedule || '',
      },
      requirements: documentRequirements(selected.requirements || []).map((name) => {
        const doc = reqDocs[name]
        if (!doc) return { name, status: 'Missing', note: '', submittedAt: null }
        return {
          name,
          fileName: doc.fileName,
          type: doc.type,
          size: doc.size,
          url: doc.url,
          status: 'Submitted',
          note: '',
          submittedAt: new Date().toISOString(),
          verifiedAt: null,
          verifiedBy: null,
        }
      }),
    }
    if (type === 'scholarship') {
      base.voucher = {
        name: form.voucherName || VOUCHER_OPTIONS[0],
        number: form.voucherNumber || `VCH-${Date.now().toString().slice(-6)}`,
        sponsor: form.sponsor || 'TESDA',
        date: form.date || new Date().toISOString().slice(0, 10),
      }
      base.payment = { fee: 0, status: 'Fully Paid', amountPaid: 0, balance: 0, paymentDate: null, referenceNo: null, note: 'Fully funded by scholarship/voucher' }
    } else {
      // Payment is intentionally not collected during enrollment: the admin
      // verifies the requirements and approves the application first, then the
      // trainee pays from My Payments.
      base.payment = {
        fee: selected.fee,
        status: 'Unpaid',
        amountPaid: 0,
        balance: selected.fee,
        paymentDate: null,
        referenceNo: null,
        note: 'Payment unlocks after enrollment approval',
      }
    }
    setSubmitting(true)
    try {
      // Awaited: the server can still refuse the row when enrollment was closed
      // after this form was opened, and then nothing must be shown as submitted.
      const res = await createEnrollment(base)
      if (!res.ok) return
      setSubmitted(base)
      setStep(4)
    } finally {
      setSubmitting(false)
    }
  }

  // ------------------------------- STEP 1 -----------------------------------
  if (step === 1) {
    return (
      <div>
        <PageHeader
          title="Enrollment"
          description="Browse available training programs and submit an enrollment application."
        />

        {/* My applications */}
        {myEnrollments.length > 0 && (
          <Card className="mb-6">
            <CardHeader title="My Applications" subtitle="Track the status of your enrollment requests" icon={ClipboardCheck} />
            <div className="divide-y divide-slate-100">
              {myEnrollments.map((e) => {
                const p = programById(e.programId)
                const requirements = e.requirements || []
                const { total, verified, rejected: rejectedDocs } = requirementCounts(requirements)
                return (
                  <div key={e.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br',
                          p?.color,
                        )}
                      >
                        <CourseIcon program={p} className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{p?.title}</p>
                        <p className="text-xs text-slate-400">
                          Applied {formatDate(e.appliedDate)} · {e.type === 'scholarship' ? 'Scholarship / Voucher' : 'Self-Pay'}
                        </p>
                        {['Rejected', 'Cancelled'].includes(e.status) && e.decisionRemarks && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-red-500">Remarks: {e.decisionRemarks}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {requirements.length > 0 && (
                        <Badge tone={verified === requirements.length ? 'success' : 'warning'}>
                          Requirements {verified}/{total}
                        </Badge>
                      )}
                      {rejectedDocs > 0 && <Badge tone="danger">{rejectedDocs} rejected</Badge>}
                      {e.type === 'self-pay' &&
                        (canPayEnrollment(e) ? (
                          <StatusBadge status={e.payment?.status} />
                        ) : (
                          <Badge tone="neutral">
                            <Lock className="h-3 w-3" /> Payment locked
                          </Badge>
                        ))}
                      <StatusBadge status={e.status} />
                      <Button size="sm" variant="secondary" icon={Eye} onClick={() => openApplication(e)}>
                        View form
                      </Button>
                      {e.type === 'self-pay' &&
                        (e.payment?.balance || 0) > 0 &&
                        canPayEnrollment(e) && (
                          <Link to="/trainee/payments">
                            <Button size="sm" icon={CreditCard}>
                              Pay Now
                            </Button>
                          </Link>
                        )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Available Programs</h2>
          <SearchInput value={query} onChange={setQuery} placeholder="Search program…" className="w-56" />
        </div>

        {filtered.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <Card key={p.id} hover className="flex flex-col overflow-hidden">
                <div className="relative h-28 overflow-hidden bg-slate-100">
                  {p.image && (
                    <img
                      src={p.image}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <div className={cn('absolute inset-0 bg-gradient-to-t opacity-80', p.color)} />
                  <div className="absolute inset-0 flex items-start justify-between p-4 text-white">
                    <CourseIcon program={p} className="h-8 w-8" />
                    <div className="flex flex-col items-end gap-1">
                      {p.special && <Badge className="bg-white/20 text-white ring-white/30">Special</Badge>}
                      <Badge className="bg-white/20 text-white ring-white/30">{p.level}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-xs font-medium text-slate-400">{p.code}</p>
                  <h3 className="text-sm font-bold text-slate-800">{p.title}</h3>
                  <p className="mt-1 line-clamp-2 flex-1 text-xs text-slate-500">{p.description}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{p.duration}</span>
                    <span className="font-semibold text-slate-700">{currency(p.fee)}</span>
                  </div>
                  {enrolledIds.includes(p.id) ? (
                    <Button className="mt-4" size="sm" variant="secondary" disabled>
                      Already applied
                    </Button>
                  ) : p.enrollable ? (
                    <>
                      <div className="mt-4">
                        <Badge tone={selfEnrollOpen ? 'success' : 'warning'} dot>
                          {selfEnrollOpen ? 'Enrollment Available' : 'Online enrollment closed'}
                        </Badge>
                      </div>
                      <Button
                        className="mt-2"
                        size="sm"
                        iconRight={selfEnrollOpen ? ChevronRight : undefined}
                        onClick={() => startEnroll(p)}
                        disabled={!selfEnrollOpen}
                      >
                        {selfEnrollOpen ? 'Enroll Now' : 'Enrollment closed'}
                      </Button>
                    </>
                  ) : (
                    <div className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 py-2 text-xs font-medium text-slate-500">
                      <Lock className="h-3.5 w-3.5" /> Enrollment: Contact Admin
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={CheckCircle2}
              title={available.length ? 'No matching programs' : 'You are enrolled in all available programs'}
              description={available.length ? 'Try a different search term.' : 'Check your courses to continue learning.'}
            />
          </Card>
        )}

        <ApplicationModal enrollment={viewing} onClose={() => setViewing(null)} onResubmit={resubmitRequirement} />
      </div>
    )
  }

  // ------------------------------- STEP 2 -----------------------------------
  if (step === 2 && selected) {
    return (
      <div>
        <button onClick={reset} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to programs
        </button>

        <div className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white', selected.color)}>
          <div className="flex items-center gap-4">
            <CourseIcon program={selected} className="h-10 w-10" />
            <div>
              <p className="text-xs opacity-90">{selected.code} · {selected.level}</p>
              <h1 className="text-2xl font-bold">{selected.title}</h1>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-white/85">{selected.overview}</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Program Details" icon={Info} />
              <CardBody>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    { label: 'Duration', value: selected.duration },
                    { label: 'Training Hours', value: `${selected.hours} hrs` },
                    { label: 'Level', value: selected.level },
                    { label: 'Category', value: selected.category },
                    { label: 'Training Fee', value: currency(selected.fee) },
                    { label: 'Competencies', value: '3 (Basic, Common, Core)' },
                  ].map((i) => (
                    <div key={i.label} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">{i.label}</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-700">{i.value}</p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Admission Requirements" icon={FileText} />
              <CardBody>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(selected.requirements || []).map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Competency Structure" icon={ClipboardCheck} />
              <CardBody className="space-y-2">
                {selected.competencies.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                    <div>
                      <Badge tone={c.type === 'Core' ? 'purple' : c.type === 'Common' ? 'info' : 'brand'}>{c.type}</Badge>
                      <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="lg:sticky lg:top-20">
              <CardHeader title="Choose Enrollment Type" icon={Wallet} />
              <CardBody className="space-y-3">
                {[
                  { key: 'scholarship', title: 'Scholarship / Voucher', desc: 'Funded by TESDA or a sponsor', icon: Ticket },
                  { key: 'self-pay', title: 'Self-Pay / Paying Trainee', desc: `Training fee: ${currency(selected.fee)}`, icon: Wallet },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setType(opt.key)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition',
                      type === opt.key ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-brand-200',
                    )}
                  >
                    <opt.icon className={cn('mt-0.5 h-5 w-5 shrink-0', type === opt.key ? 'text-brand-600' : 'text-slate-400')} />
                    <span>
                      <span className="block text-sm font-semibold text-slate-700">{opt.title}</span>
                      <span className="block text-xs text-slate-500">{opt.desc}</span>
                    </span>
                  </button>
                ))}
                <Button className="w-full" size="lg" iconRight={ChevronRight} onClick={() => setStep(3)}>
                  Continue to form
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------- STEP 3 -----------------------------------
  if (step === 3 && selected) {
    return (
      <div className="mx-auto max-w-3xl">
        <button onClick={() => setStep(2)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to program details
        </button>

        <Card>
          <CardHeader
            title={type === 'scholarship' ? 'Scholarship / Voucher Enrollment' : 'Self-Pay Enrollment'}
            subtitle={selected.title}
            icon={type === 'scholarship' ? Ticket : Wallet}
          />
          <CardBody className="space-y-5">
            {type === 'scholarship' ? (
              <>
                <FormField label="Voucher / Scholarship Name" required>
                  <Select value={form.voucherName || VOUCHER_OPTIONS[0]} onChange={(e) => setForm({ ...form, voucherName: e.target.value })}>
                    {VOUCHER_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormRow>
                  <FormField label="Voucher Number" required hint="Found on your voucher document">
                    <Input value={form.voucherNumber || ''} onChange={(e) => setForm({ ...form, voucherNumber: e.target.value })} placeholder="VCH-2026-0001" />
                  </FormField>
                  <FormField label="Sponsor" required>
                    <Input value={form.sponsor || ''} onChange={(e) => setForm({ ...form, sponsor: e.target.value })} placeholder="TESDA / PESO / LGU" />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Training Program">
                    <Input value={selected.title} disabled />
                  </FormField>
                  <FormField label="Date">
                    <Input type="date" value={form.date || new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Emergency Contact Name">
                    <Input
                      value={form.emergencyContactName || ''}
                      onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                      placeholder="Full name"
                    />
                  </FormField>
                  <FormField label="Emergency Contact Number">
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={form.emergencyContactNumber || ''}
                      onChange={(e) => setForm({ ...form, emergencyContactNumber: sanitizePhone(e.target.value) })}
                      placeholder="+63 917 000 0000"
                    />
                  </FormField>
                </FormRow>
                <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="flex items-center gap-2 font-semibold">
                    <Info className="h-4 w-4" /> No payment required
                  </p>
                  <p className="mt-1 text-emerald-700">
                    Your training fee is fully covered by the scholarship or voucher. Submit the form to begin review.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Applicant Information</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="Full Name" required>
                      <Input value={form.fullName || ''} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                    </FormField>
                    <FormField label="Email" required>
                      <Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </FormField>
                    <FormField label="Contact Number" required>
                      <Input type="tel" inputMode="tel" value={form.contact || ''} onChange={(e) => setForm({ ...form, contact: sanitizePhone(e.target.value) })} placeholder="+63 917 000 0000" />
                    </FormField>
                    <FormField label="Date of Birth">
                      <Input type="date" value={form.birthDate || ''} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                    </FormField>
                    <FormField label="Educational Background">
                      <Input value={form.education || ''} onChange={(e) => setForm({ ...form, education: e.target.value })} placeholder="e.g. Senior High School Graduate" />
                    </FormField>
                    <FormField label="Emergency Contact Name">
                      <Input
                        value={form.emergencyContactName || ''}
                        onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                        placeholder="Full name"
                      />
                    </FormField>
                    <FormField label="Emergency Contact Number">
                      <Input
                        type="tel"
                        inputMode="tel"
                        value={form.emergencyContactNumber || ''}
                        onChange={(e) => setForm({ ...form, emergencyContactNumber: sanitizePhone(e.target.value) })}
                        placeholder="+63 917 000 0000"
                      />
                    </FormField>
                    <FormField label="Preferred Schedule">
                      <Select value={form.preferredSchedule || ''} onChange={(e) => setForm({ ...form, preferredSchedule: e.target.value })}>
                        <option value="">No preference</option>
                        <option>Morning (8AM–12PM)</option>
                        <option>Afternoon (1PM–5PM)</option>
                        <option>Evening (6PM–9PM)</option>
                        <option>Weekend</option>
                      </Select>
                    </FormField>
                    <FormField label="Address">
                      <Input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </FormField>
                  </div>
                </div>

                <FormRow>
                  <FormField label="Course">
                    <Input value={selected.title} disabled />
                  </FormField>
                  <FormField label="Training Fee">
                    <Input value={currency(selected.fee)} disabled />
                  </FormField>
                </FormRow>
                <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="flex items-center gap-2 font-semibold">
                    <Info className="h-4 w-4" /> Payment after approval
                  </p>
                  <p className="mt-1 text-amber-700">
                    No payment is collected here. Once the admin verifies your requirements and approves your
                    enrollment, you can pay the {currency(selected.fee)} training fee from <strong>My Payments</strong>.
                  </p>
                </div>
              </>
            )}

            {documentRequirements(selected.requirements || []).length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents to Upload</p>
              <p className="mt-1 text-xs text-slate-500">
                Upload a clear photo or PDF of each document below. The Super Admin will verify each one before your
                enrollment is approved.
              </p>
              <div className="mt-3 space-y-2">
                {documentRequirements(selected.requirements || []).map((name, i) => {
                  const doc = reqDocs[name]
                  const inputId = 'requirement-' + selected.id + '-' + i
                  return (
                    <div
                      key={name}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {doc ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-slate-700">{name}</p>
                          <p className="truncate text-xs text-slate-400">
                            {doc ? doc.fileName : 'No file uploaded yet'}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {doc && (
                          <Button size="sm" variant="secondary" onClick={() => removeRequirement(name)}>
                            Remove
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => document.getElementById(inputId)?.click()}
                        >
                          {doc ? 'Replace' : 'Upload'}
                        </Button>
                        <input
                          id={inputId}
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            attachRequirement(name, e.target.files?.[0])
                            e.target.value = ''
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            )}

            {!selfEnrollOpen && (
              <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Online enrollment was closed by the administrator. Your answers are kept — please contact the registrar.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                icon={CheckCircle2}
                onClick={submit}
                loading={submitting}
                disabled={!selfEnrollOpen || submitting}
              >
                Submit Enrollment
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  // ------------------------------- STEP 4 -----------------------------------
  return (
    <div className="mx-auto max-w-xl">
      <Card className="overflow-hidden text-center">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-xl font-bold">Enrollment Submitted!</h1>
          <p className="mt-1 text-sm text-white/85">
            Your application for {selected?.title} has been received and is now pending review.
          </p>
        </div>
        <CardBody className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4 text-left">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Status</span>
              <StatusBadge status="Pending" />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-500">Type</span>
              <Badge tone={type === 'scholarship' ? 'success' : 'brand'}>
                {type === 'scholarship' ? 'Scholarship / Voucher' : 'Self-Pay'}
              </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-500">Date Submitted</span>
              <span className="font-medium text-slate-700">{formatDate(submitted?.appliedDate)}</span>
            </div>
          </div>
          {submitted?.requirements?.length > 0 && (
            <div className="rounded-lg bg-slate-50 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admission Requirements</p>
              <ul className="mt-2 space-y-1.5">
                {submitted.requirements.map((r) => (
                  <li key={r.name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-600">{r.name}</span>
                    <Badge tone={r.status === 'Submitted' ? 'info' : 'neutral'}>
                      {r.status === 'Submitted' ? 'Submitted' : 'Not submitted'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {type === 'self-pay' && (
            <div className="rounded-lg bg-amber-50 p-4 text-left text-xs text-amber-800">
              <p className="font-semibold">Payment is not collected yet.</p>
              <p className="mt-1">
                Once the admin verifies your requirements and approves your enrollment, <strong>Pay Now</strong> will
                appear in My Payments.
              </p>
            </div>
          )}
          <p className="text-xs text-slate-400">
            You will be notified once the registrar reviews your application. Track the status on this page.
          </p>
          <Button className="w-full" onClick={reset} icon={UserPlus}>
            Enroll in another program
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}

export default Enrollment
