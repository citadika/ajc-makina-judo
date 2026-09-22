/**
 * Journal d'activité — historique lisible de "qui a fait quoi"
 * (création/modification d'adhérent, création de carte, modification
 * des paramètres du club, vérification de carte). Correspond à
 * l'entité backend ActivityLog.
 */
export interface ActivityLogEntry {
  id: number
  /** Nom d'utilisateur du compte connecté ayant effectué l'action. */
  username: string
  /** Code interne de l'action, ex. "member_created", "card_created". */
  action: string
  /** Description lisible, prête à afficher (ex. "Adhérent créé : Jean Mukendi"). */
  description: string
  createdAt: string
}
