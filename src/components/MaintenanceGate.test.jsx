import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// The gate reads the store through useApp(); stub it so the render can be
// driven per role without a browser or a Supabase session.
const state = vi.hoisted(() => ({
  settings: { maintenanceMode: false, institution: 'HYT Global Institute' },
  user: { id: 'tn-1', role: 'trainee' },
  logout: () => {},
}))

vi.mock('../store/AppContext', () => ({ useApp: () => state }))

import { MaintenanceGate } from './MaintenanceGate'

const render = () =>
  renderToStaticMarkup(
    <MaintenanceGate>
      <p>DASHBOARD CONTENT</p>
    </MaintenanceGate>,
  )

const setUser = (role) => {
  state.user = role ? { id: `${role}-1`, role } : null
}

describe('MaintenanceGate', () => {
  it('shows the maintenance notice to a trainee and hides the dashboard', () => {
    state.settings = { maintenanceMode: true, institution: 'HYT Global Institute' }
    setUser('trainee')
    const html = render()
    expect(html).toContain('Scheduled maintenance')
    expect(html).toContain('HYT Global Institute')
    expect(html).toContain('Sign out')
    expect(html).not.toContain('DASHBOARD CONTENT')
  })

  it('shows it to a trainer too', () => {
    state.settings = { maintenanceMode: true, institution: 'HYT Global Institute' }
    setUser('trainer')
    expect(render()).toContain('Scheduled maintenance')
  })

  it('lets a Super Admin through so the toggle can be switched off', () => {
    state.settings = { maintenanceMode: true, institution: 'HYT Global Institute' }
    setUser('admin')
    const html = render()
    expect(html).toContain('DASHBOARD CONTENT')
    expect(html).not.toContain('Scheduled maintenance')
  })

  it('renders the app normally when the flag is off', () => {
    state.settings = { maintenanceMode: false, institution: 'HYT Global Institute' }
    setUser('trainee')
    const html = render()
    expect(html).toContain('DASHBOARD CONTENT')
    expect(html).not.toContain('Scheduled maintenance')
  })

  it('falls back to a generic name when the institution is blank', () => {
    state.settings = { maintenanceMode: true, institution: '' }
    setUser('trainee')
    expect(render()).toContain('The training centre')
  })
})
