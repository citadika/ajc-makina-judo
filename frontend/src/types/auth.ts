/**
 * Porté depuis core/services/auth.service.ts (Angular).
 */

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  message: string
  token: string
  userId: number
  username: string
  email: string
  fullName?: string
  role: string
  permissions?: string[]
}

export interface MeResponse {
  userId: number
  username: string
  email: string
  fullName?: string
  role: string
  permissions?: string[]
}

export interface StoredUser {
  userId: number
  username: string
  email: string
  fullName?: string
  role: string
  permissions?: string[]
}
