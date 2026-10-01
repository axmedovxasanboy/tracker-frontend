import { apiClient } from './client'
import type { SettingsRequest, SettingsResponse } from '../types'
import { todayLocal } from '../utils/format'

const base = '/settings'

// `date` is the owner's day: the server's clock is UTC, so without it a save made in Tashkent
// before 05:00 on the 1st would count the monthly income as the previous month's.
const day = () => ({ params: { date: todayLocal() } })

export const settingsApi = {
  get: () => apiClient.get<SettingsResponse>(base, day()),
  update: (req: SettingsRequest) => apiClient.put<SettingsResponse>(base, req, day()),
  /** Remove the income change made from `month` (YYYY-MM): that month falls back to the one before. */
  removeStableIncome: (month: string) => apiClient.delete(`${base}/stable-income/${month}`, day()),
  // DANGER ZONE — factory reset. Wipes all data + the account; the password is re-verified
  // server-side. On success the caller's tokens are dead, so log out → signup.
  reset: (password: string) => apiClient.post<void>(`${base}/reset`, { password }),
}
