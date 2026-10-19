import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './Form'
import { Meter, MeterIndicator, MeterLabel, MeterTrack, MeterValue } from './v-meter-7-utils/meter'

// Score the password exactly as specified: length 8+, length 12+, uppercase,
// digit, symbol. This is user guidance only — the auth backend still enforces
// the real password policy.
export function getPasswordStrength(password = '') {
  if (!password.length) return { color: '', label: '', value: 0 }

  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score <= 1) return { color: 'bg-red-500', label: 'Weak', value: 20 }
  if (score === 2) return { color: 'bg-orange-500', label: 'Fair', value: 40 }
  if (score === 3) return { color: 'bg-yellow-500', label: 'Good', value: 60 }
  if (score === 4) return { color: 'bg-blue-500', label: 'Strong', value: 80 }
  return { color: 'bg-emerald-500', label: 'Very strong', value: 100 }
}

export function PasswordStrengthMeter({
  password = '',
  onPasswordChange,
  id = 'password',
  name = 'password',
  autoComplete = 'new-password',
  placeholder = '••••••••',
  required = false,
}) {
  const [visible, setVisible] = useState(false)
  const strength = getPasswordStrength(password)
  const describedBy = `${id}-strength`

  return (
    <div className="w-full space-y-2">
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          aria-describedby={describedBy}
          className="pr-10"
          required={required}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <Meter value={strength.value}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <MeterLabel>Password strength</MeterLabel>
          {strength.label && <MeterValue>{strength.label}</MeterValue>}
        </div>
        <MeterTrack>
          <MeterIndicator className={strength.color} />
        </MeterTrack>
      </Meter>

      <p id={describedBy} className="text-xs text-slate-500" aria-live="polite">
        {strength.label
          ? `Password strength: ${strength.label}`
          : 'Use 8+ characters with uppercase letters, numbers and symbols — the password must be rated Good or higher.'}
      </p>
    </div>
  )
}

export default PasswordStrengthMeter
