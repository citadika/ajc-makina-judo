import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { useAuth } from '../../context/AuthContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { memberApi } from '../../api/memberApi'
import { beltHistoryApi } from '../../api/beltHistoryApi'
import { examinerApi } from '../../api/examinerApi'
import { apiErrorMessage, apiErrorStatus } from '../../api/client'
import type { Member, Belt } from '../../types/member'
import { BELTS, beltLabel, beltCssClass } from '../../types/member'
import type { BeltHistory as BeltHistoryEntry } from '../../types/beltHistory'
import type { Examiner } from '../../types/examiner'
import './BeltHistory.css'

const PERMISSION_DENIED_MESSAGE =
  "Vous n'avez pas l'autorisation d'effectuer cette action. Contactez un administrateur pour obtenir les droits nécessaires."

const AUTO_REFRESH_PERIOD_MS = 30_000

function formatDate(value?: string | Date | null): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
}

/** Date du jour au format "YYYY-MM-DD", attendu par un <input type="date">. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Convertit une date ISO ("2026-03-15T00:00:00" ou "2026-03-15") en
 * "YYYY-MM-DD" pour préremplir un <input type="date">. */
function toDateInputValue(value?: string | null): string {
  if (!value) return todayIso()
  return value.slice(0, 10)
}

