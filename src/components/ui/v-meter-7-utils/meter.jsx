import { cn } from '../../../lib/utils'

// Minimal meter primitives used by the password strength indicator. They mirror
// the shadcn/ui meter API (Meter / MeterTrack / MeterIndicator / MeterLabel /
// MeterValue) so the component can be swapped for the official primitives later
// without touching call sites.

export function Meter({ value = 0, className, children, ...props }) {
  const current = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={current}
      className={cn('w-full', className)}
      style={{ '--meter-value': `${current}%` }}
      {...props}
    >
      {children}
    </div>
  )
}

export function MeterLabel({ className, children }) {
  return <span className={cn('text-xs font-medium text-slate-600', className)}>{children}</span>
}

export function MeterValue({ className, children }) {
  return (
    <span className={cn('text-xs font-semibold text-slate-700', className)}>
      {typeof children === 'function' ? children() : children}
    </span>
  )
}

export function MeterTrack({ className, children }) {
  return <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>{children}</div>
}

export function MeterIndicator({ className }) {
  return (
    <div
      className={cn('h-full rounded-full transition-[width] duration-500 ease-out', className)}
      style={{ width: 'var(--meter-value)' }}
    />
  )
}
