import { apiClient } from './client'
import type { CashBalanceRequest, CashBalanceResponse } from '../types'

export const cashBalancesApi = {
  getAll: () => apiClient.get<CashBalanceResponse[]>('/cash-balances'),
  upsert: (d: CashBalanceRequest) =>
    apiClient.post<CashBalanceResponse>('/cash-balances', d),
  delete: (id: number) => apiClient.delete(`/cash-balances/${id}`),
}
