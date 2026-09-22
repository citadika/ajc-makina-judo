import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { AppShell } from '../../components/AppShell'
import { settingsApi } from '../../api/settingsApi'
import { getSettingsLogoUrl } from '../../api/mediaUrl'
import { apiErrorMessage, apiErrorStatus } from '../../api/client'
import type { UpdateSettingsRequest } from '../../types/settings'
import './Settings.css'

interface SettingsFormState {
  clubName: string
  address: string
  phone: string
  email: string
}

const emptyForm: SettingsFormState = { clubName: '', address: '', phone: '', email: '' }

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * Paramètres du club — porté depuis pages/settings/settings.ts
 * (Angular). Route ouverte à tout utilisateur authentifié en
 * lecture (voir app.routes.ts côté Angular : seul ProtectedRoute,
 * pas AdminRoute) ; l'enregistrement (PUT) est réservé à l'ADMIN
 * côté backend — un 403 est géré ici, pas au niveau du routeur.
 */
export function Settings() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  const [form, setForm] = useState<SettingsFormState>(emptyForm)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setLoadError('')

    settingsApi
      .get()
      .then((res) => {
        const settings = res.data
        setForm({
          clubName: settings.clubName || '',
          address: settings.address || '',
          phone: settings.phone || '',
          email: settings.email || '',
        })
        setLogoPreview(getSettingsLogoUrl(settings.logoPath) || null)
        setLastUpdatedBy(settings.updatedByUsername || null)
        setLastUpdatedAt(settings.updatedAt || null)
        setLoading(false)
      })
      .catch((error: unknown) => {
        console.error('SETTINGS -> LOAD ERROR:', error)
        setLoading(false)
        setLoadError('Impossible de charger les paramètres du club.')
      })
  }, [])

  function onLogoSelected(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      alert('Format non autorisé. Utilisez JPG, PNG ou WEBP.')
      input.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Le logo ne doit pas dépasser 5 Mo.')
      input.value = ''
      return
    }

    setLogoFile(file)

    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)

    input.value = ''
  }

  function save(event: FormEvent) {
    event.preventDefault()

    if (saving) return

    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    const request: UpdateSettingsRequest = {
      clubName: form.clubName || undefined,
      address: form.address || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
    }

    settingsApi
      .update(request, logoFile)
      .then((res) => {
        const settings = res.data
        setLogoFile(null)
        setLogoPreview(getSettingsLogoUrl(settings.logoPath) || null)
        setLastUpdatedBy(settings.updatedByUsername || null)
        setLastUpdatedAt(settings.updatedAt || null)
        setSaving(false)
        setSaveSuccess('Paramètres du club enregistrés.')
      })
      .catch((error: unknown) => {
        console.error('SETTINGS -> SAVE ERROR:', error)
        setSaving(false)

        if (apiErrorStatus(error) === 403) {
          setSaveError('Action réservée aux administrateurs.')
        } else {
          setSaveError(apiErrorMessage(error, "Impossible d'enregistrer les paramètres."))
        }
      })
  }

  return (
    <AppShell pageTitle="Paramètres du club" pageSubtitle="Coordonnées et logo de l'AJC MAKINA">
      <div className="screen-settings">
        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <p>Chargement des paramètres...</p>
          </div>
        ) : loadError ? (
          <div className="banner error">{loadError}</div>
        ) : (
          <>
            {saveError && <div className="banner error">{saveError}</div>}
            {saveSuccess && <div className="banner success">{saveSuccess}</div>}

            <form onSubmit={save}>
              <div className="settings-grid">
                <div className="settings-block">
                  <h5>Informations du club</h5>

                  <div className="field">
                    <label>Nom du club</label>
                    <input
                      type="text"
                      value={form.clubName}
                      onChange={(e) => setForm((f) => ({ ...f, clubName: e.target.value }))}
                      placeholder="AJC MAKINA"
                    />
                  </div>

                  <div className="field">
                    <label>Adresse</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      placeholder="Quartier Makina, Kinshasa"
                    />
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
                    <label>E-mail</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="contact@ajcmakina.cd"
                    />
                  </div>
                </div>

                <div className="settings-block">
                  <h5>Logo du club</h5>

                  <div className="logo-preview">
                    {logoPreview ? <img src={logoPreview} alt="Logo du club" /> : <span>Logo</span>}
                  </div>

                  <label className="btn-secondary upload-button">
                    📷 Choisir un logo
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onLogoSelected} hidden />
                  </label>

                  <small className="hint">JPG, PNG ou WEBP — jusqu'à 5 Mo. Utilisé sur la carte de membre et l'en-tête.</small>
                </div>
              </div>

              <button type="submit" className="btn-gold" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>

              {lastUpdatedBy && (
                <p className="settings-last-update text-faint mono">
                  Dernière modification par&nbsp;: {lastUpdatedBy} — le {formatDateTime(lastUpdatedAt)}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </AppShell>
  )
}
