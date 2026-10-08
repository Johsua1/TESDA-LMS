import { useState } from 'react'
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
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { enrollmentsOf, programById } from '../../store/selectors'
import { programs } from '../../data/programs'
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
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { currency, formatDate, cn } from '../../lib/utils'

const VOUCHER_OPTIONS = [
  'TESDA Training for Work Scholarship Program (TWSP)',
  'Special Training for Employment Program (STEP)',
  'Universal Access to Quality Tertiary Education',
  'PESO Skills Training Voucher',
]

export function Enrollment() {
  const { db, user, createEnrollment, toast } = useApp()
  const myEnrollments = enrollmentsOf(db, user.id)

  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('scholarship')
  const [form, setForm] = useState({})
  const [submitted, setSubmitted] = useState(null)

  const enrolledIds = myEnrollments.map((e) => e.programId)
  const available = programs.filter((p) => !enrolledIds.includes(p.id))
  const filtered = available.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))

  const reset = () => {
    setStep(1)
    setSelected(null)
    setForm({})
    setType('scholarship')
    setSubmitted(null)
  }

  const startEnroll = (program) => {
    setSelected(program)
    setForm({})
    setStep(2)
  }

  const submit = () => {
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
      const fee = selected.fee
      const amountPaid = Number(form.amountPaid) || 0
      const balance = Math.max(0, fee - amountPaid)
      const status = amountPaid <= 0 ? 'Unpaid' : balance === 0 ? 'Fully Paid' : 'Partially Paid'
      base.payment = {
        fee,
        status,
        amountPaid,
        balance,
        paymentDate: amountPaid > 0 ? form.paymentDate || new Date().toISOString().slice(0, 10) : null,
        referenceNo: form.referenceNo || null,
      }
    }
    createEnrollment(base)
    setSubmitted(base)
    setStep(4)
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
                return (
                  <div key={e.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p?.emoji}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{p?.title}</p>
                        <p className="text-xs text-slate-400">
                          Applied {formatDate(e.appliedDate)} · {e.type === 'scholarship' ? 'Scholarship / Voucher' : 'Self-Pay'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {e.type === 'self-pay' && <StatusBadge status={e.payment?.status} />}
                      <StatusBadge status={e.status} />
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
                <div className={cn('relative h-28 bg-gradient-to-br', p.color)}>
                  <div className="absolute inset-0 flex items-center justify-between p-4 text-white">
                    <span className="text-3xl">{p.emoji}</span>
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
                  <Button className="mt-4" size="sm" iconRight={ChevronRight} onClick={() => startEnroll(p)}>
                    View & Enroll
                  </Button>
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
            <span className="text-4xl">{selected.emoji}</span>
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
                  {selected.requirements.map((r) => (
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
                <FormRow>
                  <FormField label="Training Program">
                    <Input value={selected.title} disabled />
                  </FormField>
                  <FormField label="Training Fee">
                    <Input value={currency(selected.fee)} disabled />
                  </FormField>
                </FormRow>
                <FormRow>
                  <FormField label="Amount Paid (₱)" hint="You may pay partially or in full">
                    <Input
                      type="number"
                      min="0"
                      max={selected.fee}
                      value={form.amountPaid || ''}
                      onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
                      placeholder="0"
                    />
                  </FormField>
                  <FormField label="Payment Date">
                    <Input type="date" value={form.paymentDate || ''} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
                  </FormField>
                </FormRow>
                <FormField label="Reference Number" hint="Bank / GCash / Maya reference number (optional)">
                  <Input value={form.referenceNo || ''} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} placeholder="REF-20260001" />
                </FormField>
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Training Fee</span>
                    <span className="font-semibold text-slate-700">{currency(selected.fee)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Amount Paid</span>
                    <span className="font-semibold text-emerald-600">{currency(Number(form.amountPaid) || 0)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
                    <span className="font-medium text-slate-600">Balance</span>
                    <span className="font-bold text-slate-800">{currency(Math.max(0, selected.fee - (Number(form.amountPaid) || 0)))}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Payment Status</span>
                    <StatusBadge
                      status={
                        !Number(form.amountPaid)
                          ? 'Unpaid'
                          : Number(form.amountPaid) >= selected.fee
                            ? 'Fully Paid'
                            : 'Partially Paid'
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Note: This is a frontend demonstration. No real payment gateway is used — records are stored locally.
                </p>
              </>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button icon={CheckCircle2} onClick={submit}>
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
