import { describe, it, expect } from 'vitest'
import { normalizeSettings, validateSettings, SETTINGS_LIMITS } from './settings'

const base = (over = {}) => ({
  institution: 'HYT Global Institute',
  academicYear: '2026 - 2027',
  passingScore: 75,
  typingPassingRate: 40,
  attendanceRequirement: 80,
  allowSelfEnroll: true,
  maintenanceMode: false,
  notifyEmail: true,
  ...over,
})

describe('normalizeSettings', () => {
  it('trims text and converts numeric strings', () => {
    const value = normalizeSettings(base({ institution: '  HYT  ', passingScore: '85' }))
    expect(value.institution).toBe('HYT')
    expect(value.passingScore).toBe(85)
  })

  it('keeps a cleared number field as missing instead of zero', () => {
    expect(Number.isNaN(normalizeSettings(base({ passingScore: '' })).passingScore)).toBe(true)
    expect(Number.isNaN(normalizeSettings(base({ passingScore: '   ' })).typingPassingRate)).toBe(false)
  })

  it('coerces switches to booleans', () => {
    const value = normalizeSettings(base({ allowSelfEnroll: 0, maintenanceMode: 'yes' }))
    expect(value.allowSelfEnroll).toBe(false)
    expect(value.maintenanceMode).toBe(true)
  })
})

describe('validateSettings', () => {
  it('accepts a complete form', () => {
    expect(validateSettings(base())).toEqual({ ok: true, field: null, error: '' })
  })

  it('requires the institution name', () => {
    const result = validateSettings(base({ institution: '   ' }))
    expect(result.field).toBe('institution')
    expect(result.error).toMatch(/required/i)
  })

  it('requires the academic year', () => {
    expect(validateSettings(base({ academicYear: '' })).field).toBe('academicYear')
  })

  it('rejects a blank number instead of saving zero', () => {
    const result = validateSettings(base({ passingScore: '' }))
    expect(result.ok).toBe(false)
    expect(result.field).toBe('passingScore')
    expect(result.error).toMatch(/required/i)
  })

  it('rejects out-of-range thresholds', () => {
    expect(validateSettings(base({ passingScore: 0 })).ok).toBe(false)
    expect(validateSettings(base({ passingScore: 101 })).ok).toBe(false)
    expect(validateSettings(base({ typingPassingRate: 0 })).ok).toBe(false)
    expect(validateSettings(base({ attendanceRequirement: 150 })).ok).toBe(false)
  })

  it('rejects decimals', () => {
    const result = validateSettings(base({ attendanceRequirement: 80.5 }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/whole number/i)
  })

  it('rejects an over-long institution name', () => {
    expect(validateSettings(base({ institution: 'x'.repeat(121) })).field).toBe('institution')
  })

  it('documents the same limits the form shows', () => {
    expect(SETTINGS_LIMITS.passingScore).toMatchObject({ min: 1, max: 100 })
  })
})
