/**
 * Construction des URLs publiques de fichiers statiques
 * (photos des membres, logo du club) servis par le backend sous
 * /uploads/... — porté depuis MemberService.normalizePhoto() /
 * SettingsService.getLogoUrl() (Angular).
 *
 * BACKEND_URL reste volontairement vide ('') : comme
 * `environment.backendUrl` côté Angular, les URLs générées sont
 * relatives ("/uploads/members/xxx.jpg") et passent donc par le
 * proxy Vite vers le backend — jamais d'URL absolue codée en dur.
 */
const BACKEND_URL = ''

function encodePath(value: string): string {
  return value
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
}

function normalize(value: string | null | undefined, subfolder: 'members' | 'settings'): string {
  if (!value) {
    return ''
  }

  let raw = String(value).trim()

  if (!raw) {
    return ''
  }

  if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw
  }

  raw = raw.replace(/\\/g, '/').replace(/^\/+/, '')

  const uploadsMarker = `uploads/${subfolder}/`
  const uploadsIndex = raw.indexOf(uploadsMarker)

  if (uploadsIndex !== -1) {
    const fileName = raw.substring(uploadsIndex + uploadsMarker.length)
    if (!fileName) return ''
    return `${BACKEND_URL}/uploads/${subfolder}/${encodePath(fileName)}`
  }

  const subfolderMarker = `${subfolder}/`
  if (raw.startsWith(subfolderMarker)) {
    const fileName = raw.substring(subfolderMarker.length)
    return `${BACKEND_URL}/uploads/${subfolder}/${encodePath(fileName)}`
  }

  const fileName = raw.split('/').pop()
  if (!fileName) return ''

  return `${BACKEND_URL}/uploads/${subfolder}/${encodeURIComponent(fileName)}`
}

export function getMemberPhotoUrl(photo?: string | null): string {
  return normalize(photo, 'members')
}

export function getSettingsLogoUrl(logoPath?: string | null): string {
  return normalize(logoPath, 'settings')
}
