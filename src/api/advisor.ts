import { apiClient } from './client'
import type { AdvisorResponse } from '../types'

export const advisorApi = {
  /** The advisor for `date` — the owner's local day, YYYY-MM-DD. */
  get: (date: string) =>
    apiClient.get<AdvisorResponse>('/advisor', { params: { date } }),
}
