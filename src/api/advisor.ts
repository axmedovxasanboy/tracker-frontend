import { apiClient } from './client'
import type { AdvisorResponse } from '../types'

export const advisorApi = {
  /**
   * The advisor for `date` — the owner's local day, YYYY-MM-DD.
   *
   * `silent` keeps a failure out of the global error toast, for a page that only borrows a figure
   * from the advisor and says so inline (the client's `_silent`, as in `auth.ts`).
   */
  get: (date: string, opts: { silent?: boolean } = {}) =>
    apiClient.get<AdvisorResponse>('/advisor', { params: { date }, _silent: opts.silent }),
}
