// System settings: the shape, the limits and the validation rules.
// Shared by the admin Settings form and the tests so the store never receives
// a half-filled or out-of-range preference.

export const SETTINGS_LIMITS = {
  passingScore: { min: 1, max: 100, label: 'Default passing score' },
  typingPassingRate: { min: 1, max: 100, label: 'Typing test passing rate' },
  attendanceRequirement: { min: 1, max: 100, label: 'Attendance requirement' },
}

export const INSTITUTION_MAX = 120
export const ACADEMIC_YEAR_MAX = 40

// Number('') is 0, which would silently turn a cleared field into a zero
// threshold. Blank input must stay "missing" so validation can report it.
const toNumber = (value) => {
  if (value === null || value === undefined) return NaN
  if (typeof value === 'string' && value.trim() === '') return NaN
  return Number(value)
}

export function normalizeSettings(input = {}) {
  return {
    institution: String(input.institution ?? '').trim(),
    academicYear: String(input.academicYear ?? '').trim(),
    passingScore: toNumber(input.passingScore),
    typingPassingRate: toNumber(input.typingPassingRate),
    attendanceRequirement: toNumber(input.attendanceRequirement),
    allowSelfEnroll: Boolean(input.allowSelfEnroll),
    maintenanceMode: Boolean(input.maintenanceMode),
    notifyEmail: Boolean(input.notifyEmail),
  }
}

// Returns { ok, field, error } — `field` drives the inline message.
export function validateSettings(input) {
  const value = normalizeSettings(input)

  if (!value.institution) {
    return { ok: false, field: 'institution', error: 'Institution name is required.' }
  }
  if (value.institution.length > INSTITUTION_MAX) {
    return { ok: false, field: 'institution', error: `Institution name must be ${INSTITUTION_MAX} characters or fewer.` }
  }
  if (!value.academicYear) {
    return { ok: false, field: 'academicYear', error: 'Academic year is required.' }
  }
  if (value.academicYear.length > ACADEMIC_YEAR_MAX) {
    return { ok: false, field: 'academicYear', error: `Academic year must be ${ACADEMIC_YEAR_MAX} characters or fewer.` }
  }

  for (const [key, limit] of Object.entries(SETTINGS_LIMITS)) {
    const current = value[key]
    if (!Number.isFinite(current)) {
      return { ok: false, field: key, error: `${limit.label} is required.` }
    }
    if (!Number.isInteger(current) || current < limit.min || current > limit.max) {
      return {
        ok: false,
        field: key,
        error: `${limit.label} must be a whole number between ${limit.min} and ${limit.max}.`,
      }
    }
  }

  return { ok: true, field: null, error: '' }
}
