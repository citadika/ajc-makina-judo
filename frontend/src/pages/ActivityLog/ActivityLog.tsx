import { useCallback, useEffect, useRef, useState } from 'react'
import { AppShell } from '../../components/AppShell'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { activityLogApi } from '../../api/activityLogApi'
import { apiErrorMessage, apiErrorStatus } from '../../api/client'
import type { ActivityLogEntry } from '../../types/activityLog'
import './ActivityLog.css'

const AUTO_REFRESH_PERIOD_MS = 30_000

const ACTION_ICONS: Record<string, string> = {
  member_created: '👤',
  member_updated: '✏️',
  card_created: '🪪',
  settings_updated: '⚙️',
  verification: '🛡️',
}

function actionIcon(action: string): string {
  return ACTION_ICONS[action] || '•'
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Journal d'activité — historique de "qui a fait quoi" (création/
 * modification d'adhérent, création de carte, modification des
 * paramètres du club, vérification de carte). Alimenté côté backend
 * par app/activity.py (log_activity()), appelé depuis chacun des
 * routeurs concernés.
 */
export function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [forbidden, setForbidden] = useState(false)

  const busyRef = useRef(false)
  busyRef.current = loading

  const load = useCallback(() => {
    setLoading(true)
    setErrorMessage('')
    setForbidden(false)

    activityLogApi
      .getRecent()
      .then((res) => {
        setEntries(Array.isArray(res.data) ? res.data : [])
        setLoading(false)
      })
      .catch((error: unknown) => {
        console.error('ACTIVITY LOG -> LOAD ERROR:', error)
        setLoading(false)

        if (apiErrorStatus(error) === 403) {
          setForbidden(true)
        } else {
          setErrorMessage(apiErrorMessage(error, "Impossible de charger le journal d'activité."))
        }
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useAutoRefresh(AUTO_REFRESH_PERIOD_MS, load, () => busyRef.current)

  return (
    <AppShell pageTitle="Journal d'activité" pageSubtitle="Historique des actions effectuées par les comptes connectés">
      <section className="screen-activity-log">
        {forbidden ? (
          <div className="banner error">
            Vous n'avez pas l'autorisation de consulter le journal d'audit. Contactez un administrateur pour obtenir
            les droits nécessaires.
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="banner error">
                <strong>Erreur&nbsp;:</strong> {errorMessage}
              </div>
            )}

            {loading ? (
              <div className="empty-state">
                <div className="empty-icon">⏳</div>
                <p>Chargement du journal...</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🕒</div>
                <h3>Aucune activité enregistrée</h3>
                <p>Les actions effectuées dans l'application (créations, modifications, vérifications...) apparaîtront ici.</p>
              </div>
            ) : (
              <div className="activity-list">
                {entries.map((entry) => (
                  <div className="activity-row" key={entry.id}>
                    <span className="activity-icon" aria-hidden="true">
                      {actionIcon(entry.action)}
                    </span>
                    <div className="activity-main">
                      <p>{entry.description}</p>
                      <span className="activity-user">Par&nbsp;: {entry.username}</span>
                    </div>
                    <span className="activity-when">{formatDateTime(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </AppShell>
  )
}
