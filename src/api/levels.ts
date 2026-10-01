import { apiClient } from './client'
import type { LevelNotice, LevelRulesRequest, LevelsResponse } from '../types/levels'
import { todayLocal } from '../utils/format'

export const levelsApi = {
  /** Everything the Savings rules page needs, for the owner's `date` (YYYY-MM-DD). */
  get: (date: string, opts: { silent?: boolean } = {}) =>
    apiClient.get<LevelsResponse>('/levels', { params: { date }, _silent: opts.silent }),
  /** One change to a level's rules, from a month on. Answers with the same body as `get`. */
  saveRules: (level: number, req: LevelRulesRequest) =>
    apiClient.put<LevelsResponse>(`/levels/${level}/rules`, req, { params: { date: todayLocal() } }),
  /** Remove the version that starts in `month` (YYYY-MM); its months fall back to the one before. */
  removeVersion: (level: number, month: string) =>
    apiClient.delete(`/levels/${level}/rules/${month}`, { params: { date: todayLocal() } }),
  /** The oldest level change the web has not shown: 200 with it, or 204 (empty) with none. */
  notice: () =>
    // `date` matters here: the server records a Level 5 change only when asked for the owner's today.
    apiClient.get<LevelNotice | ''>('/levels/notice', { params: { client: 'WEB', date: todayLocal() }, _silent: true }),
  /** Mark a level change as shown on the web; the bot keeps its own mark. */
  seen: (id: number) =>
    apiClient.post(`/levels/notice/${id}/seen`, null, { params: { client: 'WEB' }, _silent: true }),
}
