import { apiClient } from './client'
import type {
  Currency,
  MonthSummaryResponse,
  MonthClosePreviewResponse,
  MonthCloseRequest,
  MonthCloseResponse,
  WalletCheckInRequest,
  WalletCheckInResult,
  WalletCheckInStatus,
} from '../types'

const base = '/months'

export const monthsApi = {
  /** The earned / tagged / spent / left envelope view for a month. */
  getSummary: (month: string, currency: Currency) =>
    apiClient.get<MonthSummaryResponse>(`${base}/summary`, { params: { month, currency } }),
  /** Per-wallet computed balances to reconcile against + the month's figures. */
  getPreview: (month: string, currency: Currency) =>
    apiClient.get<MonthClosePreviewResponse>(`${base}/preview`, { params: { month, currency } }),
  /** Commit a permanent month close. */
  close: (req: MonthCloseRequest) =>
    apiClient.post<MonthCloseResponse>(`${base}/close`, req),
  /** Whether a wallet check-in can be recorded on `date` (the owner's local day), and the wallets. */
  getCheckIn: (date: string) =>
    apiClient.get<WalletCheckInStatus>(`${base}/checkin`, { params: { date } }),
  /** Record a wallet check-in: books the everyday-spending gaps, closes nothing. */
  checkIn: (req: WalletCheckInRequest) =>
    apiClient.post<WalletCheckInResult>(`${base}/checkin`, req),
  /** Closed-month history, newest first. */
  getClosed: () => apiClient.get<MonthCloseResponse[]>(base),
}
