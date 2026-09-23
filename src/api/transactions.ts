import { apiClient } from './client'
import type {
  BalanceTransferRequest,
  PageResponse,
  Transaction,
  TransactionFilters,
  TransactionRequest,
} from '../types'

export const transactionsApi = {
  getAll: (filters: TransactionFilters) => {
    const params: Record<string, unknown> = {
      page: filters.page,
      size: filters.size,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
    }
    if (filters.type) params.type = filters.type
    if (filters.currency) params.currency = filters.currency
    if (filters.categoryId) params.categoryId = filters.categoryId
    if (filters.cardId) params.cardId = filters.cardId
    if (filters.investmentId) params.investmentId = filters.investmentId
    if (filters.startDate) params.startDate = filters.startDate
    if (filters.endDate) params.endDate = filters.endDate
    if (filters.search) params.search = filters.search
    if (filters.cashOnly) params.cashOnly = true
    if (filters.excludeTransfers) params.excludeTransfers = true
    return apiClient.get<PageResponse<Transaction>>('/transactions', { params })
  },

  create: (data: TransactionRequest) =>
    apiClient.post<Transaction>('/transactions', data),

  update: (id: number, data: TransactionRequest) =>
    apiClient.put<Transaction>(`/transactions/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/transactions/${id}`),

  getSuggestions: (q: string, categoryId?: number) =>
    apiClient.get<string[]>('/transactions/suggestions', { params: { q, categoryId } }),

  transfer: (data: BalanceTransferRequest) =>
    apiClient.post<Transaction[]>('/transactions/transfer', data),
}
