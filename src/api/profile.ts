import { apiClient } from './client'
import type { ProfileResponse } from '../types/profile'

export const profileApi = {
  /** The owner's level and savings rule for `date` — their local day, YYYY-MM-DD. */
  get: (date: string) => apiClient.get<ProfileResponse>('/profile', { params: { date } }),
}
