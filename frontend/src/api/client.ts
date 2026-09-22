import axios from 'axios'
import type { AxiosError } from 'axios'

/**
 * Client HTTP central de l'application.
 *
 * - baseURL vide/relative : toutes les requêtes ("/api/...",
 *   "/uploads/...") passent par le proxy Vite (voir
 *   vite.config.ts) vers le backend FastAPI, exactement comme
 *   `environment.apiUrl = '/api'` côté Angular. Ne JAMAIS coder en
 *   dur `http://localhost:8000` ici.
 * - Attache `Authorization: Bearer <token>` à chaque requête sortante
 *   quand un token existe (équivalent de auth.interceptor.ts côté
 *   Angular, sans le contournement zone.js/appRef.tick() qui n'a pas
 *   de sens en React : ici, chaque `setState` déclenche déjà un
 *   nouveau rendu).
 * - Sur une réponse 401 (hors /api/auth/login, où un mauvais
 *   identifiant/mot de passe renvoie aussi 401 mais où il n'y a pas
 *   de session à invalider), nettoie le localStorage et renvoie
 *   l'utilisateur vers /login?expired=1.
 */
export const apiClient = axios.create({
  baseURL: '',
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const isLoginRequest = (error.config?.url || '').includes('/auth/login')
    const token = localStorage.getItem('token')

    if (error.response?.status === 401 && token && !isLoginRequest) {
      console.warn('API CLIENT -> session invalide ou expirée, déconnexion automatique.')

      localStorage.removeItem('token')
      localStorage.removeItem('user')

      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1'
      }
    }

    return Promise.reject(error)
  },
)

/**
 * Message d'erreur lisible à partir d'une erreur Axios — reproduit
 * `getErrorMessage()` dupliqué dans plusieurs composants Angular
 * (members.ts, users.ts...).
 */
export function apiErrorMessage(error: unknown, fallback = 'Une erreur est survenue. Veuillez réessayer.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | string | undefined

    if (data && typeof data === 'object' && data.message) {
      return String(data.message)
    }

    if (typeof data === 'string' && data) {
      return data
    }

    if (error.message) {
      return error.message
    }
  }

  return fallback
}

/** Code HTTP d'une erreur Axios, ou 0 si la requête n'a pas abouti (réseau/CORS). */
export function apiErrorStatus(error: unknown): number {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? 0
  }

  return 0
}
