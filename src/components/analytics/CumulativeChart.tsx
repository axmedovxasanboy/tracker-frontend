import type { ReactNode } from 'react'
import { useLang } from '../../i18n/LanguageContext'
import { formatNumber } from '../../utils/format'
import type { EverydayDay } from '../../types/analyticsBreakdown'
import { compact } from './shared'

/** The plot's own coordinate box; the SVG stretches to the tile and its strokes do not. */
const W = 100
const H = 100
/**
 * How close (in the box's units, of a 160px plot) the two end labels may come before one of them
 * moves below its point: 10 is 16px, one line of 11px text.
 */
const LABEL_GAP = 10

/**
 * "Through the month" on the Out page (§3.3): itemised everyday spending added up day by day, one
 * polyline, against a dashed straight line from nothing to what a whole month is expected to
 * itemise. Wallet-check money is in neither — it lands in lumps on check days and has its own row.
 *
 * Inline SVG for the lines only (`preserveAspectRatio="none"` with non-scaling strokes); every
 * word and number is HTML laid over it, so text never stretches. The `<figcaption>` holds the
 * by-today sentence and an sr-only table gives the weekly totals.
 */
export function CumulativeChart({ daily, daysInMonth, expectedTotal, caption }: {
  daily: EverydayDay[]
  daysInMonth: number
  /** The month's expected itemised spending; null without a base — then no dashed line. */
  expectedTotal: number | null
  caption: ReactNode
}) {
  const { t } = useLang()
  const last = daily[daily.length - 1]
  const soFar = last?.cumulative ?? 0
  const top = Math.max(soFar, expectedTotal ?? 0)
  if (daysInMonth <= 0 || (top <= 0 && daily.length === 0)) return null
  const yMax = top > 0 ? top : 1

  // Day d is drawn where it ends, at d ÷ days of the width, from nothing at the month's start. The
  // dashed line then reads expected × d ÷ days at day d — the same expectation as the by-today
  // sentence under the chart, so spending on pace sits on the line.
  const x = (day: number) => (day / daysInMonth) * W
  const y = (v: number) => H - (Math.max(0, v) / yMax) * H
  const points = [`0,${H}`, ...daily.map(d => `${x(d.day).toFixed(2)},${y(d.cumulative).toFixed(2)}`)].join(' ')
  const ticks = [1, 10, 20, daysInMonth].filter((d, i, all) => d <= daysInMonth && all.indexOf(d) === i)
  const hasExpected = expectedTotal != null && expectedTotal > 0
  // On pace, the two end labels would print over each other: the lower figure's moves below its
  // point, the higher one's stays above.
  const crowded = hasExpected && last != null && Math.abs(y(soFar) - y(expectedTotal)) < LABEL_GAP
  const soFarBelow = crowded && soFar <= (expectedTotal ?? 0)
  const expectedBelow = crowded && !soFarBelow

  // Weekly totals for the screen-reader table: days 1–7, 8–14, … to the last day drawn.
  const weeks: { from: number; to: number; amount: number }[] = []
  for (const d of daily) {
    const w = Math.floor((d.day - 1) / 7)
    if (!weeks[w]) weeks[w] = { from: w * 7 + 1, to: Math.min(w * 7 + 7, daysInMonth), amount: 0 }
    weeks[w].amount += d.amount
  }

  return (
    <figure className="mt-3">
      <div aria-hidden="true" className="relative ml-10 mr-1">
        <div className="relative h-40">
          {/* Two y ticks: half way and the top. */}
          {[0.5, 1].map(f => (
            <div key={f} className="absolute inset-x-0 border-t border-slate-200" style={{ top: `${(1 - f) * 100}%` }}>
              <span className="absolute -left-10 -top-2 w-9 text-right text-[11px] tabular-nums text-slate-500">
                {compact(yMax * f)}
              </span>
            </div>
          ))}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <line x1="0" y1={H} x2={W} y2={H} className="stroke-slate-300" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            {hasExpected && (
              <line
                x1="0" y1={H} x2={W} y2={y(expectedTotal)}
                className="stroke-slate-500" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke"
              />
            )}
            {daily.length > 0 && (
              <polyline
                points={points}
                fill="none"
                className="stroke-chart-everyday"
                strokeWidth="2"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {/* End-point labels carry the two values. */}
          {last && (
            <span
              className={`absolute -translate-x-full whitespace-nowrap rounded-chip bg-white/90 px-1 text-[11px] font-semibold tabular-nums text-slate-900 ${soFarBelow ? '' : '-translate-y-full'}`}
              style={{ left: `${Math.max(x(last.day), 12)}%`, top: `${y(soFar)}%` }}
            >
              {compact(soFar)}
            </span>
          )}
          {hasExpected && (
            <span
              className={`absolute right-0 whitespace-nowrap px-1 text-[11px] tabular-nums text-slate-600 ${expectedBelow ? '' : '-translate-y-full'}`}
              style={{ top: `${y(expectedTotal ?? 0)}%` }}
            >
              {t('an.expected', { amount: compact(expectedTotal ?? 0) })}
            </span>
          )}
        </div>
        <div className="relative mt-1 h-4">
          {ticks.map(d => (
            <span
              key={d}
              className="absolute -translate-x-1/2 text-[11px] tabular-nums text-slate-500"
              style={{ left: `${x(d)}%` }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 text-xs leading-snug text-slate-600 tabular-nums">{caption}</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">{t('an.table.days')}</th>
            <th scope="col">{t('an.table.itemised')}</th>
          </tr>
        </thead>
        <tbody>
          {weeks.filter(Boolean).map(w => (
            <tr key={w.from}>
              <th scope="row">{w.from}–{w.to}</th>
              <td>{formatNumber(w.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
