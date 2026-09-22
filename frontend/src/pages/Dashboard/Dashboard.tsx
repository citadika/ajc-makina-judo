import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { useAuth } from '../../context/AuthContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { memberApi } from '../../api/memberApi'
import { cardApi } from '../../api/cardApi'
import { apiErrorStatus, apiErrorMessage } from '../../api/client'
import type { Member } from '../../types/member'
import type { Card } from '../../types/card'
import { BELTS, BELT_LABELS, BELT_CSS_CLASS } from '../../types/member'
import type { Belt } from '../../types/member'
import './Dashboard.css'

const AUTO_REFRESH_PERIOD_MS = 30_000

interface BeltDistributionRow {
  belt: Belt
  label: string
  cssClass: string
  count: number
  pct: number
}

function describeError(error: unknown): string {
  const status = apiErrorStatus(error)

  if (status === 0) {
    return 'Impossible de contacter le serveur. Vérifiez que le backend est démarré et accessible (adresse configurée, réseau, CORS).'
  }

  if (status === 401) {
    return 'Votre session a expiré. Veuillez vous reconnecter.'
  }

  if (status === 403) {
    return 'Accès refusé par le serveur pour cette ressource.'
  }

  if (status === 503) {
    return (
      apiErrorMessage(error, 'Problème temporaire de connexion à la base de données.') +
      ' Nouvelle tentative automatique dans quelques secondes.'
    )
  }

  if (status >= 500) {
    return `Le serveur a rencontré une erreur (${status}). ${apiErrorMessage(error, 'Réessayez dans un instant.')}`
  }

  const message = apiErrorMessage(error, '')

  if (message) {
    return message
  }

  return status
    ? `Impossible de charger les données du dashboard (erreur ${status}).`
    : 'Impossible de charger les données du dashboard.'
}

function getInitials(member: Member): string {
  const first = member.firstName?.charAt(0)?.toUpperCase() || ''
  const last = member.lastName?.charAt(0)?.toUpperCase() || ''
  return first + last
}

