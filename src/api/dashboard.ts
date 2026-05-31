import { apiClient } from './client'
import type { Currency, DashboardSummary, MonthlyData, CategoryBreakdown, TransactionType } from '../types'

export const dashboardApi = {
  getSummary: (currency: Currency) =>
    apiClient.get<DashboardSummary>('/dashboard/summary', { params: { currency } }),

  getMonthly: (currency: Currency, year: number) =>
    apiClient.get<MonthlyData[]>('/dashboard/monthly', { params: { currency, year } }),

  getCategoryBreakdown: (
    type: TransactionType,
    currency: Currency,
    year?: number,
    month?: number,
  ) =>
    apiClient.get<CategoryBreakdown[]>('/dashboard/category-breakdown', {
      params: { type, currency, year, month },
    }),
}
