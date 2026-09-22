import { apiClient } from './client'
import type { BeltHistory, PromoteBeltRequest, UpdateBeltHistoryRequest } from '../types/beltHistory'

const API_URL = '/api/members'

export const beltHistoryApi = {
  getHistory(memberId: number) {
    return apiClient.get<BeltHistory[]>(`${API_URL}/${memberId}/belt-history`)
  },

  promote(memberId: number, request: PromoteBeltRequest) {
    return apiClient.post<BeltHistory>(`${API_URL}/${memberId}/belt-history`, request)
  },

  updateEntry(memberId: number, historyId: number, request: UpdateBeltHistoryRequest) {
    return apiClient.patch<BeltHistory>(`${API_URL}/${memberId}/belt-history/${historyId}`, request)
  },
}
