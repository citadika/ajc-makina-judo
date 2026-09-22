import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AppShell } from '../../components/AppShell'
import { useAuth } from '../../context/AuthContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { verificationApi } from '../../api/verificationApi'
import { getMemberPhotoUrl } from '../../api/mediaUrl'
import { apiErrorStatus } from '../../api/client'
import type { Card } from '../../types/card'
import type { VerificationLog } from '../../types/verification'
import { beltLabel } from '../../types/member'
import './Verification.css'

const AUTO_REFRESH_PERIOD_MS = 30_000

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || ''
  const last = lastName?.charAt(0)?.toUpperCase() || ''
  return first + last
}

function formatTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function Verification() {
  const { hasPermission } = useAuth()
  const canVerify = hasPermission('verifications:create')
  const canClearRecent = hasPermission('verifications:delete')

  const [cardNumber, setCardNumber] = useState('')

  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)
  const [result, setResult] = useState<Card | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [recent, setRecent] = useState<VerificationLog[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState('')
  const [clearingRecent, setClearingRecent] = useState(false)

  const busyRef = useRef(false)
  busyRef.current = checking || recentLoading

  const loadRecent = useCallback(() => {
    setRecentLoading(true)
    setRecentError('')

    verificationApi
      .getRecent()
      .then((res) => {
        setRecent(res.data)
        setRecentLoading(false)
      })
      .catch((error: unknown) => {
        console.error('VERIFICATION -> RECENT ERROR:', error)
        setRecentLoading(false)
        setRecentError(
          apiErrorStatus(error) === 403
            ? "Vous n'avez pas l'autorisation de consulter les vérifications récentes. Contactez un administrateur."
            : 'Impossible de charger les vérifications récentes.',
        )
      })
  }, [])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  useAutoRefresh(AUTO_REFRESH_PERIOD_MS, loadRecent, () => busyRef.current)

  function verify() {
    const value = cardNumber.trim()
    if (!value || checking || !canVerify) return

    setChecking(true)
    setChecked(false)
    setResult(null)
    setNotFound(false)
    setErrorMessage('')

    verificationApi
      .verify(value)
      .then((res) => {
        setResult(res.data)
        setChecking(false)
        setChecked(true)
        loadRecent()
      })
      .catch((error: unknown) => {
        console.error('VERIFICATION -> ERROR:', error)
        setChecking(false)
        setChecked(true)

        const status = apiErrorStatus(error)
        if (status === 404) {
          setNotFound(true)
        } else if (status === 403) {
          setErrorMessage(
            "Vous n'avez pas l'autorisation d'effectuer une vérification de carte. Contactez un administrateur.",
          )
        } else {
          setErrorMessage('Impossible de vérifier cette carte pour le moment.')
        }

        loadRecent()
      })
  }

  function onKeyUp(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') verify()
  }

  // Recherche en direct : dès que la saisie s'arrête un court instant,
  // la vérification se lance toute seule (plus besoin de cliquer sur
  // "Vérifier" ni d'appuyer sur Entrée). Le bouton et la touche Entrée
  // restent utilisables pour relancer immédiatement si besoin.
  useEffect(() => {
    const value = cardNumber.trim()

    if (!value) {
      setChecked(false)
      setResult(null)
      setNotFound(false)
      setErrorMessage('')
      return
    }

    const timer = setTimeout(() => {
      verify()
    }, 450)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardNumber])

  function clearRecent() {
    if (clearingRecent || !canClearRecent) return
    if (!confirm('Voulez-vous vraiment vider la liste des vérifications récentes ?')) return

    setClearingRecent(true)
    setRecentError('')

    verificationApi
      .clearRecent()
      .then(() => {
        setClearingRecent(false)
        setRecent([])
      })
      .catch((error: unknown) => {
        console.error('VERIFICATION -> CLEAR RECENT ERROR:', error)
        setClearingRecent(false)
        setRecentError(
          apiErrorStatus(error) === 403
            ? "Vous n'avez pas l'autorisation d'effectuer cette action. Contactez un administrateur."
            : "Impossible de vider l'historique des vérifications.",
        )
      })
  }

  const resultBelt = (result?.member as { belt?: string | null } | undefined)?.belt ?? null
  const resultPhotoUrl = result?.member?.photo ? getMemberPhotoUrl(result.member.photo) : ''

  return (
    <AppShell pageTitle="Vérification" pageSubtitle="Contrôle d'une carte au poste d'accueil">
      <div className="screen-verif">
        {!canVerify && (
          <div className="banner info">
            Vous n'avez pas l'autorisation d'effectuer une vérification de carte. Contactez un administrateur pour
            obtenir les droits nécessaires.
          </div>
        )}

        <div className="verif-search">
          <input
            className="search-box"
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            onKeyUp={onKeyUp}
            placeholder="AJC05JK0347 ou numéro scanné"
            disabled={!canVerify}
          />
          <button
            type="button"
            className="btn-gold"
            onClick={verify}
            disabled={!cardNumber.trim() || checking || !canVerify}
          >
            {checking ? 'Vérification...' : 'Vérifier'}
          </button>
        </div>

        {checked && (
          <>
            {result ? (
              <div className="verif-result found">
                {resultPhotoUrl ? (
                  <div className="avatar">
                    <img src={resultPhotoUrl} alt="" />
                  </div>
                ) : (
                  <div className="avatar">{getInitials(result.member.firstName, result.member.lastName)}</div>
                )}
                <div className="verif-id">
                  <b>
                    {result.member.firstName} {result.member.lastName}
                  </b>
                  <span>
                    {result.cardNumber} &middot; Ceinture {beltLabel(resultBelt).toLowerCase()}
                  </span>
                </div>
                <span className={`status-badge ${result.status === 'ACTIVE' ? 'actif' : 'inactif'}`}>
                  {result.status === 'ACTIVE' ? 'Carte valide' : 'Carte désactivée'}
                </span>
              </div>
            ) : notFound ? (
              <div className="verif-result not-found">
                <div className="avatar" style={{ background: 'var(--ink-faint)' }}>
                  ?
                </div>
                <div className="verif-id">
                  <b>Carte introuvable</b>
                  <span>{cardNumber}</span>
                </div>
                <span className="status-badge inactif">Introuvable</span>
              </div>
            ) : errorMessage ? (
              <div className="banner error">{errorMessage}</div>
            ) : null}
          </>
        )}

        <div className="verif-log">
          <div className="verif-log-head">
            <h5>Dernières vérifications</h5>
            {recent.length > 0 && canClearRecent && (
              <button type="button" className="btn-ghost" onClick={clearRecent} disabled={clearingRecent}>
                {clearingRecent ? 'Suppression...' : 'Vider'}
              </button>
            )}
          </div>

          {recentError && <div className="banner error">{recentError}</div>}

          {recentLoading ? (
            <p className="text-faint">Chargement...</p>
          ) : recent.length === 0 && !recentError ? (
            <p className="text-faint">Aucune vérification enregistrée pour le moment.</p>
          ) : (
            recent.map((log) => (
              <div className="verif-log-row" key={log.id}>
                <span>
                  {log.found && log.member ? (
                    <>
                      {log.member.firstName} {log.member.lastName}
                    </>
                  ) : (
                    <>Inconnu &mdash; {log.cardNumber || '—'}</>
                  )}
                  {log.verifiedByUsername && <span className="by"> — vérifié par {log.verifiedByUsername}</span>}
                </span>
                <span className="when">{formatTime(log.verifiedAt)}</span>
                <span className={`status-badge ${log.found ? 'actif' : 'inactif'}`}>
                  {log.found ? 'Valide' : 'Introuvable'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
