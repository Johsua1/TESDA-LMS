import { describe, it, expect } from 'vitest'
import { validateCourse, findCourseByCode, normalizeCourseCode } from './courseValidation'

const programs = [
  { id: 'barista', code: 'BP-201', title: 'Barista NC II' },
  { id: 'va', code: 'VA-101', title: 'Virtual Assistant NC II' },
]

const base = (over = {}) => ({ title: 'Bookkeeping NC III', code: 'BK-301', ...over })

describe('validateCourse', () => {
  it('accepts a complete new course', () => {
    expect(validateCourse(base(), { programs })).toEqual({ ok: true, field: null, error: '' })
  })

  it('rejects a missing title', () => {
    const result = validateCourse(base({ title: '   ' }), { programs })
    expect(result.ok).toBe(false)
    expect(result.field).toBe('title')
    expect(result.error).toMatch(/title is required/i)
  })

  it('rejects a missing course code', () => {
    const result = validateCourse(base({ code: '' }), { programs })
    expect(result.ok).toBe(false)
    expect(result.field).toBe('code')
    expect(result.error).toMatch(/code is required/i)
  })

  it('rejects a duplicate course code', () => {
    const result = validateCourse(base({ code: 'BP-201' }), { programs })
    expect(result.ok).toBe(false)
    expect(result.field).toBe('code')
    expect(result.error).toMatch(/already used by/i)
  })

  it('treats course codes case-insensitively and ignores surrounding spaces', () => {
    const result = validateCourse(base({ code: '  bp-201  ' }), { programs })
    expect(result.ok).toBe(false)
    expect(result.field).toBe('code')
  })

  it('rejects a duplicate course title', () => {
    const result = validateCourse(base({ title: 'barista nc ii' }), { programs })
    expect(result.ok).toBe(false)
    expect(result.field).toBe('title')
  })

  it('allows a course to keep its own code when edited', () => {
    const result = validateCourse(base({ title: 'Barista NC II', code: 'bp-201' }), {
      programs,
      excludeId: 'barista',
    })
    expect(result.ok).toBe(true)
  })

  it('still blocks taking another course code when edited', () => {
    const result = validateCourse(base({ code: 'VA-101' }), { programs, excludeId: 'barista' })
    expect(result.ok).toBe(false)
    expect(result.field).toBe('code')
  })

  it('rejects a negative fee or hours', () => {
    expect(validateCourse(base({ fee: -1 }), { programs }).field).toBe('fee')
    expect(validateCourse(base({ hours: -5 }), { programs }).field).toBe('hours')
  })
})

describe('findCourseByCode', () => {
  it('finds a program by code', () => {
    expect(findCourseByCode(programs, 'va-101')?.id).toBe('va')
  })

  it('returns null for an unused code', () => {
    expect(findCourseByCode(programs, 'ZZ-999')).toBeNull()
  })
})

describe('normalizeCourseCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeCourseCode('  bp-201 ')).toBe('BP-201')
  })
})
