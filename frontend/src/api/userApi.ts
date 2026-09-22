import { apiClient } from './client'
import type { CreateUserRequest, UpdateUserRequest, UserSummary } from '../types/user'

const API_URL = '/api/users'

export const userApi = {
  getAll() {
    return apiClient.get<UserSummary[]>(API_URL)
  },

  create(request: CreateUserRequest) {
    return apiClient.post<UserSummary>(API_URL, request)
  },

  update(id: number, request: UpdateUserRequest) {
    return apiClient.put<UserSummary>(`${API_URL}/${id}`, request)
  },

  setEnabled(id: number, enabled: boolean) {
    const action = enabled ? 'enable' : 'disable'
    return apiClient.put<UserSummary>(`${API_URL}/${id}/${action}`, {})
  },
}
