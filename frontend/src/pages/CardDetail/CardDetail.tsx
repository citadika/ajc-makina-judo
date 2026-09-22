import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { useAuth } from '../../context/AuthContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { memberApi } from '../../api/memberApi'
import { cardApi } from '../../api/cardApi'
import { settingsApi } from '../../api/settingsApi'
import { getMemberPhotoUrl, getSettingsLogoUrl } from '../../api/mediaUrl'
import { apiErrorMessage, apiErrorStatus } from '../../api/client'
import type { Member } from '../../types/member'
import { beltLabel, beltCssClass } from '../../types/member'
import type { Card } from '../../types/card'
import './CardDetail.css'

const AUTO_REFRESH_PERIOD_MS = 30_000

const PERMISSION_DENIED_MESSAGE =
  "Vous n'avez pas l'autorisation d'effectuer cette action. Contactez un administrateur pour obtenir les droits nécessaires."

function getInitials(member: Member | null): string {
  if (!member) return ''
  const first = member.firstName?.charAt(0)?.toUpperCase() || ''
  const last = member.lastName?.charAt(0)?.toUpperCase() || ''
  return first + last
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
}

export function CardDetail() {
  const { id } = useParams<{ id: string }>()
  const memberId = id ? Number(id) : 0
  const { hasPermission } = useAuth()
  const canCreateCard = hasPermission('cards:create')
  const canUpdateCard = hasPermission('cards:update')

  const [member, setMember] = useState<Member | null>(null)
  const [card, setCard] = useState<Card | null>(null)
  const [logoUrl, setLogoUrl] = useState<string>('')
  // Numéro affiché au verso de la carte : celui du CLUB (paramètres),
  // pas celui de l'adhérent - la carte doit permettre de contacter le
  // club en cas de perte, pas d'exposer le téléphone personnel du
  // titulaire.
  const [clubPhone, setClubPhone] = useState<string>('')

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [creatingCard, setCreatingCard] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [actionError, setActionError] = useState('')

  const busyRef = useRef(false)
  busyRef.current = loading || creatingCard || regenerating

  const load = useCallback(() => {
    if (!memberId) {
      setErrorMessage("Identifiant d'adhérent invalide.")
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')

    Promise.all([
      memberApi.getById(memberId),
      cardApi.getByMemberId(memberId).catch(() => ({ data: null as Card | null })),
      settingsApi.get().catch(() => null),
    ])
      .then(([memberRes, cardRes, settingsRes]) => {
        setMember(memberRes.data)
        setCard(cardRes.data)
        setLogoUrl(settingsRes ? getSettingsLogoUrl(settingsRes.data.logoPath) : '')
        setClubPhone(settingsRes?.data.phone || '')
        setLoading(false)
      })
      .catch((error: unknown) => {
        console.error('CARD DETAIL -> LOAD ERROR:', error)
        setLoading(false)
        setErrorMessage(apiErrorStatus(error) === 404 ? 'Adhérent introuvable.' : "Impossible de charger les informations de l'adhérent.")
      })
  }, [memberId])

  useEffect(() => {
    load()
  }, [load])

  useAutoRefresh(AUTO_REFRESH_PERIOD_MS, load, () => busyRef.current)

  function createCard() {
    if (creatingCard || !canCreateCard) return

    setCreatingCard(true)
    setActionError('')

    cardApi
      .createForMember(memberId)
      .then((res) => {
        setCard(res.data)
        setCreatingCard(false)
      })
      .catch((error: unknown) => {
        console.error('CARD DETAIL -> CREATE CARD ERROR:', error)
        setCreatingCard(false)
        setActionError(
          apiErrorStatus(error) === 403 ? PERMISSION_DENIED_MESSAGE : apiErrorMessage(error, 'Impossible de créer la carte.'),
        )
      })
  }

  function regenerateQrCode() {
    if (!card || regenerating || !canUpdateCard) return

    setRegenerating(true)
    setActionError('')

    cardApi
      .regenerateQrCode(card.id)
      .then((res) => {
        setCard(res.data)
        setRegenerating(false)
      })
      .catch((error: unknown) => {
        console.error('CARD DETAIL -> REGENERATE QR ERROR:', error)
        setRegenerating(false)
        setActionError(
          apiErrorStatus(error) === 403
            ? PERMISSION_DENIED_MESSAGE
            : apiErrorMessage(error, 'Impossible de régénérer le QR code.'),
        )
      })
  }

  return (
    <AppShell
      pageTitle={member ? `${member.firstName} ${member.lastName}` : 'Carte de membre'}
      pageSubtitle="Carte de membre"
    >
      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <p>Chargement de la carte...</p>
        </div>
      ) : errorMessage ? (
        <>
          <div className="banner error">{errorMessage}</div>
          <Link className="btn-secondary" to="/members">
            ← Retour aux adhérents
          </Link>
        </>
      ) : member ? (
        <div className="screen-card-detail">
          <Link className="table-link" to="/members">
            ← Retour aux adhérents
          </Link>

          {actionError && <div className="banner error">{actionError}</div>}

          {!card ? (
            <div className="panel no-card-panel">
              <p>Cet adhérent n'a pas encore de carte de membre.</p>
              {canCreateCard ? (
                <button type="button" className="btn-gold" onClick={createCard} disabled={creatingCard}>
                  {creatingCard ? 'Création...' : 'Créer la carte'}
                </button>
              ) : (
                <p className="text-faint">
                  Vous n'avez pas l'autorisation de créer une carte. Contactez un administrateur.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="card-faces">
                {/* RECTO */}
                <div className="card-face">
                  <div className="member-card front">
                    <div className="mc-top">
                      <div className="mc-brand-row">
                        <div className="mc-emblem">{logoUrl ? <img src={logoUrl} alt="Logo du club" /> : 'Logo'}</div>
                        <div className="mc-brand">
                          AJC MAKINA
                          <small>CARTE DE MEMBRE</small>
                        </div>
                      </div>
                      <span className="mc-belt-tag">
                        <span className={`dot ${beltCssClass(member.belt)}`} />
                        Ceinture {beltLabel(member.belt).toLowerCase()}
                      </span>
                    </div>

                    <div className="mc-body">
                      {member.photo ? (
                        <div className="mc-photo">
                          <img src={getMemberPhotoUrl(member.photo)} alt={`${member.firstName} ${member.lastName}`} />
                        </div>
                      ) : (
                        <div className="mc-photo">{getInitials(member)}</div>
                      )}
                      <div className="mc-id">
                        <span className="name">
                          {member.firstName} {member.lastName}
                        </span>
                        <span className="num">{card.cardNumber}</span>
                        <span className="dob">
                          Né le {formatDate(member.birthDate)}
                          {member.sexe ? ` · ${member.sexe}` : ''}
                        </span>
                      </div>
                    </div>

                    <p className="mc-address">Domicile&nbsp;: {member.address || 'Non renseignée'}</p>

                    <div className="mc-bottom">
                      <span className="mc-issued">Délivrée le {formatDate(card.createdAt)}</span>
                      <div className="qr">{card.qrCode && <img src={card.qrCode} alt="QR code de la carte" />}</div>
                    </div>

                    <div className={`belt-edge ${beltCssClass(member.belt)}`} />
                  </div>
                  <span className="card-face-label">Recto</span>
                </div>

                {/* VERSO */}
                <div className="card-face">
                  <div className="member-card back mc-back">
                    <div className="mc-back-brand-row">
                      <div className="mc-emblem">{logoUrl ? <img src={logoUrl} alt="Logo du club" /> : 'Logo'}</div>
                      <div className="mc-back-brand">
                        AJC MAKINA
                        <div className="mc-flag-line">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    </div>

                    <ul className="mc-back-terms">
                      <li>Carte strictement personnelle et non transmissible.</li>
                      <li>Toute perte doit être signalée au secrétariat du club.</li>
                    </ul>

                    <div className="mc-back-sign-row">
                      <div className="mc-back-sign">
                        <span className="line"></span>
                        <span className="label">Signature du titulaire</span>
                      </div>
                      <div className="mc-back-stamp">
                        Cachet
                        <br />
                        du club
                      </div>
                    </div>

                    <div className="mc-back-contact">
                      <span>{clubPhone || '—'}</span>
                      <span>ajcmakina.cd</span>
                    </div>

                    <div className={`belt-edge ${beltCssClass(member.belt)}`} />
                  </div>
                  <span className="card-face-label">Verso</span>
                </div>
              </div>

              <div className="card-actions">
                {canUpdateCard && (
                  <button type="button" className="btn-gold" onClick={regenerateQrCode} disabled={regenerating}>
                    {regenerating ? 'Régénération...' : 'Régénérer le QR code'}
                  </button>
                )}
                <span className={`status-badge ${card.status === 'ACTIVE' ? 'actif' : 'inactif'}`}>
                  {card.status === 'ACTIVE' ? 'Carte active' : 'Carte désactivée'}
                </span>
              </div>

              <p className="card-created-by text-faint mono">
                Carte créée par&nbsp;: {card.createdByUsername || 'Non renseigné'} — le {formatDate(card.createdAt)}
              </p>

              <div className="qr-contents panel">
                <h5>Contenu encodé dans le QR</h5>
                <ul>
                  <li>Numéro de carte — {card.cardNumber}</li>
                  <li>Nom complet de l'adhérent</li>
                  <li>Téléphone et adresse e-mail</li>
                  <li>Ceinture actuelle</li>
                  <li>Sexe</li>
                  <li>Adresse postale</li>
                </ul>
              </div>
            </>
          )}
        </div>
      ) : null}
    </AppShell>
  )
}
