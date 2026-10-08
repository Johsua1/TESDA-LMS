// ---------------------------------------------------------------------------
// Shared utility helpers
// ---------------------------------------------------------------------------

export const cn = (...classes) => classes.filter(Boolean).join(' ')

export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

// ----------------------------- Date helpers --------------------------------

export const toISODate = (d) => {
  const date = d instanceof Date ? d : new Date(d)
  return date.toISOString().slice(0, 10)
}

export const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export const startOfDay = (d = new Date()) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export const formatDate = (value, opts) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' })
}

export const formatDateTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const formatTime = (value) => {
  if (!value) return '—'
  // Accept "13:00" or ISO
  if (/^\d{2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export const relativeDay = (value) => {
  const target = startOfDay(new Date(value)).getTime()
  const today = startOfDay().getTime()
  const diff = Math.round((target - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return new Date(value).toLocaleDateString('en-US', { weekday: 'long' })
  return formatDate(value)
}

export const isSameDay = (a, b) => toISODate(a) === toISODate(b)

// Combine a "YYYY-MM-DD" date and "HH:MM" time into a single local Date.
// Returns null when the date is missing or invalid. Used to validate that a
// schedule is not being set in the past.
export const combineDateTime = (dateStr, timeStr = '00:00') => {
  if (!dateStr) return null
  const [h, m] = String(timeStr || '00:00').split(':').map(Number)
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0)
  return d
}

// ----------------------------- Number helpers -------------------------------

export const currency = (n) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(
    Number(n) || 0,
  )

export const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)

export const clamp = (n, min, max) => Math.min(Math.max(n, min), max)

export const average = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

// ----------------------------- Media helpers --------------------------------

// Classify a video URL for embedding: YouTube/Vimeo links become iframes,
// anything else is treated as a direct video file. Returns null when empty.
export const videoEmbed = (url) => {
  const value = String(url || '').trim()
  if (!value) return null
  const yt = value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return { type: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` }
  const vimeo = value.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` }
  return { type: 'video', src: value }
}

export const slugify = (s = '') =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const classNamesForStatus = (status) => {
  const map = {
    present: 'success',
    late: 'warning',
    absent: 'danger',
    excused: 'info',
    approved: 'success',
    enrolled: 'success',
    completed: 'info',
    pending: 'warning',
    'under review': 'info',
    rejected: 'danger',
    cancelled: 'neutral',
    unpaid: 'danger',
    'partially paid': 'warning',
    'fully paid': 'success',
    passed: 'success',
    failed: 'danger',
    upcoming: 'info',
    ongoing: 'warning',
    'in progress': 'info',
    active: 'success',
    inactive: 'neutral',
  }
  return map[String(status).toLowerCase()] || 'neutral'
}
