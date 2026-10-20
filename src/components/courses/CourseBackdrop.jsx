import { cn } from '../../lib/utils'

// A very light watermark of the course cover, painted behind the course pages.
// Only programs flagged `coverBackground` render it, so the other courses keep
// their plain slate background.
export function CourseBackdrop({ program, className }) {
  if (!program?.coverBackground || !program.image) return null
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl', className)}>
      <img src={program.image} alt="" className="h-full w-full object-cover opacity-[0.12]" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50/55 via-slate-50/80 to-slate-50/95" />
    </div>
  )
}

export default CourseBackdrop
