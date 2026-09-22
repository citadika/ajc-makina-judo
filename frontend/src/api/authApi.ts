import { apiClient } from './client'
import type { LoginRequest, LoginResponse, MeResponse } from '../types/auth'

const API_URL = '/api/auth'

export const authApi = {
  login(credentials: LoginRequest) {
    return apiClient.post<LoginResponse>(`${API_URL}/login`, credentials)
  },

  getMe() {
    return apiClient.get<MeResponse>(`${API_URL}/me`)
  },
}
