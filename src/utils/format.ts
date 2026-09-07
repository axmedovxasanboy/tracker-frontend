import { format as dfFormat } from 'date-fns'
import { enUS, uz } from 'date-fns/locale'
import type { Currency } from '../types'
import type { Lang } from '../i18n/LanguageContext'

/**
 * Display rules — dot is the thousands separator, comma is the decimal separator
 * (European / Uzbek convention). UZS never shows decimals.
 *
 * Example: 1000000 + UZS → "1.000.000 UZS"
 *
 * We intentionally do NOT use Intl.NumberFormat — its currency-data tables and
 * locale-specific grouping behaviour vary across browsers/Node versions and have
 * produced visible drift (e.g. 10.000.000 rendering as 9.999.999,99 under some
 * UZS formatters). A hand-rolled formatter is precise and predictable.
 */
const CURRENCY_DECIMALS: Record<Currency, number> = { UZS: 0, USD: 2, EUR: 2 }

/**
 * Snap a JS float to 4-decimal-place precision.
 *
 * Amounts are stored in the database as NUMERIC(19,4); any sub-0.0001 residual
 * is a JS float64 artefact. Rounding to 4 d.p. removes those artefacts without
 * touching meaningful precision.
 */
export function snap(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 10000) / 10000
}

/**
 * Insert dots as thousands separators in an integer string.
 * "1000000" → "1.000.000"
 */
function groupThousands(intStr: string): string {
  const negative = intStr.startsWith('-')
  const digits = negative ? intStr.slice(1) : intStr
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return negative ? `-${grouped}` : grouped
}

/**
 * Format a number with `decimals` fractional digits and dot-grouping.
 * Decimal separator is comma. Example: formatNumber(1234567.5, 2) → "1.234.567,50".
 */
export function formatNumber(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return ''
  const snapped = snap(n)
  const abs = Math.abs(snapped)
  const fixed = abs.toFixed(decimals)
  // Derive the sign from the already-rounded magnitude so a tiny negative that rounds
  // to zero at display precision renders as "0"/"0,00", not "-0"/"-0,00".
  const sign = parseFloat(fixed) > 0 && snapped < 0 ? '-' : ''
  const [intPart, decPart] = fixed.split('.')
  const grouped = groupThousands(intPart)
  return decimals > 0 && decPart
    ? `${sign}${grouped},${decPart}`
    : `${sign}${grouped}`
}


/**
 * Parse a user-typed amount string into a number. Accepts any of:
 *   "1.000.000"     → 1000000
 *   "1.000.000,50"  → 1000000.5
 *   "1000000.50"    → 1000000.5
 *   "1,000,000.50"  → 1000000.5
 *   "1000000"       → 1000000
 * Returns NaN on failure. The logic: if both '.' and ',' appear, the LAST one
 * is the decimal separator; otherwise we decide based on the right-side group
 * length (3 digits → thousands; anything else → decimal).
 */
export function parseAmount(s: string | number | null | undefined): number {
  if (s === null || s === undefined) return NaN
  if (typeof s === 'number') return Number.isFinite(s) ? s : NaN
  let t = String(s).trim()
  if (!t) return NaN
  const negative = t.startsWith('-')
  t = t.replace(/[^\d.,]/g, '')
  if (!t) return NaN

  const dotCount = (t.match(/\./g) ?? []).length
  const commaCount = (t.match(/,/g) ?? []).length

  let decimalIdx = -1
  if (dotCount > 0 && commaCount > 0) {
    // Both kinds present — whichever appears LAST is the decimal separator.
    decimalIdx = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','))
  } else if (dotCount + commaCount === 1) {
    // Single separator — decide by the size of the right-hand group:
    // exactly 3 digits → thousands grouping; anything else → decimal.
    const idx = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','))
    const after = t.length - idx - 1
    if (after !== 3) decimalIdx = idx
  }
  // else: 2+ separators of the same kind → all are thousands groupings; no decimal.

  let intPart: string
  let decPart: string
  if (decimalIdx > -1) {
    intPart = t.slice(0, decimalIdx)
    decPart = t.slice(decimalIdx + 1)
  } else {
    intPart = t
    decPart = ''
  }
  intPart = intPart.replace(/\D/g, '')
  decPart = decPart.replace(/\D/g, '')
  if (!intPart && !decPart) return NaN
  const normalized = `${negative ? '-' : ''}${intPart || '0'}${decPart ? '.' + decPart : ''}`
  const n = Number(normalized)
  return Number.isFinite(n) ? n : NaN
}

