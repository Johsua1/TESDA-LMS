import { cn } from '../../lib/utils'

export function FormField({ label, htmlFor, hint, error, required, children, className }) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={htmlFor} className="label-base">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  )
}

export function Input({ className, ...props }) {
  return <input className={cn('input-base', className)} {...props} />
}

export function Textarea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cn('input-base resize-y', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn('input-base appearance-none bg-no-repeat pr-9', className)} {...props}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.6rem center',
        backgroundSize: '1rem',
      }}
    >
      {children}
    </select>
  )
}

export function Checkbox({ label, className, id, ...props }) {
  return (
    <label htmlFor={id} className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700', className)}>
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        {...props}
      />
      {label}
    </label>
  )
}

export function Radio({ label, className, id, ...props }) {
  return (
    <label htmlFor={id} className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700', className)}>
      <input
        id={id}
        type="radio"
        className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
        {...props}
      />
      {label}
    </label>
  )
}

export function FormRow({ children, cols = 2, className }) {
  const map = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }
  return <div className={cn('grid grid-cols-1 gap-4', map[cols], className)}>{children}</div>
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cn('relative', className)}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('input-base pl-9', className)}
      />
    </div>
  )
}
