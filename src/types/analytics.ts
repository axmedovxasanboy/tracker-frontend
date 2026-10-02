/**
 * `GET /analytics?from=YYYY-MM&to=YYYY-MM&date=YYYY-MM-DD` — what happened to the owner's money in
 * a range of whole months. Written from ANALYTICS-SPEC.md §11.4, field for field; this is the one
 * file to touch when the server's shape and the spec disagree.
 *
 * Money is UZS, as numbers. Months are YYYY-MM, dates YYYY-MM-DD. The server classifies every
 * row (§11.3); nothing here is worked out from raw transactions in the browser.
 */

/**
 * One period's money, by what it counted as. The same object for the whole range (`totals`), the
 * range before it (`previous`) and each month (`months[]`).
 *
 * Identities the server guarantees:
 *   earned   = earnedPay + earnedBonus + earnedOther
 *   out      = everyday + bills + loanPayments
 *   saved    = savedDonation + savedEmergency + savedInvestments + savedGoals
 *   leftOver = earned − out − saved
 */
export interface AnalyticsFlow {
  /** Real income. Shown as "In". */
  earned: number
  /** The salary tree's part (salary, advance), bonus excluded. */
  earnedPay: number
  earnedBonus: number
  earnedOther: number
  /** Everyday spending, net of wallet-check corrections. Negative only in a near-empty month. */
  everyday: number
  /** The part of `everyday` that wallet checks found — no details behind it. */
  everydayUnitemised: number
  /** Bills paid through Pay. */
  bills: number
  /** Bank instalments and repayments of borrowed money. */
  loanPayments: number
  /** everyday + bills + loanPayments. Shown as "Out". */
  out: number
  /** Money put into donation, the emergency fund, investments and goals. Shown as "Saved". */
  saved: number
  savedDonation: number
  savedEmergency: number
  savedInvestments: number
  savedGoals: number
  /** earned − out − saved. May be negative. */
  leftOver: number
  borrowed: number
  lent: number
  /** Money lent earlier and paid back in the period. */
  returned: number
  /** Money taken out of an investment, a goal or the emergency fund. */
  fromSavings: number
  /**
   * Pay that crossed the period's edge (2026-10-02): + what reached the wallets in the period but is
   * another month's salary, − what counts in the period but reached the wallets outside it. Absent
   * from a server older than that.
   */
  payForOtherMonths?: number
  /** leftOver + borrowed − lent + returned + fromSavings + payForOtherMonths: what the wallets actually did. */
  walletChange: number
  /** Counted rows (moves between the owner's own wallets excluded). */
  count: number
}

export interface AnalyticsMonth extends AnalyticsFlow {
  month: string
  /** The month had ended before `date`. */
  complete: boolean
  /** Days counted in it: the whole month when complete, else the day-of-month of `date`. */
  days: number
}

export type AnalyticsIncomeKind = 'PAY' | 'BONUS' | 'OTHER'

/** Earned income by the row's own category, largest first. */
export interface AnalyticsIncomeLine {
  categoryId: number | null
  name: string
  nameUz: string | null
  kind: AnalyticsIncomeKind
  amount: number
}

export interface AnalyticsCategoryChild {
  categoryId: number
  name: string
  nameUz: string | null
  amount: number
  count: number
}

/** Itemised everyday spending under one top-level category. */
export interface AnalyticsCategory {
  /** Null for rows with no category. */
  categoryId: number | null
  name: string
  nameUz: string | null
  color: string | null
  amount: number
  count: number
  /** The same category in `previous`; null when there is no previous period. */
  previousAmount: number | null
  /** Sub-categories with itemised rows, largest first. May be empty (or absent). */
  children?: AnalyticsCategoryChild[]
}

/** One calendar day of everyday spending. Single-month requests only. */
export interface AnalyticsDay {
  date: string
  /** That day's everyday spending: itemised + not itemised − corrections. */
  amount: number
  /** The not-itemised part of `amount`. */
  unitemised: number
  /** Running total from the 1st. */
  cumulative: number
}

export interface AnalyticsPreviousDay {
  /** Day of the previous month, 1..its last day. */
  day: number
  cumulative: number
}

export interface AnalyticsBiggestDay {
  date: string
  /** Itemised everyday spending that day. */
  amount: number
  topDescription: string | null
}

/** One itemised everyday purchase. */
export interface AnalyticsPurchase {
  id: number
  date: string
  description: string | null
  amount: number
  categoryId: number | null
  categoryName: string | null
  categoryNameUz: string | null
  color: string | null
}

