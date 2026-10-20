import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Redirects unauthenticated users to /login, preserving the intended path. */
export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

/** Redirects non-admin users to home page. */
export function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }
  return children
}
