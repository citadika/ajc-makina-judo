/**
 * Liste réutilisable des examinateurs (personnes habilitées à faire
 * passer un examen de grade) - voir backend app/models.py, Examiner.
 */
export interface Examiner {
  id: number
  name: string
  /** Grade de l'examinateur (ex. "4e Dan"), facultatif. */
  grade?: string | null
}

export interface CreateExaminerRequest {
  name: string
  /**
   * Facultatif. S'il est fourni pour un nom déjà connu, il remplace
   * (corrige) le grade déjà enregistré - voir
   * backend/app/routers/examiners.py, add_examiner().
   */
  grade?: string
}
