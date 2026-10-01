import { formatNumber, moneyFull } from '../../utils/format'
import type { TKey } from '../../i18n/LanguageContext'
import type { SettingsResponse } from '../../types'
import type { LevelEntry, LevelPercents, LevelRulesVersion, LevelSituation } from '../../types/levels'

/**
 * The pay a month needs for Level 5 (the owner's rule, spec §1.1). The server sends it with the
 * road (`road.payThreshold`); the notice does not, so the dialog and the tile use this.
 */
export const LEVEL5_PAY = 60_000_000

type T = (key: TKey, vars?: Record<string, string | number>) => string

/** The five names the owner reads; the two loan situations each hold two lines. */
export type SituationGroup = 'noDebt' | 'bank' | 'people' | 'both' | 'heavy'

export const GROUP_OF: Record<LevelSituation, SituationGroup> = {
  NO_DEBT: 'noDebt',
  BANK_LOAN_COMFORTABLE: 'bank',
  BANK_LOAN_TIGHT: 'bank',
  DEBTS_COMFORTABLE: 'people',
  DEBTS_TIGHT: 'people',
  BANK_AND_DEBTS: 'both',
  HEAVY_DEBT: 'heavy',
}

const GROUP_KEY: Record<SituationGroup, TKey> = {
  noDebt: 'lvl.s.noDebt',
  bank: 'lvl.s.bank',
  people: 'lvl.s.people',
  both: 'lvl.s.both',
  heavy: 'lvl.s.heavy',
}

/** The groups in the order the page lists them, each with its situations top to bottom. */
export const GROUPS: ReadonlyArray<{ group: SituationGroup; situations: LevelSituation[] }> = [
  { group: 'noDebt', situations: ['NO_DEBT'] },
  { group: 'bank', situations: ['BANK_LOAN_COMFORTABLE', 'BANK_LOAN_TIGHT'] },
  { group: 'people', situations: ['DEBTS_COMFORTABLE', 'DEBTS_TIGHT'] },
  { group: 'both', situations: ['BANK_AND_DEBTS'] },
  { group: 'heavy', situations: ['HEAVY_DEBT'] },
]

export const groupName = (t: T, group: SituationGroup): string => t(GROUP_KEY[group])

/** "5.000.000 UZS or more left" / "under 5.000.000 UZS left" — null for the unsplit situations. */
export function lineLabel(t: T, s: LevelSituation, cutoff: number | null | undefined): string | null {
  if (s === 'BANK_LOAN_COMFORTABLE' || s === 'DEBTS_COMFORTABLE') {
    return t('lvl.s.more', { cutoff: moneyFull(cutoff ?? 0) })
  }
  if (s === 'BANK_LOAN_TIGHT' || s === 'DEBTS_TIGHT') return t('lvl.s.under', { cutoff: moneyFull(cutoff ?? 0) })
  return null
}

/** The whole name in words: "Bank loan — under 5.000.000 UZS left", "No loans". Never "1.2.1". */
export function situationName(t: T, s: LevelSituation, cutoff: number | null | undefined): string {
  const name = groupName(t, GROUP_OF[s])
  const line = lineLabel(t, s, cutoff)
  return line ? t('lvl.s.withLine', { name, line }) : name
}

/** "5", "2,5" — the way the app writes numbers. */
export const pctNumber = (p: number): string => (Number.isInteger(p) ? String(p) : formatNumber(p, 1))

/** One bucket's figure: "5%", or "—" for a bucket that is not asked. */
export const pctCell = (p: number): string => (p > 0 ? `${pctNumber(p)}%` : '—')

/** "5% · 2% · 8%" — donation, emergency, investments. */
export const percentsText = (p: LevelPercents): string =>
  [p.donation, p.emergency, p.investments].map(pctCell).join(' · ')

export const totalOf = (p: LevelPercents): number => p.donation + p.emergency + p.investments

/** The version of a level in force in `month` (YYYY-MM): the latest `from` ≤ it, else the first. */
export function versionAt(entry: LevelEntry, month: string): LevelRulesVersion {
  const sorted = [...entry.versions].sort((a, b) => a.from.localeCompare(b.from))
  let found = sorted[0]
  for (const v of sorted) if (v.from <= month) found = v
  return found
}

/**
 * The monthly income for `month` from the settings already loaded: the change recorded from the
 * latest month ≤ it, the first one before them all, or — on a server without income history — the
 * one income. Null while none is set.
 */
export function incomeFor(settings: SettingsResponse | null, month: string): number | null {
  if (!settings) return null
  const history = [...(settings.stableIncomeHistory ?? [])].sort((a, b) => a.month.localeCompare(b.month))
  if (history.length > 0) {
    let found = history[0]
    for (const e of history) if (e.month <= month) found = e
    return found.amount
  }
  return settings.monthlyStableIncome ?? null
}

/** Percent × income, per bucket, in whole UZS. */
export function amountsOf(p: LevelPercents, income: number): LevelPercents {
  const of = (x: number) => Math.round((income * x) / 100)
  return { donation: of(p.donation), emergency: of(p.emergency), investments: of(p.investments) }
}

/** "350.000 · 140.000 · 560.000 UZS" — each bucket's amount, the currency once at the end. */
export function amountsText(a: LevelPercents): string {
  const parts = [a.donation, a.emergency, a.investments]
  return parts.map((x, i) => (i === parts.length - 1 ? moneyFull(x) : moneyFull(x).replace(/\s*UZS$/, ''))).join(' · ')
}
