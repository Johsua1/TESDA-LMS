import { describe, it, expect } from 'vitest'
import { isMaintenanceBlocked, MAINTENANCE_EXEMPT_ROLES } from './maintenance'

const on = { maintenanceMode: true }
const off = { maintenanceMode: false }
const trainee = { id: 'tn-1', role: 'trainee' }
const trainer = { id: 'tr-1', role: 'trainer' }
const admin = { id: 'ad-1', role: 'admin' }

describe('isMaintenanceBlocked', () => {
  it('lets everyone through when the flag is off', () => {
    expect(isMaintenanceBlocked({ settings: off, user: trainee })).toBe(false)
    expect(isMaintenanceBlocked({ settings: off, user: trainer })).toBe(false)
    expect(isMaintenanceBlocked({ settings: off, user: admin })).toBe(false)
  })

  it('blocks trainees and trainers when the flag is on', () => {
    expect(isMaintenanceBlocked({ settings: on, user: trainee })).toBe(true)
    expect(isMaintenanceBlocked({ settings: on, user: trainer })).toBe(true)
  })

  it('never blocks a Super Admin, so the toggle can be turned back off', () => {
    expect(isMaintenanceBlocked({ settings: on, user: admin })).toBe(false)
    expect(MAINTENANCE_EXEMPT_ROLES).toContain('admin')
  })

  it('does not block when nobody is signed in', () => {
    expect(isMaintenanceBlocked({ settings: on, user: null })).toBe(false)
  })

  it('fails closed for an unknown role', () => {
    expect(isMaintenanceBlocked({ settings: on, user: { id: 'x', role: 'guest' } })).toBe(true)
  })

  it('treats missing settings as "not in maintenance"', () => {
    expect(isMaintenanceBlocked({ settings: undefined, user: trainee })).toBe(false)
  })
})
