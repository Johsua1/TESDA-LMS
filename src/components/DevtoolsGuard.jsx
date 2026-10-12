import { useEffect } from 'react'

// Blocks the common "open the inspector" entry points so casual users cannot
// poke around the UI: F12, Ctrl/Cmd+Shift+I / J / C (DevTools), Ctrl+U (view
// source), and the right-click context menu.
//
// SECURITY NOTE: this is a deterrent, not real security. A determined user can
// still reach DevTools through the browser menu ("More tools > Developer
// tools"), disable JavaScript, or request the page with another tool. The
// actual protection for your data is the server-side Row Level Security (RLS)
// on Supabase — this guard only stops the obvious shortcuts.
export function DevtoolsGuard() {
  useEffect(() => {
    const isBlockedShortcut = (e) => {
      const key = String(e.key || '').toLowerCase()
      // F12 — open DevTools
      if (e.key === 'F12') return true
      // Ctrl+Shift+I / J / C  (Windows / Linux)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key)) return true
      // Cmd+Option+I / J / C  (macOS)
      if (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(key)) return true
      // Ctrl+U / Cmd+U — view source
      if ((e.ctrlKey || e.metaKey) && key === 'u') return true
      return false
    }

    const onKeyDown = (e) => {
      if (isBlockedShortcut(e)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const onContextMenu = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    // Capture phase so the guard runs before anything else can react.
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('contextmenu', onContextMenu, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
    }
  }, [])

  return null
}

export default DevtoolsGuard
