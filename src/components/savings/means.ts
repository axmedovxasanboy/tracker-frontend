import { snap } from '../../utils/format'
import type { TKey } from '../../i18n/LanguageContext'
import type { AdvisorMeans } from '../../types/fixes'

/** A sentence to print: its dictionary key and the AMOUNTS that go in it (the caller formats them). */
export interface MeansLine {
  key: TKey
  amounts: Record<string, number>
  /** A warning (amber) rather than a remark (grey). */
  warn: boolean
}

/**
 * What the Goals tile says about whether a normal month — one without a bonus — has room for the
 * plans. Null when there is nothing to say.
 *
 * `roomForGoals` and `leftToLive` can be zero or NEGATIVE, and not because of the plans: a month
 * can be short after bills, loans and what is set aside before any goal exists. A negative amount
 * is never printed as "left" — each case has its own sentence: something left, nothing left, or
 * already short by so much.
 */
export function meansLine(means: AdvisorMeans | null | undefined): MeansLine | null {
  // Only about plans: with none asked for, the tile has no claim to make.
  if (!means || !(means.goals > 0)) return null
  const room = snap(means.roomForGoals)
  const left = snap(means.leftToLive)

  if (means.verdict === 'DOES_NOT_FIT' || left < 0) {
    if (room > 0) return { key: 'fix.goals.doesNotFit', amounts: { goals: means.goals, room }, warn: true }
    if (room === 0) return { key: 'fix.goals.doesNotFitNone', amounts: { goals: means.goals }, warn: true }
    return { key: 'fix.goals.doesNotFitShort', amounts: { goals: means.goals, amount: -room }, warn: true }
  }
  if (means.verdict === 'TIGHT' && means.paceMonthly != null) {
    return left > 0
      ? { key: 'fix.goals.tight', amounts: { left, pace: means.paceMonthly }, warn: false }
      : { key: 'fix.goals.tightNone', amounts: { pace: means.paceMonthly }, warn: true }
  }
  return null
}

/**
 * The goal form's live warning: would the plans, with this monthly payment, ask more than a normal
 * month has? Null when they fit.
 *
 * `alreadyCounted` is this goal's stored payment when `means.goals` already includes it (editing a
 * plan), so it is not counted twice.
 */
export function planWarning(
  means: AdvisorMeans | null | undefined, monthly: number, alreadyCounted: number,
): MeansLine | null {
  if (!means || !(monthly > 0)) return null
  const room = snap(means.roomForGoals)
  // No room for any plan at all: say that, rather than blame this payment for the whole gap.
  if (room < 0) return { key: 'fix.goal.noRoomShort', amounts: { amount: -room }, warn: true }
  if (room === 0) return { key: 'fix.goal.noRoom', amounts: {}, warn: true }
  const over = snap(means.goals - alreadyCounted + monthly - room)
  return over >= 1 ? { key: 'fix.goal.tooMuch', amounts: { amount: over }, warn: true } : null
}
