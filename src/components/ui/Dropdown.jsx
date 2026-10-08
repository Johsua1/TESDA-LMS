import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'
import { cn } from '../../lib/utils'

// A row-action menu. The menu is rendered in a portal on <body> with fixed
// positioning so it is never clipped by a scrolling table or an overflow-hidden
// card — that clipping is why the old inline menu got cut off. It flips above
// the trigger when there isn't room below and stays inside the viewport.
export function Dropdown({ trigger, items = [], align = 'right', className }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const menuWidth = menuRef.current?.offsetWidth || 176
    const menuHeight = menuRef.current?.offsetHeight || 0
    const gap = 6
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = menuHeight > 0 && spaceBelow < menuHeight + gap && rect.top > menuHeight + gap
    let left = align === 'right' ? rect.right - menuWidth : rect.left
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))
    const top = openUp ? rect.top - menuHeight - gap : rect.bottom + gap
    setPos({ top, left })
  }, [align])

  useLayoutEffect(() => {
    if (!open) return undefined
    updatePosition()
    // Measure again on the next frame now that the menu has real dimensions.
    const id = requestAnimationFrame(updatePosition)
    return () => cancelAnimationFrame(id)
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onReflow = () => setOpen(false)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [open])

  return (
    <>
      <div className={cn('relative', className)} ref={triggerRef}>
        <div onClick={() => setOpen((o) => !o)}>{trigger || <MenuTrigger open={open} />}</div>
      </div>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className="fixed z-[60] min-w-[11rem] animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5"
          >
            {items.map((item, i) =>
              item.divider ? (
                <div key={`d-${i}`} className="my-1 border-t border-slate-100" />
              ) : (
                <button
                  key={item.label}
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    item.onClick?.()
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition',
                    item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

function MenuTrigger({ open }) {
  return (
    <button
      type="button"
      title="Actions"
      aria-label="Open actions menu"
      aria-haspopup="menu"
      aria-expanded={open}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg transition',
        open ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
      )}
    >
      <MoreVertical className="h-4 w-4" />
    </button>
  )
}

export default Dropdown
