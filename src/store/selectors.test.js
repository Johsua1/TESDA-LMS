import { describe, it, expect } from 'vitest'
import { enrollmentOf, outstandingPayments } from './selectors'

const row = (id, status, appliedDate = '2026-10-01') => ({
  id,
  traineeId: 't1',
  programId: 'barista',
  status,
  appliedDate,
  type: 'self-pay',
  payment: { fee: 5000, balance: 5000, amountPaid: 0 },
})

describe('enrollmentOf', () => {
  it('prefers the live application over an older rejected record', () => {
    const db = { enrollments: [row('old', 'Rejected', '2026-01-01'), row('new', 'Pending', '2026-10-22')] }
    expect(enrollmentOf(db, 't1', 'barista').id).toBe('new')
  })

  it('prefers an approved row over a newer pending one', () => {
    const db = { enrollments: [row('pending', 'Pending', '2026-10-22'), row('approved', 'Approved', '2026-01-01')] }
    expect(enrollmentOf(db, 't1', 'barista').id).toBe('approved')
  })
})

describe('outstandingPayments', () => {
  it('only returns payable self-pay balances', () => {
    const db = {
      enrollments: [
        row('pending', 'Pending'),
        row('approved', 'Approved'),
        row('enrolled', 'Enrolled'),
        row('completed', 'Completed'),
        row('rejected', 'Rejected'),
        { ...row('scholar', 'Approved'), type: 'scholarship' },
      ],
    }
    expect(outstandingPayments(db, 't1').map((e) => e.id)).toEqual(['approved', 'enrolled', 'completed'])
  })
})
