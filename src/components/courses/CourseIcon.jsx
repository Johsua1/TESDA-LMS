import { courseIcon } from '../../lib/courseVisuals'
import { cn } from '../../lib/utils'

// A course's distinctive Lucide icon, rendered where the emoji used to sit on
// the course card / detail header.
export function CourseIcon({ program, className }) {
  const Icon = courseIcon(program)
  return <Icon className={cn('text-white drop-shadow', className)} aria-hidden="true" />
}

export default CourseIcon
