import type { AnalyticsFlow } from '../../types/analytics'

/**
 * The owner's open questions from ANALYTICS-SPEC.md §13, each answered in ONE place.
 * A different answer is a one-line change here (the page's name is the one line
 * `shell.nav.analytics` in `i18n/en.analytics.ts` and `uz.analytics.ts`).
 */

/**
 * A donation counts inside "Saved", as it does on History. Set to `false` and donations leave
 * "Saved" everywhere on the page and become their own "Given" segment in "Where it went".
 */
export const DONATION_COUNTS_AS_SAVED: boolean = true

/** The blunt line under the hero: "Without the bonus this month would be … short." */
export const SHOW_WITHOUT_BONUS_LINE: boolean = true

/** "Saved" and "Given" as the page shows them, under the decision above. */
export function savedAndGiven(f: Pick<AnalyticsFlow, 'saved' | 'savedDonation'>): { saved: number; given: number } {
  return DONATION_COUNTS_AS_SAVED
    ? { saved: f.saved, given: 0 }
    : { saved: f.saved - f.savedDonation, given: f.savedDonation }
}
