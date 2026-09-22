import type { Belt, Member } from './member'

/**
 * Porté depuis core/models/belt-history.model.ts (Angular).
 * Jackson sérialise l'entité JPA telle quelle côté backend :
 * `member` est donc l'objet Member complet.
 *
 * Jusqu'à 3 examinateurs par passage (voir backend app/models.py,
 * BeltHistory) : `examinateur` est le premier, tous facultatifs. Le
 * grade de chaque examinateur n'est PAS stocké ici (il vit sur la
 * liste réutilisable des examinateurs, voir types/examiner.ts) : il
 * est retrouvé par nom à l'affichage.
 */
export interface BeltHistory {
  id: number
  member: Member
  ancienneCeinture: Belt | null
  nouvelleCeinture: Belt
  datePassage: string
  observation?: string | null
  examinateur?: string | null
  examinateur2?: string | null
  examinateur3?: string | null
}

export interface PromoteBeltRequest {
  nouvelleCeinture: Belt
  datePassage?: string
  observation?: string
  examinateur?: string
  examinateur2?: string
  examinateur3?: string
  /**
   * Grade de chaque examinateur, facultatif - ne sont PAS enregistrés
   * sur le passage : ils servent uniquement à créer/mettre à jour le
   * grade de l'examinateur correspondant dans la liste réutilisable.
   */
  examinateurGrade?: string
  examinateur2Grade?: string
  examinateur3Grade?: string
}

export interface UpdateBeltHistoryRequest {
  datePassage: string
  observation?: string
  examinateur?: string
  examinateur2?: string
  examinateur3?: string
  examinateurGrade?: string
  examinateur2Grade?: string
  examinateur3Grade?: string
}
