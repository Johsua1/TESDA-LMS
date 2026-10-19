import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Input } from './Form'

// Character-by-character confirmation helper. Both values are controlled by the
// parent form; this component never stores the password itself and only ever
// renders masked characters.
export function AssistedPasswordConfirmation({
  password = '',
  confirmPassword = '',
  onConfirmPasswordChange,
  id = 'confirmPassword',
  name = 'confirmPassword',
  autoComplete = 'new-password',
  placeholder = 'Re-enter your password',
  required = false,
}) {
  const [visible, setVisible] = useState(false)
  const reduceMotion = useReducedMotion()

  const original = Array.from(password)
  const typed = Array.from(confirmPassword)
  const hasConfirm = typed.length > 0
  const matches = hasConfirm && confirmPassword === password
  const statusId = `${id}-status`

  const status = !hasConfirm
    ? 'Re-enter your password to confirm it.'
    : matches
      ? 'Passwords match.'
      : 'Passwords do not match yet.'

  return (
    <div className="w-full space-y-2">
      <motion.div
        animate={matches && !reduceMotion ? { scale: [1, 1.01, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={cn(
          'rounded-lg border p-3 transition-colors',
          matches ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/60',
        )}
      >
        <div className="relative">
          <Input
            id={id}
            name={name}
            type={visible ? 'text' : 'password'}
            autoComplete={autoComplete}
            placeholder={placeholder}
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            aria-describedby={statusId}
            className="bg-white pr-10"
            required={required}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600"
            aria-label={visible ? 'Hide confirmation password' : 'Show confirmation password'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="font-medium uppercase tracking-wide">Original</span>
          <span className="flex flex-wrap gap-0.5" aria-hidden="true">
            {original.length ? (
              original.map((_, index) => (
                <span key={index} className="leading-none text-slate-400">
                  •
                </span>
              ))
            ) : (
              <span className="normal-case text-slate-400">enter a password first</span>
            )}
          </span>
          <span className="sr-only">
            {original.length ? `Original password has ${original.length} characters.` : 'No original password entered yet.'}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1" aria-hidden="true">
          {typed.length ? (
            typed.map((char, index) => {
              const ok = index < original.length && char === original[index]
              return (
                <span
                  key={index}
                  className={cn(
                    'flex h-5 w-4 items-center justify-center rounded border text-[11px] leading-none',
                    ok
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                      : 'border-red-200 bg-red-100 text-red-700',
                  )}
                >
                  •
                </span>
              )
            })
          ) : (
            <span className="text-[11px] text-slate-400">Characters appear here as you type.</span>
          )}
        </div>
      </motion.div>

      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={cn(
          'text-xs font-medium',
          !hasConfirm ? 'text-slate-500' : matches ? 'text-emerald-600' : 'text-red-600',
        )}
      >
        {status}
      </p>
    </div>
  )
}

export default AssistedPasswordConfirmation
