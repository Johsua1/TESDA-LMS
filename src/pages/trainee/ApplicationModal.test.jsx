import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApplicationModal } from './Enrollment'

const base = {
  id: 'enr-1',
  programId: 'barista',
  type: 'self-pay',
  status: 'Pending',
  appliedDate: '2026-10-01',
  applicant: { fullName: 'Juan Dela Cruz', email: 'juan@example.com' },
  payment: { fee: 5000, amountPaid: 0, balance: 5000, status: 'Unpaid' },
  requirements: [
    { name: 'PSA Birth Certificate', status: 'Rejected', fileName: 'old.pdf', url: 'data:old', note: 'Blurry' },
    { name: 'Resume', status: 'Verified', fileName: 'cv.pdf', url: 'data:cv' },
  ],
}

describe('ApplicationModal', () => {
  it('shows the rejected document with a replacement upload', () => {
    const html = renderToStaticMarkup(
      <ApplicationModal enrollment={base} onClose={() => {}} onResubmit={() => {}} />,
    )
    expect(html).toContain('Rejected by the registrar. Upload a new copy.')
    expect(html).toContain('accept="image/*,application/pdf"')
    expect(html).toContain('Blurry')
    expect(html).toContain('Applicant Information')
  })

  it('does not offer uploads once the enrollment itself is rejected', () => {
    const html = renderToStaticMarkup(
      <ApplicationModal enrollment={{ ...base, status: 'Rejected' }} onClose={() => {}} onResubmit={() => {}} />,
    )
    expect(html).toContain('Your enrollment application was rejected by the registrar.')
    expect(html).toContain('This record is read-only')
    expect(html).not.toContain('accept="image/*,application/pdf"')
  })

  it('shows the registrar remarks on a rejected record', () => {
    const html = renderToStaticMarkup(
      <ApplicationModal
        enrollment={{
          ...base,
          status: 'Rejected',
          decisionRemarks: 'PSA birth certificate is blurry. Upload a clear copy.',
          decisionAt: '2026-10-22T00:00:00.000Z',
        }}
        onClose={() => {}}
        onResubmit={() => {}}
      />,
    )
    expect(html).toMatch(/Registrar(?:&#x27;|')s remarks/)
    expect(html).toContain('PSA birth certificate is blurry. Upload a clear copy.')
  })
})
