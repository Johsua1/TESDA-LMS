import { useEffect } from 'react'
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './primitives'

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', icon: Icon }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full animate-scale-in rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl',
          sizeMap[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-4.5 w-4.5" />
              </span>
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-800">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

const confirmTones = {
  danger: { icon: AlertTriangle, ring: 'bg-red-50 text-red-600', button: 'danger' },
  warning: { icon: AlertTriangle, ring: 'bg-amber-50 text-amber-600', button: 'primary' },
  info: { icon: Info, ring: 'bg-sky-50 text-sky-600', button: 'primary' },
  success: { icon: CheckCircle2, ring: 'bg-emerald-50 text-emerald-600', button: 'success' },
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
}) {
  const cfg = confirmTones[tone]
  const Icon = cfg.icon
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={cfg.button}
            onClick={() => {
              onConfirm?.()
              onClose?.()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', cfg.ring)}>
          <Icon className="h-5 w-5" />
        </span>
        <p className="pt-1.5 text-sm text-slate-600">{message}</p>
      </div>
    </Modal>
  )
}
