import type { LoanTakenResponse } from '../types'

/**
 * Nasiya (e.g. Uzum Nasiya): borrowed money that is paid in full by a deadline for a small fee, or
 * — once the owner switches it — paid in monthly installments. See NASIYA-SPEC.md (Batch 75).
 */

/** The lender a new nasiya starts on — the one service the owner uses. */
export const NASIYA_DEFAULT_LENDER = 'Uzum Nasiya'
/** The service fee a new nasiya starts on, in percent. */
export const NASIYA_DEFAULT_FEE = 5
/** The term a new nasiya starts on, in days. */
export const NASIYA_DEFAULT_DAYS = 30
/** "Days left" turns amber at this many days or fewer. */
export const NASIYA_SOON_DAYS = 5

/** `date` (YYYY-MM-DD) moved by `days`, as YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

/** Whole days from `today` to `date` (both YYYY-MM-DD); negative once `date` has passed. */
export function daysUntil(date: string, today: string): number {
  const at = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((at(date) - at(today)) / 86_400_000)
}

/** A nasiya still to be paid by its deadline: not switched to installments, not paid off. */
export function isOpenNasiya(l: LoanTakenResponse): boolean {
  return !!l.nasiya && !l.installmentsSince && l.status !== 'PAID' && l.remainingAmount > 0.5 && !!l.dueDate
}

/** A nasiya the owner switched to monthly installments. */
export function isSwitchedNasiya(l: LoanTakenResponse): boolean {
  return !!l.nasiya && !!l.installmentsSince
}

/** What a nasiya costs on top of the money received — the server's figure, else worked out. */
export function nasiyaCost(l: LoanTakenResponse): number {
  if (l.extraCost != null) return Math.max(0, l.extraCost)
  if (l.principalAmount == null) return 0
  return Math.max(0, l.totalAmount - l.principalAmount)
}

/** The total to pay for `received` money at a `feePct` service fee, rounded to the sum. */
export function nasiyaTotal(received: number, feePct: number): number {
  return Math.round(received * (1 + feePct / 100))
}

/** The fee a stored nasiya was taken at, in percent (one decimal); the default when unknown. */
export function nasiyaFeePct(l: LoanTakenResponse): number {
  const principal = l.principalAmount ?? 0
  if (principal <= 0) return NASIYA_DEFAULT_FEE
  return Math.round(((l.totalAmount - principal) / principal) * 1000) / 10
}