export interface AnalyticsEveryday {
  /** = totals.everyday */
  total: number
  /** Σ months[].days */
  days: number
  /** total ÷ days; null when days = 0. */
  perDay: number | null
  /** = totals.everydayUnitemised */
  unitemised: number
  /** All top-level categories, largest first. Σ amount + unitemised = total. */
  categories: AnalyticsCategory[]
  /** Every day from the 1st to min(month end, date). Empty unless from = to. */
  daily: AnalyticsDay[]
  /** The month before, day by day. Null unless from = to and that month has counted rows. */
  previousDaily: AnalyticsPreviousDay[] | null
  /** Top three days by itemised spending. Empty unless from = to. */
  biggestDays?: AnalyticsBiggestDay[]
  /** Top five itemised rows of the range. */
  biggest?: AnalyticsPurchase[]
}

/** A bill paid in the range, grouped by the bill. */
export interface AnalyticsBillLine {
  refId: number | null
  name: string
  paid: number
  count: number
}

/** BANK: a bank loan · LOAN: money borrowed from a person · DEBT: a debt. As `/advisor`'s upcoming. */
export type AnalyticsLoanKind = 'BANK' | 'LOAN' | 'DEBT'

/** Loan payments in the range, grouped by the loan paid. */
export interface AnalyticsLoanLine {
  kind: AnalyticsLoanKind
  refId: number | null
  name: string
  /** Repaid as fast as possible (always true for a debt, false for a bank loan). */
  asap: boolean
  paid: number
}

export type AnalyticsSavingKind = 'DONATION' | 'EMERGENCY' | 'INVESTMENTS' | 'GOAL'

export interface AnalyticsSavingLine {
  kind: AnalyticsSavingKind
  /** GOAL: the goal's investment id. */
  refId: number | null
  /** GOAL: the goal's name. */
  name: string | null
  saved: number
  /**
   * What the month asked for — its target plus what was carried into it. Only for a single-month
   * request; null when nothing was asked and for every multi-month range.
   */
  asked: number | null
}

/** A loan not yet paid off. */
export interface AnalyticsPositionLoan {
  kind: AnalyticsLoanKind
  refId: number | null
  name: string
  asap: boolean
  original: number
  /** Still to repay. Null when it cannot be known (a bank loan with no end date). */
  left: number | null
  /** The monthly payment; null for a loan repaid as fast as possible. */
  monthly: number | null
  /** YYYY-MM the last payment falls in; null when it cannot be known. */
  paidOffBy: string | null
}

/** What the owner owns and owes today. */
export interface AnalyticsPosition {
  asOf: string
  wallets: number
  emergencyFund: number
  investments: number
  goals: number
  /** wallets + emergencyFund + investments + goals */
  own: number
  /** Largest `left` first, unknown last. */
  loans: AnalyticsPositionLoan[]
  /** Σ of the known `left`. */
  loansLeft: number
  owedToYou: number
  /** own − loansLeft */
  net: number
}

/** A month-end picture of `position`. Not drawn yet — typed so a later tile needs no new shape. */
export interface AnalyticsPositionSnapshot {
  month: string
  wallets: number
  emergencyFund: number
  investments: number
  goals: number
  loansLeft: number
  owedToYou: number
}

export interface AnalyticsResponse {
  currency: string
  /** The owner's day the answer is for. */
  date: string
  from: string
  to: string
  /** Earliest month with any counted row; null when there is none. */
  firstMonth: string | null
  /** Months from `firstMonth` to the month of `date` with at least one counted row. */
  monthsWithData: number
  /** Settings' monthly income; null when unset. */
  stableIncome: number | null
  /** Rows dated inside the range but after `date` — not counted anywhere above. */
  notYetCount: number
  totals: AnalyticsFlow
  /** The same number of months immediately before `from`; null when that range is empty. */
  previous: AnalyticsFlow | null
  /** One per month of the range, oldest first; months before `firstMonth` are left out. */
  months: AnalyticsMonth[]
  income: AnalyticsIncomeLine[]
  everyday: AnalyticsEveryday
  bills: AnalyticsBillLine[]
  loanPayments: AnalyticsLoanLine[]
  savings: AnalyticsSavingLine[]
  /** Null unless `to` is the month of `date`. */
  position: AnalyticsPosition | null
  /** Month snapshots, oldest first. Optional; may be empty. */
  positionHistory?: AnalyticsPositionSnapshot[]
}
