/**
 * The fields the 2026-09-30 usability fixes ask the server for (UX-FIXES-SPEC.md §3), in one
 * file so a rename is one edit. Every one of them is OPTIONAL where it hangs off an existing
 * type (`types/index.ts`): the backend ships separately, and with a field absent each screen has
 * to behave exactly as it did before the fix — never blank, never throw.
 */

// ── §3.1 — GET /advisor → daily ───────────────────────────────────────────────────────────────

/** SHORT: `shortBy` is set · OVER_PACE: `runsOutOn` is set · OK: neither. */
export type DailyVerdict = 'OK' | 'OVER_PACE' | 'SHORT'

/**
 * Why the pace cannot be kept, for OVER_PACE only.
 * GOALS: without the plans' reservations the pace would hold · SAVINGS: without anything set
 * aside it would · PACE: not even then — the spending itself is more than there is.
 */
export type DailyCause = 'GOALS' | 'SAVINGS' | 'PACE'

/** What §3.1 adds to `AdvisorDaily`. */
export interface AdvisorDailyFix {
  verdict?: DailyVerdict
  cause?: DailyCause | null
  /** `safePerDay` with every goal reservation removed. */
  safePerDayNoGoals?: number
  /** `safePerDay` with nothing set aside at all (the rule's buckets, their carry-over, goals). */
  safePerDayNoSavings?: number
}

/** What §3.1 adds to `AdvisorDailyBreakdown`: the two halves of `savings`. */
export interface AdvisorBreakdownFix {
  /** The rule's buckets and what they carry. */
  setAside?: number
  /** Goals. `setAside + goals = savings`. */
  goals?: number
}

// ── §3.2 — goals: a wish or a plan ────────────────────────────────────────────────────────────

/** PLAN: has a monthly payment and is set aside for · WISH: kept on the list, asks for nothing. */
export type GoalKind = 'PLAN' | 'WISH'

// ── §3.3 — GET /advisor → means, goals ────────────────────────────────────────────────────────

export type MeansVerdict = 'FITS' | 'TIGHT' | 'DOES_NOT_FIT'

/** Does a normal month — one without a bonus — have room for what is asked of it? */
export interface AdvisorMeans {
  income: number
  bills: number
  loanPayments: number
  /** Next month's rule percentages × income. */
  setAside: number
  /** Σ monthly payments of the plans asked for next month. */
  goals: number
  /** income − bills − loanPayments − setAside − goals. May be negative. */
  leftToLive: number
  /** income − bills − loanPayments − setAside. May be negative. */
  roomForGoals: number
  /** The recent pace × 30; null while there is no pace yet. */
  paceMonthly: number | null
  verdict: MeansVerdict
}

export type GoalStatus = 'DONE' | 'DOES_NOT_FIT' | 'BEHIND' | 'ON_TRACK'

/** One savings goal as the advisor sees it. */
export interface AdvisorGoal {
  id: number
  name: string
  kind: GoalKind
  target: number | null
  value: number
  /** The stored monthly payment — kept even for a wish; null when never set. */
  monthly: number | null
  /** YYYY-MM */
  startMonth: string | null
  /** YYYY-MM */
  deadline: string | null
  /** Null for a wish. */
  status: GoalStatus | null
  /** BEHIND only: the monthly payment that would meet the deadline. */
  neededMonthly: number | null
}

// ── §3.4 — GET /advisor → owe ─────────────────────────────────────────────────────────────────

export interface AdvisorOwe {
  /** Σ still to repay on every loan whose amount is known. */
  leftToRepay: number
  /** Loans left out of `leftToRepay` because the amount cannot be known. */
  notCounted: { kind: 'BANK' | 'LOAN' | 'DEBT'; refId: number | null; name: string }[]
  /** The part of `leftToRepay` on loans repaid as fast as possible. */
  toRepayFast: number
  owedToYou: number
}

// ── §3.5 — TransactionResponse.flow ───────────────────────────────────────────────────────────

/** What one row counts as — decided by the server, by the same rule `GET /analytics` uses. */
export type TransactionFlow =
  | 'EARNED' | 'BORROWED' | 'RETURNED' | 'FROM_SAVINGS' | 'CORRECTION'
  | 'LENT' | 'SAVED' | 'GIVEN' | 'LOAN_PAYMENT' | 'BILL' | 'EVERYDAY' | 'TRANSFER'
