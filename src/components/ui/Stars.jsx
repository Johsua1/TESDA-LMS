import { Star } from 'lucide-react'
import { cn } from '../../lib/utils'

// A 1–5 star row. Pass `onChange` to make it interactive (a picker); omit it to
// render a read-only display.
export function Stars({ value = 0, onChange, size = 'md', className }) {
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  return (
    <div className={cn('flex gap-1', className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={cn('rounded p-0.5 transition', onChange && 'hover:scale-110')}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star className={cn(dim, n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
        </button>
      ))}
    </div>
  )
}

export default Stars
