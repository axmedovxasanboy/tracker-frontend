/**
 * The owner's switches for Analytics (ANALYTICS-V2-SPEC.md §5.3 and §7), each answered in ONE
 * place. A different answer is a one-line change here.
 *
 * The page names are not here: they are i18n keys (`analytics.nav.*` in `i18n/en.analytics.ts`
 * and `uz.analytics.ts`), so renaming a tab — "Set aside" to "Savings" (Q3) — is two strings and
 * touches no other screen's words.
 */

/**
 * Q1 — whether Expected In counts the average bonus. The owner's rule ("the average of all
 * previous months") says yes, so it does, with "(incl. … bonus)" on In and Left over whenever the
 * bonus is a large part of it. False takes `expected.flow.earnedBonus` off Expected In and
 * Expected Left over on Totals and In, and drops the note; the Bonus source row keeps its own.
 */
export const EXPECTED_IN_COUNTS_BONUS: boolean = true

/** From this share of Expected In, the In and Left over rows say "(incl. … bonus)" (§1.2). */
export const BONUS_NOTE_SHARE = 0.25

/** How many Out rows are listed before the rest fold into "Smaller (n)" (§3.3). */
export const OUT_ROWS_BEFORE_SMALLER = 8
