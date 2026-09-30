import type { ReactNode } from 'react'
import { formatNumber, money } from '../../utils/format'

/**
 * The chart marks' colours, by what they stand for. The values live in `tailwind.config.js`
 * (`colors.chart.*`) with the app's other tokens; the class names are written out in full here
 * because Tailwind only ships the ones it can find as literal text.
 */
export type Series =
  | 'pay' | 'bonus' | 'other'
  | 'everyday' | 'bills' | 'loans' | 'saved' | 'given'
  | 'wallets' | 'emergency' | 'investments' | 'goals'
  | 'muted'

/** A filled mark drawn in HTML (a bar segment, a legend swatch). */
export const SERIES_BG: Record<Series, string> = {
  pay: 'bg-chart-pay',
  bonus: 'bg-chart-bonus',
  other: 'bg-chart-other',
  everyday: 'bg-chart-everyday',
  bills: 'bg-chart-bills',
  loans: 'bg-chart-loans',
  saved: 'bg-chart-saved',
  given: 'bg-chart-given',
  wallets: 'bg-chart-wallets',
  emergency: 'bg-chart-emergency',
  investments: 'bg-chart-investments',
  goals: 'bg-chart-goals',
  muted: 'bg-chart-muted',
}

/**
 * The same colour as `currentColor`, for a recharts layer: its marks are given
 * `fill="currentColor"` / `stroke="currentColor"` and the layer this class.
 */
export const SERIES_TEXT: Record<Series, string> = {
  pay: 'text-chart-pay',
  bonus: 'text-chart-bonus',
  other: 'text-chart-other',
  everyday: 'text-chart-everyday',
  bills: 'text-chart-bills',
  loans: 'text-chart-loans',
  saved: 'text-chart-saved',
  given: 'text-chart-given',
  wallets: 'text-chart-wallets',
  emergency: 'text-chart-emergency',
  investments: 'text-chart-investments',
  goals: 'text-chart-goals',
  muted: 'text-chart-muted',
}

/**
 * "Left over": a pattern rather than a fifth colour, so it never reads as one more category and
 * still shows without colour at all.
 */
export const HATCH =
  'border border-slate-300 bg-white bg-[repeating-linear-gradient(135deg,theme(colors.slate.300)_0_2px,transparent_2px_6px)]'

/**
 * The chrome of a recharts chart, set from outside through the class names recharts gives its
 * parts — so grid, axes and ticks wear the app's slate tokens instead of hex literals in props
 * (a CSS rule outranks the presentation attribute recharts writes).
 *
 * The last line is the focus indicator. With `accessibilityLayer` recharts makes its own <svg>
 * the tab stop, so the project's `focus-ring` class cannot be put on it; this draws the same
 * indigo-600 band on it instead (the global reset removes the browser's own outline). A chart
 * always sits on a white tile, where that one band measures 6.29:1.
 */
export const CHART_CHROME = [
  '[&_.recharts-cartesian-grid_line]:stroke-slate-200',
  '[&_.recharts-cartesian-axis-line]:stroke-slate-200',
  '[&_.recharts-cartesian-axis-tick-value]:fill-slate-500',
  '[&_.recharts-tooltip-cursor]:stroke-slate-300',
  '[&_.recharts-surface]:rounded-chip',
  '[&_.recharts-surface:focus-visible]:outline [&_.recharts-surface:focus-visible]:outline-2',
  '[&_.recharts-surface:focus-visible]:outline-offset-2 [&_.recharts-surface:focus-visible]:outline-indigo-600',
].join(' ')

/** The box a chart's tooltip is drawn in. */
export const TOOLTIP_BOX =
  'rounded-control border border-hairline bg-white px-3 py-2 text-xs text-slate-600 shadow-tile-hover'

/** A compact amount without its unit — "22,3 M" — for axis ticks and dense table cells. */
export function compact(amount: number): string {
  return money(amount).replace(/\s*UZS$/, '')
}

/**
 * `part` as a whole-number share of `whole`: "44", "<1", or null when there is nothing to
 * measure against. Whole numbers only — a decimal on a share invites precision it does not have.
 */
export function shareOf(part: number, whole: number): string | null {
  if (!(whole > 0) || !(part > 0)) return null
  const pct = (part / whole) * 100
  if (pct < 1) return '<1'
  return formatNumber(Math.round(pct))
}

/** A legend swatch: the mark's colour (or the hatch) as a small square. Decorative. */
export function Swatch({ series, hatched = false }: { series?: Series; hatched?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 rounded-[3px] ${hatched ? HATCH : series ? SERIES_BG[series] : 'bg-slate-200'}`}
    />
  )
}

/**
 * One line of a bar's legend — which is also the bar's text equivalent: the mark's colour, its
 * name, its amount and (optionally) its share. With `onClick` the whole line is a button.
 */
export function LegendRow({ series, hatched, name, amount, exact, share, note, onClick, actionHint }: {
  series?: Series
  hatched?: boolean
  name: string
  /** Already formatted. */
  amount: string
  /** The exact figure behind a compact `amount`, as its tooltip. */
  exact?: string
  /** "44" → "44%". */
  share?: string | null
  /** A second, muted line under the name. */
  note?: ReactNode
  onClick?: () => void
  /** What pressing it does, for a screen reader — the name alone would not say. */
  actionHint?: string
}) {
  const body = (
    <>
      <Swatch series={series} hatched={hatched} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-700 [overflow-wrap:anywhere]">{name}</span>
        {note && <span className="block text-xs leading-snug text-slate-500 [overflow-wrap:anywhere]">{note}</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className="block whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900" title={exact}>
          {amount}
        </span>
      </span>
      {share !== undefined && (
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500">
          {share != null ? `${share}%` : ''}
        </span>
      )}
    </>
  )
  if (!onClick) {
    return <li className="flex min-h-[36px] items-center gap-2.5 py-1">{body}</li>
  }
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        title={actionHint}
        className="focus-ring -mx-2 flex min-h-[44px] w-[calc(100%+1rem)] items-center gap-2.5 rounded-control px-2 py-1 text-left transition-colors hover:bg-slate-50"
      >
        {body}
        {actionHint && <span className="sr-only">{actionHint}</span>}
      </button>
    </li>
  )
}
