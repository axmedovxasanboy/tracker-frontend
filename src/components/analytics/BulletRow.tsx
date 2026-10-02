import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { TKey } from '../../i18n/LanguageContext'
import { compact } from './shared'

type Translate = (key: TKey, vars?: Record<string, string | number>) => string

/**
 * "Not itemised": the muted grey with a hatch, so wallet-check money never passes for detail and
 * still reads without colour. "Left over" uses the plain slate `HATCH`.
 */
export const HATCH_MUTED =
  'bg-[repeating-linear-gradient(135deg,theme(colors.slate.400)_0_2px,theme(colors.slate.200)_2px_5px)]'

/** One segment of a bar's fill. A bar of several is stacked in the order given. */
export interface BarPart {
  value: number
  /** The fill — a `SERIES_BG` class, `HATCH` or `HATCH_MUTED`. */
  className: string
}

// ── The caption grammar (§1.2) — the one function every "so far against expected" goes through ──

/** ▲ ▼ ≈ — only ever for a comparison with expected, and always named for a screen reader. */
function Glyph({ kind, t }: { kind: 'more' | 'less' | 'about'; t: Translate }) {
  const glyph = kind === 'more' ? '▲' : kind === 'less' ? '▼' : '≈'
  return <span role="img" aria-label={t(`an.sr.${kind}` as const)}>{glyph}</span>
}

/**
 * What a figure's caption says about it against its expected value (§1.2), in one place:
 *
 * - a month in progress: "{expected} expected", then "· {to come} to come" while some has come
 *   and more is due, or "· ▲ {x} over" once it is past; Left over never has "to come";
 * - a complete month: "{expected} expected · ≈ as expected" inside the band (5% of expected, at
 *   least 50.000), else "▲ {x} more" / "▼ {x} less";
 * - `paidOff` (Out and Loan payments): leaves the paid-off loans out of "to come" and says so,
 *   "· {amount} for paid-off loans", so so far + to come + paid-off = expected on screen;
 * - `bonus`: "(incl. {amount} bonus)" right after the expected figure;
 * - a new line says "new" and a paid-off loan "paid off" — neither has a tick.
 *
 * Differences are neutral words, never a colour: nothing here is good or bad (R14).
 * Null when there is nothing to compare with.
 */
export function vsExpected(t: Translate, {
  soFar, expected, open, kind = 'flow', paidOff = 0, bonus = null, isNew = false, closed = false,
}: {
  soFar: number
  expected: number | null
  /** The month is still in progress. */
  open: boolean
  kind?: 'flow' | 'leftOver'
  paidOff?: number
  bonus?: number | null
  isNew?: boolean
  closed?: boolean
}): ReactNode {
  if (closed) return t('an.paidOff')
  if (isNew) return t('an.new')
  if (expected == null) return null

  const head = bonus
    ? `${t('an.expected', { amount: compact(expected) })} (${t('an.inclBonus', { amount: compact(bonus) })})`
    : t('an.expected', { amount: compact(expected) })
  const parts: ReactNode[] = [head]

  if (open) {
    const toCome = expected - soFar - paidOff
    if (kind !== 'leftOver' && soFar > 0 && toCome > 0) {
      parts.push(t('an.toCome', { amount: compact(toCome) }))
    }
    if (soFar > expected) {
      parts.push(<><Glyph kind="more" t={t} /> {t('an.over', { amount: compact(soFar - expected) })}</>)
    }
  } else {
    const band = Math.max(0.05 * Math.abs(expected), 50_000)
    const diff = soFar - expected
    if (Math.abs(diff) <= band) parts.push(<><Glyph kind="about" t={t} /> {t('an.asExpected')}</>)
    else if (diff > 0) parts.push(<><Glyph kind="more" t={t} /> {t('an.more', { amount: compact(diff) })}</>)
    else parts.push(<><Glyph kind="less" t={t} /> {t('an.less', { amount: compact(-diff) })}</>)
  }
  if (paidOff > 0) parts.push(t('an.loansPaidOff', { amount: compact(paidOff) }))

  return parts.map((p, i) => <Fragment key={i}>{i > 0 && ' · '}{p}</Fragment>)
}

// ── The bar ──────────────────────────────────────────────────────────────────────────────────

/** A share of the page's one scale, as a CSS percentage clamped to the track. */
const pct = (value: number, scale: number) => (scale > 0 ? Math.min(100, Math.max(0, (value / scale) * 100)) : 0)

/**
 * The bullet graph (Few): a filled bar for so far and a 2px ink tick for expected, on the one
 * scale every row of the page shares. Decorative — the row's words carry the same figures.
 */
export function BulletBar({ parts, value, expected, scale, thin = false }: {
  parts: BarPart[]
  /** So far; a negative value draws no fill. */
  value: number
  expected: number | null
  scale: number
  thin?: boolean
}) {
  const filled = value > 0 ? pct(value, scale) : 0
  const sum = parts.reduce((s, p) => s + Math.max(0, p.value), 0)
  const tick = expected != null && expected >= 0 && scale > 0 ? pct(expected, scale) : null
  return (
    <div aria-hidden="true" className={`relative w-full rounded-full bg-slate-100 ${thin ? 'h-1' : 'h-2'}`}>
      {filled > 0 && sum > 0 && (
        <div className="absolute inset-y-0 left-0 flex overflow-hidden rounded-full" style={{ width: `${filled}%` }}>
          {parts.filter(p => p.value > 0).map((p, i) => (
            <div key={i} className={`h-full ${p.className}`} style={{ width: `${(p.value / sum) * 100}%` }} />
          ))}
        </div>
      )}
      {tick != null && (
        <div
          className={`absolute top-1/2 w-0.5 -translate-y-1/2 rounded-full bg-slate-900 ${thin ? 'h-3' : 'h-4'}`}
          style={{ left: `clamp(0px, calc(${tick}% - 1px), calc(100% - 2px))` }}
        />
      )}
    </div>
  )
}

