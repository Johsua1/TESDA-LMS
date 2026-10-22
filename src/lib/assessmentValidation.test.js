import { describe, it, expect } from 'vitest'
import { validateExam, validateQuiz, validateAssessment, questionError } from './assessmentValidation'

const mcq = (over = {}) => ({
  id: 'q1',
  type: 'mcq',
  q: 'Which tool schedules meetings?',
  options: ['Calendar', 'Notepad', 'Printer', 'Router'],
  answer: 'Calendar',
  ...over,
})

const base = (over = {}) => ({
  title: 'Competency Assessment Exam',
  passing: 75,
  questions: [mcq()],
  ...over,
})

describe('validateExam', () => {
  it('accepts a complete exam', () => {
    expect(validateExam(base())).toEqual({ ok: true, error: '' })
  })

  it('rejects a blank title', () => {
    const result = validateExam(base({ title: '   ' }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/exam title is required/i)
  })

  it('rejects an exam without questions', () => {
    const result = validateExam(base({ questions: [] }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/at least one question/i)
  })

  it('rejects a passing score outside 1-100', () => {
    expect(validateExam(base({ passing: 0 })).ok).toBe(false)
    expect(validateExam(base({ passing: 101 })).ok).toBe(false)
    expect(validateExam(base({ passing: '' })).ok).toBe(false)
  })

  it('reports the first incomplete question by number', () => {
    const result = validateExam(base({ questions: [mcq(), mcq({ id: 'q2', q: '' })] }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Question 2/)
  })
})

describe('validateQuiz', () => {
  const quiz = (over = {}) => base({ title: 'Module 1 Assessment', ...over })

  it('accepts a complete quiz', () => {
    expect(validateQuiz(quiz())).toEqual({ ok: true, error: '' })
  })

  it('rejects a blank title', () => {
    const result = validateQuiz(quiz({ title: '  ' }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/quiz title is required/i)
  })

  it('rejects a quiz without questions', () => {
    const result = validateQuiz(quiz({ questions: [] }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/at least one question/i)
  })

  it('rejects a passing score outside 1-100', () => {
    expect(validateQuiz(quiz({ passing: 0 })).ok).toBe(false)
    expect(validateQuiz(quiz({ passing: 101 })).ok).toBe(false)
    expect(validateQuiz(quiz({ passing: '' })).ok).toBe(false)
  })

  it('rejects a half-built question, naming it', () => {
    const result = validateQuiz(
      quiz({ questions: [mcq(), mcq({ id: 'q2', q: 'Pick one', options: ['A', 'B'], answer: 'C' })] }),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Question 2/)
    expect(result.error).toMatch(/correct answer that matches one of its options/i)
  })

  it('rejects an unanswered true/false question', () => {
    const result = validateQuiz(quiz({ questions: [{ id: 't1', type: 'tf', q: 'A quiz can be retaken.', answer: null }] }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/True or False/)
  })

  it('applies the same rules as an exam', () => {
    const cases = [
      { title: 'X', passing: 75, questions: [] },
      { title: '', passing: 75, questions: [mcq()] },
      { title: 'X', passing: 0, questions: [mcq()] },
      { title: 'X', passing: 75, questions: [mcq({ q: '' })] },
    ]
    for (const item of cases) {
      const examResult = validateExam(item)
      const quizResult = validateQuiz(item)
      expect(quizResult.ok).toBe(examResult.ok)
      expect(quizResult.error.replace(/^Quiz/, 'Exam')).toBe(examResult.error)
    }
  })
})

describe('validateAssessment', () => {
  it('falls back to a neutral label for an unknown kind', () => {
    const result = validateAssessment({ title: '' }, { kind: 'typing' })
    expect(result.error).toBe('Assessment title is required.')
  })
})

describe('questionError', () => {
  it('needs at least two options for multiple choice', () => {
    expect(questionError(mcq({ options: ['Calendar', '', '', ''] }), 0)).toMatch(/two answer options/)
  })

  it('needs a correct answer that matches an option', () => {
    expect(questionError(mcq({ answer: '' }), 0)).toMatch(/correct answer/)
    expect(questionError(mcq({ answer: 'Stapler' }), 0)).toMatch(/matches one of its options/)
  })

  it('needs true or false marked', () => {
    expect(questionError({ id: 't1', type: 'tf', q: 'A VA can work remotely.', answer: null }, 0)).toMatch(/True or False/)
    expect(questionError({ id: 't1', type: 'tf', q: 'A VA can work remotely.', answer: false }, 0)).toBeNull()
  })

  it('needs an identification answer', () => {
    expect(questionError({ id: 'i1', type: 'id', q: 'Spell out WPM.', answer: '  ' }, 0)).toMatch(/identification/)
    expect(questionError({ id: 'i1', type: 'id', q: 'Spell out WPM.', answer: 'Words per minute' }, 0)).toBeNull()
  })

  it('returns null for a valid question', () => {
    expect(questionError(mcq(), 0)).toBeNull()
  })
})
