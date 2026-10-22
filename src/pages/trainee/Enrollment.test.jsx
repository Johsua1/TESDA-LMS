import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

// The page reads everything through useApp(); stub it so the enrollment gate
// can be driven by the admin setting alone.
const state = vi.hoisted(() => ({
  settings: { allowSelfEnroll: true },
  user: { id: 'tn-1', role: 'trainee', name: 'Juan Dela Cruz', email: 'juan@example.com' },
  db: {
    enrollments: [],
    programs: [
      {
        id: 'barista',
        code: 'BRT',
        title: 'Barista NC II',
        description: 'Prepare and serve coffee.',
        duration: '20 days',
        fee: 5000,
        level: 'NC II',
        color: 'from-amber-400 to-amber-600',
        enrollable: true,
        requirements: [],
      },
    ],
  },
  createEnrollment: () => ({ ok: true, id: 'enr-1' }),
  resubmitEnrollmentRequirement: () => {},
  toast: () => {},
}))

vi.mock('../../store/AppContext', () => ({ useApp: () => state }))

import { Enrollment } from './Enrollment'

const render = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <Enrollment />
    </MemoryRouter>,
  )

describe('Enrollment page - online enrollment switch', () => {
  it('lets a trainee apply while online enrollment is open', () => {
    state.settings = { allowSelfEnroll: true }
    const html = render()
    expect(html).toContain('Enrollment Available')
    expect(html).toContain('Enroll Now')
    expect(html).not.toContain('Enrollment closed')
  })

  it('disables the apply button when the admin closes online enrollment', () => {
    state.settings = { allowSelfEnroll: false }
    const html = render()
    expect(html).toContain('Online enrollment closed')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Enrollment closed<\/button>/)
    expect(html).not.toContain('Enroll Now')
  })

  it('treats a missing flag as open, matching the server default', () => {
    state.settings = {}
    expect(render()).toContain('Enroll Now')
  })
})
