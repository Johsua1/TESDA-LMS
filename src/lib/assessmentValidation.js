// Quiz/exam authoring rules, shared by the trainer forms and the tests.
// An assessment may only be saved once every required field is filled in and
// every question is answerable — a half-built question would grade as wrong for
// everyone who takes it. Quizzes and exams use the same rules so a trainer
// cannot publish a quiz that would be rejected as an exam.

export const EXAM_PASSING_MIN = 1
export const EXAM_PASSING_MAX = 100

const LABELS = { exam: 'Exam', quiz: 'Quiz' }

const isBlank = (value) => !String(value ?? '').trim()

// Returns a human-readable problem for one question, or null when it is valid.
export function questionError(question, index) {
  const label = `Question ${index + 1}`
  if (!question) return `${label} is empty.`
  if (isBlank(question.q)) return `${label} needs a question.`

  if (question.type === 'mcq') {
    const options = (question.options || []).filter((option) => !isBlank(option))
    if (options.length < 2) return `${label} needs at least two answer options.`
    if (isBlank(question.answer)) return `${label} needs a correct answer.`
    if (!options.includes(question.answer)) return `${label} needs a correct answer that matches one of its options.`
    return null
  }

  if (question.type === 'tf') {
    return typeof question.answer === 'boolean' ? null : `${label} needs True or False marked as the answer.`
  }

  if (question.type === 'id') {
    return isBlank(question.answer) ? `${label} needs the correct identification answer.` : null
  }

  return `${label} has an unknown question type.`
}

// Returns { ok, error } — `error` is the first problem found.
export function validateAssessment(assessment, { kind = 'exam' } = {}) {
  const label = LABELS[kind] || 'Assessment'
  if (!assessment) return { ok: false, error: `${label} details are missing.` }
  if (isBlank(assessment.title)) return { ok: false, error: `${label} title is required.` }

  const passing = Number(assessment.passing)
  if (!Number.isFinite(passing) || passing < EXAM_PASSING_MIN || passing > EXAM_PASSING_MAX) {
    return { ok: false, error: `Passing score must be between ${EXAM_PASSING_MIN} and ${EXAM_PASSING_MAX}.` }
  }

  const questions = assessment.questions || []
  if (!questions.length) return { ok: false, error: 'Add at least one question.' }

  for (let i = 0; i < questions.length; i += 1) {
    const error = questionError(questions[i], i)
    if (error) return { ok: false, error }
  }

  return { ok: true, error: '' }
}

export const validateExam = (exam) => validateAssessment(exam, { kind: 'exam' })
export const validateQuiz = (quiz) => validateAssessment(quiz, { kind: 'quiz' })
