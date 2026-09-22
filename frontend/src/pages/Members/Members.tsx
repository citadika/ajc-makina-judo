import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, SyntheticEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { PhotoCropModal } from '../../components/PhotoCropModal'
import { useAuth } from '../../context/AuthContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { memberApi } from '../../api/memberApi'
import { cardApi } from '../../api/cardApi'
import { getMemberPhotoUrl } from '../../api/mediaUrl'
import { apiErrorMessage, apiErrorStatus } from '../../api/client'

const PERMISSION_DENIED_MESSAGE =
  "Vous n'avez pas l'autorisation d'effectuer cette action. Contactez un administrateur pour obtenir les droits nécessaires."
import type { Member, CreateMemberRequest, UpdateMemberRequest, Belt, Sexe } from '../../types/member'
import { BELTS, SEXES, beltLabel, beltCssClass } from '../../types/member'
import './Members.css'

const AUTO_REFRESH_PERIOD_MS = 30_000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface MemberFormState {
  firstName: string
  lastName: string
  phone: string
  email: string
  birthDate: string
  sexe: Sexe | ''
  belt: Belt | ''
  commune: string
  quartier: string
  avenue: string
  numero: string
  active: boolean
}

const emptyForm: MemberFormState = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  birthDate: '',
  sexe: '',
  belt: '',
  commune: '',
  quartier: '',
  avenue: '',
  numero: '',
  active: true,
}

function getInitials(member: Member): string {
  const first = member.firstName?.charAt(0)?.toUpperCase() || ''
  const last = member.lastName?.charAt(0)?.toUpperCase() || ''
  return first + last
}

function getAge(birthDate?: string): string {
  if (!birthDate) return '—'

  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return '—'

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const month = today.getMonth() - birth.getMonth()

  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return `${age} ans`
}

