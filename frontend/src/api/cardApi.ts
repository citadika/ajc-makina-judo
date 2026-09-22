import { apiClient } from './client'
import type { Card } from '../types/card'

const API_URL = '/api/cards'

export const cardApi = {
  getAll() {
    return apiClient.get<Card[]>(API_URL)
  },

  getById(id: number) {
    return apiClient.get<Card>(`${API_URL}/${id}`)
  },

  getByMemberId(memberId: number) {
    return apiClient.get<Card>(`${API_URL}/member/${memberId}`)
  },

  createForMember(memberId: number) {
    return apiClient.post<Card>(`${API_URL}/member/${memberId}`, {})
  },

  regenerateQrCode(cardId: number) {
    return apiClient.post<Card>(`${API_URL}/${cardId}/qrcode`, {})
  },
}
