import { apiClient } from './client'
import type { ClubSettings, UpdateSettingsRequest } from '../types/settings'

const API_URL = '/api/settings'

export const settingsApi = {
  get() {
    return apiClient.get<ClubSettings>(API_URL)
  },

  /**
   * PUT /api/settings (multipart/form-data) — même convention que
   * memberApi.update()/create() : une partie "settings" (JSON) et
   * une partie facultative "logo" (fichier).
   */
  update(request: UpdateSettingsRequest, logoFile?: File | null) {
    const formData = new FormData()

    // Chaîne JSON brute, pas un Blob : voir le commentaire
    // équivalent dans memberApi.ts (toFormData) pour le détail —
    // un Blob sans nom de fichier explicite est envoyé par le
    // navigateur comme un fichier ("filename=blob"), que FastAPI
    // rejette pour un champ déclaré "settings: str = Form(...)".
    formData.append('settings', JSON.stringify(request))

    if (logoFile) {
      formData.append('logo', logoFile, logoFile.name)
    }

    return apiClient.put<ClubSettings>(API_URL, formData)
  },
}
