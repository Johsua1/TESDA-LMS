import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { cn } from '../../lib/utils'

const config = {
  success: { icon: CheckCircle2, ring: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  error: { icon: XCircle, ring: 'bg-red-50 text-red-600', bar: 'bg-red-500' },
  warning: { icon: AlertTriangle, ring: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' },
  info: { icon: Info, ring: 'bg-sky-50 text-sky-600', bar: 'bg-sky-500' },
}

export function ToastContainer() {
  const { toasts, dismissToast } = useApp()
  if (!toasts.length) return null
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
      {toasts.map((t) => {
        const cfg = config[t.type] || config.info
        const Icon = cfg.icon
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex animate-slide-in items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg"
          >
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', cfg.ring)}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              {t.title && <p className="text-sm font-semibold text-slate-800">{t.title}</p>}
              <p className="text-sm text-slate-600">{t.message}</p>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default ToastContainer
