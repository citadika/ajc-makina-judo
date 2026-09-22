import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AdminRoute } from './routes/AdminRoute'
import { PermissionRoute } from './routes/PermissionRoute'
import { Login } from './pages/Login/Login'
import { Dashboard } from './pages/Dashboard/Dashboard'
import { Members } from './pages/Members/Members'
import { Cards } from './pages/Cards/Cards'
import { CardDetail } from './pages/CardDetail/CardDetail'
import { BeltHistory } from './pages/BeltHistory/BeltHistory'
import { Verification } from './pages/Verification/Verification'
import { Users } from './pages/Users/Users'
import { Settings } from './pages/Settings/Settings'
import { ActivityLog } from './pages/ActivityLog/ActivityLog'

/**
 * Table de routage — porté depuis app.routes.ts (Angular).
 *
 * - "/" redirige vers /dashboard.
 * - "/login" est public.
 * - Toutes les autres routes exigent une session (ProtectedRoute,
 *   équivalent de authGuard).
 * - "/users" exige en plus le rôle ADMIN (AdminRoute, équivalent de
 *   adminGuard).
 * - Les routes qui listent/affichent une ressource exigent en plus
 *   l'autorisation de lecture correspondante (PermissionRoute, voir
 *   ce fichier) - protection de confort côté client, l'autorisation
 *   effective restant appliquée côté serveur sur chaque endpoint.
 * - "/settings" reste accessible en lecture à tout utilisateur
 *   authentifié côté routeur (comme côté Angular) : seul le
 *   PUT est réservé à l'ADMIN, et c'est le composant qui gère le
 *   403 renvoyé par le backend à l'enregistrement.
 * - Toute route inconnue redirige vers /dashboard.
 */
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />

          <Route element={<PermissionRoute permission="members:read" />}>
            <Route path="/members" element={<Members />} />
          </Route>

          <Route element={<PermissionRoute permission="cards:read" />}>
            <Route path="/cards" element={<Cards />} />
            <Route path="/members/:id/card" element={<CardDetail />} />
          </Route>

          <Route element={<PermissionRoute permission="belt_history:read" />}>
            <Route path="/members/:id/belt-history" element={<BeltHistory />} />
          </Route>

          <Route element={<PermissionRoute permission="verifications:read" />}>
            <Route path="/verification" element={<Verification />} />
          </Route>

          <Route element={<PermissionRoute permission="activity_log:read" />}>
            <Route path="/activity-log" element={<ActivityLog />} />
          </Route>
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/users" element={<Users />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
