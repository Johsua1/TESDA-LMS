import { Wrench, LogOut } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { isMaintenanceBlocked } from '../lib/maintenance'

// Enforced for trainees and trainers only: a Super Admin must be able to sign
// in and switch maintenance mode back off.
export function MaintenanceGate({ children }) {
  const { settings, user, logout } = useApp()
  if (!isMaintenanceBlocked({ settings, user })) return children

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Wrench className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-800">Scheduled maintenance</h1>
        <p className="mt-2 text-sm text-slate-500">
          {settings.institution || 'The training centre'} is temporarily unavailable while the system is being
          updated. Please try again later.
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  )
}

export default MaintenanceGate
