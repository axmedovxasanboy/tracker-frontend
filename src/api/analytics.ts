import { apiClient } from './client'
import type { AnalyticsResponse } from '../types/analytics'

export const analyticsApi = {
  /**
   * What happened between two months, inclusive (`from`, `to`: YYYY-MM), as of `date` — the
   * owner's local day, YYYY-MM-DD, since the server's clock is UTC.
   */
  get: (from: string, to: string, date: string) =>
    apiClient.get<AnalyticsResponse>('/analytics', { params: { from, to, date } }),
}
