/**
 * `GET /profile` — the owner's level and savings rule, worked out from their monthly income.
 * Money is UZS, as numbers; months are YYYY-MM.
 */
import type { Bucket } from './index'

/** Why this month's percentages are what they are. */
export type ProfileReason =
  | 'NO_DEBT' | 'BANK_LOAN_COMFORTABLE' | 'BANK_LOAN_TIGHT' | 'DEBTS_COMFORTABLE' | 'DEBTS_TIGHT'
  | 'BANK_AND_DEBTS' | 'HEAVY_DEBT' | 'CUSTOM' | 'NO_RULE'

export interface ProfileBucket {
  bucket: Bucket
  /** 0 = not asked for this month. */
  percent: number
  amount: number
  /** The same percent of a month without a bonus. */
  normalMonthAmount: number
}

export interface ProfileNextMonth {
  month: string
  reason: ProfileReason
  loanPayments: number
  leftForSavings: number
  buckets: { bucket: Bucket; percent: number; normalMonthAmount: number }[]
}

export interface ProfileResponse {
  username: string
  month: string
  missingStableIncome: boolean
  /** 1..6 — the 15.000.000 steps of what is left after bills; null when there is none. */
  level: number | null
  aboveCeiling: boolean
  /** Where this level starts, in left-after-bills. */
  levelFrom: number | null
  /** Where the next one starts; null at the top. */
  nextLevelAt: number | null
  stableIncome: number | null
  monthlyBills: number
  leftAfterBills: number
  loanPayments: number
  leftForSavings: number
  bonusThisMonth: number
  savingsBase: number
  /** Null while the monthly income is unset. */
  rule: { reason: ProfileReason; cutoff: number | null } | null
  /** Always the three, in this order: DONATION, EMERGENCY, INVESTMENTS. */
  buckets: ProfileBucket[]
  totalPercent: number
  totalAmount: number
  normalMonthTotal: number
  nextMonth: ProfileNextMonth | null
}
