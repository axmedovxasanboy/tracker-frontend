import { shiftMonth } from '../../utils/format'

/**
 * A savings goal's plan, worked out the same way wherever it is shown — the goal form's hint and
 * the Savings page's cards — so the two can never disagree.
 *
 * This month counts as the first month to pay: it is the one "Savings this month" asks for.
 */

/** Whole months from `a` to `b` (both YYYY-MM); negative when `b` is earlier. */
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by * 12 + bm) - (ay * 12 + am)
}

/** The last day of a YYYY-MM month, as YYYY-MM-DD — how a deadline month is stored. */
export function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

/** Up to the next 10.000 — the step a monthly amount is suggested in. */
function ceilTo10k(n: number): number {
  return Math.ceil(n / 10_000) * 10_000
}

export interface GoalPlan {
  /** What each month from this one to the deadline month asks for; null without a deadline. */
  needed: number | null
  /** The month (YYYY-MM) `monthly` reaches the target in; null when it never does. */
  reach: string | null
  /** The deadline month (YYYY-MM), if there is one. */
  deadlineMonth: string | null
  /** Paying `monthly`, the goal is reached after its deadline. */
  late: boolean
}

/**
 * @param remaining what is still missing (target minus what is already there), never negative
 * @param monthly   what the owner puts in each month; 0 when not set
 * @param deadline  YYYY-MM or YYYY-MM-DD; null without one
 * @param month     this month, YYYY-MM
 */
export function goalPlan(remaining: number, monthly: number, deadline: string | null, month: string): GoalPlan {
  const deadlineMonth = deadline ? deadline.slice(0, 7) : null
  // A deadline already behind us leaves this month to find the rest.
  const monthsLeft = deadlineMonth ? Math.max(1, monthsBetween(month, deadlineMonth) + 1) : null
  const needed = monthsLeft != null && remaining > 0 ? ceilTo10k(remaining / monthsLeft) : null
  const reach = remaining > 0 && monthly > 0 ? shiftMonth(month, Math.ceil(remaining / monthly) - 1) : null
  return { needed, reach, deadlineMonth, late: !!deadlineMonth && !!reach && reach > deadlineMonth }
}
