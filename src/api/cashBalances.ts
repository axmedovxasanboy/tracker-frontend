import { apiClient } from './client'
import type { CashBalanceRequest, CashBalanceResponse, CashNowRequest } from '../types'

export const cashBalancesApi = {
  getAll: () => apiClient.get<CashBalanceResponse[]>('/cash-balances'),
  upsert: (d: CashBalanceRequest) =>
    apiClient.post<CashBalanceResponse>('/cash-balances', d),
  /** Set the cash held now; the server books the difference (everyday spending or found money). */
  setCurrent: (d: CashNowRequest) =>
    apiClient.post<CashBalanceResponse>('/cash-balances/current', d),
}
