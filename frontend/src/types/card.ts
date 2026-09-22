import type { Member } from './member'

/**
 * Modèles liés aux cartes de membre — porté depuis
 * core/models/card.model.ts (Angular).
 */

export interface CardMember {
  id: number
  firstName: string
  lastName: string
  photo?: string | null
  belt?: string | null
}

export interface Card {
  id: number
  memberId?: number
  cardNumber?: string
  status?: string

  /**
   * L'entité backend n'expose que createdAt/updatedAt — il n'y a
   * pas de champ issueDate/expiryDate. La "date de délivrance"
   * affichée sur la carte utilise donc createdAt.
   */
  createdAt?: string
  updatedAt?: string
  /** Utilisateur connecté ayant créé cette carte. */
  createdByUsername?: string | null

  qrCode?: string

  member: Member | CardMember
}
