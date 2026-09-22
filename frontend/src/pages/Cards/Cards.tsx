import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { cardApi } from '../../api/cardApi'
import { getMemberPhotoUrl } from '../../api/mediaUrl'
import { apiErrorMessage } from '../../api/client'
import type { Card } from '../../types/card'
import { beltLabel, beltCssClass } from '../../types/member'
import './Cards.css'

const AUTO_REFRESH_PERIOD_MS = 30_000

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || ''
  const last = lastName?.charAt(0)?.toUpperCase() || ''
  return first + last
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
}

function onPhotoError(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none'
}

/**
 * Liste de toutes les cartes créées, avec recherche - porte le lien
 * "Cartes" de la barre latérale demandé par le club. Réutilise
 * GET /api/cards (déjà utilisé par le Dashboard) plutôt que d'ajouter
 * un nouvel endpoint backend.
 */
export function Cards() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'' | 'active' | 'disabled'>(() => {
    const fromUrl = searchParams.get('status')
    return fromUrl === 'active' || fromUrl === 'disabled' ? fromUrl : ''
  })

  const busyRef = useRef(false)
  busyRef.current = loading

  const load = useCallback(() => {
    setLoading(true)
    setErrorMessage('')

    cardApi
      .getAll()
      .then((res) => {
        setCards(Array.isArray(res.data) ? res.data : [])
        setLoading(false)
      })
      .catch((error: unknown) => {
        console.error('CARDS -> LOAD ERROR:', error)
        setLoading(false)
        setErrorMessage(apiErrorMessage(error, 'Impossible de charger les cartes.'))
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useAutoRefresh(AUTO_REFRESH_PERIOD_MS, load, () => busyRef.current)

  const filteredCards = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()

    return cards.filter((card) => {
      const member = card.member as { firstName?: string; lastName?: string; id?: number } | undefined
      const searchText = [card.cardNumber, member?.firstName, member?.lastName, member?.id ? String(member.id) : '']
        .filter((v) => v !== null && v !== undefined)
        .join(' ')
        .toLowerCase()

      const matchesKeyword = !keyword || searchText.includes(keyword)

      const status = String(card.status || '').toUpperCase()
      const matchesStatus =
        !selectedStatus ||
        (selectedStatus === 'active' && status === 'ACTIVE') ||
        (selectedStatus === 'disabled' && status !== 'ACTIVE')

      return matchesKeyword && matchesStatus
    })
  }, [cards, searchKeyword, selectedStatus])

  function clearFilters() {
    setSearchKeyword('')
    setSelectedStatus('')
    setSearchParams({})
  }

  function onStatusChange(value: '' | 'active' | 'disabled') {
    setSelectedStatus(value)
    if (value) setSearchParams({ status: value })
    else setSearchParams({})
  }

  return (
    <AppShell pageTitle="Cartes" pageSubtitle={`${filteredCards.length} / ${cards.length} carte(s)`}>
      <section className="screen-cards">
        {errorMessage && (
          <div className="banner error">
            <strong>Erreur&nbsp;:</strong> {errorMessage}
          </div>
        )}

        <div className="members-tools">
          <input
            className="search-box"
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Rechercher une carte (numéro, nom de l'adhérent...)..."
          />

          <select
            className="status-filter"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as '' | 'active' | 'disabled')}
          >
            <option value="">Toutes les cartes</option>
            <option value="active">Actives</option>
            <option value="disabled">Désactivées</option>
          </select>

          <button type="button" className="btn-secondary" onClick={clearFilters}>
            Réinitialiser
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <p>Chargement des cartes...</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🪪</div>
            {cards.length === 0 ? (
              <>
                <h3>Aucune carte créée</h3>
                <p>Les cartes créées depuis la fiche d'un adhérent apparaîtront ici.</p>
              </>
            ) : (
              <>
                <h3>Aucun résultat</h3>
                <p>Aucune carte ne correspond à vos critères.</p>
                <button type="button" className="btn-secondary" onClick={clearFilters}>
                  Réinitialiser les filtres
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Adhérent</th>
                  <th>Numéro de carte</th>
                  <th>Ceinture</th>
                  <th>Délivrée le</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.map((card) => {
                  const member = card.member as {
                    id?: number
                    firstName?: string
                    lastName?: string
                    photo?: string | null
                    belt?: string | null
                  }

                  return (
                    <tr key={card.id}>
                      <td>
                        <div className="name-cell">
                          {member.photo ? (
                            <div className="avatar">
                              <img
                                src={getMemberPhotoUrl(member.photo)}
                                alt={`${member.firstName} ${member.lastName}`}
                                onError={onPhotoError}
                              />
                            </div>
                          ) : (
                            <div className="avatar">{getInitials(member.firstName, member.lastName)}</div>
                          )}
                          <div>
                            <b>
                              {member.firstName} {member.lastName}
                            </b>
                            <br />
                            <small className="mono text-faint">#{member.id}</small>
                          </div>
                        </div>
                      </td>

                      <td className="mono">{card.cardNumber || '—'}</td>

                      <td>
                        <span className="belt-chip">
                          <span className={`dot ${beltCssClass(member.belt)}`} />
                          {beltLabel(member.belt)}
                        </span>
                      </td>

                      <td>{formatDate(card.createdAt)}</td>

                      <td>
                        <span className={`status-badge ${String(card.status).toUpperCase() === 'ACTIVE' ? 'actif' : 'inactif'}`}>
                          {String(card.status).toUpperCase() === 'ACTIVE' ? 'Active' : 'Désactivée'}
                        </span>
                      </td>

                      <td>
                        {member.id && (
                          <Link className="table-link" to={`/members/${member.id}/card`}>
                            Voir la carte →
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  )
}
