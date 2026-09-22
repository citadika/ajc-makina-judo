import { apiClient } from './client'
import type { CreateExaminerRequest, Examiner } from '../types/examiner'

const API_URL = '/api/examiners'

export const examinerApi = {
  getAll() {
    return apiClient.get<Examiner[]>(API_URL)
  },

  /**
   * "Ajouter" un examinateur à la liste réutilisable - idempotent
   * côté backend (renvoie l'entrée existante si ce nom est déjà
   * connu, insensible à la casse).
   */
  add(request: CreateExaminerRequest) {
    return apiClient.post<Examiner>(API_URL, request)
  },
}
