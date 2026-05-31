import { apiClient } from './client'
import type {
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
}
