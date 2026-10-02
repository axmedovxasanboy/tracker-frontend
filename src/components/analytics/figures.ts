import type { Lang, TKey } from '../../i18n/LanguageContext'
import { formatDate, formatMonth } from '../../utils/format'
import type { AnalyticsBreakdown, BreakdownLine, LineHistory } from '../../types/analyticsBreakdown'
import { BONUS_NOTE_SHARE, EXPECTED_IN_COUNTS_BONUS } from './decisions'

/**
 * Small rules every Analytics V2 page shares: which month a figure belongs to, what is expected
 * of it, how a list is ordered and which of its lines are drawn, and how a line names itself.
 * Nothing here classifies a row — the server does that (§1.4).
 */

// ── Month names ──────────────────────────────────────────────────────────────────────────────

/**
 * A month by its name alone, inside a sentence or a list: "September" / "sentabr" — Uzbek writes
 * month names in lowercase in running text. A line that STARTS with one goes through `capFirst`.
 */
export function monthWord(ym: string, lang: Lang): string {
  const name = formatDate(ym, lang, 'monthName') || ym
  return lang === 'uz' ? name.toLocaleLowerCase('uz') : name
}

/**
 * A month inside "since …" / "-dan" sentences: "September 2026" in English; in Uzbek the
 * lowercase name with no year, because the suffix is glued to it ("sentabrdan", §5.4).
 */
export function monthFrom(ym: string, lang: Lang): string {
  return lang === 'uz' ? monthWord(ym, lang) : formatMonth(ym, lang)
}

/** A day inside a sentence: "2 Oct" / "2 oktabr" — Uzbek keeps the month whole (no "Okt"). */
export function dayWord(date: string, lang: Lang): string {
  if (lang !== 'uz') return formatDate(date, lang, 'dayShort')
  const day = Number(date.slice(8, 10))
  return Number.isFinite(day) && day > 0 ? `${day} ${monthWord(date.slice(0, 7), lang)}` : date
}

/** A line that may begin with a lowercase month ("sentabrdan beri …") starts with a capital. */
export function capFirst(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s
}

/** A chart axis only: "Sep" / "sen" (§5.4 — the one place a month may be shortened). */
export function monthAxis(ym: string, lang: Lang): string {
  const short = formatDate(ym, lang, 'monthShort').replace(/\s*\d{4}$/, '')
  return lang === 'uz' ? short.toLocaleLowerCase('uz') : short
}

/**
 * "September – October 2026" for the range a 12-months answer covers; one month is just itself.
 * A label, not running text: both names are capitalised in Uzbek too ("Sentabr – Oktabr 2026").
 */
export function rangeLabel(first: string, last: string, lang: Lang): string {
  if (first === last) return formatMonth(last, lang)
  const from = first.slice(0, 4) === last.slice(0, 4) ? capFirst(monthWord(first, lang)) : formatMonth(first, lang)
  return `${from} – ${formatMonth(last, lang)}`
}

// ── The month on screen ──────────────────────────────────────────────────────────────────────

/** The month a one-month answer is about is still running (§1.2 "a month in progress"). */
export function isOpenMonth(d: AnalyticsBreakdown): boolean {
  const m = d.months[d.months.length - 1]
  return !!m && !m.complete
}

/** Expected In, with or without the average bonus as the owner decided (Q1, `decisions.ts`). */
export function expectedIn(d: AnalyticsBreakdown): number | null {
  const e = d.expected?.flow
  if (!e) return null
  return EXPECTED_IN_COUNTS_BONUS ? e.earned : e.earned - e.earnedBonus
}

/** Expected Left over, under the same decision. */
export function expectedLeftOver(d: AnalyticsBreakdown): number | null {
  const e = d.expected?.flow
  if (!e) return null
  return EXPECTED_IN_COUNTS_BONUS ? e.leftOver : e.leftOver - e.earnedBonus
}

/**
 * The bonus inside Expected In, when it is big enough to say so: "(incl. 26 M bonus)" on the In
 * and Left over rows (§1.2). Null when it is not counted, or is a small part.
 */
export function bonusInExpected(d: AnalyticsBreakdown): number | null {
  const e = d.expected?.flow
  if (!e || !EXPECTED_IN_COUNTS_BONUS) return null
  const bonus = e.earnedBonus
  return bonus > 0 && e.earned > 0 && bonus >= BONUS_NOTE_SHARE * e.earned ? bonus : null
}

// ── Lines ────────────────────────────────────────────────────────────────────────────────────

