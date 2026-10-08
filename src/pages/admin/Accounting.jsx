import { useState } from 'react'
import { Wallet, TrendingUp, CheckCircle2, Clock, Eye, Receipt, Users, FileText } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useApp } from '../../store/AppContext'
import { revenueStats, programById } from '../../store/selectors'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  StatCard,
  Select,
  Modal,
  Button,
  EmptyState,
  Avatar,
  Badge,
  ProgressBar,
  Input,
  FormField,
} from '../../components/ui'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable } from '../../components/ui/Table'
import { currency, formatDate, cn } from '../../lib/utils'

export function Accounting() {
  const { db, updatePayment, toast } = useApp()
  const revenue = revenueStats(db)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [payAmount, setPayAmount] = useState('')

  const selfPay = db.enrollments.filter((e) => e.type === 'self-pay')
  const records = selfPay
    .filter((e) => statusFilter === 'all' || e.payment?.status === statusFilter)
    .map((e) => ({
      id: e.id,
      enrollment: e,
      trainee: db.users.find((u) => u.id === e.traineeId),
      program: programById(e.programId),
    }))
    .sort((a, b) => (b.enrollment.payment?.balance || 0) - (a.enrollment.payment?.balance || 0))

  const unpaid = selfPay.filter((e) => e.payment?.status === 'Unpaid').length
  const partial = selfPay.filter((e) => e.payment?.status === 'Partially Paid').length
  const paid = selfPay.filter((e) => e.payment?.status === 'Fully Paid').length

  const byProgram = db.programs.map((p) => {
    const enrs = db.enrollments.filter((e) => e.programId === p.id && e.type === 'self-pay')
    const billed = enrs.reduce((s, e) => s + (e.payment?.fee || 0), 0)
    const collected = enrs.reduce((s, e) => s + (e.payment?.amountPaid || 0), 0)
    return { name: p.code, Billed: billed, Collected: collected, Balance: billed - collected }
  })

  const recordPayment = () => {
    const p = selected.enrollment.payment
    const amount = Number(payAmount)
    if (!amount || amount <= 0) {
      toast('Enter a valid amount.', 'warning')
      return
    }
    const newPaid = Math.min(p.fee, p.amountPaid + amount)
    const balance = p.fee - newPaid
    updatePayment(selected.id, {
      amountPaid: newPaid,
      balance,
      status: balance === 0 ? 'Fully Paid' : 'Partially Paid',
      paymentDate: new Date().toISOString().slice(0, 10),
      referenceNo: p.referenceNo || `REF-${Date.now().toString().slice(-8)}`,
    })
    setSelected(null)
    setPayAmount('')
  }

  const columns = [
    {
      key: 'trainee',
      header: 'Trainee',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.trainee?.name} color={r.trainee?.avatarColor} size="sm" />
          <div>
            <p className="font-medium text-slate-700">{r.trainee?.name}</p>
            <p className="text-xs text-slate-400">{r.program?.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'program', header: 'Program', render: (r) => r.program?.title },
    { key: 'fee', header: 'Fee', sortable: true, sortValue: (r) => r.enrollment.payment?.fee, render: (r) => currency(r.enrollment.payment?.fee) },
    { key: 'paid', header: 'Paid', sortable: true, sortValue: (r) => r.enrollment.payment?.amountPaid, render: (r) => <span className="font-medium text-emerald-600">{currency(r.enrollment.payment?.amountPaid)}</span> },
    { key: 'balance', header: 'Balance', sortable: true, sortValue: (r) => r.enrollment.payment?.balance, render: (r) => <span className={cn('font-medium', r.enrollment.payment?.balance > 0 ? 'text-red-600' : 'text-slate-400')}>{currency(r.enrollment.payment?.balance)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.enrollment.payment?.status} /> },
    { key: 'actions', header: '', render: (r) => <Button size="sm" variant="secondary" icon={Eye} onClick={() => { setSelected(r); setPayAmount('') }}>Record Payment</Button> },
  ]

  return (
    <div>
      <PageHeader
        title="Accounting Records"
        description="Track training fees, payments and outstanding balances."
        action={
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
            <option value="all">All payment statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Fully Paid">Fully Paid</option>
          </Select>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Billed" value={currency(revenue.billed)} icon={Receipt} tone="brand" />
        <StatCard label="Collected" value={currency(revenue.paid)} icon={CheckCircle2} tone="success" hint={`${revenue.collection}% collection rate`} />
        <StatCard label="Outstanding" value={currency(revenue.balance)} icon={Clock} tone="danger" />
        <StatCard label="Paying Trainees" value={selfPay.length} icon={Users} tone="purple" hint={`${paid} fully paid · ${partial} partial · ${unpaid} unpaid`} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Collections by Program" subtitle="Billed vs collected vs balance" icon={TrendingUp} />
        <CardBody>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProgram} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `₱${v / 1000}k`} />
                <Tooltip formatter={(v) => currency(v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="Billed" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Balance" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-slate-400" /> Billed</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-emerald-500" /> Collected</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-red-500" /> Balance</span>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Payment Records" icon={Wallet} />
        <DataTable
          columns={columns}
          data={records}
          searchable
          searchPlaceholder="Search by trainee…"
          pageSize={10}
          emptyState={<EmptyState icon={Wallet} title="No payment records" />}
        />
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Record Payment"
        subtitle={selected?.trainee?.name}
        icon={Wallet}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={recordPayment}>Save Payment</Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Training Fee', value: currency(selected.enrollment.payment?.fee) },
                { label: 'Amount Paid', value: currency(selected.enrollment.payment?.amountPaid) },
                { label: 'Balance', value: currency(selected.enrollment.payment?.balance) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-sm font-bold text-slate-800">{s.value}</p>
                  <p className="text-[10px] uppercase text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>Payment progress</span>
                <span>{selected.enrollment.payment?.fee ? Math.round((selected.enrollment.payment.amountPaid / selected.enrollment.payment.fee) * 100) : 0}%</span>
              </div>
              <ProgressBar value={selected.enrollment.payment?.fee ? (selected.enrollment.payment.amountPaid / selected.enrollment.payment.fee) * 100 : 0} />
            </div>
            <FormField label="Amount to Pay (₱)" hint={`Remaining balance: ${currency(selected.enrollment.payment?.balance)}`}>
              <Input type="number" min="0" max={selected.enrollment.payment?.balance} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPayAmount(String(selected.enrollment.payment?.balance || 0))}>
                Full Balance
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPayAmount(String(Math.round((selected.enrollment.payment?.fee || 0) / 2)))}>
                Half
              </Button>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Reference: {selected.enrollment.payment?.referenceNo || '—'} · Last payment: {formatDate(selected.enrollment.payment?.paymentDate)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Accounting
