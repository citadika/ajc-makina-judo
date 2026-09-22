/**
 * Porté depuis core/services/verification.service.ts (Angular) —
 * correspond à l'entité backend VerificationLog.
 */
export interface VerificationLog {
  id: number
  cardNumber?: string
  found: boolean
  member?: {
    id: number
    firstName: string
    lastName: string
    photo?: string | null
  } | null
  verifiedAt: string
  verifiedByUsername?: string
}
