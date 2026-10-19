import { describe, it, expect } from 'vitest'
import { initialSeconds, tickSeconds, formatCountdown, attemptSeconds, remainingSeconds } from './quizTimer'
import { quizWindow, getQuizAccess } from './quizAccess'

describe('initialSeconds', () => {
  it('converts the time limit to seconds', () => {
    expect(initialSeconds(15)).toBe(900)
    expect(initialSeconds(30)).toBe(1800)
  })

  it('rounds fractional minutes', () => {
    expect(initialSeconds(12.5)).toBe(750)
  })

  it('returns 0 for missing, zero or negative limits', () => {
    expect(initialSeconds(0)).toBe(0)
    expect(initialSeconds(-5)).toBe(0)
    expect(initialSeconds(undefined)).toBe(0)
    expect(initialSeconds('abc')).toBe(0)
  })
})

describe('tickSeconds', () => {
  it('counts down and stops at zero', () => {
    let s = 3
    s = tickSeconds(s)
    expect(s).toBe(2)
    s = tickSeconds(s)
    expect(s).toBe(1)
    s = tickSeconds(s)
    expect(s).toBe(0)
    expect(tickSeconds(s)).toBe(0)
  })
})

describe('formatCountdown', () => {
  it('formats mm:ss', () => {
    expect(formatCountdown(900)).toBe('15:00')
    expect(formatCountdown(59)).toBe('00:59')
    expect(formatCountdown(0)).toBe('00:00')
  })

  it('keeps minutes above 59', () => {
    expect(formatCountdown(3661)).toBe('61:01')
  })

  it('never shows a negative clock', () => {
    expect(formatCountdown(-10)).toBe('00:00')
  })
})

describe('attemptSeconds', () => {
  it('gives every quiz 30 minutes', () => {
    expect(attemptSeconds('quiz')).toBe(30 * 60)
    expect(formatCountdown(attemptSeconds('quiz'))).toBe('30:00')
  })

  it('gives every exam 60 minutes', () => {
    expect(attemptSeconds('exam')).toBe(60 * 60)
    expect(formatCountdown(attemptSeconds('exam'))).toBe('60:00')
  })

  it('defaults to the quiz clock', () => {
    expect(attemptSeconds()).toBe(30 * 60)
  })
})

describe('remainingSeconds', () => {
  const now = new Date(2026, 9, 19, 12, 0, 0)

  it('subtracts the time already spent', () => {
    const started = new Date(2026, 9, 19, 11, 50, 0) // 10 minutes ago
    expect(remainingSeconds(started, 30 * 60, now)).toBe(20 * 60)
  })

  it('never returns a negative clock', () => {
    const started = new Date(2026, 9, 19, 11, 0, 0) // 60 minutes ago
    expect(remainingSeconds(started, 30 * 60, now)).toBe(0)
  })

  it('falls back to the full duration for a bad start time', () => {
    expect(remainingSeconds('not-a-date', 30 * 60, now)).toBe(30 * 60)
  })
})

describe('timer with a past start', () => {
  const now = new Date(2026, 9, 19, 12, 0, 0)
  const ongoingQuiz = {
    id: 'q1',
    timeLimit: 15,
    startDate: '2026-10-19',
    startTime: '11:50', // started 10 minutes ago
    deadlineDate: '2026-10-20',
    deadlineTime: '17:00',
  }

  it('treats an ongoing quiz as open, not as "before start"', () => {
    const w = quizWindow(ongoingQuiz, now)
    expect(w.beforeStart).toBe(false)
    expect(w.afterDeadline).toBe(false)
  })

  it('allows the attempt to start', () => {
    const access = getQuizAccess({ quiz: ongoingQuiz, now })
    expect(access.canStart).toBe(true)
    expect(access.blockedReason).toBeNull()
  })

  it('ignores the schedule when timing the attempt', () => {
    // The trainer's start time does not shorten or extend the attempt clock.
    expect(attemptSeconds('quiz')).toBe(30 * 60)
    expect(formatCountdown(attemptSeconds('quiz'))).toBe('30:00')
  })

  it('works the same for an exam', () => {
    const exam = { ...ongoingQuiz, id: 'e1', timeLimit: 30 }
    const w = quizWindow(exam, now)
    expect(w.beforeStart).toBe(false)
    expect(w.afterDeadline).toBe(false)
    expect(formatCountdown(attemptSeconds('exam'))).toBe('60:00')
  })
})