export function Members() {
  const { hasPermission } = useAuth()
  // Chaque action d'écriture applique désormais sa propre autorisation
  // (voir backend app/routers/members.py) plutôt qu'une seule clé
  // "members" partagée par l'ajout, la modification et la suppression.
  const canCreate = hasPermission('members:create')
  const canUpdate = hasPermission('members:update')
  const canDelete = hasPermission('members:delete')
  const [searchParams, setSearchParams] = useSearchParams()

  const [members, setMembers] = useState<Member[]>([])
  const [cardMemberIds, setCardMemberIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [forbidden, setForbidden] = useState(false)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedBelt, setSelectedBelt] = useState<Belt | ''>(() => (searchParams.get('belt') as Belt) || '')
  const [selectedStatus, setSelectedStatus] = useState<'' | 'active' | 'inactive'>('')
  const [withoutCardOnly, setWithoutCardOnly] = useState(() => searchParams.get('filter') === 'sans-carte')

  const [togglingMemberId, setTogglingMemberId] = useState<number | null>(null)
  const [deletingMemberId, setDeletingMemberId] = useState<number | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const [form, setForm] = useState<MemberFormState>(emptyForm)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null)
  const [cropSource, setCropSource] = useState<string | null>(null)

  const [showViewModal, setShowViewModal] = useState(false)
  const [viewedMember, setViewedMember] = useState<Member | null>(null)

  // Empêche l'auto-refresh d'écraser une saisie en cours ou d'interrompre une action.
  const busyRef = useRef(false)
  busyRef.current =
    loading ||
    showModal ||
    showViewModal ||
    saving ||
    togglingMemberId !== null ||
    deletingMemberId !== null ||
    cropSource !== null

  const loadMembers = useCallback(() => {
    setLoading(true)
    setErrorMessage('')
    setForbidden(false)

    Promise.all([memberApi.getAll(), cardApi.getAll().catch(() => ({ data: [] as { member?: { id?: number } }[] }))])
      .then(([membersRes, cardsRes]) => {
        setMembers(membersRes.data)

        const ids = new Set<number>()
        for (const card of cardsRes.data) {
          const memberId = card?.member?.id
          if (memberId !== null && memberId !== undefined) ids.add(Number(memberId))
        }
        setCardMemberIds(ids)

        setLoading(false)
      })
      .catch((error: unknown) => {
        console.error('LOAD MEMBERS ERROR:', error)
        setLoading(false)

        if (apiErrorStatus(error) === 403) {
          setForbidden(true)
        } else {
          setErrorMessage(apiErrorMessage(error))
        }
      })
  }, [])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  useAutoRefresh(AUTO_REFRESH_PERIOD_MS, loadMembers, () => busyRef.current)

  const filteredMembers = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()

    return members.filter((member) => {
      const searchText = [member.firstName, member.lastName, member.phone, member.email, String(member.id)]
        .filter((v) => v !== null && v !== undefined)
        .join(' ')
        .toLowerCase()

      const matchesKeyword = !keyword || searchText.includes(keyword)
      const matchesBelt = !selectedBelt || member.belt === selectedBelt
      const matchesStatus =
        !selectedStatus ||
        (selectedStatus === 'active' && member.active) ||
        (selectedStatus === 'inactive' && !member.active)
      const matchesCardFilter = !withoutCardOnly || !cardMemberIds.has(Number(member.id))

      return matchesKeyword && matchesBelt && matchesStatus && matchesCardFilter
    })
  }, [members, searchKeyword, selectedBelt, selectedStatus, withoutCardOnly, cardMemberIds])

  function clearSearch() {
    setSearchKeyword('')
    setSelectedBelt('')
    setSelectedStatus('')
    setWithoutCardOnly(false)
    setSearchParams({})
  }

  function openCreateModal() {
    setIsEditing(false)
    setEditingMember(null)
    setForm(emptyForm)
    setPhotoPreview(null)
    setSelectedPhotoFile(null)
    setModalError('')
    setTouched({})
    setShowModal(true)
  }

  function openEditModal(member: Member) {
    setIsEditing(true)
    setEditingMember(member)
    setForm({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      phone: member.phone || '',
      email: member.email || '',
      birthDate: member.birthDate || '',
      sexe: member.sexe || '',
      belt: member.belt || '',
      commune: member.commune || '',
      quartier: member.quartier || '',
      avenue: member.avenue || '',
      numero: member.numero || '',
      active: member.active,
    })
    setPhotoPreview(member.photo ? getMemberPhotoUrl(member.photo) : null)
    setSelectedPhotoFile(null)
    setModalError('')
    setTouched({})
    setShowModal(true)
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
    setEditingMember(null)
    setPhotoPreview(null)
    setSelectedPhotoFile(null)
  }

  function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      alert('Format non autorisé. Utilisez JPG, PNG ou WEBP.')
      input.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('La photo ne doit pas dépasser 10 Mo.')
      input.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => setCropSource(reader.result as string)
    reader.readAsDataURL(file)

    input.value = ''
  }

  function removeSelectedPhoto() {
    setSelectedPhotoFile(null)
    setPhotoPreview(null)
  }

  function openPhotoCrop() {
    // Repartir de l'aperçu actuel (photo déjà choisie, ou déjà
    // enregistrée pour un adhérent existant) pour permettre de
    // recadrer à nouveau, pas seulement au premier choix du fichier.
    if (photoPreview) setCropSource(photoPreview)
  }

  function onCropConfirm(file: File) {
    setSelectedPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
    setCropSource(null)
  }

  function onCropCancel() {
    setCropSource(null)
  }

  function isFormValid(): boolean {
    return form.firstName.trim().length > 0 && form.lastName.trim().length > 0 && (!form.email || EMAIL_RE.test(form.email))
  }

  function saveMember(event: FormEvent) {
    event.preventDefault()

    if (saving) return

    if (!isFormValid()) {
      setTouched({ firstName: true, lastName: true, email: true })
      return
    }

    setSaving(true)
    setModalError('')

    if (isEditing && editingMember) {
      const request: UpdateMemberRequest = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        email: form.email || undefined,
        birthDate: form.birthDate || undefined,
        commune: form.commune || undefined,
        quartier: form.quartier || undefined,
        avenue: form.avenue || undefined,
        numero: form.numero || undefined,
        sexe: form.sexe || undefined,
        belt: form.belt || undefined,
        active: form.active,
      }

      memberApi
        .update(editingMember.id, request, selectedPhotoFile)
        .then(() => {
          setSaving(false)
          setSuccessMessage('Membre modifié avec succès.')
          closeModal()
          loadMembers()
        })
        .catch((error: unknown) => {
          console.error('UPDATE MEMBER ERROR:', error)
          setSaving(false)
          setModalError(apiErrorStatus(error) === 403 ? PERMISSION_DENIED_MESSAGE : apiErrorMessage(error))
        })

      return
    }

    const request: CreateMemberRequest = {
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone || undefined,
      email: form.email || undefined,
      birthDate: form.birthDate || undefined,
      commune: form.commune || undefined,
      quartier: form.quartier || undefined,
      avenue: form.avenue || undefined,
      numero: form.numero || undefined,
      sexe: form.sexe || undefined,
      belt: form.belt || undefined,
    }

    memberApi
      .create(request, selectedPhotoFile)
      .then(() => {
        setSaving(false)
        setSuccessMessage('Membre créé avec succès.')
        closeModal()
        loadMembers()
      })
      .catch((error: unknown) => {
        console.error('CREATE MEMBER ERROR:', error)
        setSaving(false)
        setModalError(apiErrorStatus(error) === 403 ? PERMISSION_DENIED_MESSAGE : apiErrorMessage(error))
      })
  }

  function openViewModal(member: Member) {
    setViewedMember(member)
    setShowViewModal(true)
  }

  function closeViewModal() {
    setShowViewModal(false)
    setViewedMember(null)
  }

  function toggleActive(member: Member) {
    const action = member.active ? 'désactiver' : 'activer'
    if (!confirm(`Voulez-vous vraiment ${action} ce membre ?`)) return

    // Empêche un double-clic d'envoyer deux requêtes pour le même membre.
    if (togglingMemberId === member.id) return

    setTogglingMemberId(member.id)
    setErrorMessage('')
    setSuccessMessage('')

    memberApi
      .update(member.id, { active: !member.active })
      .then((res) => {
        const updatedMember = res.data
        setTogglingMemberId(null)
        setSuccessMessage(updatedMember.active ? 'Membre activé.' : 'Membre désactivé.')
        setMembers((prev) => prev.map((m) => (m.id === updatedMember.id ? updatedMember : m)))
      })
      .catch((error: unknown) => {
        console.error('TOGGLE ACTIVE ERROR:', error)
        setTogglingMemberId(null)
        setErrorMessage(apiErrorStatus(error) === 403 ? PERMISSION_DENIED_MESSAGE : apiErrorMessage(error))
      })
  }

  function deleteMember(member: Member) {
    if (!confirm(`Voulez-vous vraiment supprimer ${member.firstName} ${member.lastName} ?`)) return

    // Empêche un double-clic d'envoyer deux requêtes pour le même membre.
    if (deletingMemberId === member.id) return

    setDeletingMemberId(member.id)
    setErrorMessage('')
    setSuccessMessage('')

    memberApi
      .delete(member.id)
      .then(() => {
        setDeletingMemberId(null)
        setSuccessMessage('Membre supprimé avec succès.')
        setMembers((prev) => prev.filter((m) => m.id !== member.id))
      })
      .catch((error: unknown) => {
        console.error('DELETE MEMBER ERROR:', error)
        setDeletingMemberId(null)
        setErrorMessage(apiErrorStatus(error) === 403 ? PERMISSION_DENIED_MESSAGE : apiErrorMessage(error))
      })
  }

  function onPhotoError(event: SyntheticEvent<HTMLImageElement>) {
    event.currentTarget.style.display = 'none'
  }

  return (
    <AppShell pageTitle="Adhérents" pageSubtitle={`${filteredMembers.length} / ${members.length} membre(s)`}>
      <section className="screen-members">
        {forbidden ? (
          <div className="banner error">
            Vous n'avez pas l'autorisation de consulter la liste des adhérents. Contactez un administrateur pour
            obtenir les droits nécessaires.
          </div>
        ) : (
          <>
        {errorMessage && (
          <div className="banner error">
            <strong>Erreur&nbsp;:</strong> {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="banner success">
            <strong>✓</strong> {successMessage}
          </div>
        )}

        <div className="members-tools">
          <input
            className="search-box"
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Rechercher un adhérent (nom, téléphone, email, ID)..."
          />

          <select
            className="belt-filter"
            value={selectedBelt}
            onChange={(e) => setSelectedBelt(e.target.value as Belt | '')}
          >
            <option value="">Toutes les ceintures</option>
            {BELTS.map((belt) => (
              <option value={belt} key={belt}>
                {beltLabel(belt)}
              </option>
            ))}
          </select>

          <select
            className="status-filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as '' | 'active' | 'inactive')}
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>

          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={withoutCardOnly}
              onChange={(e) => setWithoutCardOnly(e.target.checked)}
            />
            Sans carte uniquement
          </label>

          <button type="button" className="btn-secondary" onClick={clearSearch}>
            Réinitialiser
          </button>

          {canCreate && (
            <button type="button" className="btn-gold" onClick={openCreateModal}>
              + Nouvel adhérent
            </button>
          )}
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <p>Chargement des adhérents...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🥋</div>
            {members.length === 0 ? (
              <>
                <h3>Aucun adhérent enregistré</h3>
                <p>Commencez par ajouter votre premier adhérent.</p>
                {canCreate && (
                  <button type="button" className="btn-gold" onClick={openCreateModal}>
                    + Ajouter un adhérent
                  </button>
                )}
              </>
            ) : (
              <>
                <h3>Aucun résultat</h3>
                <p>Aucun adhérent ne correspond à vos critères.</p>
                <button type="button" className="btn-secondary" onClick={clearSearch}>
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
                  <th>Téléphone</th>
                  <th>Email</th>
                  <th>Naissance</th>
                  <th>Ceinture</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id}>
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
                          <div className="avatar">{getInitials(member)}</div>
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

                    <td className="mono">{member.phone || '—'}</td>
                    <td>{member.email || '—'}</td>

                    <td>
                      {member.birthDate ? (
                        <>
                          {member.birthDate} <small className="text-faint">({getAge(member.birthDate)})</small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td>
                      <span className="belt-chip">
                        <span className={`dot ${beltCssClass(member.belt)}`} />
                        {beltLabel(member.belt)}
                      </span>
                    </td>

                    <td>
                      {member.active ? (
                        <span className="status-badge actif">Actif</span>
                      ) : (
                        <span className="status-badge inactif">Inactif</span>
                      )}
                    </td>

                    <td>
                      <Link className="table-link" to={`/members/${member.id}/card`}>
                        Carte →
                      </Link>
                      <Link className="table-link" to={`/members/${member.id}/belt-history`}>
                        Historique →
                      </Link>
                      <button type="button" className="btn-icon" title="Voir" onClick={() => openViewModal(member)}>
                        👁
                      </button>
                      {canUpdate && (
                        <>
                          <button
                            type="button"
                            className="btn-icon"
                            title="Modifier"
                            onClick={() => openEditModal(member)}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            title={member.active ? 'Désactiver' : 'Activer'}
                            disabled={togglingMemberId === member.id || deletingMemberId === member.id}
                            onClick={() => toggleActive(member)}
                          >
                            {togglingMemberId === member.id ? '⏳' : member.active ? '⏸' : '▶'}
                          </button>
                        </>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="btn-icon"
                          title="Supprimer"
                          disabled={deletingMemberId === member.id || togglingMemberId === member.id}
                          onClick={() => deleteMember(member)}
                        >
                          {deletingMemberId === member.id ? '⏳' : '🗑'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{isEditing ? "Modifier l'adhérent" : 'Nouvel adhérent'}</h2>
                <p>
                  {isEditing
                    ? "Modifiez les informations de l'adhérent."
                    : 'Enregistrez un nouvel adhérent JudoCard.'}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeModal} disabled={saving}>
                ×
              </button>
            </div>

            <form onSubmit={saveMember} noValidate>
              <div className="modal-body">
                {modalError && (
                  <div className="banner error">
                    <strong>Erreur&nbsp;:</strong> {modalError}
                  </div>
                )}

                <div className="photo-section">
                  <div className="photo-preview">
                    {photoPreview ? <img src={photoPreview} alt="Photo de l'adhérent" /> : <span>📷</span>}
                  </div>

                  <div className="photo-controls">
                    <label className={`btn-secondary upload-button${saving ? ' disabled' : ''}`}>
                      📷 Choisir une photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={onPhotoSelected}
                        disabled={saving}
                        hidden
                      />
                    </label>

                    {photoPreview && (
                      <>
                        <button type="button" className="btn-ghost" onClick={openPhotoCrop} disabled={saving}>
                          🔍 Zoomer / recadrer
                        </button>
                        <button type="button" className="btn-ghost" onClick={removeSelectedPhoto} disabled={saving}>
                          Supprimer la photo
                        </button>
                      </>
                    )}

                    <small className="hint">JPG, PNG ou WEBP — jusqu'à 10 Mo. Vous pourrez zoomer et recadrer après le choix du fichier.</small>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Prénom *</label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                      onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
                      placeholder="Prénom"
                    />
                    {touched.firstName && !form.firstName.trim() && (
                      <small className="field-error">Le prénom est obligatoire.</small>
                    )}
                  </div>

                  <div className="field">
                    <label>Nom *</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
                      placeholder="Nom"
                    />
                    {touched.lastName && !form.lastName.trim() && (
                      <small className="field-error">Le nom est obligatoire.</small>
                    )}
                  </div>

                  <div className="field">
                    <label>Téléphone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+243..."
                    />
                  </div>

                  <div className="field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                      placeholder="email@exemple.com"
                    />
                    {touched.email && form.email && !EMAIL_RE.test(form.email) && (
                      <small className="field-error">Veuillez saisir une adresse email valide.</small>
                    )}
                  </div>

                  <div className="field">
                    <label>Date de naissance</label>
                    <input
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                    />
                  </div>

                  <div className="field">
                    <label>Sexe</label>
                    <select
                      value={form.sexe}
                      onChange={(e) => setForm((f) => ({ ...f, sexe: e.target.value as Sexe | '' }))}
                    >
                      <option value="">Non défini</option>
                      {SEXES.map((sexe) => (
                        <option value={sexe} key={sexe}>
                          {sexe}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Ceinture</label>
                    <select
                      value={form.belt}
                      onChange={(e) => setForm((f) => ({ ...f, belt: e.target.value as Belt | '' }))}
                    >
                      <option value="">Non définie</option>
                      {BELTS.map((belt) => (
                        <option value={belt} key={belt}>
                          {beltLabel(belt)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field full-width">
                    <label>Adresse</label>
                    <div className="address-grid">
                      <div className="field">
                        <label>Commune</label>
                        <input
                          type="text"
                          value={form.commune}
                          onChange={(e) => setForm((f) => ({ ...f, commune: e.target.value }))}
                          placeholder="Ex : Ngaliema"
                        />
                      </div>
                      <div className="field">
                        <label>Quartier</label>
                        <input
                          type="text"
                          value={form.quartier}
                          onChange={(e) => setForm((f) => ({ ...f, quartier: e.target.value }))}
                          placeholder="Ex : Makina"
                        />
                      </div>
                      <div className="field">
                        <label>Avenue</label>
                        <input
                          type="text"
                          value={form.avenue}
                          onChange={(e) => setForm((f) => ({ ...f, avenue: e.target.value }))}
                          placeholder="Ex : Avenue Lumumba"
                        />
                      </div>
                      <div className="field">
                        <label>Numéro</label>
                        <input
                          type="text"
                          value={form.numero}
                          onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                          placeholder="Ex : 12"
                        />
                      </div>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="field checkbox-field">
                      <input
                        type="checkbox"
                        id="active-checkbox"
                        checked={form.active}
                        onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                      />
                      <label htmlFor="active-checkbox">Adhérent actif</label>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={saving}>
                  Annuler
                </button>
                <button type="submit" className="btn-gold" disabled={saving}>
                  {saving ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : "Créer l'adhérent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && viewedMember && (
        <div className="modal-overlay" onClick={closeViewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Détails de l'adhérent</h2>
                <p>Informations de l'adhérent JudoCard</p>
              </div>
              <button type="button" className="modal-close" onClick={closeViewModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="view-head">
                {viewedMember.photo ? (
                  <div className="avatar view-avatar">
                    <img
                      src={getMemberPhotoUrl(viewedMember.photo)}
                      alt={`${viewedMember.firstName} ${viewedMember.lastName}`}
                      onError={onPhotoError}
                    />
                  </div>
                ) : (
                  <div className="avatar view-avatar">{getInitials(viewedMember)}</div>
                )}

                <div>
                  <h3>
                    {viewedMember.firstName} {viewedMember.lastName}
                  </h3>
                  <p className="mono text-faint">Adhérent #{viewedMember.id}</p>
                  {viewedMember.active ? (
                    <span className="status-badge actif">Actif</span>
                  ) : (
                    <span className="status-badge inactif">Inactif</span>
                  )}
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-item">
                  <span>Téléphone</span>
                  <strong>{viewedMember.phone || 'Non renseigné'}</strong>
                </div>
                <div className="detail-item">
                  <span>Email</span>
                  <strong>{viewedMember.email || 'Non renseigné'}</strong>
                </div>
                <div className="detail-item">
                  <span>Date de naissance</span>
                  <strong>{viewedMember.birthDate || 'Non renseignée'}</strong>
                </div>
                <div className="detail-item">
                  <span>Âge</span>
                  <strong>{getAge(viewedMember.birthDate)}</strong>
                </div>
                <div className="detail-item">
                  <span>Sexe</span>
                  <strong>{viewedMember.sexe || 'Non défini'}</strong>
                </div>
                <div className="detail-item">
                  <span>Ceinture</span>
                  <strong>
                    <span className="belt-chip">
                      <span className={`dot ${beltCssClass(viewedMember.belt)}`} />
                      {beltLabel(viewedMember.belt)}
                    </span>
                  </strong>
                </div>
                <div className="detail-item">
                  <span>Adresse</span>
                  <strong>{viewedMember.address || 'Non renseignée'}</strong>
                </div>
                <div className="detail-item">
                  <span>Créé par</span>
                  <strong>{viewedMember.createdByUsername || 'Non renseigné'}</strong>
                </div>
                <div className="detail-item">
                  <span>Dernière modification par</span>
                  <strong>{viewedMember.updatedByUsername || 'Non renseigné'}</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <Link className="btn-ghost" to={`/members/${viewedMember.id}/card`}>
                Voir la carte
              </Link>
              <Link className="btn-ghost" to={`/members/${viewedMember.id}/belt-history`}>
                Historique
              </Link>
              <button type="button" className="btn-secondary" onClick={closeViewModal}>
                Fermer
              </button>
              {canUpdate && (
                <button
                  type="button"
                  className="btn-gold"
                  onClick={() => {
                    const member = viewedMember
                    closeViewModal()
                    if (member) openEditModal(member)
                  }}
                >
                  ✏️ Modifier
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {cropSource && <PhotoCropModal imageSrc={cropSource} onCancel={onCropCancel} onConfirm={onCropConfirm} />}
          </>
        )}
      </section>
    </AppShell>
  )
}
