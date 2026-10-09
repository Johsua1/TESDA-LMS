import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { navConfig, roleMeta } from '../../config/navigation'
import { cn } from '../../lib/utils'

export function Sidebar({ open, onClose, collapsed }) {
  const { user } = useApp()
  const role = user?.role || 'trainee'
  const groups = navConfig[role] || []
  const meta = roleMeta[role]

  return (
    <>
      {/* mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-blue-900 text-white transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          collapsed ? 'w-20' : 'w-72',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* brand */}
        <div className={cn('flex h-16 items-center gap-3 border-b border-white/10 px-4', collapsed && 'justify-center px-0')}>
          <img
            src="/hgi-logo.png"
            alt="HYT Global Institute"
            className="h-11 w-11 shrink-0 object-contain drop-shadow"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">HYT Global Institute</p>
              <p className="truncate text-[11px] text-blue-200">{meta.label} Portal</p>
            </div>
          )}
          <button
            className="ml-auto rounded-lg p-1.5 text-white hover:bg-orange-500 lg:hidden transition-colors"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.group}>
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-blue-200">
                  {group.group}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          collapsed && 'justify-center px-0',
                          isActive
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'text-white hover:bg-orange-500',
                        )
                      }
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar