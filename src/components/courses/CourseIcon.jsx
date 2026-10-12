import { courseIcon } from '../../lib/courseVisuals'
import { cn } from '../../lib/utils'

// A course's distinctive Lucide icon, rendered wherever the emoji used to sit.
// `tone` picks the colour:
//   'light' — white icon for dark / gradient backgrounds (course cards, heroes)
//   'dark'  — slate icon for light backgrounds (list rows, tables, forms)
export function CourseIcon({ program, className, tone = 'light' }) {
  const Icon = courseIcon(program)
  return (
    <Icon
      className={cn('shrink-0', tone === 'light' ? 'text-white drop-shadow' : 'text-slate-500', className)}
      aria-hidden="true"
    />
  )
}

export default CourseIcon
