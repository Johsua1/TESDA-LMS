import { describe, it, expect } from 'vitest'
import {
  applyRequirementResubmission,
  canPayEnrollment,
  isEnrollmentLocked,
  requirementCounts,
} from './enrollmentRequirements'

const enrollment = () => ({
  id: 'enr-1',
  status: 'Pending',
  requirements: [
    {
      name: 'PSA Birth Certificate',
      status: 'Rejected',
      fileName: 'old.pdf',
      url: 'data:old',
      note: 'Blurry copy',
      verifiedAt: '2026-01-01T00:00:00.000Z',
      verifiedBy: 'admin-1',
    },
    {
      name: 'Resume',
      status: 'Verified',
      fileName: 'cv.pdf',
      url: 'data:cv',
      note: '',
      verifiedAt: '2026-01-02T00:00:00.000Z',
      verifiedBy: 'admin-1',
    },
    { name: 'Medical Certificate', status: 'Missing', note: '' },
  ],
})

describe('applyRequirementResubmission', () => {
  it('moves a rejected document back to Submitted with the new file', () => {
    const next = applyRequirementResubmission(
      enrollment(),
      'PSA Birth Certificate',
      { fileName: 'psa.pdf', type: 'application/pdf', size: 1234, url: 'data:new' },
      '2026-10-22T00:00:00.000Z',
    )
    expect(next.requirements[0]).toMatchObject({
      name: 'PSA Birth Certificate',
      fileName: 'psa.pdf',
      type: 'application/pdf',
      size: 1234,
      url: 'data:new',
      status: 'Submitted',
      note: '',
      submittedAt: '2026-10-22T00:00:00.000Z',
      verifiedAt: null,
      verifiedBy: null,
    })
  })

  it('leaves the other requirements untouched', () => {
    const before = enrollment()
    const next = applyRequirementResubmission(before, 'PSA Birth Certificate', { fileName: 'psa.pdf', url: 'data:new' })
    expect(next.requirements[1]).toEqual(before.requirements[1])
    expect(next.requirements[2]).toEqual(before.requirements[2])
  })

  it('fills a missing requirement', () => {
    const next = applyRequirementResubmission(enrollment(), 'Medical Certificate', {
      fileName: 'med.pdf',
      url: 'data:med',
    })
    expect(next.requirements[2]).toMatchObject({ status: 'Submitted', fileName: 'med.pdf', url: 'data:med' })
  })

  it('returns the same enrollment for an unknown requirement or no file', () => {
    const before = enrollment()
    expect(applyRequirementResubmission(before, 'NBI Clearance', { url: 'data:x' })).toBe(before)
    expect(applyRequirementResubmission(before, 'PSA Birth Certificate', {})).toBe(before)
  })
})

describe('isEnrollmentLocked', () => {
  it('locks rejected and cancelled applications', () => {
    expect(isEnrollmentLocked({ status: 'Rejected' })).toBe(true)
    expect(isEnrollmentLocked({ status: 'Cancelled' })).toBe(true)
  })

  it('keeps open applications editable', () => {
    for (const status of ['Pending', 'Under Review', 'Approved', 'Enrolled', 'Completed']) {
      expect(isEnrollmentLocked({ status })).toBe(false)
    }
  })
})

describe('canPayEnrollment', () => {
  it('allows payment after approval when there are no document requirements', () => {
    for (const status of ['Approved', 'Enrolled', 'Completed']) {
      expect(canPayEnrollment({ status })).toBe(true)
    }
  })

  it('locks payment while pending, under review, rejected or cancelled', () => {
    for (const status of ['Pending', 'Under Review', 'Rejected', 'Cancelled']) {
      expect(canPayEnrollment({ status })).toBe(false)
    }
  })

  it('requires every document to be verified', () => {
    const verified = { status: 'Approved', requirements: [{ status: 'Verified' }] }
    expect(canPayEnrollment(verified)).toBe(true)
    for (const requirementStatus of ['Submitted', 'Rejected', 'Missing']) {
      expect(canPayEnrollment({ ...verified, requirements: [{ status: requirementStatus }] })).toBe(false)
    }
  })
})

describe('requirementCounts', () => {
  it('counts verified, rejected and missing rows', () => {
    expect(requirementCounts(enrollment().requirements)).toEqual({
      total: 3,
      verified: 1,
      rejected: 1,
      missing: 1,
    })
  })

  it('handles an empty list', () => {
    expect(requirementCounts()).toEqual({ total: 0, verified: 0, rejected: 0, missing: 0 })
  })
})
