import { useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useApp } from '../../store/AppContext'
import { navConfig } from '../../config/navigation'

function usePageTitle() {
  const { user } = useApp()
  const { pathname } = useLocation()
  return useMemo(() => {
    const groups = navConfig[user?.role] || []
    const items = groups.flatMap((g) => g.items)
    // longest matching prefix wins
    const match = items
      .filter((i) => pathname === i.to || pathname.startsWith(i.to + '/'))
      .sort((a, b) => b.to.length - a.to.length)[0]
    return match?.label || 'Dashboard'
  }, [pathname, user])
}

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const title = usePageTitle()

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} title={title} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
