// Maintenance-mode gate rule, kept pure so the role bypass is testable.
// Trainees and trainers are locked out; a Super Admin must keep access,
// otherwise nobody could switch maintenance mode back off.

export const MAINTENANCE_EXEMPT_ROLES = ['admin']

export function isMaintenanceBlocked({ settings, user } = {}) {
  if (!settings?.maintenanceMode) return false
  // No signed-in user: ProtectedRoute owns that redirect, not this gate.
  if (!user) return false
  return !MAINTENANCE_EXEMPT_ROLES.includes(user.role)
}
