import { apiClient } from './client'
import type {
  BalanceTransferRequest,
  Currency,
  ExchangeRequest,
  PageResponse,
  Transaction,
  TransactionFilters,
  TransactionRequest,
  TransactionType,
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

  getById: (id: number) =>
    apiClient.get<Transaction>(`/transactions/${id}`),

  create: (data: TransactionRequest) =>
    apiClient.post<Transaction>('/transactions', data),

  update: (id: number, data: TransactionRequest) =>
    apiClient.put<Transaction>(`/transactions/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/transactions/${id}`),

  getRecent: (currency: Currency, type?: TransactionType) => {
    const params: Record<string, unknown> = {
      page: 0, size: 8, sortBy: 'transactionDate', sortDir: 'desc',
      excludeTransfers: true,
    }
    if (currency) params.currency = currency
    if (type) params.type = type
    return apiClient.get<PageResponse<Transaction>>('/transactions', { params })
  },

  getSuggestions: (q: string, categoryId?: number) =>
    apiClient.get<string[]>('/transactions/suggestions', { params: { q, categoryId } }),

  getPlaceSuggestions: (categoryId?: number, q?: string) =>
    apiClient.get<string[]>('/transactions/places', {
      params: { categoryId, q: q ?? '' },
    }),

  transfer: (data: BalanceTransferRequest) =>
    apiClient.post<Transaction[]>('/transactions/transfer', data),

  exchange: (data: ExchangeRequest) =>
    apiClient.post<Transaction[]>('/transactions/exchange', data),
}
