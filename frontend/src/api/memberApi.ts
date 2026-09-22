import { apiClient } from './client'
import type { CreateMemberRequest, Member, UpdateMemberRequest } from '../types/member'

const API_URL = '/api/members'

function toFormData(request: CreateMemberRequest | UpdateMemberRequest, photoFile?: File | null): FormData {
  const formData = new FormData()

  // IMPORTANT : on ajoute une chaîne JSON brute, PAS un Blob.
  // Un Blob ajouté à FormData sans nom de fichier explicite est
  // automatiquement envoyé par le navigateur avec filename="blob" -
  // le backend (FastAPI, "member: str = Form(...)") le voit alors
  // comme un fichier uploadé plutôt qu'un simple champ texte, et
  // rejette la requête avec "Données invalides." C'est exactement
  // le bug corrigé ici : une chaîne simple est toujours envoyée
  // comme un champ de formulaire classique.
  formData.append('member', JSON.stringify(request))

  if (photoFile) {
    formData.append('photo', photoFile, photoFile.name)
  }

  return formData
}

export const memberApi = {
  getAll() {
    return apiClient.get<Member[]>(API_URL)
  },

  search(keyword: string) {
    return apiClient.get<Member[]>(`${API_URL}/search`, { params: { keyword } })
  },

  getById(id: number) {
    return apiClient.get<Member>(`${API_URL}/${id}`)
  },

  create(request: CreateMemberRequest, photoFile?: File | null) {
    return apiClient.post<Member>(API_URL, toFormData(request, photoFile))
  },

  update(id: number, request: UpdateMemberRequest, photoFile?: File | null) {
    return apiClient.put<Member>(`${API_URL}/${id}`, toFormData(request, photoFile))
  },

  delete(id: number) {
    return apiClient.delete<void>(`${API_URL}/${id}`)
  },
}
