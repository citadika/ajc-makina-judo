import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Porté depuis core/guards/admin.guard.ts (Angular) : autorise
 * l'accès uniquement aux utilisateurs authentifiés dont le rôle est
 * ADMIN. Un utilisateur non authentifié est renvoyé vers /login
 * (comme ProtectedRoute) ; un utilisateur authentifié mais non-admin
 * est renvoyé vers /dashboard.
 */
export function AdminRoute() {
  const { isAuthenticated, isAdmin } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
