import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { IconChip } from '../ui/IconChip'
import { Tile } from '../ui/Tile'
import type { TileMdSpan, TileSpan } from '../ui/Tile'
import type { IconTone } from '../ui/StatTile'
import { BulletBar } from './BulletRow'

/**
 * A headline figure as a stat tile (2026-10-13 restyle, after the reference dashboards the owner
 * picked): the label and its icon, the figure with its "vs last month" badge beside it, a thin
 * meter of so far against expected — the 2px tick is expected — and the caption lines under it
 * (expected, to come, what it is made of).
 *
 * A tile that leads to its page is one link; `stretch` evens out a row of figures (Totals,
 * 12 months) — a lone figure beside a taller tile keeps its own height. The figure uses
 * proportional digits (a large standalone number), captions tabular ones.
 */
export function FigureTile({
  label, icon, iconTone = 'neutral', amount, value, badge, meter, captions = [], negative = 'slate', to,
  span = 3, mdSpan = 3, stretch = false,
}: {
  label: string
  icon: ReactNode
  iconTone?: IconTone
  /** Already formatted (`compact`). */
  amount: string
  /** For the sign: a negative figure reads rose in a complete month. */
  value: number
  badge?: ReactNode
  /** So far against expected, on the tile's own scale; a fill class (`SERIES_BG.*` or `HATCH`). */
  meter?: { expected: number | null; fill: string }
  /** One line each; empty ones are dropped. */
  captions?: ReactNode[]
  negative?: 'rose' | 'slate'
  to?: string
  span?: TileSpan
  mdSpan?: TileMdSpan
  /** Take the row's height, so a row of figures lines up. */
  stretch?: boolean
}) {
  const shown = captions.filter(c => c != null && c !== false && c !== '')
  const tone = value < 0 && negative === 'rose' ? 'text-expense' : 'text-slate-900'
  // Without an expected figure there is nothing to measure against: no meter, rather than a full one.
  const showMeter = meter != null && meter.expected != null
  const scale = showMeter ? Math.max(value, meter.expected ?? 0, 0) : 0

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-0.5 pt-1 text-label uppercase text-slate-500 [overflow-wrap:anywhere]">
          {label}
          {to && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        </h2>
        <IconChip tone={iconTone}>{icon}</IconChip>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`whitespace-nowrap text-stat ${tone}`}>{amount}</span>
        {badge}
      </p>
      {showMeter && meter && (
        <div className="mt-3">
          <BulletBar parts={[{ value, className: meter.fill }]} value={value} expected={meter.expected} scale={scale} />
        </div>
      )}
      {shown.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {shown.map((c, i) => (
            <p key={i} className="text-xs leading-snug text-slate-600 tabular-nums [overflow-wrap:anywhere]">{c}</p>
          ))}
        </div>
      )}
    </>
  )

  if (to) {
    return (
      <Tile span={span} mdSpan={mdSpan} as="section" padding="none" className={stretch ? 'self-stretch' : ''}>
        <Link
          to={to}
          className="focus-ring block h-full rounded-tile p-5 transition-colors hover:bg-slate-50/70"
        >
          {body}
        </Link>
      </Tile>
    )
  }
  return (
    <Tile span={span} mdSpan={mdSpan} as="section" className={stretch ? 'self-stretch' : ''}>
      {body}
    </Tile>
  )
}
