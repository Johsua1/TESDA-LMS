import { useEffect, useState } from 'react'

// A ticking "now" so time-derived UI (e.g. schedule status) updates on its own
// while a page stays open — no reload needed. Default 30s keeps re-renders
// cheap while still flipping Upcoming → Ongoing → Completed promptly.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export default useNow
