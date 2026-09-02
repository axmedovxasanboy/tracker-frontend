import { apiClient } from './client'
import type {
  AllocationPreviewRequest, AllocationPreviewResponse,
  AllocationLedgerResponse, AllocationRulesView,
  Bucket, BucketPayment, Currency, LevelConfigRequest,
  OverviewIncomeResponse, OverviewTierResponse,
} from '../types'

const base = '/overview'

export const overviewApi = {
  getIncome: (month: string, currency: Currency) =>
    apiClient.get<OverviewIncomeResponse>(`${base}/income`, { params: { month, currency } }),
  getTier: (month: string, currency: Currency) =>
    apiClient.get<OverviewTierResponse>(`${base}/tier`, { params: { month, currency } }),
  getAllocationLedger: (month: string, currency: Currency) =>
    apiClient.get<AllocationLedgerResponse>(`${base}/allocation-ledger`, { params: { month, currency } }),
  getBucketPayments: (bucket: Bucket, month: string, currency: Currency) =>
    apiClient.get<BucketPayment[]>(`${base}/bucket/${bucket}/payments`, { params: { month, currency } }),
  getAllocationRules: () =>
    apiClient.get<AllocationRulesView>(`${base}/allocation-rules`),
  saveLevelConfig: (req: LevelConfigRequest) =>
    apiClient.put<AllocationRulesView>(`${base}/level-config`, req),

  /** Read-only: what would this draft transaction do to the allocation? */
  previewAllocation: (req: AllocationPreviewRequest, currency: string) =>
    apiClient.post<AllocationPreviewResponse>(
      `/overview/allocation-preview?currency=${currency}`, req, { _silent: true } as never),
}
