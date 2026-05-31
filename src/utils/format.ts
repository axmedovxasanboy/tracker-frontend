import type { Currency } from '../types'

/**
 * Display rules — dot is the thousands separator, comma is the decimal separator
 * (European / Uzbek convention). UZS never shows decimals; USD/EUR show two.
 *
 * Examples: 1000000 + UZS → "1.000.000 UZS"
 *           1000000.5 + USD → "1.000.000,50 USD"
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
  const sign = snapped < 0 ? '-' : ''
  const abs = Math.abs(snapped)
  const fixed = abs.toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  const grouped = groupThousands(intPart)
  return decimals > 0 && decPart
    ? `${sign}${grouped},${decPart}`
    : `${sign}${grouped}`
}

/**
 * Format an amount with its currency suffix. `compact` shortens to k/M/B for
 * dashboard chart axis labels.
 */
export function formatCurrency(amount: number, currency: Currency, compact = false): string {
  const decimals = CURRENCY_DECIMALS[currency]
  if (compact) {
    const abs = Math.abs(amount)
    if (abs >= 1_000_000_000) return `${formatNumber(amount / 1_000_000_000, 1)} B ${currency}`
    if (abs >= 1_000_000) return `${formatNumber(amount / 1_000_000, 1)} M ${currency}`
    if (abs >= 1_000) return `${formatNumber(amount / 1_000, 1)} k ${currency}`
    return `${formatNumber(amount, decimals)} ${currency}`
  }
  return `${formatNumber(amount, decimals)} ${currency}`
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