// ── The row ──────────────────────────────────────────────────────────────────────────────────

/**
 * One figure as a bullet row (§3.0):
 *
 *   Label                              so far ›
 *   [██████████░░░░░░░░|░░░░░░░░░░]
 *   caption (one line each)
 *
 * The visible text is the data; the bar is its picture. A row that leads somewhere is ONE link
 * (`to`) or ONE disclosure button (`onToggle`) — never a control inside a control — with a 44px
 * floor and the focus ring.
 */
export function BulletRow({
  label, amount, value, parts, expected = null, scale, thin = false, captions = [],
  negative = 'slate', to, onToggle, expanded, strip, lead = false, className = '',
}: {
  label: ReactNode
  /** Already formatted: `compact()` on a closed row, `formatNumber()` on an opened one. */
  amount: string
  /** So far, for the bar and the sign. */
  value: number
  parts: BarPart[]
  /** Where the tick goes; null draws none. */
  expected?: number | null
  scale: number
  /** 4px instead of 8px — a child under its root. */
  thin?: boolean
  /** Each one a line under the bar; empty ones are dropped. */
  captions?: ReactNode[]
  /** How a negative amount reads: rose in a complete month, slate while the month runs (R14). */
  negative?: 'rose' | 'slate'
  to?: string
  onToggle?: () => void
  expanded?: boolean
  /** Over a range: the month-by-month strip in place of the bullet bar. */
  strip?: ReactNode
  /** The page's headline figure: a larger label and amount. */
  lead?: boolean
  className?: string
}) {
  const shown = captions.filter(c => c != null && c !== false && c !== '')
  const tone = value < 0 && negative === 'rose' ? 'text-expense' : 'text-slate-900'
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className={`min-w-0 [overflow-wrap:anywhere] ${lead ? 'text-title text-slate-900' : 'text-sm font-medium text-slate-700'}`}>
          {label}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          <span className={`whitespace-nowrap tabular-nums ${lead ? 'text-stat' : 'text-sm font-semibold'} ${tone}`}>
            {amount}
          </span>
          {to && <ChevronRight className="h-4 w-4 shrink-0 self-center text-slate-500" aria-hidden="true" />}
          {onToggle && (
            <ChevronDown
              className={`h-4 w-4 shrink-0 self-center text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          )}
        </span>
      </span>
      <span className={`block ${lead ? 'mt-2' : 'mt-1.5'}`}>
        {strip ?? <BulletBar parts={parts} value={value} expected={expected} scale={scale} thin={thin} />}
      </span>
      {shown.map((c, i) => (
        <span key={i} className="mt-1 block text-xs leading-snug text-slate-600 tabular-nums [overflow-wrap:anywhere]">
          {c}
        </span>
      ))}
    </>
  )

  // One width per kind of row, never both: a plain row is the content's width; a link or button
  // reaches 8px past it on each side for its padding, so every row's track is the same length and
  // the page's one scale holds (with `w-full` as well, Tailwind's order made the wider one lose).
  const box = `block py-2 text-left ${className}`
  const interactive = 'focus-ring -mx-2 min-h-[44px] w-[calc(100%+1rem)] rounded-control px-2 transition-colors hover:bg-slate-50'
  if (to) return <Link to={to} className={`${box} ${interactive}`}>{body}</Link>
  if (onToggle) {
    return (
      <button type="button" onClick={onToggle} aria-expanded={!!expanded} className={`${box} ${interactive}`}>
        {body}
      </button>
    )
  }
  return <div className={`${box} w-full`}>{body}</div>
}

/**
 * A plain line inside an opened row or under a group: name, amount and an optional caption — no
 * bar. A link when it has somewhere to go.
 */
export function TextRow({ label, amount, caption, to, className = '' }: {
  label: ReactNode
  amount: string
  caption?: ReactNode
  to?: string | null
  className?: string
}) {
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm text-slate-700 [overflow-wrap:anywhere]">{label}</span>
        <span className="flex shrink-0 items-center gap-0.5">
          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">{amount}</span>
          {to && <ChevronRight className="h-4 w-4 shrink-0 self-center text-slate-500" aria-hidden="true" />}
        </span>
      </span>
      {caption && <span className="mt-0.5 block text-xs leading-snug text-slate-600 [overflow-wrap:anywhere]">{caption}</span>}
    </>
  )
  if (to) {
    return (
      <Link
        to={to}
        className={`focus-ring -mx-2 flex min-h-[44px] w-[calc(100%+1rem)] flex-col justify-center rounded-control px-2 py-1.5 transition-colors hover:bg-slate-50 ${className}`}
      >
        {body}
      </Link>
    )
  }
  return <div className={`flex min-h-[36px] flex-col justify-center py-1.5 ${className}`}>{body}</div>
}

/** The page's scale: the largest so far or expected among the rows that draw a bar. */
export function scaleOf(values: Array<number | null | undefined>): number {
  return values.reduce<number>((max, v) => (v != null && v > max ? v : max), 0)
}
