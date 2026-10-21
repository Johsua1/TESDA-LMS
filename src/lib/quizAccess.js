// ---------------------------------------------------------------------------
// Quiz scheduling and access rules
// ---------------------------------------------------------------------------
// A quiz lives inside program.quizzes. Scheduling fields:
//   startDate / startTime      -> when the quiz opens
//   deadlineDate / deadlineTime -> when it closes
// With neither set the quiz has no schedule and cannot be started at all.
// Every rule below is applied by the data layer (AppContext) before an attempt
// or a request is written, so hiding a button in the UI is never the only gate.
// ---------------------------------------------------------------------------

import { attemptSeconds, remainingSeconds } from './quizTimer'

const pad = (n) => String(n).padStart(2, '0')

// 'YYYY-MM-DD' + 'HH:mm' -> Date. Missing time means the start/end of that day.
export const combineDateTime = (date, time, edge = 'start') => {
  if (!date) return null
  const [y, m, d] = String(date).split('-').map(Number)
  if (!y || !m || !d) return null
  if (time) {
    const [hh, mm] = String(time).split(':').map(Number)
    return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0)
  }
  return edge === 'end' ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0)
}

export const quizWindow = (quiz = {}, now = new Date()) => {
  const start = combineDateTime(quiz.startDate, quiz.startTime, 'start')
  const deadline = combineDateTime(quiz.deadlineDate, quiz.deadlineTime, 'end')
  return {
    start,
    deadline,
    beforeStart: Boolean(start && now < start),
    afterDeadline: Boolean(deadline && now > deadline),
    scheduled: Boolean(start || deadline),
  }
}

