import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AppShell } from '../../components/AppShell'
import { useAuth } from '../../context/AuthContext'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { userApi } from '../../api/userApi'
import { apiErrorMessage, apiErrorStatus } from '../../api/client'
import type { CreateUserRequest, PermissionKey, UpdateUserRequest, UserSummary } from '../../types/user'
import { PERMISSION_RESOURCES } from '../../types/user'
import './Users.css'

const AUTO_REFRESH_PERIOD_MS = 30_000

interface UserFormState {
  username: string
  email: string
  fullName: string
  role: string
  password: string
  permissions: string[]
}

const emptyForm: UserFormState = {
  username: '',
  email: '',
  fullName: '',
  role: 'USER',
  password: '',
  permissions: [],
}

/**
 * Regroupe les clés d'autorisation d'un compte par ressource, pour un
 * affichage compact dans le tableau (une pastille par ressource,
 * ex. "Adhérents : Lecture, Ajout") plutôt qu'une pastille par clé
 * "ressource:action" (14 pastilles possibles au total).
 */
function groupPermissionsByResource(permissions: string[]): { resource: string; label: string; actions: string }[] {
  const byResource = new Map<string, Set<string>>()

  for (const key of permissions) {
    const [resource, action] = key.split(':')
    if (!byResource.has(resource)) byResource.set(resource, new Set())
    if (action) byResource.get(resource)!.add(action)
  }

  return PERMISSION_RESOURCES.filter((resource) => byResource.has(resource.key)).map((resource) => ({
    resource: resource.key,
    label: resource.label,
    actions: resource.actions
      .filter((a) => byResource.get(resource.key)!.has(a.action))
      .map((a) => a.label)
      .join(', '),
  }))
}

