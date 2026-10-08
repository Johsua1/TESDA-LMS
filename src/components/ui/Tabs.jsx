import { cn } from '../../lib/utils'

export function Tabs({ tabs, value, onChange, className, variant = 'underline', size = 'md' }) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' }
  if (variant === 'pills') {
    return (
      <div className={cn('inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1', className)}>
        {tabs.map((t) => {
          const active = t.key === value
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg font-medium transition',
                sizes[size],
                active ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {t.icon && <t.icon className="h-4 w-4" />}
              {t.label}
              {t.badge != null && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    active ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-600',
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('flex gap-1 overflow-x-auto border-b border-slate-200 scrollbar-hide', className)}>
      {tabs.map((t) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 border-b-2 font-medium transition',
              sizes[size],
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            )}
          >
            {t.icon && <t.icon className="h-4 w-4" />}
            {t.label}
            {t.badge != null && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
