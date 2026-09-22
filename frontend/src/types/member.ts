/**
 * Modèles liés aux membres — porté depuis
 * core/models/member.model.ts (Angular).
 */

// =====================================================
// CEINTURE
// =====================================================

/**
 * Valeurs strictement identiques à l'enum `Belt` du backend.
 * Toute autre valeur est rejetée par l'API (HTTP 400).
 */
export type Belt =
  | 'BLANCHE'
  | 'JAUNE'
  | 'ORANGE'
  | 'VERTE'
  | 'BLEUE'
  | 'MARRON'
  | 'NOIRE'

export const BELTS: Belt[] = ['BLANCHE', 'JAUNE', 'ORANGE', 'VERTE', 'BLEUE', 'MARRON', 'NOIRE']

export const BELT_LABELS: Record<Belt, string> = {
  BLANCHE: 'Blanche',
  JAUNE: 'Jaune',
  ORANGE: 'Orange',
  VERTE: 'Verte',
  BLEUE: 'Bleue',
  MARRON: 'Marron',
  NOIRE: 'Noire',
}

/**
 * Classe CSS (belt-white, belt-yellow, ...) associée à chaque
 * ceinture — les noms de classes restent en anglais côté CSS.
 */
export const BELT_CSS_CLASS: Record<Belt, string> = {
  BLANCHE: 'belt-white',
  JAUNE: 'belt-yellow',
  ORANGE: 'belt-orange',
  VERTE: 'belt-green',
  BLEUE: 'belt-blue',
  MARRON: 'belt-brown',
  NOIRE: 'belt-black',
}

export function beltLabel(belt?: string | null): string {
  if (!belt) return 'Non définie'
  return (BELT_LABELS as Record<string, string>)[belt] || belt
}

export function beltCssClass(belt?: string | null): string {
  if (!belt) return 'belt-white'
  return (BELT_CSS_CLASS as Record<string, string>)[belt] || 'belt-white'
}

// =====================================================
// SEXE
// =====================================================

export type Sexe = 'Masculin' | 'Féminin'

export const SEXES: Sexe[] = ['Masculin', 'Féminin']

// =====================================================
// MEMBRE
// =====================================================

export interface Member {
  id: number
  firstName: string
  lastName: string
  phone?: string
  email?: string
  birthDate?: string
  /** Adresse composée, lisible - utilisée pour l'affichage (carte, fiche, QR). */
  address?: string
  /** Champs structurés bruts - utilisés pour pré-remplir le formulaire de modification. */
  commune?: string
  quartier?: string
  avenue?: string
  numero?: string
  sexe?: Sexe | null
  belt?: Belt | null
  photo?: string | null
  active: boolean
  createdAt: string
  updatedAt?: string
  /** Traçabilité "qui a fait l'action" — utilisateur connecté ayant créé / modifié en dernier cette fiche. */
  createdByUsername?: string | null
  updatedByUsername?: string | null
}

export interface CreateMemberRequest {
  firstName: string
  lastName: string
  phone?: string
  email?: string
  birthDate?: string
  commune?: string
  quartier?: string
  avenue?: string
  numero?: string
  sexe?: Sexe | null
  belt?: Belt | null
}

export interface UpdateMemberRequest {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  birthDate?: string
  commune?: string
  quartier?: string
  avenue?: string
  numero?: string
  sexe?: Sexe | null
  belt?: Belt | null
  active?: boolean
}
