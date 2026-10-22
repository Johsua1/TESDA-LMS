// Answer-completeness rules for a quiz or exam attempt.
// A trainee must answer every question before submitting: an unanswered
// question grades as wrong, so a half-filled attempt silently costs marks.
// `false` is a valid True/False answer, so only undefined/null/blank strings
// count as unanswered.

const idOf = (question) => question?.id

export const isAnswered = (value) => {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim() !== ''
  return true
}

// `keyOf` lets an exam read its answer map by `examQid` instead of `id`.
export const unansweredQuestions = (questions = [], answers = {}, keyOf = idOf) =>
  (questions || []).filter((question) => !isAnswered(answers?.[keyOf(question)]))

export const firstUnansweredIndex = (questions = [], answers = {}, keyOf = idOf) =>
  (questions || []).findIndex((question) => !isAnswered(answers?.[keyOf(question)]))

export const answersComplete = (questions = [], answers = {}, keyOf = idOf) =>
  firstUnansweredIndex(questions, answers, keyOf) === -1
