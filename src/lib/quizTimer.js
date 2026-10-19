// ---------------------------------------------------------------------------
// Attempt countdown helpers
// ---------------------------------------------------------------------------
// Every attempt gets a fixed clock: 30 minutes for a quiz, 60 minutes for an
// exam. The trainer's schedule decides when a trainee may start, not how long
// the attempt runs.

const pad = (n) => String(n).padStart(2, '0')

export const initialSeconds = (timeLimit) => {
  const minutes = Number(timeLimit)
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  return Math.round(minutes * 60)
}

export const tickSeconds = (seconds) => (seconds <= 0 ? 0 : seconds - 1)

export const ATTEMPT_MINUTES = { quiz: 30, exam: 60 }

export const attemptMinutes = (kind = 'quiz') => ATTEMPT_MINUTES[kind] || ATTEMPT_MINUTES.quiz

// Seconds an attempt gets, by assessment type.
export const attemptSeconds = (kind = 'quiz') => attemptMinutes(kind) * 60

// Seconds left in an attempt that started at `startedAt`. Used when a trainee
// leaves the quiz and comes back: the clock keeps running from the original
// start instead of restarting.
export const remainingSeconds = (startedAt, totalSeconds, now = new Date()) => {
  const started = new Date(startedAt).getTime()
  if (!Number.isFinite(started)) return totalSeconds
  const elapsed = Math.floor((now.getTime() - started) / 1000)
  return Math.max(0, totalSeconds - Math.max(0, elapsed))
}

export const formatCountdown = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}
