import { useEffect, useState } from 'react'

// Persist a small UI preference (filters, toggles) across reloads and
// navigation. The stored value is validated on read, so a key left behind by
// an older build — or a program the user no longer has access to — falls back
// to the default instead of breaking the page.
export function usePersistentState(key, initialValue, isValid) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return initialValue
      const parsed = JSON.parse(raw)
      if (isValid && !isValid(parsed)) return initialValue
      return parsed
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Private mode / quota errors: the preference still applies for this
      // session, it just won't survive a reload.
    }
  }, [key, value])

  return [value, setValue]
}

export default usePersistentState
