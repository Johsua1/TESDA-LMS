import { describe, it, expect } from 'vitest'
import {
  combineDateTime,
  quizWindow,
  validateSchedule,
  getQuizAccess,
  quizBlockedMessage,
  formatQuizSchedule,
} from './quizAccess'

// All dates below are local time — combineDateTime builds wall-clock Dates, and
// the tests must not depend on the machine's timezone.
const NOW = new Date(2026, 9, 19, 12, 0, 0) // 19 Oct 2026, 12:00 local

const schedule = (patch = {}) => ({
  startDate: '',
  startTime: '',
  deadlineDate: '',
  deadlineTime: '',
  ...patch,
})

describe('combineDateTime', () => {
  it('combines a date and a time', () => {
    const d = combineDateTime('2026-10-19', '09:30', 'start')
    expect(d).toEqual(new Date(2026, 9, 19, 9, 30, 0, 0))
  })

  it('uses the start of the day when no time is given', () => {
    const d = combineDateTime('2026-10-19', '', 'start')
    expect(d).toEqual(new Date(2026, 9, 19, 0, 0, 0, 0))
  })

  it('uses the end of the day when no time is given for a deadline', () => {
    const d = combineDateTime('2026-10-19', '', 'end')
    expect(d).toEqual(new Date(2026, 9, 19, 23, 59, 59, 999))
  })

  it('returns null without a date', () => {
    expect(combineDateTime('', '09:00')).toBeNull()
    expect(combineDateTime(null, null)).toBeNull()
  })

  it('returns null for a malformed date', () => {
    expect(combineDateTime('not-a-date', '09:00')).toBeNull()
  })
})

describe('quizWindow', () => {
  it('is unscheduled and open when no dates are set', () => {
    const w = quizWindow(schedule(), NOW)
    expect(w).toMatchObject({ scheduled: false, beforeStart: false, afterDeadline: false })
  })

  it('is before start when the start is in the future', () => {
    const w = quizWindow(schedule({ startDate: '2026-10-20', startTime: '09:00' }), NOW)
    expect(w.beforeStart).toBe(true)
    expect(w.afterDeadline).toBe(false)
  })

  it('is after the deadline when the deadline has passed', () => {
    const w = quizWindow(schedule({ deadlineDate: '2026-10-18', deadlineTime: '17:00' }), NOW)
    expect(w.afterDeadline).toBe(true)
    expect(w.beforeStart).toBe(false)
  })

  it('treats the exact start instant as open', () => {
    const w = quizWindow(schedule({ startDate: '2026-10-19', startTime: '12:00' }), NOW)
    expect(w.beforeStart).toBe(false)
  })

  it('treats the exact deadline instant as still open', () => {
    const w = quizWindow(schedule({ deadlineDate: '2026-10-19', deadlineTime: '12:00' }), NOW)
    expect(w.afterDeadline).toBe(false)
  })

  it('uses end of day for a deadline date without a time', () => {
    const w = quizWindow(schedule({ deadlineDate: '2026-10-19' }), NOW)
    expect(w.afterDeadline).toBe(false)
  })
})

