import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { roleMeta } from '../config/navigation'

export function ProtectedRoute({ allow, children }) {
  const { user } = useApp()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (allow && !allow.includes(user.role)) {
    // send user to their own home instead of showing a forbidden page
    return <Navigate to={roleMeta[user.role]?.home || '/login'} replace />
  }

  return children
}

export default ProtectedRoute
