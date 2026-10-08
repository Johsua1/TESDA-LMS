import { NavLink, useNavigate } from 'react-router-dom'
import { X, LogOut, ChevronLeft } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { navConfig, roleMeta } from '../../config/navigation'
import { cn } from '../../lib/utils'
import { Avatar } from '../ui'

export function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const { user, logout } = useApp()
  const navigate = useNavigate()
  const role = user?.role || 'trainee'
  const groups = navConfig[role] || []
  const meta = roleMeta[role]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

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
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-300 transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
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
              <p className="truncate text-[11px] text-slate-400">{meta.label} Portal</p>
            </div>
          )}
          <button
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
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
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white',
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

        {/* footer */}
        <div className="border-t border-white/10 p-3">
          {!collapsed && (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-white/5 p-2.5">
              <Avatar name={user?.name} color={user?.avatarColor} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{user?.name}</p>
                <p className="truncate text-[11px] text-slate-400">{user?.email}</p>
              </div>
            </div>
          )}
          <div className={cn('flex gap-2', collapsed && 'flex-col')}>
            <button
              onClick={handleLogout}
              className={cn(
                'flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-400',
                collapsed && 'justify-center px-0',
              )}
              title="Sign out"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && 'Sign out'}
            </button>
            <button
              onClick={onToggleCollapse}
              className="hidden items-center justify-center rounded-lg px-2 py-2 text-slate-400 transition hover:bg-white/5 hover:text-white lg:flex"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
