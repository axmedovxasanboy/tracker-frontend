import type { AnalyticsFlow } from '../../types/analytics'

/**
 * The owner's open questions from ANALYTICS-SPEC.md §13, each answered in ONE place.
 * A different answer is a one-line change here (the page's name is the one line
 * `shell.nav.analytics` in `i18n/en.analytics.ts` and `uz.analytics.ts`).
 */

/**
 * Whether a donation counts inside "Saved". The owner's answer (2026-09-30): no — a donation is
 * "Given". So "Saved" excludes donations everywhere on the page, "Given" is its own segment in
 * "Where it went", and the tile that lists both is titled "Set aside". History follows the same
 * rule (pages/History.tsx), so the word shows the same figure on both pages.
 */
export const DONATION_COUNTS_AS_SAVED: boolean = false

/** The blunt line under the hero: "Without the bonus this month would be … short." */
export const SHOW_WITHOUT_BONUS_LINE: boolean = true

/** "Saved" and "Given" as the page shows them, under the decision above. */
export function savedAndGiven(f: Pick<AnalyticsFlow, 'saved' | 'savedDonation'>): { saved: number; given: number } {
  return DONATION_COUNTS_AS_SAVED
    ? { saved: f.saved, given: 0 }
    : { saved: f.saved - f.savedDonation, given: f.savedDonation }
}