export function BeltHistory() {
  const { id } = useParams<{ id: string }>()
  const memberId = id ? Number(id) : 0
  const { user, hasPermission } = useAuth()
  // "Enregistrer le passage" et "+ Ajouter" un examinateur sont tous
  // deux des actions d'AJOUT (belt_history:create) ; modifier la date
  // ou les examinateurs d'un passage déjà enregistré (✏️ Modifier)
  // est une action de MODIFICATION (belt_history:update) distincte.
  const canCreate = hasPermission('belt_history:create')
  const canUpdate = hasPermission('belt_history:update')

  const [member, setMember] = useState<Member | null>(null)
  const [history, setHistory] = useState<BeltHistoryEntry[]>([])

  const [examiners, setExaminers] = useState<Examiner[]>([])
  const [addingExaminer, setAddingExaminer] = useState(false)
  const [examinerError, setExaminerError] = useState('')

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const defaultExaminerName = user?.fullName || user?.username || 'Administrateur'

  const [selectedBelt, setSelectedBelt] = useState<Belt | ''>('')
  const [observation, setObservation] = useState('')
  const [passageDate, setPassageDate] = useState<string>(todayIso())
  const [examinateur, setExaminateur] = useState(defaultExaminerName)
  const [examinateur2, setExaminateur2] = useState('')
  const [examinateur3, setExaminateur3] = useState('')
  const [examinateurGrade, setExaminateurGrade] = useState('')
  const [examinateur2Grade, setExaminateur2Grade] = useState('')
  const [examinateur3Grade, setExaminateur3Grade] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [selectedEntry, setSelectedEntry] = useState<BeltHistoryEntry | null>(null)
  const [editingDate, setEditingDate] = useState(false)
  const [editedDate, setEditedDate] = useState('')
  const [editedExaminateur, setEditedExaminateur] = useState('')
  const [editedExaminateur2, setEditedExaminateur2] = useState('')
  const [editedExaminateur3, setEditedExaminateur3] = useState('')
  const [editedExaminateurGrade, setEditedExaminateurGrade] = useState('')
  const [editedExaminateur2Grade, setEditedExaminateur2Grade] = useState('')
  const [editedExaminateur3Grade, setEditedExaminateur3Grade] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)
  const [entryError, setEntryError] = useState('')

  const busyRef = useRef(false)
  busyRef.current = loading || saving || selectedEntry !== null || savingEntry

  const load = useCallback(() => {
    if (!memberId) {
      setErrorMessage("Identifiant d'adhérent invalide.")
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage('')

    memberApi
      .getById(memberId)
      .then((memberRes) => {
        setMember(memberRes.data)

        return beltHistoryApi.getHistory(memberId).then((historyRes) => {
          const sorted = [...historyRes.data].sort(
            (a, b) => new Date(b.datePassage).getTime() - new Date(a.datePassage).getTime(),
          )
          setHistory(sorted)
          setLoading(false)
        })
      })
      .catch((error: unknown) => {
        console.error('BELT HISTORY -> LOAD ERROR:', error)
        setLoading(false)

        const status = apiErrorStatus(error)
        if (status === 404) {
          setErrorMessage('Adhérent introuvable.')
        } else if (status === 403) {
          setErrorMessage(
            "Vous n'avez pas l'autorisation de consulter cet historique. Contactez un administrateur pour obtenir les droits nécessaires.",
          )
        } else {
          setErrorMessage("Impossible de charger l'adhérent.")
        }
      })
  }, [memberId])

  useEffect(() => {
    load()
  }, [load])

  useAutoRefresh(AUTO_REFRESH_PERIOD_MS, load, () => busyRef.current)

  const loadExaminers = useCallback(() => {
    examinerApi
      .getAll()
      .then((res) => {
        const sorted = [...res.data].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        setExaminers(sorted)
      })
      .catch((error: unknown) => {
        console.error('BELT HISTORY -> LOAD EXAMINERS ERROR:', error)
      })
  }, [])

  useEffect(() => {
    loadExaminers()
  }, [loadExaminers])

  /**
   * "Ajouter" un nom (et un grade facultatif) d'examinateur à la liste
   * réutilisable, sans enregistrer de passage de ceinture. Idempotent
   * côté backend : si ce nom existe déjà (insensible à la casse),
   * l'ajout réussit quand même - un grade non vide fourni ici corrige
   * alors le grade déjà enregistré pour ce nom.
   */
  function addExaminer(rawName: string, rawGrade: string) {
    const name = rawName.trim()
    if (!name || addingExaminer || !canCreate) return

    setAddingExaminer(true)
    setExaminerError('')

    examinerApi
      .add({ name, grade: rawGrade.trim() || undefined })
      .then((res) => {
        setAddingExaminer(false)
        setExaminers((prev) => {
          const index = prev.findIndex((ex) => ex.name.toLowerCase() === res.data.name.toLowerCase())
          if (index === -1) {
            return [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
          }
          // Le grade a pu être corrigé côté serveur : on remplace
          // l'entrée existante pour refléter ce changement partout où
          // le grade est affiché.
          const next = [...prev]
          next[index] = res.data
          return next
        })
      })
      .catch((error: unknown) => {
        console.error('BELT HISTORY -> ADD EXAMINER ERROR:', error)
        setAddingExaminer(false)
        setExaminerError(
          apiErrorStatus(error) === 403
            ? PERMISSION_DENIED_MESSAGE
            : apiErrorMessage(error, "Impossible d'ajouter cet examinateur."),
        )
      })
  }

  /** Grade déjà connu pour ce nom (insensible à la casse), s'il existe. */
  function findKnownGrade(name: string): string | undefined {
    const match = examiners.find((ex) => ex.name.toLowerCase() === name.trim().toLowerCase())
    return match?.grade || undefined
  }

  /** Préremplit le champ grade avec le grade déjà connu pour ce nom,
   * sans écraser une valeur déjà saisie manuellement. */
  function autofillGrade(name: string, currentGrade: string, setGrade: (g: string) => void) {
    if (currentGrade.trim()) return
    const known = findKnownGrade(name)
    if (known) setGrade(known)
  }

  /** "Nom (Grade)" si un grade est connu pour ce nom, sinon juste "Nom". */
  function examinerDisplay(name?: string | null): string {
    if (!name || !name.trim()) return ''
    const grade = findKnownGrade(name)
    return grade ? `${name} (${grade})` : name
  }

  function promote(event: FormEvent) {
    event.preventDefault()

    if (!selectedBelt || saving || !canCreate) return

    setSaving(true)
    setSaveError('')

    beltHistoryApi
      .promote(memberId, {
        nouvelleCeinture: selectedBelt,
        datePassage: passageDate || undefined,
        observation: observation.trim() || undefined,
        examinateur: examinateur.trim() || undefined,
        examinateur2: examinateur2.trim() || undefined,
        examinateur3: examinateur3.trim() || undefined,
        examinateurGrade: examinateurGrade.trim() || undefined,
        examinateur2Grade: examinateur2Grade.trim() || undefined,
        examinateur3Grade: examinateur3Grade.trim() || undefined,
      })
      .then(() => {
        setSaving(false)
        setSelectedBelt('')
        setObservation('')
        setPassageDate(todayIso())
        setExaminateur(defaultExaminerName)
        setExaminateur2('')
        setExaminateur3('')
        setExaminateurGrade('')
        setExaminateur2Grade('')
        setExaminateur3Grade('')
        // La liste réutilisable a pu être enrichie (nouveau nom et/ou
        // grade) via l'auto-enregistrement côté serveur : on la
        // recharge pour que l'auto-complétion en tienne compte tout
        // de suite, sans attendre un rechargement de page.
        loadExaminers()
        // Le passage de ceinture a changé member.belt côté backend : on
        // recharge le membre + l'historique pour rester synchronisé.
        load()
      })
      .catch((error: unknown) => {
        console.error('BELT HISTORY -> PROMOTE ERROR:', error)
        setSaving(false)
        setSaveError(
          apiErrorStatus(error) === 403
            ? PERMISSION_DENIED_MESSAGE
            : apiErrorMessage(error, "Impossible d'enregistrer ce passage de ceinture."),
        )
      })
  }

  function openEntry(entry: BeltHistoryEntry) {
    setSelectedEntry(entry)
    setEditingDate(false)
    setEditedDate(toDateInputValue(entry.datePassage))
    setEditedExaminateur(entry.examinateur || '')
    setEditedExaminateur2(entry.examinateur2 || '')
    setEditedExaminateur3(entry.examinateur3 || '')
    // Préremplit avec le grade déjà connu pour chaque examinateur (le
    // grade vit sur la liste réutilisable, pas sur le passage
    // lui-même) - modifiable avant "+ Ajouter" pour le corriger.
    setEditedExaminateurGrade(findKnownGrade(entry.examinateur || '') || '')
    setEditedExaminateur2Grade(findKnownGrade(entry.examinateur2 || '') || '')
    setEditedExaminateur3Grade(findKnownGrade(entry.examinateur3 || '') || '')
    setEntryError('')
  }

  function closeEntry() {
    if (savingEntry) return
    setSelectedEntry(null)
    setEditingDate(false)
    setEntryError('')
  }

  function saveEntryDate() {
    if (!selectedEntry || savingEntry || !canUpdate) return

    setSavingEntry(true)
    setEntryError('')

    beltHistoryApi
      .updateEntry(memberId, selectedEntry.id, {
        datePassage: editedDate,
        examinateur: editedExaminateur.trim() || undefined,
        examinateur2: editedExaminateur2.trim() || undefined,
        examinateur3: editedExaminateur3.trim() || undefined,
        examinateurGrade: editedExaminateurGrade.trim() || undefined,
        examinateur2Grade: editedExaminateur2Grade.trim() || undefined,
        examinateur3Grade: editedExaminateur3Grade.trim() || undefined,
      })
      .then((res) => {
        setSavingEntry(false)
        setEditingDate(false)
        setSelectedEntry(res.data)
        loadExaminers()
        load()
      })
      .catch((error: unknown) => {
        console.error('BELT HISTORY -> UPDATE ENTRY ERROR:', error)
        setSavingEntry(false)
        setEntryError(
          apiErrorStatus(error) === 403
            ? PERMISSION_DENIED_MESSAGE
            : apiErrorMessage(error, 'Impossible de modifier ce passage.'),
        )
      })
  }

  const currentBeltIndex = member ? BELTS.indexOf(member.belt as Belt) : -1

  /** Concatène les examinateurs renseignés (1 à 3) en une seule chaîne
   * lisible, avec leur grade entre parenthèses quand il est connu
   * (ex. "Maître Kabongo (4e Dan), Sensei Mbala"). */
  function examinerNames(entry: BeltHistoryEntry): string {
    return [entry.examinateur, entry.examinateur2, entry.examinateur3]
      .filter((n) => n && n.trim())
      .map((n) => examinerDisplay(n))
      .join(', ')
  }

  function getInitials(): string {
    if (!member) return ''
    const first = member.firstName?.charAt(0)?.toUpperCase() || ''
    const last = member.lastName?.charAt(0)?.toUpperCase() || ''
    return first + last
  }

  return (
    <AppShell
      pageTitle={member ? `${member.firstName} ${member.lastName}` : 'Historique de ceinture'}
      pageSubtitle="Historique des ceintures"
    >
      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <p>Chargement de l'historique...</p>
        </div>
      ) : errorMessage ? (
        <>
          <div className="banner error">{errorMessage}</div>
          <Link className="btn-secondary" to="/members">
            ← Retour aux adhérents
          </Link>
        </>
      ) : member ? (
        <div className="screen-history">
          <Link className="table-link" to="/members">
            ← Retour aux adhérents
          </Link>

          <div className="history-member">
            <div className={`avatar ${beltCssClass(member.belt)}`} style={{ color: '#10161C' }}>
              {getInitials()}
            </div>
            <div className="who">
              <b>
                {member.firstName} {member.lastName}
              </b>
              <span>Ceinture actuelle&nbsp;: {beltLabel(member.belt)}</span>
            </div>
            <div className="history-matricule">
              <span className="num mono">#{member.id}</span>
              <span className="lock">Matricule inchangé</span>
            </div>
          </div>

          {saveError && <div className="banner error">{saveError}</div>}
          {!canCreate && (
            <div className="banner info">
              Vous n'avez pas l'autorisation d'enregistrer un passage de ceinture. Contactez un administrateur pour
              obtenir les droits nécessaires.
            </div>
          )}

          <form className="history-form" onSubmit={promote}>
            <div className="field">
              <label htmlFor="new-belt">Nouvelle ceinture</label>
              <select
                id="new-belt"
                value={selectedBelt}
                onChange={(e) => setSelectedBelt(e.target.value as Belt | '')}
                disabled={!canCreate}
                required
              >
                <option value="" disabled>
                  Choisir...
                </option>
                {BELTS.map((belt, index) => (
                  <option value={belt} key={belt} disabled={index <= currentBeltIndex}>
                    {beltLabel(belt)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="passage-date">Date du passage</label>
              <input
                id="passage-date"
                type="date"
                value={passageDate}
                max={todayIso()}
                onChange={(e) => setPassageDate(e.target.value)}
                disabled={!canCreate}
                required
              />
            </div>

            <div className="field full-width">
              <label htmlFor="examinateur">Examinateur(s) — jusqu'à 3</label>
              <div className="examiners-grid">
                <div className="examiner-field">
                  <div className="examiner-input-row">
                    <input
                      id="examinateur"
                      type="text"
                      list="examiners-list"
                      value={examinateur}
                      onChange={(e) => {
                        setExaminateur(e.target.value)
                        autofillGrade(e.target.value, examinateurGrade, setExaminateurGrade)
                      }}
                      maxLength={150}
                      placeholder="Examinateur 1"
                      disabled={!canCreate}
                    />
                    <button
                      type="button"
                      className="btn-secondary btn-add-examiner"
                      onClick={() => addExaminer(examinateur, examinateurGrade)}
                      disabled={!examinateur.trim() || addingExaminer || !canCreate}
                      title="Ajouter ce nom (et ce grade) à la liste réutilisable des examinateurs"
                    >
                      {addingExaminer ? '...' : '+ Ajouter'}
                    </button>
                  </div>
                  <input
                    type="text"
                    className="examiner-grade-input"
                    value={examinateurGrade}
                    onChange={(e) => setExaminateurGrade(e.target.value)}
                    maxLength={100}
                    placeholder="Grade (facultatif, ex. 4e Dan)"
                    disabled={!canCreate}
                  />
                </div>
                <div className="examiner-field">
                  <div className="examiner-input-row">
                    <input
                      id="examinateur2"
                      type="text"
                      list="examiners-list"
                      value={examinateur2}
                      onChange={(e) => {
                        setExaminateur2(e.target.value)
                        autofillGrade(e.target.value, examinateur2Grade, setExaminateur2Grade)
                      }}
                      maxLength={150}
                      placeholder="Examinateur 2 (facultatif)"
                      disabled={!canCreate}
                    />
                    <button
                      type="button"
                      className="btn-secondary btn-add-examiner"
                      onClick={() => addExaminer(examinateur2, examinateur2Grade)}
                      disabled={!examinateur2.trim() || addingExaminer || !canCreate}
                      title="Ajouter ce nom (et ce grade) à la liste réutilisable des examinateurs"
                    >
                      {addingExaminer ? '...' : '+ Ajouter'}
                    </button>
                  </div>
                  <input
                    type="text"
                    className="examiner-grade-input"
                    value={examinateur2Grade}
                    onChange={(e) => setExaminateur2Grade(e.target.value)}
                    maxLength={100}
                    placeholder="Grade (facultatif, ex. 4e Dan)"
                    disabled={!canCreate}
                  />
                </div>
                <div className="examiner-field">
                  <div className="examiner-input-row">
                    <input
                      id="examinateur3"
                      type="text"
                      list="examiners-list"
                      value={examinateur3}
                      onChange={(e) => {
                        setExaminateur3(e.target.value)
                        autofillGrade(e.target.value, examinateur3Grade, setExaminateur3Grade)
                      }}
                      maxLength={150}
                      placeholder="Examinateur 3 (facultatif)"
                      disabled={!canCreate}
                    />
                    <button
                      type="button"
                      className="btn-secondary btn-add-examiner"
                      onClick={() => addExaminer(examinateur3, examinateur3Grade)}
                      disabled={!examinateur3.trim() || addingExaminer || !canCreate}
                      title="Ajouter ce nom (et ce grade) à la liste réutilisable des examinateurs"
                    >
                      {addingExaminer ? '...' : '+ Ajouter'}
                    </button>
                  </div>
                  <input
                    type="text"
                    className="examiner-grade-input"
                    value={examinateur3Grade}
                    onChange={(e) => setExaminateur3Grade(e.target.value)}
                    maxLength={100}
                    placeholder="Grade (facultatif, ex. 4e Dan)"
                    disabled={!canCreate}
                  />
                </div>
              </div>
              <datalist id="examiners-list">
                {examiners.map((ex) => (
                  <option value={ex.name} key={ex.id} />
                ))}
              </datalist>
              {examinerError && <span className="examiner-error">{examinerError}</span>}
            </div>

            <div className="field full-width">
              <label htmlFor="observation">Observation (facultatif)</label>
              <textarea
                id="observation"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Remarque sur ce passage de grade..."
                disabled={!canCreate}
              />
            </div>

            <button type="submit" className="btn-gold" disabled={!selectedBelt || saving || !canCreate}>
              {saving ? 'Enregistrement...' : 'Enregistrer le passage'}
            </button>
          </form>

          <div className="history-timeline">
            {history.length === 0 ? (
              <div className="empty-state">
                <p className="text-faint">Aucun passage de ceinture enregistré pour le moment.</p>
              </div>
            ) : (
              history.map((entry) => (
                <div
                  className="history-row clickable"
                  key={entry.id}
                  onClick={() => openEntry(entry)}
                  role="button"
                  tabIndex={0}
                  title="Voir les détails de ce passage"
                >
                  <span className={`dot ${beltCssClass(entry.nouvelleCeinture)}`} />
                  <div className="change">
                    <b>
                      {beltLabel(entry.ancienneCeinture)} → {beltLabel(entry.nouvelleCeinture)}
                    </b>
                    <span>{entry.observation || 'Aucune observation'}</span>
                    {examinerNames(entry) && (
                      <span>
                        {[entry.examinateur, entry.examinateur2, entry.examinateur3].filter((n) => n && n.trim())
                          .length > 1
                          ? 'Examinateurs'
                          : 'Examinateur'}
                        &nbsp;: {examinerNames(entry)}
                      </span>
                    )}
                  </div>
                  <span className="when">{formatDate(entry.datePassage)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {selectedEntry && (
        <div className="modal-overlay" onClick={closeEntry}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Détails du passage</h2>
                <p>Informations enregistrées lors de ce passage de ceinture.</p>
              </div>
              <button type="button" className="modal-close" onClick={closeEntry} disabled={savingEntry}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {entryError && <div className="banner error">{entryError}</div>}

              <div className="details-grid">
                <div className="detail-item">
                  <span>Ancienne ceinture</span>
                  <strong>
                    <span className="belt-chip">
                      <span className={`dot ${beltCssClass(selectedEntry.ancienneCeinture)}`} />
                      {beltLabel(selectedEntry.ancienneCeinture)}
                    </span>
                  </strong>
                </div>
                <div className="detail-item">
                  <span>Nouvelle ceinture</span>
                  <strong>
                    <span className="belt-chip">
                      <span className={`dot ${beltCssClass(selectedEntry.nouvelleCeinture)}`} />
                      {beltLabel(selectedEntry.nouvelleCeinture)}
                    </span>
                  </strong>
                </div>
                <div className="detail-item">
                  <span>Date du passage</span>
                  {editingDate ? (
                    <input
                      type="date"
                      value={editedDate}
                      max={todayIso()}
                      onChange={(e) => setEditedDate(e.target.value)}
                    />
                  ) : (
                    <strong>{formatDate(selectedEntry.datePassage)}</strong>
                  )}
                </div>
                <div className="detail-item full-width">
                  <span>Examinateur(s) — jusqu'à 3</span>
                  {editingDate ? (
                    <div className="examiners-grid">
                      <div className="examiner-field">
                        <div className="examiner-input-row">
                          <input
                            type="text"
                            list="examiners-list"
                            value={editedExaminateur}
                            onChange={(e) => {
                              setEditedExaminateur(e.target.value)
                              autofillGrade(e.target.value, editedExaminateurGrade, setEditedExaminateurGrade)
                            }}
                            maxLength={150}
                            placeholder="Examinateur 1"
                          />
                          <button
                            type="button"
                            className="btn-secondary btn-add-examiner"
                            onClick={() => addExaminer(editedExaminateur, editedExaminateurGrade)}
                            disabled={!editedExaminateur.trim() || addingExaminer || !canCreate}
                            title="Ajouter ce nom (et ce grade) à la liste réutilisable des examinateurs"
                          >
                            {addingExaminer ? '...' : '+ Ajouter'}
                          </button>
                        </div>
                        <input
                          type="text"
                          className="examiner-grade-input"
                          value={editedExaminateurGrade}
                          onChange={(e) => setEditedExaminateurGrade(e.target.value)}
                          maxLength={100}
                          placeholder="Grade (facultatif, ex. 4e Dan)"
                        />
                      </div>
                      <div className="examiner-field">
                        <div className="examiner-input-row">
                          <input
                            type="text"
                            list="examiners-list"
                            value={editedExaminateur2}
                            onChange={(e) => {
                              setEditedExaminateur2(e.target.value)
                              autofillGrade(e.target.value, editedExaminateur2Grade, setEditedExaminateur2Grade)
                            }}
                            maxLength={150}
                            placeholder="Examinateur 2 (facultatif)"
                          />
                          <button
                            type="button"
                            className="btn-secondary btn-add-examiner"
                            onClick={() => addExaminer(editedExaminateur2, editedExaminateur2Grade)}
                            disabled={!editedExaminateur2.trim() || addingExaminer || !canCreate}
                            title="Ajouter ce nom (et ce grade) à la liste réutilisable des examinateurs"
                          >
                            {addingExaminer ? '...' : '+ Ajouter'}
                          </button>
                        </div>
                        <input
                          type="text"
                          className="examiner-grade-input"
                          value={editedExaminateur2Grade}
                          onChange={(e) => setEditedExaminateur2Grade(e.target.value)}
                          maxLength={100}
                          placeholder="Grade (facultatif, ex. 4e Dan)"
                        />
                      </div>
                      <div className="examiner-field">
                        <div className="examiner-input-row">
                          <input
                            type="text"
                            list="examiners-list"
                            value={editedExaminateur3}
                            onChange={(e) => {
                              setEditedExaminateur3(e.target.value)
                              autofillGrade(e.target.value, editedExaminateur3Grade, setEditedExaminateur3Grade)
                            }}
                            maxLength={150}
                            placeholder="Examinateur 3 (facultatif)"
                          />
                          <button
                            type="button"
                            className="btn-secondary btn-add-examiner"
                            onClick={() => addExaminer(editedExaminateur3, editedExaminateur3Grade)}
                            disabled={!editedExaminateur3.trim() || addingExaminer || !canCreate}
                            title="Ajouter ce nom (et ce grade) à la liste réutilisable des examinateurs"
                          >
                            {addingExaminer ? '...' : '+ Ajouter'}
                          </button>
                        </div>
                        <input
                          type="text"
                          className="examiner-grade-input"
                          value={editedExaminateur3Grade}
                          onChange={(e) => setEditedExaminateur3Grade(e.target.value)}
                          maxLength={100}
                          placeholder="Grade (facultatif, ex. 4e Dan)"
                        />
                      </div>
                    </div>
                  ) : (
                    <strong>{examinerNames(selectedEntry) || 'Non renseigné'}</strong>
                  )}
                </div>
                <div className="detail-item full-width">
                  <span>Observation</span>
                  <strong>{selectedEntry.observation || 'Aucune observation'}</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {editingDate ? (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setEditingDate(false)
                      setEditedDate(toDateInputValue(selectedEntry.datePassage))
                      setEditedExaminateur(selectedEntry.examinateur || '')
                      setEditedExaminateur2(selectedEntry.examinateur2 || '')
                      setEditedExaminateur3(selectedEntry.examinateur3 || '')
                      setEditedExaminateurGrade(findKnownGrade(selectedEntry.examinateur || '') || '')
                      setEditedExaminateur2Grade(findKnownGrade(selectedEntry.examinateur2 || '') || '')
                      setEditedExaminateur3Grade(findKnownGrade(selectedEntry.examinateur3 || '') || '')
                    }}
                    disabled={savingEntry}
                  >
                    Annuler
                  </button>
                  <button type="button" className="btn-gold" onClick={saveEntryDate} disabled={savingEntry}>
                    {savingEntry ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-secondary" onClick={closeEntry}>
                    Fermer
                  </button>
                  {canUpdate && (
                    <button type="button" className="btn-gold" onClick={() => setEditingDate(true)}>
                      ✏️ Modifier
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
