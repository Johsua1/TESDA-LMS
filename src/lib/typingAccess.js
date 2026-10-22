// ---------------------------------------------------------------------------
// Typing test access rules
// ---------------------------------------------------------------------------
// A VA trainee gets exactly ONE typing test. After the trainer evaluates the
// result the trainee may ask for a retake; only a trainer approval grants one
// more attempt. This mirrors the quiz request flow (lib/quizAccess.js).
// ---------------------------------------------------------------------------

export const TYPING_PROGRAM_ID = 'virtual-assistant'

const newestFirst = (a, b) => new Date(b.requestedAt || b.date || 0) - new Date(a.requestedAt || a.date || 0)

// A trainee's typing results for one program, newest first.
export const typingTestsOf = (db, traineeId, programId = TYPING_PROGRAM_ID) =>
  (db.typingTests || [])
    .filter((t) => t.traineeId === traineeId && (!programId || t.programId === programId))
    .sort((a, b) => new Date(b.submittedAt || b.date || 0) - new Date(a.submittedAt || a.date || 0))

// A trainee's retake requests for one program, newest first.
export const typingRequestsOf = (db, traineeId, programId = TYPING_PROGRAM_ID) =>
  (db.typingRequests || [])
    .filter((r) => r.traineeId === traineeId && (!programId || r.programId === programId))
    .sort(newestFirst)

// Only an explicit `evaluated: false` means the trainer still has to look at
// the result — legacy rows (created before evaluation tracking) count as done.
export const isTypingEvaluated = (test) => Boolean(test) && test.evaluated !== false

// An approval grants exactly one attempt until it is consumed.
export const unusedTypingGrant = (request) =>
  Boolean(request) &&
  request.status === 'approved' &&
  !request.consumedAt &&
  Number(request.attemptsUsed || 0) < Number(request.attemptsGranted || 1)

export function getTypingAccess({ tests = [], requests = [] } = {}) {
  const attemptCount = tests.length
  const latest = tests[0] || null
  const evaluated = latest ? isTypingEvaluated(latest) : false
  const pendingRequest = requests.find((r) => r.status === 'pending') || null
  const approvedRequest = requests.find(unusedTypingGrant) || null
  const latestRejected = requests.find((r) => r.status === 'rejected') || null

  // First attempt is always allowed; every later attempt needs an approval.
  const canStart = attemptCount === 0 || Boolean(approvedRequest)
  // The trainer evaluates first, then the trainee may ask for another attempt.
  const canRequest = attemptCount > 0 && !canStart && !pendingRequest && evaluated

  return {
    attemptCount,
    latest,
    evaluated,
    pendingRequest,
    approvedRequest,
    latestRejected,
    canStart,
    canRequest,
    waitingForEvaluation: attemptCount > 0 && !evaluated,
  }
}