function getInitials(user: UserSummary): string {
  const source = user.fullName || user.username || ''
  const parts = source.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Users() {
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [forbidden, setForbidden] = useState(false)

  const [togglingUserId, setTogglingUserId] = useState<number | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<UserFormState>(emptyForm)

  const busyRef = useRef(false)
  busyRef.current = loading || forbidden || showModal || saving || togglingUserId !== null

  const load = useCallback(() => {
    setLoading(true)
    setErrorMessage('')
    setForbidden(false)

    userApi
      .getAll()
      .then((res) => {
        setUsers(res.data)
        setLoading(false)
      })
      .catch((error: unknown) => {
        console.error('USERS -> LOAD ERROR:', error)
        setLoading(false)

        if (apiErrorStatus(error) === 403) {
          setForbidden(true)
        } else {
          setErrorMessage('Impossible de charger les utilisateurs.')
        }
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useAutoRefresh(AUTO_REFRESH_PERIOD_MS, load, () => busyRef.current)

  function openCreateModal() {
    setIsEditing(false)
    setEditingUser(null)
    setFormError('')
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEditModal(user: UserSummary) {
    setIsEditing(true)
    setEditingUser(user)
    setFormError('')
    setForm({
      username: user.username,
      email: user.email,
      fullName: user.fullName || '',
      role: user.role,
      password: '',
      permissions: user.permissions || [],
    })
    setShowModal(true)
  }

  function togglePermission(key: PermissionKey) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key) ? f.permissions.filter((p) => p !== key) : [...f.permissions, key],
    }))
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
    setEditingUser(null)
  }

  function getErrorMessage(error: unknown): string {
    if (apiErrorStatus(error) === 403) {
      return 'Action réservée aux administrateurs.'
    }
    return apiErrorMessage(error)
  }

  function save(event: FormEvent) {
    event.preventDefault()

    if (saving) return

    setFormError('')

    if (isEditing && editingUser) {
      const request: UpdateUserRequest = {
        email: form.email || undefined,
        fullName: form.fullName || undefined,
        role: form.role || undefined,
        password: form.password || undefined,
        permissions: form.permissions,
      }

      setSaving(true)

      userApi
        .update(editingUser.id, request)
        .then(() => {
          setSaving(false)
          closeModal()
          load()
        })
        .catch((error: unknown) => {
          console.error('USERS -> UPDATE ERROR:', error)
          setSaving(false)
          setFormError(getErrorMessage(error))
        })

      return
    }

    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError("Nom d'utilisateur, email et mot de passe sont obligatoires.")
      return
    }

    const request: CreateUserRequest = {
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim() || undefined,
      role: form.role,
      permissions: form.permissions,
    }

    setSaving(true)

    userApi
      .create(request)
      .then(() => {
        setSaving(false)
        closeModal()
        load()
      })
      .catch((error: unknown) => {
        console.error('USERS -> CREATE ERROR:', error)
        setSaving(false)
        setFormError(getErrorMessage(error))
      })
  }

  function toggleEnabled(user: UserSummary) {
    if (togglingUserId === user.id) return

    const nextEnabled = !user.enabled

    setTogglingUserId(user.id)
    setErrorMessage('')

    userApi
      .setEnabled(user.id, nextEnabled)
      .then((res) => {
        const updatedUser = res.data
        setTogglingUserId(null)
        setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)))
      })
      .catch((error: unknown) => {
        console.error('USERS -> TOGGLE ENABLED ERROR:', error)
        setTogglingUserId(null)
        setErrorMessage(getErrorMessage(error))
      })
  }

  function isSelf(user: UserSummary): boolean {
    return currentUser?.userId === user.id
  }

  return (
    <AppShell pageTitle="Utilisateurs" pageSubtitle="Comptes du bureau du club">
      <div className="screen-users">
        {forbidden ? (
          <div className="banner error">
            Accès réservé aux administrateurs. Vous n'avez pas les droits nécessaires pour consulter cette page.
          </div>
        ) : (
          <>
            <div className="users-head">
              <p className="text-faint">{users.length} compte(s)</p>
              <button type="button" className="btn-gold" onClick={openCreateModal}>
                + Ajouter un utilisateur
              </button>
            </div>

            {errorMessage && <div className="banner error">{errorMessage}</div>}

            {loading ? (
              <div className="empty-state">
                <div className="empty-icon">⏳</div>
                <p>Chargement des utilisateurs...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👤</div>
                <h3>Aucun utilisateur</h3>
                <p>Ajoutez le premier compte du bureau du club.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Compte</th>
                      <th>E-mail</th>
                      <th>Rôle</th>
                      <th>Autorisations</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="name-cell">
                            <div className="avatar">{getInitials(user)}</div>
                            <div>
                              <b>{user.username}</b>
                              <br />
                              {user.fullName && <small className="text-faint">{user.fullName}</small>}
                            </div>
                          </div>
                        </td>
                        <td className="mono">{user.email}</td>
                        <td>
                          <span className={`role-badge ${user.role === 'ADMIN' ? 'admin' : 'secretariat'}`}>
                            {user.role === 'ADMIN' ? 'Administrateur' : 'Secrétariat'}
                          </span>
                        </td>
                        <td>
                          {user.role === 'ADMIN' ? (
                            <span className="perm-badge perm-all">Accès complet</span>
                          ) : user.permissions && user.permissions.length > 0 ? (
                            <div className="perm-badge-list">
                              {groupPermissionsByResource(user.permissions).map((group) => (
                                <span className="perm-badge" key={group.resource} title={group.actions}>
                                  {group.label} : {group.actions}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-faint">Aucune</span>
                          )}
                        </td>
                        <td>
                          {user.enabled ? (
                            <span className="status-badge actif">Actif</span>
                          ) : (
                            <span className="status-badge inactif">Désactivé</span>
                          )}
                        </td>
                        <td>
                          <button type="button" className="btn-icon" title="Modifier" onClick={() => openEditModal(user)}>
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            title={user.enabled ? 'Désactiver' : 'Activer'}
                            disabled={isSelf(user) || togglingUserId === user.id}
                            onClick={() => toggleEnabled(user)}
                          >
                            {togglingUserId === user.id ? '⏳' : user.enabled ? '⏸' : '▶'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{isEditing ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}</h2>
                <p>Comptes du bureau du club (accès administrateur ou secrétariat).</p>
              </div>
              <button type="button" className="modal-close" onClick={closeModal} disabled={saving}>
                ×
              </button>
            </div>

            <form onSubmit={save}>
              <div className="modal-body">
                {formError && <div className="banner error">{formError}</div>}

                <div className="field">
                  <label>Nom d'utilisateur</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    disabled={isEditing}
                    placeholder="ex: skabongo"
                  />
                </div>

                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email@ajcmakina.cd"
                  />
                </div>

                <div className="field">
                  <label>Nom complet</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Nom et prénom"
                  />
                </div>

                <div className="field">
                  <label>Rôle</label>
                  <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                    <option value="ADMIN">Administrateur</option>
                    <option value="USER">Secrétariat</option>
                  </select>
                </div>

                <div className="field">
                  <label>{isEditing ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe'}</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>

                <div className="field full-width">
                  <label>Autorisations</label>
                  {form.role === 'ADMIN' ? (
                    <p className="text-faint perm-note">
                      Un compte Administrateur a toujours accès à toutes les actions, quelles que soient les cases
                      cochées ci-dessous.
                    </p>
                  ) : (
                    <p className="text-faint perm-note">
                      Pour chaque rubrique, cochez séparément la lecture, l'ajout, la modification et la suppression
                      selon les actions que ce compte Secrétariat est autorisé à effectuer.
                    </p>
                  )}
                  <div className="perm-matrix">
                    {PERMISSION_RESOURCES.map((resource) => (
                      <div className="perm-matrix-row" key={resource.key}>
                        <span className="perm-matrix-resource">{resource.label}</span>
                        <div className="perm-matrix-actions">
                          {resource.actions.map((action) => (
                            <label className="perm-checkbox" key={action.key}>
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(action.key)}
                                onChange={() => togglePermission(action.key)}
                              />
                              <span>{action.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={saving}>
                  Annuler
                </button>
                <button type="submit" className="btn-gold" disabled={saving}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
