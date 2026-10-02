import type { TKey } from '../../i18n/LanguageContext'

/**
 * The six Analytics pages (ANALYTICS-V2-SPEC.md §2.1): one place that knows each page's address
 * and its tab label, read by the navbar, the layout and the links between pages.
 */
export type Section = 'totals' | 'in' | 'out' | 'set-aside' | 'goals' | '12-months'

export const SECTIONS: ReadonlyArray<{ id: Section; path: string; labelKey: TKey }> = [
  { id: 'totals', path: '/analytics', labelKey: 'analytics.nav.totals' },
  { id: 'in', path: '/analytics/in', labelKey: 'analytics.nav.in' },
  { id: 'out', path: '/analytics/out', labelKey: 'analytics.nav.out' },
  { id: 'set-aside', path: '/analytics/set-aside', labelKey: 'analytics.nav.setAside' },
  { id: 'goals', path: '/analytics/goals', labelKey: 'analytics.nav.goals' },
  { id: '12-months', path: '/analytics/12-months', labelKey: 'analytics.nav.year' },
]

export const SECTION_PATH = Object.fromEntries(SECTIONS.map(s => [s.id, s.path])) as Record<Section, string>
export const SECTION_LABEL = Object.fromEntries(SECTIONS.map(s => [s.id, s.labelKey])) as Record<Section, TKey>

/** The page a path names, or null for an address under /analytics that is none of them. */
export function sectionOf(pathname: string): Section | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  return SECTIONS.find(s => s.path === path)?.id ?? null
}

/** `?month=` for any month but the current one, which is the default and is left out (§2.3). */
export function monthSearch(month: string, thisMonth: string): string {
  return month !== thisMonth ? `?month=${month}` : ''
}
