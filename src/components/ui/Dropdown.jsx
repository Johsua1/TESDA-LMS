import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Dropdown({ trigger, items = [], align = 'right', className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className={cn('relative', className)} ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger || <MenuTrigger />}</div>
      {open && (
        <div
          className={cn(
            'absolute z-30 mt-2 min-w-[11rem] animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
          role="menu"
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
        </div>
      )}
    </div>
  )
}

function MenuTrigger() {
  return (
    <button
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
      aria-label="Open menu"
    >
      <MoreVertical className="h-4 w-4" />
    </button>
  )
}

export default Dropdown
