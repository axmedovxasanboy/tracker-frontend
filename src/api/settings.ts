import { apiClient } from './client'
import type { SettingsRequest, SettingsResponse } from '../types'

const base = '/settings'

export const settingsApi = {
  get: () => apiClient.get<SettingsResponse>(base),
  update: (req: SettingsRequest) => apiClient.put<SettingsResponse>(base, req),
  // DANGER ZONE — factory reset. Wipes all data + the account; the password is re-verified
  // server-side. On success the caller's tokens are dead, so log out → signup.
  reset: (password: string) => apiClient.post<void>(`${base}/reset`, { password }),
}
