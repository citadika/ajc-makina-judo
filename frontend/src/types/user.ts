/**
 * Porté depuis core/models/user.model.ts (Angular).
 */

export type UserRole = 'ADMIN' | 'USER'

/**
 * Autorisations granulaires qu'un administrateur peut accorder à un
 * compte (voir backend app/schemas.py, PERMISSION_ACTIONS) - sans
 * effet pour un compte ADMIN, qui a toujours accès à tout.
 *
 * Chaque ressource n'expose que les actions qui existent réellement
 * dans son API (ex. pas de "suppression" pour les cartes). Clé finale
 * au format "ressource:action" (ex. "members:read",
 * "belt_history:create") - identique côté backend et frontend.
 */
const ACTION_LABELS: Record<string, string> = {
  read: 'Lecture',
  create: 'Ajout',
  update: 'Modification',
  delete: 'Suppression',
}

export interface PermissionAction {
  key: string
  action: string
  label: string
}

export interface PermissionResource {
  key: string
  label: string
  actions: PermissionAction[]
}

/**
 * Structure groupée par ressource, utilisée pour afficher une grille
 * (matrice) ressource × action dans l'écran Utilisateurs, plutôt
 * qu'une liste plate d'autorisations mélangeant lecture et écriture.
 */
export const PERMISSION_RESOURCES: PermissionResource[] = [
  {
    key: 'members',
    label: 'Adhérents',
    actions: ['read', 'create', 'update', 'delete'].map((action) => ({
      key: `members:${action}`,
      action,
      label: ACTION_LABELS[action],
    })),
  },
  {
    key: 'cards',
    label: 'Cartes',
    actions: ['read', 'create', 'update'].map((action) => ({
      key: `cards:${action}`,
      action,
      label: ACTION_LABELS[action],
    })),
  },
  {
    key: 'belt_history',
    label: 'Historique de ceinture',
    actions: ['read', 'create', 'update'].map((action) => ({
      key: `belt_history:${action}`,
      action,
      label: ACTION_LABELS[action],
    })),
  },
  {
    key: 'verifications',
    label: 'Vérification de carte',
    actions: ['read', 'create', 'delete'].map((action) => ({
      key: `verifications:${action}`,
      action,
      label: ACTION_LABELS[action],
    })),
  },
  {
    key: 'activity_log',
    label: "Journal d'audit",
    actions: ['read'].map((action) => ({
      key: `activity_log:${action}`,
      action,
      label: ACTION_LABELS[action],
    })),
  },
]

export const PERMISSION_KEYS = PERMISSION_RESOURCES.flatMap((resource) =>
  resource.actions.map((a) => a.key),
) as string[]

export type PermissionKey = string

/** "Adhérents — Lecture" etc. - utilisé pour les info-bulles / listes complètes. */
export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_RESOURCES.flatMap((resource) =>
    resource.actions.map((a) => [a.key, `${resource.label} — ${a.label}`]),
  ),
)

/** Jamais de mot de passe exposé par le backend. */
export interface UserSummary {
  id: number
  username: string
  email: string
  fullName?: string | null
  role: string
  enabled: boolean
  permissions: string[]
}

export interface CreateUserRequest {
  username: string
  email: string
  password: string
  fullName?: string
  role: string
  permissions?: string[]
}

export interface UpdateUserRequest {
  email?: string
  fullName?: string
  role?: string
  password?: string
  permissions?: string[]
}
