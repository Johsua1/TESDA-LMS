import { useState } from 'react'
import {
  UserPlus,
  CheckCircle2,
  XCircle,
  Eye,
  Wallet,
  Ticket,
  Clock,
  Search,
  Users,
  FileCheck2,
  Ban,
  FileText,
  Download,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { programById } from '../../store/selectors'
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Modal,
  Select,
  Tabs,
  EmptyState,
  Avatar,
  Badge,
  StatCard,
  SearchInput,
  FormField,
  Textarea,
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { currency, formatDate } from '../../lib/utils'
import { documentRequirements } from '../../lib/requirements'
import { PAYABLE_STATUSES, canPayEnrollment, requirementCounts } from '../../lib/enrollmentRequirements'

const STATUS_FLOW = ['Pending', 'Under Review', 'Approved', 'Enrolled', 'Completed', 'Rejected', 'Cancelled']

const requirementTone = (status) =>
  status === 'Verified' ? 'success' : status === 'Rejected' ? 'danger' : status === 'Submitted' ? 'info' : 'neutral'

export function ManageEnrollments() {
  const { db, setEnrollmentStatus, verifyEnrollmentRequirement, updatePayment, toast } = useApp()
  const [tab, setTab] = useState('pending')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [remarks, setRemarks] = useState('')

  const verifyRequirement = (requirement, status) => {
    const res = verifyEnrollmentRequirement(selected.id, requirement.name, status)
    if (!res.ok) {
      toast(res.error, 'error')
      return
    }
    setSelected({
      ...selected,
      requirements: (selected.requirements || []).map((r) =>
        r.name === requirement.name
          ? { ...r, status, verifiedAt: status === 'Submitted' ? null : new Date().toISOString() }
          : r,
      ),
    })
  }

  // Every requirement the program lists, paired with the document the trainee
  // attached (missing ones are shown so nothing is silently skipped).
  const requirementRows = selected
    ? documentRequirements(programById(selected.programId)?.requirements || []).map((name) => {
        const submitted = (selected.requirements || []).find((r) => r.name === name)
        return submitted || { name, status: 'Missing' }
      })
    : []

  // Requirements are processed before payment: the admin can only approve an
  // application once every required document is verified.
  const requirementsReady = requirementRows.length === 0 || requirementRows.every((r) => r.status === 'Verified')
  const statusBlocked = (status) =>
    !requirementsReady && status !== selected?.status && ['Approved', 'Enrolled', 'Completed'].includes(status)

  const all = [...db.enrollments].sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate))
  const pending = all.filter((e) => ['Pending', 'Under Review'].includes(e.status))
  const active = all.filter((e) => ['Approved', 'Enrolled'].includes(e.status))
  const completed = all.filter((e) => e.status === 'Completed')
  const rejected = all.filter((e) => ['Rejected', 'Cancelled'].includes(e.status))

  const source = tab === 'pending' ? pending : tab === 'active' ? active : tab === 'completed' ? completed : rejected
  const filtered = source.filter((e) => {
    const t = db.users.find((u) => u.id === e.traineeId)
    return !query || t?.name.toLowerCase().includes(query.toLowerCase())
  })

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
              <p className="text-xs text-slate-400">{t?.email}</p>
            </div>
          </div>
        )
      },
    },
    { key: 'program', header: 'Program', render: (r) => programById(r.programId)?.title },
    {
      key: 'type',
      header: 'Type',
      render: (r) => (
        <Badge tone={r.type === 'scholarship' ? 'success' : 'brand'}>
          {r.type === 'scholarship' ? 'Scholarship' : 'Self-Pay'}
        </Badge>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (r) => (r.type === 'self-pay' ? <StatusBadge status={r.payment?.status} /> : <span className="text-xs text-slate-400">Funded</span>),
    },
    { key: 'appliedDate', header: 'Applied', sortable: true, render: (r) => formatDate(r.appliedDate) },
    {
      key: 'requirements',
      header: 'Requirements',
      render: (r) => {
        const list = r.requirements || []
        if (!list.length) return <span className="text-xs text-slate-400">—</span>
        const { total, verified, rejected } = requirementCounts(list)
        return (
          <div className="flex flex-wrap items-center gap-1">
            <Badge tone={verified === total ? 'success' : verified ? 'warning' : 'neutral'}>
              {verified}/{total} verified
            </Badge>
            {rejected > 0 && <Badge tone="danger">{rejected} rejected</Badge>}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <div>
          <StatusBadge status={r.status} />
          {['Rejected', 'Cancelled'].includes(r.status) && r.decisionRemarks && (
            <p className="mt-1 line-clamp-2 max-w-[180px] text-[11px] text-slate-400">{r.decisionRemarks}</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="secondary" icon={Eye} onClick={() => setSelected(r)}>
            Review
          </Button>
        </div>
      ),
    },
  ]

  const tabs = [
    { key: 'pending', label: 'Pending Review', icon: Clock, badge: pending.length },
    { key: 'active', label: 'Enrolled', icon: Users, badge: active.length },
    { key: 'completed', label: 'Completed', icon: FileCheck2, badge: completed.length },
    { key: 'rejected', label: 'Rejected / Cancelled', icon: Ban, badge: rejected.length },
  ]

  return (
    <div>
      <PageHeader title="Enrollment" description="Review and process trainee enrollment applications." />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending Review" value={pending.length} icon={Clock} tone="warning" />
        <StatCard label="Enrolled" value={active.length} icon={Users} tone="success" />
        <StatCard label="Completed" value={completed.length} icon={FileCheck2} tone="info" />
        <StatCard label="Rejected / Cancelled" value={rejected.length} icon={Ban} tone="danger" />
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        <SearchInput value={query} onChange={setQuery} placeholder="Search by trainee…" className="sm:w-56" />
      </div>

      <Card>
        <CardHeader title="Enrollment Applications" icon={UserPlus} />
        <DataTable
          columns={columns}
          data={filtered}
          pageSize={10}
          emptyState={<EmptyState icon={UserPlus} title="No applications" description="No enrollment applications in this category." />}
        />
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Enrollment Application"
        subtitle={db.users.find((u) => u.id === selected?.traineeId)?.name}
        icon={UserPlus}
        size="lg"
        footer={
          selected && (
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
              {['Pending', 'Under Review'].includes(selected.status) && (
                <>
                  <Button
                    variant="danger"
                    icon={XCircle}
                    onClick={() => {
                      setRemarks('')
                      setConfirm({ enrollment: selected, status: 'Rejected' })
                    }}
                  >
                    Reject
                  </Button>
                  <Button variant="secondary" onClick={() => { setEnrollmentStatus(selected.id, 'Under Review'); setSelected({ ...selected, status: 'Under Review' }) }}>
                    Mark Under Review
                  </Button>
                  <Button
                    variant="success"
                    icon={CheckCircle2}
                    disabled={!requirementsReady}
                    title={requirementsReady ? undefined : 'Verify every document before approving'}
                    onClick={() => { setEnrollmentStatus(selected.id, 'Approved'); setSelected({ ...selected, status: 'Approved' }) }}
                  >
                    Approve
                  </Button>
                </>
              )}
              {['Approved', 'Enrolled'].includes(selected.status) && (
                <>
                  <Button
                    variant="secondary"
                    icon={Ban}
                    onClick={() => {
                      setRemarks('')
                      setConfirm({ enrollment: selected, status: 'Cancelled' })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="success"
                    icon={CheckCircle2}
                    disabled={!requirementsReady}
                    title={requirementsReady ? undefined : 'Verify every document before completing'}
                    onClick={() => { setEnrollmentStatus(selected.id, 'Completed'); setSelected({ ...selected, status: 'Completed' }) }}
                  >
                    Mark Completed
                  </Button>
                </>
              )}
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={db.users.find((u) => u.id === selected.traineeId)?.name} color={db.users.find((u) => u.id === selected.traineeId)?.avatarColor} size="lg" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">{db.users.find((u) => u.id === selected.traineeId)?.name}</p>
                <p className="text-xs text-slate-400">{programById(selected.programId)?.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={selected.type === 'scholarship' ? 'success' : 'brand'}>
                    {selected.type === 'scholarship' ? 'Scholarship / Voucher' : 'Self-Pay'}
                  </Badge>
                  <StatusBadge status={selected.status} />
                </div>
              </div>
            </div>

            {['Rejected', 'Cancelled'].includes(selected.status) && selected.decisionRemarks && (
              <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Decision Remarks</p>
                <p className="mt-2 whitespace-pre-line text-sm text-red-800">{selected.decisionRemarks}</p>
                {selected.decisionAt && (
                  <p className="mt-2 text-[11px] text-red-500">
                    Recorded {formatDate(selected.decisionAt)}
                  </p>
                )}
              </div>
            )}

            {selected.applicant && (
              <div className="rounded-xl border border-slate-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Applicant Information</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  {[
                    { label: 'Full Name', value: selected.applicant.fullName },
                    { label: 'Email', value: selected.applicant.email },
                    { label: 'Contact Number', value: selected.applicant.contact },
                    {
                      label: 'Date of Birth',
                      value: selected.applicant.birthDate ? formatDate(selected.applicant.birthDate) : '',
                    },
                    { label: 'Education', value: selected.applicant.education },
                    { label: 'Preferred Schedule', value: selected.applicant.preferredSchedule },
                    { label: 'Address', value: selected.applicant.address },
                    {
                      label: 'Emergency Contact',
                      value: selected.applicant.emergencyContactName || selected.applicant.emergencyContact,
                    },
                    { label: 'Emergency Number', value: selected.applicant.emergencyContactNumber },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xs text-slate-400">{item.label}</p>
                      <p className="font-medium text-slate-700">{item.value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Program', value: programById(selected.programId)?.title },
                { label: 'Applied Date', value: formatDate(selected.appliedDate) },
                { label: 'Training Fee', value: currency(selected.payment?.fee || 0) },
              ].map((i) => (
                <div key={i.label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{i.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-700">{i.value}</p>
                </div>
              ))}
            </div>

            {requirementRows.length > 0 && (
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <FileText className="h-4 w-4" /> Documents to Verify
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Verify each document submitted by the trainee. Approve the enrollment once all requirements are
                verified.
              </p>
              {!requirementsReady && (
                <p className="mt-2 text-xs font-medium text-amber-600">
                  Verify every document before approving this enrollment — payment stays locked until approval.
                </p>
              )}
              <div className="mt-3 space-y-2">
                {requirementRows.map((r) => (
                  <div
                    key={r.name}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700">{r.name}</p>
                      <p className="truncate text-xs text-slate-400">
                        {r.fileName ? r.fileName : r.status === 'Missing' ? 'Not submitted' : 'No file attached'}
                      </p>
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
                      {(r.status === 'Submitted' || r.status === 'Rejected') && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={XCircle}
                            onClick={() => verifyRequirement(r, 'Rejected')}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="success"
                            icon={CheckCircle2}
                            onClick={() => verifyRequirement(r, 'Verified')}
                          >
                            Verify
                          </Button>
                        </>
                      )}
                      {r.status === 'Verified' && (
                        <Button size="sm" variant="secondary" onClick={() => verifyRequirement(r, 'Submitted')}>
                          Undo
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

            {selected.type === 'scholarship' && selected.voucher && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <Ticket className="h-4 w-4" /> Scholarship / Voucher Details
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-emerald-700">Voucher Name</p>
                    <p className="font-medium text-emerald-900">{selected.voucher.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700">Voucher Number</p>
                    <p className="font-medium text-emerald-900">{selected.voucher.number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700">Sponsor</p>
                    <p className="font-medium text-emerald-900">{selected.voucher.sponsor}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700">Date</p>
                    <p className="font-medium text-emerald-900">{formatDate(selected.voucher.date)}</p>
                  </div>
                </div>
              </div>
            )}

            {selected.type === 'self-pay' && selected.payment && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Wallet className="h-4 w-4" /> Payment Details
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-400">Training Fee</p>
                    <p className="font-semibold text-slate-700">{currency(selected.payment.fee)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Amount Paid</p>
                    <p className="font-semibold text-emerald-600">{currency(selected.payment.amountPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Balance</p>
                    <p className="font-semibold text-red-600">{currency(selected.payment.balance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <StatusBadge status={selected.payment.status} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
                  <span>Reference: {selected.payment.referenceNo || '—'}</span>
                  <span>Date: {formatDate(selected.payment.paymentDate)}</span>
                </div>
                {selected.payment.balance > 0 &&
                  (canPayEnrollment(selected) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      icon={Wallet}
                      onClick={() => {
                        updatePayment(selected.id, { amountPaid: selected.payment.fee, balance: 0, status: 'Fully Paid', paymentDate: new Date().toISOString().slice(0, 10) })
                        setSelected({ ...selected, payment: { ...selected.payment, amountPaid: selected.payment.fee, balance: 0, status: 'Fully Paid' } })
                      }}
                    >
                      Record Full Payment
                    </Button>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400">
                      {PAYABLE_STATUSES.includes(selected.status)
                        ? 'Verify all requirements before recording a payment.'
                        : 'Approve the enrollment before recording a payment.'}
                    </p>
                  ))}
              </div>
            )}

            <div className="rounded-lg border border-slate-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update Status</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STATUS_FLOW.map((s) => (
                  <button
                    key={s}
                    disabled={statusBlocked(s)}
                    onClick={() => {
                      if (statusBlocked(s)) {
                        toast('Verify every document before approving this enrollment.', 'warning')
                        return
                      }
                      if (['Rejected', 'Cancelled'].includes(s)) {
                        setRemarks('')
                        setConfirm({ enrollment: selected, status: s })
                        return
                      }
                      setEnrollmentStatus(selected.id, s)
                      setSelected({ ...selected, status: s })
                      toast(`Status updated to ${s}.`, 'info')
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      selected.status === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirm}
        onClose={() => {
          setConfirm(null)
          setRemarks('')
        }}
        title={`${confirm?.status === 'Rejected' ? 'Reject' : 'Cancel'} enrollment?`}
        subtitle={confirm ? db.users.find((u) => u.id === confirm.enrollment?.traineeId)?.name : ''}
        icon={confirm?.status === 'Rejected' ? XCircle : Ban}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirm(null)
                setRemarks('')
              }}
            >
              Back
            </Button>
            <Button
              variant={confirm?.status === 'Rejected' ? 'danger' : 'primary'}
              icon={confirm?.status === 'Rejected' ? XCircle : Ban}
              disabled={!remarks.trim()}
              onClick={() => {
                if (!remarks.trim()) return
                setEnrollmentStatus(confirm.enrollment.id, confirm.status, remarks)
                setSelected(null)
                setConfirm(null)
                setRemarks('')
              }}
            >
              {confirm?.status === 'Rejected' ? 'Reject enrollment' : 'Cancel enrollment'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This will mark the application as <strong>{confirm?.status}</strong>. The trainee will see your remarks on
            their enrollment record.
          </p>
          <FormField
            label="Remarks"
            required
            hint="Explain what the trainee needs to fix or why the application was closed."
          >
            <Textarea
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                confirm?.status === 'Rejected'
                  ? 'e.g. PSA birth certificate is blurry. Please upload a clear copy.'
                  : 'e.g. Cancelled at the trainee’s request.'
              }
            />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}

export default ManageEnrollments
