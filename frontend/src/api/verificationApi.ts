import { apiClient } from './client'
import type { Card } from '../types/card'
import type { VerificationLog } from '../types/verification'

const API_URL = '/api/verifications'

export const verificationApi = {
  /**
   * GET /api/verifications/verify/{cardNumber} — renvoie la Card si
   * trouvée (200), ou une erreur HTTP (404 probable) sinon, à gérer
   * comme "carte non trouvée" côté page plutôt que comme un crash.
   */
  verify(cardNumber: string) {
    return apiClient.get<Card>(`${API_URL}/verify/${encodeURIComponent(cardNumber)}`)
  },

  getRecent() {
    return apiClient.get<VerificationLog[]>(`${API_URL}/recent`)
  },

  clearRecent() {
    return apiClient.delete<void>(`${API_URL}/recent`)
  },
}