/** Options for `money()`. The defaults are the tile case: unit shown, sign only when negative. */
export interface MoneyOpts {
  /**
   * false drops the currency code AND the space before the k/M/B suffix ("29,5M").
   * Chart axis ticks only — everywhere else the unit has to travel with the number.
   */
  unit?: boolean
  /** true forces a leading '+' on positives, for ledger deltas that can go either way. */
  signed?: boolean
}

/** Compact magnitudes, smallest first — the order `compactMagnitude` promotes through. */
const COMPACT_UNITS: ReadonlyArray<readonly [number, string]> = [
  [1_000, 'k'],
  [1_000_000, 'M'],
  [1_000_000_000, 'B'],
]

/**
 * Pick the k/M/B bucket for `amount` and render its magnitude, or null below 1.000
 * where the plain form is already short.
 *
 * The bucket is re-checked AFTER rounding, not before: 999.950 / 1e3 is 999,95, which
 * rounds to 1.000,0 — a figure that belongs in M. Bucketing on the raw value is what
 * printed "1.000,0 k UZS" for every amount just under a boundary.
 */
function compactMagnitude(amount: number): { text: string; suffix: string } | null {
  const abs = Math.abs(amount)
  let idx = -1
  for (let i = 0; i < COMPACT_UNITS.length; i++) {
    if (abs >= COMPACT_UNITS[i][0]) idx = i
  }
  if (idx < 0) return null

  let rounded = Math.round((abs / COMPACT_UNITS[idx][0]) * 10) / 10
  // Promote on overflow. The largest bucket has nowhere to go, so 1e12 stays "1.000 B".
  if (rounded >= 1000 && idx < COMPACT_UNITS.length - 1) {
    idx += 1
    rounded = Math.round((abs / COMPACT_UNITS[idx][0]) * 10) / 10
  }
  // Round FIRST, sign LAST: Math.round(-9999.5) is -9999, so rounding a negative directly
  // would give "-999,9 k" where the positive of the same size gives "1 M".
  const signed = amount < 0 ? -rounded : rounded
  // A whole magnitude reads better without the trailing ",0" — "50 k UZS", not "50,0 k UZS".
  return { text: formatNumber(signed, Number.isInteger(rounded) ? 0 : 1), suffix: COMPACT_UNITS[idx][1] }
}

/**
 * Tiles, heroes, stat cards and chart tooltips: "29,5 M UZS".
 *
 * Compact by definition — thresholds ≥1e9 → B, ≥1e6 → M, ≥1e3 → k, plain below that,
 * one decimal at most. Never use it in a list or a detail row: those want the exact
 * figure from `moneyFull()`. Hang `moneyExact()` off a compact figure as its caption
 * or `title=` so the precise number is always one hover away.
 */
export function money(amount: number, currency: Currency = 'UZS', opts: MoneyOpts = {}): string {
  const { unit = true, signed = false } = opts
  const snapped = snap(amount)
  const compact = compactMagnitude(snapped)

  let text: string
  if (compact) {
    text = unit ? `${compact.text} ${compact.suffix} ${currency}` : `${compact.text}${compact.suffix}`
  } else {
    const plain = formatNumber(snapped, CURRENCY_DECIMALS[currency])
    text = unit ? `${plain} ${currency}` : plain
  }
  return signed && snapped > 0 ? `+${text}` : text
}


/**
 * Lists, detail rows, ExplainModal rows and form summaries: "29.500.000 UZS".
 * UZS never renders a decimal, so no figure ever ends in ",00".
 */
export function moneyFull(amount: number, currency: Currency = 'UZS'): string {
  return `${formatNumber(amount, CURRENCY_DECIMALS[currency])} ${currency}`
}

/**
 * The exact value behind a compact one — a tile's caption, or its `title=`.
 * Identical output to `moneyFull()`; the separate name says why it is there.
 */
export function moneyExact(amount: number, currency: Currency = 'UZS'): string {
  return moneyFull(amount, currency)
}

/**
 * Chart axis ticks: "29,5M". No currency code and no space, because an axis has no room
 * for either and the tile title already names the unit. Recharts' `YAxis` needs
 * `width={44}` to clear the widest of these ("999,9M").
 */
export function moneyAxis(amount: number, currency: Currency = 'UZS'): string {
  return money(amount, currency, { unit: false })
}


/**
 * One date format app-wide. `short` is the default and is what a list row or a detail
 * row should use; the rest exist for the four places that genuinely need something else.
 *
 * `day`, `dayTime` and `datetime` are aliases, kept so every page can migrate without
 * agreeing on a name first.
 */
