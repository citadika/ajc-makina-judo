import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface PermissionRouteProps {
  /** Clé d'autorisation requise (voir types/user.ts, PERMISSION_KEYS), ex. "members:read". */
  permission: string
}

/**
 * Variante de AdminRoute (voir ce fichier) pour les autorisations
 * granulaires : autorise l'accès uniquement aux utilisateurs
 * authentifiés qui sont ADMIN ou qui possèdent explicitement cette
 * autorisation (voir AuthContext.hasPermission()). Un utilisateur non
 * authentifié est renvoyé vers /login ; un utilisateur authentifié
 * mais sans cette autorisation est renvoyé vers /dashboard.
 *
 * C'est une protection de confort côté client (évite d'afficher une
 * page qui échouera de toute façon) : l'application effective de
 * l'autorisation reste côté serveur (require_permission(), voir
 * backend app/dependencies.py) sur chaque endpoint concerné.
 */
export function PermissionRoute({ permission }: PermissionRouteProps) {
  const { isAuthenticated, hasPermission } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
