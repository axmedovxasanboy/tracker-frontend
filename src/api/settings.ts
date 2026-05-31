import { apiClient } from './client'
import type { SettingsRequest, SettingsResponse } from '../types'

const base = '/settings'

export const settingsApi = {
  get: () => apiClient.get<SettingsResponse>(base),
  update: (req: SettingsRequest) => apiClient.put<SettingsResponse>(base, req),
}
