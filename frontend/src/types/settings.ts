/**
 * Porté depuis core/models/settings.model.ts (Angular).
 */

export interface ClubSettings {
  id: number
  clubName: string
  address?: string | null
  phone?: string | null
  email?: string | null
  logoPath?: string | null
  updatedAt?: string
  /** Utilisateur (ADMIN) ayant modifié en dernier les paramètres du club. */
  updatedByUsername?: string | null
}

export interface UpdateSettingsRequest {
  clubName?: string
  address?: string
  phone?: string
  email?: string
}
