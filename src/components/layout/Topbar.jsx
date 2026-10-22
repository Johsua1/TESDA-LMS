import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, LogOut, UserCircle, ChevronDown, Megaphone } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { announcementsFor, unreadAnnouncements } from '../../store/selectors'
import { Avatar, Badge } from '../ui'
import { Dropdown } from '../ui/Dropdown'
import { roleMeta } from '../../config/navigation'
import { formatDate, cn } from '../../lib/utils'

export function Topbar({ onMenuClick, title }) {
  const { user, db, logout, markAnnouncementRead, markAnnouncementsRead } = useApp()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const meta = roleMeta[user?.role] || {}
  const announcements = announcementsFor(db, user).slice(0, 5)
  const unread = unreadAnnouncements(db, user)
  const unreadIds = new Set(unread.map((a) => a.id))
  const openAnnouncements = () => {
    setNotifOpen(false)
    if (roleMeta[user?.role]?.home) navigate(`${roleMeta[user.role].home}/announcements`)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-6 no-print">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-slate-800 sm:text-base">{title || meta.label + ' Portal'}</h2>
        <p className="hidden truncate text-xs text-slate-400 sm:block">
          Welcome back, {user?.name?.split(' ')[0]} · {meta.label}
        </p>
      </div>

      {/* notifications */}
      <div className="relative">
        <button
          onClick={() => setNotifOpen((o) => !o)}
          className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unread.length > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-tesda-red ring-2 ring-white" />
          )}
        </button>
        {notifOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} aria-hidden="true" />
            <div className="absolute right-0 z-20 mt-2 w-80 animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <span className="text-sm font-semibold text-slate-800">Notifications</span>
                {unread.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <Badge tone="brand">{unread.length} unread</Badge>
                    <button
                      type="button"
                      onClick={() => markAnnouncementsRead(unread.map((a) => a.id))}
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Mark all read
                    </button>
                  </div>
                ) : (
                  <Badge tone="success">All read</Badge>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {announcements.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications</p>
                )}
                {announcements.map((a) => {
                  const isUnread = unreadIds.has(a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        markAnnouncementRead(a.id)
                        openAnnouncements()
                      }}
                      className={cn(
                        'flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50',
                        isUnread && 'bg-brand-50/50',
                      )}
                    >
                      <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                        <Megaphone className="h-4 w-4" />
                        {isUnread && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-tesda-red ring-2 ring-white" />}
                      </span>
                      <div className="min-w-0">
                        <p className={cn('truncate text-sm text-slate-800', isUnread ? 'font-semibold' : 'font-medium')}>{a.title}</p>
                        <p className="line-clamp-2 text-xs text-slate-500">{a.body}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(a.date)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* user menu */}
      <Dropdown
        trigger={
          <button className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-slate-100">
            <Avatar name={user?.name} color={user?.avatarColor} size="sm" />
            <span className="hidden text-left sm:block">
              <span className="block text-xs font-semibold text-slate-700">{user?.name}</span>
              <span className="block text-[11px] text-slate-400">{meta.label}</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          </button>
        }
        items={[
          {
            label: 'My Profile',
            icon: UserCircle,
            onClick: () => {
              const base = roleMeta[user?.role]?.home
              if (base) navigate(`${base}/profile`)
            },
          },
          { divider: true },
          { label: 'Sign out', icon: LogOut, danger: true, onClick: handleLogout },
        ]}
      />
    </header>
  )
}

export default Topbar
