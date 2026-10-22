import { describe, it, expect, afterEach } from 'vitest'
import {
  setLivePrograms,
  getLivePrograms,
  publishedLessons,
  publishedLessonCount,
  programLessonCount,
} from '../data/programs'
import { courseProgress } from '../store/selectors'

// A trainer can unpublish a lesson; the trainee must never see it, and it must
// not count towards progress (otherwise 100% becomes unreachable).
const original = getLivePrograms()

const program = (lessons) => [
  {
    id: 'zz-vis',
    code: 'ZZ-VIS',
    title: 'Visibility Test',
    competencies: [{ id: 'zz-c1', type: 'Basic', title: 'Basic', lessons }],
  },
]

afterEach(() => setLivePrograms(original))

describe('lesson visibility', () => {
  it('treats a missing published flag as published', () => {
    setLivePrograms(program([{ id: 'l1', title: 'One' }]))
    expect(publishedLessonCount('zz-vis')).toBe(1)
  })

  it('hides lessons explicitly unpublished by the trainer', () => {
    setLivePrograms(
      program([
        { id: 'l1', title: 'One' },
        { id: 'l2', title: 'Two', published: false },
        { id: 'l3', title: 'Three', published: true },
      ]),
    )
    expect(programLessonCount('zz-vis')).toBe(3)
    expect(publishedLessonCount('zz-vis')).toBe(2)
    expect(publishedLessons('zz-vis').map((l) => l.id)).toEqual(['l1', 'l3'])
  })

  it('ignores completed-but-unpublished lessons in progress', () => {
    setLivePrograms(
      program([
        { id: 'l1', title: 'One' },
        { id: 'l2', title: 'Two', published: false },
        { id: 'l3', title: 'Three' },
      ]),
    )
    // l2 was completed before the trainer unpublished it: it must drop out of
    // both the numerator and the denominator.
    const progress = courseProgress({ progress: { l1: true, l2: true } }, 'zz-vis')
    expect(progress).toEqual({ completed: 1, total: 2, percent: 50 })
  })

  it('never divides by zero when every lesson is unpublished', () => {
    setLivePrograms(program([{ id: 'l1', title: 'One', published: false }]))
    expect(courseProgress({ progress: {} }, 'zz-vis')).toEqual({ completed: 0, total: 0, percent: 0 })
  })
})
