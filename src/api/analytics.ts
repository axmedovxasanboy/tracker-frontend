import { apiClient } from './client'
import type { AnalyticsResponse } from '../types/analytics'
import type { RawBreakdown } from '../types/analyticsBreakdown'

export const analyticsApi = {
  /**
   * What happened between two months, inclusive (`from`, `to`: YYYY-MM), as of `date` — the
   * owner's local day, YYYY-MM-DD, since the server's clock is UTC.
   *
   * The V1 endpoint. Nothing on the web reads it any more; it stays until the server removes it
   * (ANALYTICS-V2-SPEC.md §4.5), together with `types/analytics.ts`.
   */
  get: (from: string, to: string, date: string) =>
    apiClient.get<AnalyticsResponse>('/analytics', { params: { from, to, date } }),

  /**
   * Analytics V2: one month (`from` = `to`) or a range, as of `date`. Read it through
   * `withBreakdownDefaults` — the server may be older or newer than this page. A server from
   * before V2 has no such route: it answers 401 even to a fresh token (its error dispatch runs
   * unauthenticated), or 404 once that is fixed — `_mayBeMissing` keeps the session either way.
   */
  breakdown: (from: string, to: string, date: string) =>
    apiClient.get<RawBreakdown>('/analytics/breakdown', { params: { from, to, date }, _mayBeMissing: true }),
}
