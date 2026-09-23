import { apiClient } from './client'
import type { WalletCheckInRequest, WalletCheckInResult, WalletCheckInStatus } from '../types'

const base = '/months'

export const monthsApi = {
  /** Whether a wallet check-in can be recorded on `date` (the owner's local day), and the wallets. */
  getCheckIn: (date: string) =>
    apiClient.get<WalletCheckInStatus>(`${base}/checkin`, { params: { date } }),
  /** Record a wallet check-in: books the everyday-spending gaps, closes nothing. */
  checkIn: (req: WalletCheckInRequest) =>
    apiClient.post<WalletCheckInResult>(`${base}/checkin`, req),
}
