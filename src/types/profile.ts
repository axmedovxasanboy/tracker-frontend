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
  /** Unpaid from earlier months, on top of `amount`. Absent on an older server. */
  carried?: number
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
  /** False for income that is not pay (anything but salary, avans and bonus). */
  inBase?: boolean
}

/**
 * What the savings base is made of: the monthly income from Settings + this month's bonus.
 * Recording salary or avans never moves it. (An older server built it from the salary, avans and
 * bonus received, with `usesStableIncome` false once the salary had arrived.)
 */
export interface ProfileBaseParts {
  salaryReceived: number
  stableIncome: number
  /** Always true now; false only on an older server, once this month's salary had arrived. */
  usesStableIncome: boolean
  bonus: number
  /** The bonus-category lines, possibly none (an older server: salary, avans and bonus lines). */
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
  /** Its share of the savings base (monthly income + bonus). Absent on an older server. */
  percentOfBase?: number | null
  /** What this month asks for; null when nothing is asked. */
  target: number | null
  /** Unpaid from earlier months, on top of `target`. Absent on an older server. */
  carried?: number
  /** How much more went in than the advice (target + carried) asked. */
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
  /** What the percentages apply to: the monthly income from Settings + this month's bonus. */
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
