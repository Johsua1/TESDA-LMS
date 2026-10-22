// Course authoring rules, shared by the admin course form, the store's
// addProgram guard and the tests.
// A course may only be created once its title and course code are filled in,
// and the course code must be unique — two programs sharing a code make
// enrollments, schedules and reports ambiguous.

export const normalizeCourseCode = (code) => String(code ?? '').trim().replace(/\s+/g, ' ').toUpperCase()

export const normalizeCourseTitle = (title) => String(title ?? '').trim().replace(/\s+/g, ' ')

// Returns the program already using `code`, ignoring `excludeId` (the course
// being edited), or null. Codes compare case-insensitively so "bp-201" and
// "BP-201" are treated as the same code.
export function findCourseByCode(programs = [], code, { excludeId = null } = {}) {
  const target = normalizeCourseCode(code)
  if (!target) return null
  return (
    programs.find(
      (program) => program.id !== excludeId && normalizeCourseCode(program.code) === target,
    ) || null
  )
}

export function findCourseByTitle(programs = [], title, { excludeId = null } = {}) {
  const target = normalizeCourseTitle(title).toLowerCase()
  if (!target) return null
  return (
    programs.find(
      (program) => program.id !== excludeId && normalizeCourseTitle(program.title).toLowerCase() === target,
    ) || null
  )
}

// Returns { ok, field, error } — `field` lets the form show the message under
// the offending input instead of only as a toast.
export function validateCourse(payload, { programs = [], excludeId = null } = {}) {
  const title = normalizeCourseTitle(payload?.title)
  const code = String(payload?.code ?? '').trim()

  if (!title) return { ok: false, field: 'title', error: 'Course title is required.' }
  if (!code) return { ok: false, field: 'code', error: 'Course code is required.' }

  const duplicateCode = findCourseByCode(programs, code, { excludeId })
  if (duplicateCode) {
    return {
      ok: false,
      field: 'code',
      error: `Course code "${duplicateCode.code}" is already used by "${duplicateCode.title}".`,
    }
  }

  const duplicateTitle = findCourseByTitle(programs, title, { excludeId })
  if (duplicateTitle) {
    return {
      ok: false,
      field: 'title',
      error: `"${duplicateTitle.title}" already exists with course code ${duplicateTitle.code}.`,
    }
  }

  const fee = payload?.fee === '' || payload?.fee === null || payload?.fee === undefined ? 0 : Number(payload.fee)
  if (!Number.isFinite(fee) || fee < 0) {
    return { ok: false, field: 'fee', error: 'Training fee must be zero or more.' }
  }

  const hours = payload?.hours === '' || payload?.hours === null || payload?.hours === undefined ? 0 : Number(payload.hours)
  if (!Number.isFinite(hours) || hours < 0) {
    return { ok: false, field: 'hours', error: 'Total hours must be zero or more.' }
  }

  return { ok: true, field: null, error: '' }
}
