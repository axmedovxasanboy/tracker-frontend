/**
 * Types for the 2026-09 rebuild's shell screens (History, Wallets, Loans & bills, Settings).
 * The API shapes themselves live in `./index`; these are the screens' own derived views.
 */
import type {
  BankLoanResponse, Currency, DebtResponse, LoanGivenResponse, LoanTakenResponse,
  MonthlyPaymentResponse, Transaction,
} from './index'

/**
 * One calendar month of transactions, fetched whole (every page), so a screen's totals and the
 * list under them are built from the same rows and can never disagree.
 */
export interface MonthTransactions {
  /** YYYY-MM the rows belong to — lets a screen tell the month it asked for from a stale one. */
  month: string
  rows: Transaction[]
}

/**
 * Where a transaction's money counts on History.
 * - `in`       — money earned (salary, other income)
 * - `borrowed` — money borrowed: it arrived, but it is not income
 * - `out`      — money spent (including loan payments)
 * - `lent`     — money lent: it left, but it is not spent
 * - `surplus`  — a wallet check found more than recorded: taken back off `out`, the same way a
 *                check that found less adds to it
 * - `saved`    — money put into donation, emergency fund or investments
 * - `skip`     — moves between your own wallets, money returned to you
 */
export type MoneyFlow = 'in' | 'borrowed' | 'out' | 'lent' | 'surplus' | 'saved' | 'skip'

/** A loan the owner is paying back, whichever record it lives in. */
export type Obligation =
  | ObligationBase & { kind: 'bank'; record: BankLoanResponse }
  | ObligationBase & { kind: 'taken'; record: LoanTakenResponse }
  | ObligationBase & { kind: 'debt'; record: DebtResponse }

export interface ObligationBase {
  /** Stable React key: kind + id. */
  key: string
  id: number
  name: string
  currency: Currency
  /** What one month costs; null when the record does not say (an old bank loan). */
  monthly: number | null
  /** Still to pay back; null when it cannot be known. */
  remaining: number | null
  /** True when `remaining` is worked out from the end date rather than recorded. */
  remainingEstimated: boolean
  /** Paid in full (or, for a bank loan, past its end date). */
  paidOff: boolean
  /** Already paid in full for this calendar month. */
  paidThisMonth: boolean
  /**
   * When the next payment falls, as YYYY-MM. `first` marks a loan whose payments have not
   * started yet. Null once the loan is paid off.
   */
  next: { month: string; first: boolean } | null
}

/** Money the owner lent and is waiting to get back. */
export interface Receivable {
  record: LoanGivenResponse
  returned: boolean
}

/** A bill row, with what the Home advisor says about this month. */
export interface BillRow {
  record: MonthlyPaymentResponse
  /** null = not known (the advisor has no answer, e.g. before the monthly income is set). */
  paidThisMonth: boolean | null
  /** Still to pay this month, per the advisor; null when paid or not known. */
  left: number | null
}