export type DateStyle =
  | 'short'     // 5 Sep 2026        / 5 Sen 2026
  | 'day'       //   alias of 'short'
  | 'long'      // 5 September 2026  / 5 Sentabr 2026
  | 'month'     // September 2026    / Sentabr 2026
  | 'time'      // 5 Sep 2026, 14:32 / 5 Sen 2026, 14:32
  | 'dayTime'   //   alias of 'time'
  | 'datetime'  //   alias of 'time'
  | 'dayShort'  // 5 Sep             / 5 Sen        — Recent transactions
  | 'clock'     // 14:32                            — CacheBadge, OfflineBanner
  | 'iso'       // 2026-09-05                       — form values, never shown as prose

// 'month' uses LLLL (standalone), not MMMM (formatting/genitive): a bare "Month Year"
// heading is not part of a date phrase, and the two forms diverge in several locales.
const DATE_PATTERNS: Record<DateStyle, string> = {
  short: 'd MMM yyyy',
  day: 'd MMM yyyy',
  long: 'd MMMM yyyy',
  month: 'LLLL yyyy',
  time: 'd MMM yyyy, HH:mm',
  dayTime: 'd MMM yyyy, HH:mm',
  datetime: 'd MMM yyyy, HH:mm',
  dayShort: 'd MMM',
  clock: 'HH:mm',
  iso: 'yyyy-MM-dd',
}

// Named imports, never the `date-fns/locale` barrel — a namespace import would pull all
// ~200 locales into the bundle instead of these two.
const DATE_LOCALES = { en: enUS, uz } as const

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_MONTH = /^(\d{4})-(\d{2})$/

/**
 * Turn any of the shapes the app carries dates in into a Date in the VIEWER's timezone,
 * or null if it is not a date at all.
 *
 * 'YYYY-MM-DD' and 'YYYY-MM' are built from their parts on purpose: `new Date('2026-09-05')`
 * is parsed as UTC midnight per the ECMAScript spec, so the same string renders as the 4th
 * for anyone west of Greenwich. A transaction date is a plain calendar date with no timezone
 * attached, and it has to survive the round trip unchanged.
 */
function toLocalDate(value: string | number | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const fromEpoch = new Date(value)
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch
  }

  const trimmed = value.trim()
  if (!trimmed) return null

  const day = ISO_DAY.exec(trimmed)
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]))

  const month = ISO_MONTH.exec(trimmed)
  if (month) return new Date(Number(month[1]), Number(month[2]) - 1, 1)

  // Anything else is a full timestamp (createdAt, cachedAt) — those carry their own offset.
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * The one date renderer. `lang` comes from `useLang()`; Uzbek month names come from the
 * date-fns `uz` locale, which ships with the package we already depend on.
 *
 * Returns '' for an unparseable input rather than "Invalid Date", so a bad value from the
 * API leaves a blank cell instead of shouting at the user.
 */
export function formatDate(value: string | number | Date, lang: Lang, style: DateStyle = 'short'): string {
  const date = toLocalDate(value)
  if (!date) return ''
  return dfFormat(date, DATE_PATTERNS[style], { locale: DATE_LOCALES[lang] })
}

/**
 * Month heading from the 'YYYY-MM' string the app stores months as:
 * "September 2026" / "Sentabr 2026". Falls back to the raw value so a malformed
 * month leaves the heading readable instead of empty.
 */
export function formatMonth(ym: string, lang: Lang): string {
  return formatDate(ym, lang, 'month') || ym
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Today in the VIEWER's timezone, as the 'YYYY-MM-DD' every date field and API call wants.
 *
 * Replaces `new Date().toISOString().split('T')[0]`, which is UTC: in Uzbekistan (UTC+5)
 * that names YESTERDAY for every form opened before 05:00 local. It is not only a cosmetic
 * prefill — the monthly-envelope model buckets a transaction by its date, so a payment
 * recorded late at night landed in the previous month's allocation.
 */
export function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * The current month in the viewer's timezone, as 'YYYY-MM'. Same reason `toISOString()`
 * is wrong here: on the 1st before 05:00 it names the previous month.
 */
export function monthLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}


/**
 * Pick the singular or plural wording for `n`: plural(2, 'loan', 'loans', 'en') → "loans".
 *
 * Uzbek has no numeral-triggered plural — "2 qarz", never "2 qarzlar" — so uz always takes
 * the singular form and the uz dictionary may hold the same string under both keys. Either
 * form may contain "{count}", which is replaced with `n`, so
 * plural(2, '{count} loan', '{count} loans', 'en') → "2 loans" works too.
 */
export function plural(n: number, one: string, many: string, lang: Lang): string {
  const form = lang === 'uz' || Math.abs(n) === 1 ? one : many
  return form.split('{count}').join(String(n))
}