describe('validateSchedule', () => {
  it('accepts an empty schedule (no restriction)', () => {
    expect(validateSchedule({ ...schedule(), now: NOW })).toEqual({ ok: true, error: '' })
  })

  it('rejects a new quiz that starts in the past', () => {
    const res = validateSchedule({
      ...schedule({ startDate: '2026-10-18', startTime: '09:00' }),
      now: NOW,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/start date and time cannot be in the past/i)
  })

  it('rejects a new quiz whose deadline is in the past', () => {
    const res = validateSchedule({
      ...schedule({ deadlineDate: '2026-10-18', deadlineTime: '17:00' }),
      now: NOW,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/deadline cannot be in the past/i)
  })

  it('accepts a future schedule', () => {
    const res = validateSchedule({
      ...schedule({
        startDate: '2026-10-20',
        startTime: '09:00',
        deadlineDate: '2026-10-25',
        deadlineTime: '17:00',
      }),
      now: NOW,
    })
    expect(res).toEqual({ ok: true, error: '' })
  })

  it('allows an existing quiz to keep a past start while its deadline is ahead', () => {
    const res = validateSchedule({
      ...schedule({
        startDate: '2026-10-18',
        startTime: '09:00',
        deadlineDate: '2026-10-20',
        deadlineTime: '17:00',
      }),
      allowPastStart: true,
      now: NOW,
    })
    expect(res.ok).toBe(true)
  })

  it('rejects an existing quiz whose deadline has already passed', () => {
    const res = validateSchedule({
      ...schedule({
        startDate: '2026-10-10',
        startTime: '09:00',
        deadlineDate: '2026-10-18',
        deadlineTime: '17:00',
      }),
      allowPastStart: true,
      now: NOW,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/deadline cannot be in the past/i)
  })

  it('rejects a deadline that equals the start', () => {
    const res = validateSchedule({
      ...schedule({
        startDate: '2026-10-20',
        startTime: '09:00',
        deadlineDate: '2026-10-20',
        deadlineTime: '09:00',
      }),
      now: NOW,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/deadline must be after the start/i)
  })

  it('rejects a deadline before the start', () => {
    const res = validateSchedule({
      ...schedule({
        startDate: '2026-10-21',
        startTime: '09:00',
        deadlineDate: '2026-10-20',
        deadlineTime: '17:00',
      }),
      now: NOW,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/deadline must be after the start/i)
  })

  it('allows the current minute (one-minute grace)', () => {
    const res = validateSchedule({
      ...schedule({ startDate: '2026-10-19', startTime: '12:00' }),
      now: new Date(2026, 9, 19, 12, 0, 45),
    })
    expect(res.ok).toBe(true)
  })

  it('rejects a start more than a minute in the past', () => {
    const res = validateSchedule({
      ...schedule({ startDate: '2026-10-19', startTime: '11:58' }),
      now: NOW,
    })
    expect(res.ok).toBe(false)
  })

  it('rejects an existing quiz whose past start was changed', () => {
    const res = validateSchedule({
      ...schedule({ startDate: '2026-10-17', startTime: '09:00' }),
      now: NOW,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/start date and time cannot be in the past/i)
  })

  it('does not let allowPastStart bypass a past deadline', () => {
    const res = validateSchedule({
      ...schedule({
        startDate: '2026-10-10',
        startTime: '09:00',
        deadlineDate: '2026-10-18',
        deadlineTime: '17:00',
      }),
      allowPastStart: true,
      now: NOW,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/deadline cannot be in the past/i)
  })
})

describe('getQuizAccess with schedules', () => {
  it('blocks a first attempt before the start', () => {
    const access = getQuizAccess({
      quiz: schedule({ startDate: '2026-10-20', startTime: '09:00' }),
      now: NOW,
    })
    expect(access.canStart).toBe(false)
    expect(access.blockedReason).toBe('before_start')
  })

  it('allows a first attempt inside the window', () => {
    const access = getQuizAccess({
      quiz: schedule({
        startDate: '2026-10-19',
        startTime: '08:00',
        deadlineDate: '2026-10-19',
        deadlineTime: '17:00',
      }),
      now: NOW,
    })
    expect(access.canStart).toBe(true)
    expect(access.blockedReason).toBeNull()
  })

  it('asks for late access once the deadline passed without an attempt', () => {
    const access = getQuizAccess({
      quiz: schedule({ deadlineDate: '2026-10-18', deadlineTime: '17:00' }),
      now: NOW,
    })
    expect(access.canStart).toBe(false)
    expect(access.blockedReason).toBe('late_required')
    expect(access.canRequestLate).toBe(true)
  })

  it('does not offer late access while the quiz is still open', () => {
    const access = getQuizAccess({
      quiz: schedule({ deadlineDate: '2026-10-20', deadlineTime: '17:00' }),
      now: NOW,
    })
    expect(access.canRequestLate).toBe(false)
  })
})

describe('getQuizAccess without a schedule', () => {
  it('blocks the first attempt when nothing is scheduled', () => {
    const access = getQuizAccess({ quiz: schedule(), now: NOW })
    expect(access.canStart).toBe(false)
    expect(access.blockedReason).toBe('no_schedule')
    expect(access.window.scheduled).toBe(false)
  })

  it('explains that the trainer has not scheduled the quiz', () => {
    const access = getQuizAccess({ quiz: schedule(), now: NOW })
    expect(quizBlockedMessage(access)).toMatch(/not scheduled/i)
  })

  it('still lets a trainer-approved attempt through', () => {
    const access = getQuizAccess({
      quiz: schedule(),
      requests: [{ id: 'qr1', status: 'approved', attemptsGranted: 1, attemptsUsed: 0 }],
      now: NOW,
    })
    expect(access.canStart).toBe(true)
    expect(access.blockedReason).toBeNull()
  })
})

describe('getQuizAccess with a running session', () => {
  const openQuiz = schedule({
    startDate: '2026-10-19',
    startTime: '08:00',
    deadlineDate: '2026-10-19',
    deadlineTime: '17:00',
  })

  it('resumes with the time left, not a fresh 30 minutes', () => {
    const startedAt = new Date(2026, 9, 19, 11, 50, 0).toISOString() // 10 min ago
    const access = getQuizAccess({ quiz: openQuiz, sessions: [{ id: 'qs1', startedAt }], now: NOW })
    expect(access.canStart).toBe(false)
    expect(access.canResume).toBe(true)
    expect(access.resumeSeconds).toBe(20 * 60)
    expect(access.blockedReason).toBeNull()
  })

  it('blocks a restart once the session ran out of time', () => {
    const startedAt = new Date(2026, 9, 19, 11, 0, 0).toISOString() // 60 min ago
    const access = getQuizAccess({ quiz: openQuiz, sessions: [{ id: 'qs1', startedAt }], now: NOW })
    expect(access.canStart).toBe(false)
    expect(access.canResume).toBe(false)
    expect(access.blockedReason).toBe('attempt_expired')
    expect(access.canRequestRetake).toBe(true)
  })

  it('blocks the first start while a session is running', () => {
    const startedAt = new Date(2026, 9, 19, 11, 55, 0).toISOString()
    const access = getQuizAccess({ quiz: openQuiz, sessions: [{ id: 'qs1', startedAt }], now: NOW })
    expect(access.canStart).toBe(false)
    expect(access.session.id).toBe('qs1')
  })

  it('lets a trainer approval restart after the session timed out', () => {
    const startedAt = new Date(2026, 9, 18, 9, 26, 0).toISOString()
    const access = getQuizAccess({
      quiz: schedule(),
      sessions: [{ id: 'qs1', startedAt }],
      requests: [{ id: 'qr1', status: 'approved', attemptsGranted: 1, attemptsUsed: 0 }],
      now: NOW,
    })
    expect(access.expiredSession).toBe(true)
    expect(access.canResume).toBe(false)
    expect(access.canStart).toBe(true)
    expect(access.blockedReason).toBeNull()
  })

  it('asks for a retake after a timed-out session with no approval', () => {
    const startedAt = new Date(2026, 9, 18, 9, 26, 0).toISOString()
    const access = getQuizAccess({ quiz: schedule(), sessions: [{ id: 'qs1', startedAt }], now: NOW })
    expect(access.canStart).toBe(false)
    expect(access.canRequestRetake).toBe(true)
    expect(access.blockedReason).toBe('attempt_expired')
  })

  it('resumes the newest session when an older row is left behind', () => {
    const stale = new Date(2026, 9, 19, 8, 0, 0).toISOString()
    const fresh = new Date(2026, 9, 19, 11, 50, 0).toISOString()
    const access = getQuizAccess({
      quiz: openQuiz,
      sessions: [
        { id: 'old', startedAt: stale },
        { id: 'new', startedAt: fresh },
      ],
      now: NOW,
    })
    expect(access.session.id).toBe('new')
    expect(access.canResume).toBe(true)
    expect(access.resumeSeconds).toBe(20 * 60)
  })
})

describe('exam schedules (shared validator)', () => {
  it('rejects an exam that starts in the past', () => {
    const res = validateSchedule({
      ...schedule({ startDate: '2026-10-18', startTime: '08:00' }),
      now: NOW,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/start date and time cannot be in the past/i)
  })

  it('accepts an exam scheduled in the future', () => {
    const res = validateSchedule({
      ...schedule({
        startDate: '2026-10-20',
        startTime: '08:00',
        deadlineDate: '2026-10-21',
        deadlineTime: '12:00',
      }),
      now: NOW,
    })
    expect(res.ok).toBe(true)
  })

  it('lets an ongoing exam keep its past start but requires a future deadline', () => {
    const res = validateSchedule({
      ...schedule({
        startDate: '2026-10-18',
        startTime: '08:00',
        deadlineDate: '2026-10-20',
        deadlineTime: '12:00',
      }),
      allowPastStart: true,
      now: NOW,
    })
    expect(res.ok).toBe(true)
  })
})

describe('formatQuizSchedule', () => {
  it('describes a full schedule', () => {
    expect(
      formatQuizSchedule({
        startDate: '2026-10-19',
        startTime: '09:00',
        deadlineDate: '2026-10-20',
        deadlineTime: '17:30',
      }),
    ).toBe('2026-10-19 9:00 AM — 2026-10-20 5:30 PM')
  })

  it('handles a missing schedule', () => {
    expect(formatQuizSchedule({})).toBe('No schedule set')
  })
})