export type LineMode = 'month' | 'range'

/**
 * Whether a line earns a row (§3.0): nothing in it and nothing expected (a month) or averaged (a
 * range) means it is skipped — group lines are always sent, at 0, and cost no space.
 */
export function lineDrawn(line: BreakdownLine, mode: LineMode): boolean {
  if (line.amount !== 0) return true
  const reference = mode === 'month' ? line.expected : line.average
  return reference != null && reference !== 0
}

/**
 * The order of a list (§3.2, §3.3): by expected when the month has a base — so a row keeps its
 * place from day to day and month to month — ties by so far; a new line ranks by its so-far
 * amount, and so does a loan already paid off (nothing more is to come from it). Without a base,
 * and over a range, by amount.
 */
export function rankLines(lines: BreakdownLine[], base: boolean, mode: LineMode): BreakdownLine[] {
  const weight = (l: BreakdownLine) =>
    mode === 'month' && base && !l.isNew && !l.closed && l.expected != null ? l.expected : l.amount
  return [...lines].sort((a, b) =>
    weight(b) - weight(a) || b.amount - a.amount || a.name.localeCompare(b.name))
}

type Translate = (key: TKey, vars?: Record<string, string | number>) => string
type CategoryName = (c?: { name: string; nameUz?: string | null } | null) => string

/**
 * What a line is called on screen. Data names come from the data (`nameUz` in Uzbek, else the
 * English name — never a kind label); the server's codes and fixed lines get the page's words.
 */
export function lineLabel(line: BreakdownLine, t: Translate, categoryName: CategoryName, lang: Lang): string {
  if (line.key === 'unitemised' || line.kind === 'NOT_ITEMISED') return t('analytics.b.notItemised')
  if (line.key === 'loans') return t('analytics.group.loans')
  if (line.key === 'uncategorized') return t('analytics.b.uncategorised')
  if (line.key === 'emergency:none') return t('an.emergencyNoAccount')
  // Two more lines the server names in English only (`nameUz` null): a bank installment that
  // matches no bank loan, and stocks bought with no holding behind them.
  if (line.key === 'loan:BANK:?') return t('an.bankLoan')
  if (line.key === 'stocks:none') return t('an.stocksNoAccount')
  if (line.kind === 'GROUP' && line.key.startsWith('group:')) {
    const word = GROUP_WORD[line.key.slice('group:'.length)]
    if (word) return t(word)
  }
  if (line.kind === 'GROUP' && line.flow) {
    const word = MOVED_WORD[line.flow]
    if (word) return t(word)
  }
  if (line.kind === 'CHECK') {
    // A wallet-check day is named by its day: `check:2026-09-15`.
    const day = line.key.startsWith('check:') ? line.key.slice('check:'.length) : ''
    return (day && dayWord(day, lang)) || line.name
  }
  return categoryName(line) || line.name
}

/** The four destinations of Set aside, by the code in their `group:` key. */
export const GROUP_WORD: Partial<Record<string, TKey>> = {
  INVESTMENTS: 'an.group.INVESTMENTS',
  EMERGENCY: 'an.group.EMERGENCY',
  GOALS: 'an.group.GOALS',
  DONATIONS: 'an.group.DONATIONS',
}

/** The four kinds of money that are neither In nor Out, by the server's flow. */
export const MOVED_WORD: Partial<Record<string, TKey>> = {
  BORROWED: 'an.borrowed',
  LENT: 'an.lent',
  RETURNED: 'an.returned',
  FROM_SAVINGS: 'an.fromSavings',
}

// ── Links ────────────────────────────────────────────────────────────────────────────────────

/**
 * A History address for one month's rows: `/history?month=2026-09&categoryId=9`. Every key of
 * the filter is ANDed by History. A day range opens the month the days are in.
 */
export function historyHref(month: string, filter: LineHistory & { search?: string }): string {
  const params = new URLSearchParams()
  params.set('month', filter.from?.slice(0, 7) || month)
  if (filter.categoryId != null) params.set('categoryId', String(filter.categoryId))
  if (filter.investmentId != null) params.set('investmentId', String(filter.investmentId))
  if (filter.flow) params.set('flow', filter.flow)
  if (filter.walletCheck) params.set('walletCheck', '1')
  if (filter.from) params.set('from', filter.from)
  if (filter.to) params.set('to', filter.to)
  if (filter.search) params.set('search', filter.search)
  return `/history?${params.toString()}`
}