export function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [members, setMembers] = useState<Member[]>([])
  const [cards, setCards] = useState<Card[]>([])

  const [membersLoading, setMembersLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(true)

  const [membersError, setMembersError] = useState('')
  const [cardsError, setCardsError] = useState('')

  const dashboardLoading = membersLoading || cardsLoading
  const loadingRef = useRef(dashboardLoading)
  loadingRef.current = dashboardLoading

  const loadDashboard = useCallback(() => {
    setMembersLoading(true)
    setCardsLoading(true)
    setMembersError('')
    setCardsError('')

    Promise.all([memberApi.getAll(), cardApi.getAll()])
      .then(([membersRes, cardsRes]) => {
        const membersData = Array.isArray(membersRes.data) ? membersRes.data : []
        const cardsData = Array.isArray(cardsRes.data) ? cardsRes.data : []

        setMembers(membersData)
        setCards(cardsData)

        if (!Array.isArray(membersRes.data)) {
          setMembersError('Le serveur a retourné un format de membres incorrect.')
        }

        if (!Array.isArray(cardsRes.data)) {
          setCardsError('Le serveur a retourné un format de cartes incorrect.')
        }

        setMembersLoading(false)
        setCardsLoading(false)
      })
      .catch((error: unknown) => {
        console.error('DASHBOARD -> ERREUR CHARGEMENT:', error)

        setMembers([])
        setCards([])

        const message = describeError(error)
        setMembersError(message)
        setCardsError(message)

        setMembersLoading(false)
        setCardsLoading(false)
      })
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  useAutoRefresh(AUTO_REFRESH_PERIOD_MS, loadDashboard, () => loadingRef.current)

  const totalMembers = members.length
  const activeCards = cards.filter((card) => String(card.status || '').toUpperCase() === 'ACTIVE').length
  const disabledCards = cards.filter((card) => String(card.status || '').toUpperCase() === 'DISABLED').length

  const memberIdsWithCard = new Set<number>()
  for (const card of cards) {
    const memberId = card?.member?.id
    if (memberId !== null && memberId !== undefined) {
      memberIdsWithCard.add(Number(memberId))
    }
  }
  const membersWithoutCard =
    members.length === 0 ? 0 : members.filter((member) => !memberIdsWithCard.has(Number(member.id))).length

  const beltDistribution: BeltDistributionRow[] = (() => {
    const rows = BELTS.map((belt) => ({
      belt,
      label: BELT_LABELS[belt],
      cssClass: BELT_CSS_CLASS[belt],
      count: members.filter((m) => m.belt === belt).length,
      pct: 0,
    }))

    const max = Math.max(1, ...rows.map((row) => row.count))

    return rows.map((row) => ({ ...row, pct: Math.round((row.count / max) * 100) }))
  })()

  const recentMembers = [...members]
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA
    })
    .slice(0, 5)

  const fullName = user?.fullName || user?.username || 'Administrateur'

  const todayLabel = (() => {
    const formatted = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  })()

  return (
    <AppShell showHeader={false}>
      <div className="screen-dash">
        <div className="dash-head">
          <h4>Bonjour, {fullName}</h4>
          <span>{todayLabel}</span>
        </div>

        {(membersError || cardsError) && (
          <div className="banner error">
            <span>{membersError || cardsError}</span>
            <button type="button" className="btn-ghost" onClick={loadDashboard}>
              Réessayer
            </button>
          </div>
        )}

        {dashboardLoading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <p>Chargement du tableau de bord...</p>
          </div>
        ) : (
          <>
            <div className="kpi-row">
              <button
                type="button"
                className="kpi clickable"
                onClick={() => navigate('/members')}
                title="Voir tous les adhérents"
              >
                <span className="label">Adhérents</span>
                <span className="value">{totalMembers}</span>
                <span className="delta">Total inscrits</span>
              </button>
              <button
                type="button"
                className="kpi clickable"
                onClick={() => navigate('/cards?status=active')}
                title="Voir les cartes actives"
              >
                <span className="label">Cartes actives</span>
                <span className="value">{activeCards}</span>
                <span className="delta">
                  {totalMembers > 0 ? Math.round((activeCards / totalMembers) * 100) : 0}&nbsp;%
                </span>
              </button>
              <button
                type="button"
                className="kpi clickable"
                onClick={() => navigate('/cards?status=disabled')}
                title="Voir les cartes désactivées"
              >
                <span className="label">Désactivées</span>
                <span className="value">{disabledCards}</span>
                <span className="delta muted">cartes</span>
              </button>
              <button
                type="button"
                className="kpi clickable"
                onClick={() => navigate('/members?filter=sans-carte')}
                title="Voir les adhérents sans carte"
              >
                <span className="label">Sans carte</span>
                <span className="value">{membersWithoutCard}</span>
                <span className="delta warn">à traiter</span>
              </button>
            </div>

            <div className="dash-split">
              <div className="belt-chart">
                <h5>Répartition par ceinture</h5>

                {beltDistribution.map((row) => (
                  <div
                    className="belt-row clickable"
                    key={row.belt}
                    onClick={() => navigate(`/members?belt=${row.belt}`)}
                    title={`Voir les adhérents ceinture ${row.label.toLowerCase()}`}
                  >
                    <span className="name">{row.label}</span>
                    <div className="track">
                      <div className={`fill ${row.cssClass}`} style={{ width: `${row.pct}%` }} />
                    </div>
                    <span className="count">{row.count}</span>
                  </div>
                ))}
              </div>

              <div className="recent">
                <h5>Dernières inscriptions</h5>

                {recentMembers.length === 0 ? (
                  <p className="text-faint">Aucun adhérent enregistré pour le moment.</p>
                ) : (
                  recentMembers.map((member) => (
                    <Link className="recent-row" to="/members" key={member.id}>
                      <div className="avatar">{getInitials(member)}</div>
                      <div className="who">
                        <b>
                          {member.firstName} {member.lastName}
                        </b>
                        <span>{BELT_LABELS[member.belt as Belt] || 'Non définie'}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="dash-actions">
              <button type="button" className="btn-gold" onClick={() => navigate('/members')}>
                Voir tous les adhérents
              </button>
              <button type="button" className="btn-secondary" onClick={loadDashboard}>
                Actualiser
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