const formatTime = (time) => {
  if (!time) return ''
  const [h, m] = String(time).split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${pad(m || 0)} ${suffix}`
}

export const formatQuizSchedule = (quiz = {}) => {
  const start = quiz.startDate ? `${quiz.startDate}${quiz.startTime ? ` ${formatTime(quiz.startTime)}` : ''}` : null
  const end = quiz.deadlineDate ? `${quiz.deadlineDate}${quiz.deadlineTime ? ` ${formatTime(quiz.deadlineTime)}` : ''}` : null
  if (!start && !end) return 'No schedule set'
  if (start && end) return `${start} — ${end}`
  if (start) return `Opens ${start}`
  return `Closes ${end}`
}

// Trainer-side schedule validation. Kept pure so the rules are testable and
// identical to what the form enforces.
//   - the start date/time cannot be in the past
//   - the deadline cannot be in the past
//   - the deadline must be after the start
// `allowPastStart` is only set when an already-started quiz/exam is being
// edited without touching its start (otherwise the trainer could never fix a
// typo on a running assessment).
// A one-minute grace covers the minute-precision date/time inputs.
export const validateSchedule = ({
  startDate,
  startTime,
  deadlineDate,
  deadlineTime,
  allowPastStart = false,
  now = new Date(),
} = {}) => {
  const opens = combineDateTime(startDate, startTime, 'start')
  const closes = combineDateTime(deadlineDate, deadlineTime, 'end')
  const cutoff = new Date(now.getTime() - 60 * 1000)

  if (opens && opens < cutoff && !allowPastStart) {
    return { ok: false, error: 'The start date and time cannot be in the past.' }
  }
  if (closes && closes < cutoff) {
    return { ok: false, error: 'The deadline cannot be in the past.' }
  }
  if (opens && closes && closes <= opens) {
    return { ok: false, error: 'The deadline must be after the start date and time.' }
  }
  return { ok: true, error: '' }
}

export const isApprovalUnused = (request) =>
  request?.status === 'approved' &&
  Number(request.attemptsUsed || 0) < Number(request.attemptsGranted || 1)

// The single source of truth used by both the trainee UI and the store's
// write guards.
export const getQuizAccess = ({ quiz, attempts = [], requests = [], sessions = [], now = new Date() }) => {
  const window = quizWindow(quiz, now)
  const attemptCount = attempts.length
  const sortedAttempts = [...attempts].sort((a, b) => new Date(b.date) - new Date(a.date))
  const bestAttempt = [...attempts].sort((a, b) => b.percentage - a.percentage)[0] || null
  const lastAttempt = sortedAttempts[0] || null

  const pendingRequest = requests.find((r) => r.status === 'pending') || null
  const approvedRequest = [...requests]
    .filter(isApprovalUnused)
    .sort((a, b) => new Date(b.decidedAt || 0) - new Date(a.decidedAt || 0))[0] || null
  const latestRequest = [...requests].sort(
    (a, b) => new Date(b.decidedAt || b.requestedAt || 0) - new Date(a.decidedAt || a.requestedAt || 0),
  )[0] || null
  const latestRejected = latestRequest?.status === 'rejected' ? latestRequest : null

  const windowOpen = !window.beforeStart && !window.afterDeadline

  // An open session is an attempt that was already started. The clock keeps
  // running from its `startedAt`, so coming back to the quiz resumes the
  // remaining time instead of handing out a fresh 30 minutes. The newest row
  // wins: only one session per trainee/quiz is stored (unique index), but a
  // leftover row from an earlier attempt must never shadow the current one.
  const session =
    [...sessions].sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))[0] || null
  const resumeSeconds = session ? remainingSeconds(session.startedAt, attemptSeconds('quiz'), now) : 0
  const canResume = Boolean(session) && resumeSeconds > 0
  // A session whose clock ran out was never submitted: it is a forfeited
  // attempt, not an open one. It must not block a trainer-approved attempt,
  // which is what left an approved trainee stuck on "Request Retake".
  const activeSession = canResume ? session : null
  const expiredSession = Boolean(session) && !canResume

  // A quiz with no schedule at all cannot be taken: the trainer must set a
  // start/deadline first. An explicit trainer approval still unlocks it.
  // A session that ran out of time counts as a used attempt, so the window
  // alone no longer unlocks a fresh try — only a trainer approval does.
  const attemptUsed = attemptCount > 0 || expiredSession
  const canStart =
    !activeSession && (Boolean(approvedRequest) || (window.scheduled && windowOpen && !attemptUsed))

  let blockedReason = null
  if (!canStart && !canResume) {
    if (expiredSession) blockedReason = 'attempt_expired'
    else if (pendingRequest) blockedReason = 'pending'
    else if (!window.scheduled) blockedReason = 'no_schedule'
    else if (window.beforeStart) blockedReason = 'before_start'
    else if (window.afterDeadline && attemptCount === 0) blockedReason = 'late_required'
    else if (attemptCount > 0) blockedReason = 'attempt_used'
    else blockedReason = 'closed'
  }

  const canRequestRetake =
    attemptUsed &&
    !pendingRequest &&
    (!approvedRequest || expiredSession) &&
    !canResume
  const canRequestLate =
    attemptCount === 0 && window.afterDeadline && !pendingRequest && !approvedRequest && !activeSession

  return {
    window,
    attemptCount,
    bestAttempt,
    lastAttempt,
    pendingRequest,
    approvedRequest,
    latestRequest,
    latestRejected,
    session,
    activeSession,
    expiredSession,
    canResume,
    resumeSeconds,
    canStart,
    canRequestRetake,
    canRequestLate,
    blockedReason,
  }
}

export const quizBlockedMessage = (access) => {
  switch (access?.blockedReason) {
    case 'pending':
      return 'Your request is waiting for trainer approval.'
    case 'no_schedule':
      return 'Your trainer has not scheduled this quiz yet.'
    case 'attempt_expired':
      return 'Your attempt time is up. Request a retake from your trainer.'
    case 'before_start':
      return 'This quiz is not open yet.'
    case 'late_required':
      return 'The deadline has passed. Request late access from your trainer.'
    case 'attempt_used':
      return 'You have already taken this quiz. Request a retake from your trainer.'
    case 'closed':
      return 'This quiz is currently unavailable.'
    default:
      return ''
  }
}

// A trainee's own requests, newest first — used for the dashboard notices.
export const traineeQuizRequests = (db, traineeId) =>
  (db.quizRequests || [])
    .filter((r) => r.traineeId === traineeId)
    .sort((a, b) => new Date(b.decidedAt || b.requestedAt || 0) - new Date(a.decidedAt || a.requestedAt || 0))

export const quizRequestStatusLabel = (status) =>
  status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending'
