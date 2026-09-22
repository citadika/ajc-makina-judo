import { apiClient } from './client'
import type { ActivityLogEntry } from '../types/activityLog'

const API_URL = '/api/activity-log'

export const activityLogApi = {
  getRecent() {
    return apiClient.get<ActivityLogEntry[]>(API_URL)
  },
}
