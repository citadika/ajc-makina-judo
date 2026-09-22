import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface AppShellProps {
  pageTitle?: string
  pageSubtitle?: string
  showHeader?: boolean
  children: ReactNode
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'active' : ''
}

/**
 * Coquille applicative partagée par toutes les pages authentifiées —
 * porté depuis shared/app-shell/app-shell.ts (Angular). Les classes
 * elles-mêmes (.app-shell, .app-sidebar, .side-nav, .side-user,
 * .page-head...) vivent dans styles/global.css.
 */
export function AppShell({ pageTitle = '', pageSubtitle = '', showHeader = true, children }: AppShellProps) {
  const { user, isAdmin, hasPermission, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Bouton "Retour" affiché sur toutes les pages sauf le tableau de
  // bord (qui est déjà la page d'accueil - y revenir n'a pas de sens).
  // window.history.length <= 1 signifie un onglet fraîchement ouvert
  // (ex. lien direct) : dans ce cas navigate(-1) sortirait de
  // l'application, donc on retombe sur le tableau de bord à la place.
  const showBackButton = location.pathname !== '/dashboard'

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }

  const fullName = user?.fullName || user?.username || 'Administrateur'
  const userRole = user?.role === 'ADMIN' ? 'Administrateur' : user?.role ? 'Secrétariat' : 'Administration'

  const initials = (() => {
    const name = fullName.trim()
    if (!name) return 'JC'
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  })()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="side-brand">
          <div className="side-mark">
            Judo<span className="accent">Card</span>
          </div>
          <span className="side-club">AJC MAKINA</span>
        </div>

        <nav className="side-nav">
          <NavLink to="/dashboard" className={navLinkClass} end>
            <span className="icon">🏠</span>
            <span>Tableau de bord</span>
          </NavLink>

          {hasPermission('members:read') && (
            <NavLink to="/members" className={navLinkClass}>
              <span className="icon">👥</span>
              <span>Adhérents</span>
            </NavLink>
          )}

          {hasPermission('cards:read') && (
            <NavLink to="/cards" className={navLinkClass}>
              <span className="icon">🪪</span>
              <span>Cartes</span>
            </NavLink>
          )}

          {hasPermission('verifications:read') && (
            <NavLink to="/verification" className={navLinkClass}>
              <span className="icon">🛡️</span>
              <span>Vérification</span>
            </NavLink>
          )}

          {hasPermission('activity_log:read') && (
            <NavLink to="/activity-log" className={navLinkClass}>
              <span className="icon">🕒</span>
              <span>Journal d'activité</span>
            </NavLink>
          )}

          {isAdmin && (
            <NavLink to="/users" className={navLinkClass}>
              <span className="icon">👤</span>
              <span>Utilisateurs</span>
            </NavLink>
          )}

          <NavLink to="/settings" className={navLinkClass}>
            <span className="icon">⚙️</span>
            <span>Paramètres</span>
          </NavLink>
        </nav>

        <div className="side-user">
          <div className="avatar">{initials}</div>
          <div className="who">
            <b>{fullName}</b>
            <span>{userRole}</span>
          </div>
          <button type="button" className="logout-btn" title="Déconnexion" onClick={handleLogout}>
            ↪
          </button>
        </div>
      </aside>

      <div className="app-main">
        {showHeader && (pageTitle || pageSubtitle) && (
          <div className="page-head">
            <div className="page-head-main">
              {showBackButton && (
                <button type="button" className="btn-back" onClick={goBack} title="Retour">
                  ← Retour
                </button>
              )}
              {pageTitle && <h1>{pageTitle}</h1>}
            </div>
            {pageSubtitle && <span className="sub">{pageSubtitle}</span>}
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
