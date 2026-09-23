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

/** One kind of income this month: a category (or none), by the name it carries. */
export interface ProfileIncomeLine {
  categoryId: number | null
  name: string
  nameUz: string | null
  amount: number
  /** False for income the savings base leaves out (anything but salary, avans and bonus). */
  inBase?: boolean
}

/** What the savings base is made of: salary + avans + bonus received this month. */
export interface ProfileBaseParts {
  salaryReceived: number
  stableIncome: number
  /** The Settings income stands in while this month's salary has not arrived yet. */
  usesStableIncome: boolean
  bonus: number
  /** Salary, avans and bonus lines, largest first. */
  lines: ProfileIncomeLine[]
}

export interface ProfileIncomeThisMonth {
  /** Salary, advances, bonuses — money earned. Borrowed and paid-back money is left out. */
  total: number
  lines: ProfileIncomeLine[]
  /** Borrowed money that arrived this month. */
  excludedBorrowed: number
  /** Money paid back to the owner this month. */
  excludedReturned: number
}

export interface ProfileAllocatedLine {
  bucket: Bucket | 'GOALS'
  amount: number
  /** Null while there is no income this month. */
  percentOfIncome: number | null
  /** Its share of the savings base (salary + avans + bonus). Absent on an older server. */
  percentOfBase?: number | null
  /** What this month asks for; null when nothing is asked. */
  target: number | null
  /** How much more went in than the advice asked. */
  over?: number | null
}

export interface ProfileAllocatedThisMonth {
  total: number
  percentOfIncome: number | null
  /** The total's share of the savings base. Absent on an older server. */
  percentOfBase?: number | null
  lines: ProfileAllocatedLine[]
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
  /** Still sent, but no longer part of the savings base (an older server still builds on them). */
  loanPayments: number
  leftForSavings: number
  bonusThisMonth: number
  /** What the percentages apply to: salary + avans + bonus received this month. */
  savingsBase: number
  /** How `savingsBase` is made up. Absent on an older server. */
  baseParts?: ProfileBaseParts
  /** Null while the monthly income is unset. */
  rule: { reason: ProfileReason; cutoff: number | null } | null
  /** Always the three, in this order: DONATION, EMERGENCY, INVESTMENTS. */
  buckets: ProfileBucket[]
  totalPercent: number
  totalAmount: number
  normalMonthTotal: number
  nextMonth: ProfileNextMonth | null
  /** This month so far. Absent on an older server. */
  incomeThisMonth?: ProfileIncomeThisMonth
  allocatedThisMonth?: ProfileAllocatedThisMonth
}
