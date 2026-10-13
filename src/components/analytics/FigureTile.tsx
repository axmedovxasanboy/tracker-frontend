import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { IconChip } from '../ui/IconChip'
import { Tile } from '../ui/Tile'
import type { TileMdSpan, TileSpan } from '../ui/Tile'
import type { IconTone } from '../ui/StatTile'
import { BulletBar } from './BulletRow'

/**
 * A headline figure as a stat tile (2026-10-13, after the reference dashboards the owner picked):
 * its icon and label, the figure with its "vs last month" badge beside it, and a thin meter of so
 * far against expected — the 2px tick is expected. Nothing else: everything said about the figure
 * (expected, to come, what it is made of) is behind the `info` "!" in the top corner — the owner
 * found the captions under every figure too much to read.
 *
 * The label is the link to the figure's own page, so the "!" never sits inside a link. `stretch`
 * evens out a row of figures (Totals, 12 months); a lone figure beside a taller tile keeps its own
 * height. The figure uses proportional digits (a large standalone number).
 */
export function FigureTile({
  label, icon, iconTone = 'neutral', amount, value, badge, meter, info, negative = 'slate', to,
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
  /** The "!" button with the figure's details (`TileInfo`). */
  info?: ReactNode
  negative?: 'rose' | 'slate'
  to?: string
  span?: TileSpan
  mdSpan?: TileMdSpan
  /** Take the row's height, so a row of figures lines up. */
  stretch?: boolean
}) {
  const tone = value < 0 && negative === 'rose' ? 'text-expense' : 'text-slate-900'
  // Without an expected figure there is nothing to measure against: no meter, rather than a full one.
  const showMeter = meter != null && meter.expected != null
  const scale = showMeter ? Math.max(value, meter.expected ?? 0, 0) : 0

  return (
    <Tile span={span} mdSpan={mdSpan} as="section" className={stretch ? 'self-stretch' : ''}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconChip tone={iconTone}>{icon}</IconChip>
          <h2 className="min-w-0 text-label uppercase text-slate-500 [overflow-wrap:anywhere]">
            {to ? (
              <Link
                to={to}
                className="focus-ring -mx-1 -my-3 inline-flex min-h-[44px] items-center gap-0.5 rounded-chip px-1 hover:text-slate-800"
              >
                {label}
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </Link>
            ) : label}
          </h2>
        </div>
        {info}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`whitespace-nowrap text-stat ${tone}`}>{amount}</span>
        {badge}
      </p>
      {showMeter && meter && (
        <div className="mt-3">
          <BulletBar parts={[{ value, className: meter.fill }]} value={value} expected={meter.expected} scale={scale} />
        </div>
      )}
    </Tile>
  )
}
