import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet,
  CreditCard,
  Receipt,
  CheckCircle2,
  Clock,
  Smartphone,
  Landmark,
  Banknote,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  History,
  ShieldCheck,
  Lock,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { enrollmentsOf, programById, paymentTransactions } from '../../store/selectors'
import {
  PageHeader,
  Card,
  CardBody,
  CardHeader,
  Button,
  Badge,
  StatCard,
  ProgressBar,
  Modal,
  FormField,
  Input,
  Select,
  EmptyState,
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { currency, formatDate, cn } from '../../lib/utils'
import { PAYABLE_STATUSES, areRequirementsVerified, canPayEnrollment } from '../../lib/enrollmentRequirements'
import { CourseIcon } from '../../components/courses/CourseIcon'

const PAYMENT_METHODS = [
  { key: 'GCash', label: 'GCash', icon: Smartphone, hint: 'Mobile wallet' },
  { key: 'Maya', label: 'Maya', icon: Smartphone, hint: 'Mobile wallet' },
  { key: 'Bank Transfer', label: 'Bank Transfer', icon: Landmark, hint: 'InstaPay / PESONet' },
  { key: 'Over-the-Counter', label: 'Over-the-Counter', icon: Banknote, hint: 'Cash at the registrar' },
]

const methodMeta = (key) => PAYMENT_METHODS.find((m) => m.key === key) || PAYMENT_METHODS[0]

const todayISO = () => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// A single self-pay enrollment card with balance + transaction history
// ---------------------------------------------------------------------------
function PaymentCard({ enrollment, onPay, onReceipt }) {
  const [showHistory, setShowHistory] = useState(false)
  const program = programById(enrollment.programId)
  const payment = enrollment.payment || {}
  const fee = Number(payment.fee) || 0
  const paid = Number(payment.amountPaid) || 0
  const balance = Number(payment.balance) || 0
  const paidPct = fee ? Math.round((paid / fee) * 100) : 100
  const settled = balance <= 0
  const closed = ['Cancelled', 'Rejected'].includes(enrollment.status)
  // Payment is the step after admin approval: a pending/under-review
  // application has a fee on record but no Pay Now button yet.
  const statusApproved = PAYABLE_STATUSES.includes(enrollment.status)
  const docsReady = areRequirementsVerified(enrollment)
  const approved = canPayEnrollment(enrollment)
  const transactions = paymentTransactions(enrollment)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br', program?.color || 'from-brand-500 to-brand-700')}>
            <CourseIcon program={program} className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-400">{program?.code}</p>
            <h3 className="text-sm font-bold text-slate-800">{program?.title || 'Program'}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {enrollment.type === 'scholarship' ? 'Scholarship / Voucher' : 'Self-Pay'} · Enrolled {formatDate(enrollment.appliedDate)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={payment.status} />
          {closed ? (
            <Badge tone="danger" dot>
              Payment closed
            </Badge>
          ) : !statusApproved ? (
            <Badge tone="neutral" dot>
              Awaiting approval
            </Badge>
          ) : !docsReady ? (
            <Badge tone="warning" dot>
              Documents pending
            </Badge>
          ) : settled ? (
            <Badge tone="success" dot>
              Settled
            </Badge>
          ) : (
            <Badge tone="warning" dot>
              Balance due
            </Badge>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Training Fee</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-700">{currency(fee)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-emerald-600">Amount Paid</p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-700">{currency(paid)}</p>
          </div>
          <div className={cn('rounded-lg p-3', balance > 0 ? 'bg-red-50' : 'bg-slate-50')}>
            <p className={cn('text-[11px] uppercase tracking-wide', balance > 0 ? 'text-red-500' : 'text-slate-400')}>Balance</p>
            <p className={cn('mt-0.5 text-sm font-semibold', balance > 0 ? 'text-red-600' : 'text-slate-700')}>{currency(balance)}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
            <span>Payment progress</span>
            <span className="font-semibold text-slate-600">{paidPct}% paid</span>
          </div>
          <ProgressBar value={paidPct} tone={settled ? 'bg-emerald-500' : paidPct >= 40 ? 'bg-brand-500' : 'bg-amber-500'} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-700"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? 'Hide' : 'View'} payment history
            {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {settled ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Fully paid
            </span>
          ) : approved ? (
            <Button size="sm" icon={CreditCard} onClick={() => onPay(enrollment)}>
              Pay Now
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Lock className="h-4 w-4" />{' '}
              {closed
                ? 'Payment closed'
                : !statusApproved
                  ? 'Unlocks after approval'
                  : 'Unlocks after document verification'}
            </span>
          )}
        </div>

        {showHistory && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
            {transactions.length ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium">Reference</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 text-right font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t) => (
                    <tr key={t.id} className="text-slate-600">
                      <td className="px-3 py-2">{formatDate(t.date)}</td>
                      <td className="px-3 py-2">{t.method || '—'}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{t.referenceNo || '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{currency(t.amount)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => onReceipt(t)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 transition hover:text-brand-700"
                        >
                          <Receipt className="h-3 w-3" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-3 py-4 text-center text-xs text-slate-400">No payments recorded yet.</p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Pay Now modal
// ---------------------------------------------------------------------------
function PayModal({ open, enrollment, onClose, onConfirm }) {
  const payment = enrollment?.payment || {}
  const fee = Number(payment.fee) || 0
  const paid = Number(payment.amountPaid) || 0
  const balance = Number(payment.balance) || 0
  const program = enrollment ? programById(enrollment.programId) : null

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState(PAYMENT_METHODS[0].key)
  const [referenceNo, setReferenceNo] = useState('')
  const [date, setDate] = useState(todayISO())

  // Reset the form each time the modal opens for a new enrollment
  useEffect(() => {
    if (open) {
      setAmount(balance ? String(balance) : '')
      setMethod(PAYMENT_METHODS[0].key)
      setReferenceNo('')
      setDate(todayISO())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, enrollment?.id])

  if (!enrollment) return null

  const value = Math.max(0, Number(amount) || 0)
  const applied = Math.min(value, balance)
  const newBalance = Math.max(0, balance - applied)
  const newStatus = newBalance === 0 ? 'Fully Paid' : paid + applied > 0 ? 'Partially Paid' : 'Unpaid'
  const invalid = !value || value <= 0

  const preset = (val) => setAmount(String(val))

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Make a Payment"
      subtitle={program?.title}
      icon={CreditCard}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="success"
            icon={ShieldCheck}
            disabled={invalid}
            onClick={() => onConfirm({ amount: applied, method, referenceNo, date })}
          >
            Confirm Payment
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Training Fee</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-700">{currency(fee)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Already Paid</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-700">{currency(paid)}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-red-500">Balance</p>
            <p className="mt-0.5 text-sm font-semibold text-red-600">{currency(balance)}</p>
          </div>
        </div>

        {/* Amount */}
        <FormField label="Amount to Pay (₱)" required hint="You may pay the full balance or any partial amount">
          <Input
            type="number"
            min="1"
            max={balance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => preset(balance)}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
          >
            Full balance · {currency(balance)}
          </button>
          <button
            onClick={() => preset(Math.round(balance / 2))}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
          >
            Half · {currency(Math.round(balance / 2))}
          </button>
        </div>

        {/* Method */}
        <FormField label="Payment Method" required>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label} — {m.hint}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Reference Number" hint="From your GCash / Maya / bank receipt">
            <Input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. 0012 3456 7890"
            />
          </FormField>
          <FormField label="Payment Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
        </div>

        {/* Live result preview */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">This payment</span>
            <span className="font-semibold text-emerald-600">{currency(applied)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
            <span className="font-medium text-slate-600">Remaining balance after payment</span>
            <span className="font-bold text-slate-800">{currency(newBalance)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">New payment status</span>
            <StatusBadge status={newStatus} />
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-brand-50 p-3 text-xs text-brand-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This is a frontend demonstration — no real payment gateway is connected. The payment is recorded locally and
            the registrar can verify it in the Accounting module.
          </p>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Receipt for one recorded payment
// ---------------------------------------------------------------------------
function ReceiptRow({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn('text-right', strong ? 'text-base font-bold text-slate-800' : 'font-medium text-slate-700')}>
        {value}
      </dd>
    </div>
  )
}

function ReceiptModal({ record, onClose, settings, user }) {
  const enrollment = record?.enrollment
  const tx = record?.tx
  if (!enrollment || !tx) return null

  const program = programById(enrollment.programId)
  const payment = enrollment.payment || {}
  // Receipts are historical: show the balance as of this payment, not today's.
  const history = paymentTransactions(enrollment)
  const index = history.findIndex((t) => t.id === tx.id)
  const paidToDate =
    index >= 0 ? history.slice(index).reduce((sum, t) => sum + (Number(t.amount) || 0), 0) : Number(payment.amountPaid) || 0
  const balanceAfter = Math.max(0, (Number(payment.fee) || 0) - paidToDate)
  const receiptNo =
    tx.referenceNo && tx.referenceNo !== '—'
      ? tx.referenceNo
      : `RCPT-${String(tx.id || '').slice(-8).toUpperCase()}`

  return (
    <Modal
      open
      onClose={onClose}
      title="Payment Receipt"
      subtitle={program?.title}
      icon={Receipt}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-4">
          <div>
            <p className="text-sm font-bold text-slate-800">{settings?.institution || 'HYT Global Institute'}</p>
            {settings?.academicYear && (
              <p className="text-xs text-slate-500">Academic Year {settings.academicYear}</p>
            )}
            <p className="text-xs text-slate-500">Official payment receipt</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Receipt No.</p>
            <p className="font-mono text-xs font-semibold text-slate-700">{receiptNo}</p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <ReceiptRow label="Received from" value={user?.name || '—'} />
          <ReceiptRow label="Program" value={[program?.code, program?.title].filter(Boolean).join(' · ') || '—'} />
          <ReceiptRow label="Payment date" value={formatDate(tx.date)} />
          <ReceiptRow label="Payment method" value={tx.method || '—'} />
          <ReceiptRow label="Amount received" value={currency(tx.amount)} strong />
        </dl>

        <dl className="mt-4 space-y-2 border-t border-dashed border-slate-200 pt-4 text-sm">
          <ReceiptRow label="Total paid to date" value={currency(paidToDate)} />
          <ReceiptRow label="Balance after this payment" value={currency(balanceAfter)} />
          <ReceiptRow label="Payment status" value={balanceAfter === 0 ? 'Fully Paid' : 'Partially Paid'} />
        </dl>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          Generated from the payment record dated {formatDate(tx.date)}. Keep this receipt for your records.
        </p>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function Payments() {
  const { db, user, settings, recordPayment } = useApp()
  const [target, setTarget] = useState(null)
  const [receipt, setReceipt] = useState(null)

  const mySelfPay = useMemo(
    () => enrollmentsOf(db, user.id).filter((e) => e.type === 'self-pay' && e.payment),
    [db, user.id],
  )

  const totals = useMemo(
    () =>
      mySelfPay.reduce(
        (acc, e) => {
          acc.billed += Number(e.payment?.fee) || 0
          acc.paid += Number(e.payment?.amountPaid) || 0
          if ((Number(e.payment?.balance) || 0) > 0 && canPayEnrollment(e)) acc.due += 1
          return acc
        },
        { billed: 0, paid: 0, due: 0 },
      ),
    [mySelfPay],
  )

  const balance = Math.max(0, totals.billed - totals.paid)
  const payableBalance = mySelfPay
    .filter((e) => canPayEnrollment(e))
    .reduce((sum, e) => sum + (Number(e.payment?.balance) || 0), 0)
  const openApplications = mySelfPay.filter((e) => !['Rejected', 'Cancelled'].includes(e.status))

  const confirm = (payload) => {
    const ok = recordPayment(target.id, payload)
    if (ok) setTarget(null)
  }

  return (
    <div>
      <PageHeader
        title="My Payments"
        description="View your training fees, settle your outstanding balance, and keep track of your payment history."
        action={
          <Link to="/trainee/enrollment">
            <Button variant="secondary" icon={Wallet}>
              Enroll in a program
            </Button>
          </Link>
        }
      />

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Billed" value={currency(totals.billed)} icon={Receipt} tone="brand" hint="Across self-pay programs" />
        <StatCard label="Total Paid" value={currency(totals.paid)} icon={CheckCircle2} tone="success" hint="Recorded payments" />
        <StatCard label="Outstanding Balance" value={currency(payableBalance)} icon={Clock} tone={payableBalance > 0 ? 'danger' : 'success'} hint={payableBalance > 0 ? 'Amount still due' : 'Nothing payable right now'} />
        <StatCard label="Payments Due" value={totals.due} icon={CreditCard} tone="warning" hint={totals.due ? 'Approved program(s) with a balance' : 'No payments due'} />
      </div>

      {mySelfPay.length ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="h-3.5 w-3.5" />
            {payableBalance > 0
              ? `You have ${currency(payableBalance)} in outstanding balance. Tap “Pay Now” on any program below to settle it.`
              : !openApplications.length
                ? 'No payments are due. Closed applications stay listed here as records.'
                : openApplications.some((e) => (Number(e.payment?.balance) || 0) > 0)
                  ? 'Your payment will unlock once the admin approves your enrollment and verifies your requirements.'
                  : 'All your open self-pay programs are fully paid. Thank you!'}
          </div>
          {mySelfPay.map((e) => (
            <PaymentCard key={e.id} enrollment={e} onPay={setTarget} onReceipt={(tx) => setReceipt({ enrollment: e, tx })} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Wallet}
            title="No self-pay enrollments"
            description="You have no programs with a training fee. Enroll in a self-pay program to manage payments here."
            action={
              <Link to="/trainee/enrollment">
                <Button iconRight={ArrowRight}>Browse programs</Button>
              </Link>
            }
          />
        </Card>
      )}

      <PayModal open={!!target} enrollment={target} onClose={() => setTarget(null)} onConfirm={confirm} />
      <ReceiptModal record={receipt} onClose={() => setReceipt(null)} settings={settings} user={user} />
    </div>
  )
}

export default Payments
