import { describe, it, expect } from 'vitest'
import { isAnswered, unansweredQuestions, firstUnansweredIndex, answersComplete } from './quizAnswers'

const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]
const examQuestions = [{ id: 'e1', examQid: 'x1' }, { id: 'e2', examQid: 'x2' }]
const byExamQid = (q) => q.examQid

describe('isAnswered', () => {
  it('treats false as answered (True/False)', () => {
    expect(isAnswered(false)).toBe(true)
  })

  it('rejects undefined, null, empty and blank strings', () => {
    expect(isAnswered(undefined)).toBe(false)
    expect(isAnswered(null)).toBe(false)
    expect(isAnswered('')).toBe(false)
    expect(isAnswered('   ')).toBe(false)
  })

  it('accepts text answers', () => {
    expect(isAnswered('Calendar')).toBe(true)
    expect(isAnswered(true)).toBe(true)
  })
})

describe('unansweredQuestions', () => {
  it('lists every question still missing an answer', () => {
    const result = unansweredQuestions(questions, { q1: 'A', q3: false })
    expect(result.map((q) => q.id)).toEqual(['q2'])
  })

  it('is empty when everything is answered', () => {
    expect(unansweredQuestions(questions, { q1: 'A', q2: 'B', q3: true })).toEqual([])
  })

  it('treats a whitespace-only answer as unanswered', () => {
    expect(unansweredQuestions(questions, { q1: 'A', q2: '  ', q3: true })).toHaveLength(1)
  })

  it('reads the answer map through a custom key', () => {
    expect(unansweredQuestions(examQuestions, { x1: 'A' }, byExamQid).map((q) => q.id)).toEqual(['e2'])
  })
})

describe('firstUnansweredIndex', () => {
  it('returns the index of the first unanswered question', () => {
    expect(firstUnansweredIndex(questions, { q1: 'A', q3: 'C' })).toBe(1)
  })

  it('returns -1 when complete', () => {
    expect(firstUnansweredIndex(questions, { q1: 'A', q2: 'B', q3: 'C' })).toBe(-1)
  })

  it('supports a custom key', () => {
    expect(firstUnansweredIndex(examQuestions, { x2: 'B' }, byExamQid)).toBe(0)
  })
})

describe('answersComplete', () => {
  it('matches firstUnansweredIndex', () => {
    expect(answersComplete(questions, {})).toBe(false)
    expect(answersComplete(questions, { q1: 'A', q2: 'B', q3: 'C' })).toBe(true)
  })
})
