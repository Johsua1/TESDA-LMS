// Admission requirement rows live inside enrollment.requirements:
// { name, fileName, type, size, url, status, note, submittedAt, verifiedAt, verifiedBy }
//
// Kept as pure helpers so the trainee re-upload flow and the admin badges share
// one definition (and can be unit-tested without React).

// Once the registrar closes an application, the trainee's copy is read-only.
// The record itself stays in the database (and in both the trainee's and the
// admin's lists) so there is always a history of the rejection.
export const ENROLLMENT_LOCKED_STATUSES = ['Rejected', 'Cancelled']

export const isEnrollmentLocked = (enrollment) => ENROLLMENT_LOCKED_STATUSES.includes(enrollment?.status)

// Payment comes after the admin approves the application. Completed is included
// so an outstanding balance on a finished program can still be settled.
export const PAYABLE_STATUSES = ['Approved', 'Enrolled', 'Completed']

export const areRequirementsVerified = (enrollment) =>
  (enrollment?.requirements || []).every((r) => r.status === 'Verified')

// Payment needs both halves of the flow: the admin approved the application
// AND every required document was verified.
export const canPayEnrollment = (enrollment) =>
  PAYABLE_STATUSES.includes(enrollment?.status) && areRequirementsVerified(enrollment)

export const requirementCounts = (requirements = []) => ({
  total: requirements.length,
  verified: requirements.filter((r) => r.status === 'Verified').length,
  rejected: requirements.filter((r) => r.status === 'Rejected').length,
  missing: requirements.filter((r) => r.status === 'Missing').length,
})

// Replace one document after a rejection (or fill in a missing one). The row
// goes back to Submitted, so the registrar sees it in the verification queue
// again, and any earlier decision is cleared.
export function applyRequirementResubmission(enrollment, requirementName, doc, submittedAt = new Date().toISOString()) {
  if (!enrollment || !doc?.url) return enrollment
  const requirements = enrollment.requirements || []
  if (!requirements.some((r) => r.name === requirementName)) return enrollment

  return {
    ...enrollment,
    requirements: requirements.map((r) =>
      r.name === requirementName
        ? {
            ...r,
            fileName: doc.fileName,
            type: doc.type,
            size: doc.size,
            url: doc.url,
            status: 'Submitted',
            note: '',
            submittedAt,
            verifiedAt: null,
            verifiedBy: null,
          }
        : r,
    ),
  }
}
