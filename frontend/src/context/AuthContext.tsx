import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '../api/authApi'
import type { LoginRequest, StoredUser } from '../types/auth'

interface AuthContextValue {
  user: StoredUser | null
  token: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  /** true si le compte est ADMIN (accès complet) ou possède explicitement cette autorisation. */
  hasPermission: (key: string) => boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredUser(): StoredUser | null {
  const raw = localStorage.getItem('user')

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as StoredUser
  } catch {
    return null
  }
}

/**
 * Contexte d'authentification — porté depuis AuthService (Angular).
 *
 * Persiste sous les mêmes clés localStorage ("token", "user") pour
 * rester cohérent avec la version Angular, même si cette
 * application React est indépendante.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<StoredUser | null>(() => readStoredUser())

  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await authApi.login(credentials)
    const data = response.data

    const storedUser: StoredUser = {
      userId: data.userId,
      username: data.username,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      permissions: data.permissions || [],
    }

    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(storedUser))

    setToken(data.token)
    setUser(storedUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  const isAdmin = user?.role === 'ADMIN'

  const hasPermission = useCallback(
    (key: string) => isAdmin || (user?.permissions || []).includes(key),
    [isAdmin, user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      isAdmin,
      hasPermission,
      login,
      logout,
    }),
    [user, token, isAdmin, hasPermission, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>.')
  }

  return context
}
