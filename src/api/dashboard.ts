import { apiClient } from './client'
import type { Currency, DashboardSummary } from '../types'

export const dashboardApi = {
  getSummary: (currency: Currency) =>
    apiClient.get<DashboardSummary>('/dashboard/summary', { params: { currency } }),
}
