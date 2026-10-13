import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
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
 *
 * Since the 2026-10-13 restyle the line has a 10% wash under it, and a crosshair finds the day
 * under the pointer (or the arrow keys, once the plot has focus): that day's total so far against
 * what a normal month would have reached by then.
 */
export function CumulativeChart({ daily, daysInMonth, expectedTotal, caption }: {
  daily: EverydayDay[]
  daysInMonth: number
  /** The month's expected itemised spending; null without a base — then no dashed line. */
  expectedTotal: number | null
  caption: ReactNode
}) {
  const { t } = useLang()
  const plotRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
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

  // The crosshair snaps to a drawn day: the one nearest the pointer.
  const lastDay = last?.day ?? 0
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const box = plotRef.current?.getBoundingClientRect()
    if (!box || box.width <= 0 || lastDay <= 0) return
    const day = Math.round(((e.clientX - box.left) / box.width) * daysInMonth)
    setHover(Math.min(lastDay, Math.max(1, day)))
  }
  const step = (e: KeyboardEvent<HTMLDivElement>) => {
    if (lastDay <= 0) return
    const at = hover ?? lastDay
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHover(Math.max(1, at - 1)) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setHover(Math.min(lastDay, at + 1)) }
    else if (e.key === 'Escape') setHover(null)
  }
  // The total by a day: the last drawn day at or before it (a day with nothing keeps the total).
  const totalBy = (day: number) => daily.reduce((v, d) => (d.day <= day ? d.cumulative : v), 0)
  const hovered = hover != null ? { day: hover, total: totalBy(hover) } : null

  // Weekly totals for the screen-reader table: days 1–7, 8–14, … to the last day drawn.
  const weeks: { from: number; to: number; amount: number }[] = []
  for (const d of daily) {
    const w = Math.floor((d.day - 1) / 7)
    if (!weeks[w]) weeks[w] = { from: w * 7 + 1, to: Math.min(w * 7 + 7, daysInMonth), amount: 0 }
    weeks[w].amount += d.amount
  }

  return (
    <figure className="mt-3">
      <div
        className="focus-ring relative ml-12 mr-1 rounded-control outline-none"
        role="group"
        tabIndex={lastDay > 0 ? 0 : undefined}
        aria-label={t('an.chart.through')}
        onKeyDown={step}
        // The last day only for a keyboard arrival; a tap has already picked its day.
        onFocus={e => {
          const keyboard = e.currentTarget.matches(':focus-visible')
          setHover(h => h ?? (keyboard ? lastDay || null : null))
        }}
        onBlur={() => setHover(null)}
      >
        <div
          ref={plotRef}
          aria-hidden="true"
          className="relative h-40 touch-pan-y"
          onPointerMove={pick}
          onPointerDown={pick}
          // A finger lifting fires pointerleave right after the tap; only a mouse leaving clears.
          onPointerLeave={e => { if (e.pointerType === 'mouse') setHover(null) }}
        >
          {/* Two y ticks: half way and the top. */}
          {[0.5, 1].map(f => (
            <div key={f} className="absolute inset-x-0 border-t border-slate-200" style={{ top: `${(1 - f) * 100}%` }}>
              <span className="absolute -left-12 -top-2 w-11 whitespace-nowrap text-right text-[11px] tabular-nums text-slate-500">
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
              <polygon
                points={`${points} ${x(lastDay).toFixed(2)},${H}`}
                className="fill-chart-everyday/10"
                stroke="none"
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
          {hovered && (
            <>
              <div className="pointer-events-none absolute inset-y-0 w-px bg-slate-400" style={{ left: `${x(hovered.day)}%` }} />
              <span
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-chart-everyday"
                style={{ left: `${x(hovered.day)}%`, top: `${y(hovered.total)}%` }}
              />
            </>
          )}
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
        {hovered && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute top-0 z-10 w-44 rounded-control border border-hairline bg-white p-2.5 shadow-tile-hover"
            // Beside the crosshair, but never past the plot's edge on a narrow screen.
            style={x(hovered.day) < W / 2
              ? { left: `min(calc(${x(hovered.day)}% + 8px), calc(100% - 11rem))` }
              : { right: `min(calc(${W - x(hovered.day)}% + 8px), calc(100% - 11rem))` }}
          >
            <p className="text-xs font-semibold text-slate-900">{t('an.chart.day', { day: hovered.day })}</p>
            <p className="mt-1 flex items-center gap-2 text-xs">
              <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full bg-chart-everyday" />
              <span className="min-w-0 flex-1 text-slate-500">{t('an.chart.soFar')}</span>
              <span className="font-semibold tabular-nums text-slate-900">{compact(hovered.total)}</span>
            </p>
            {hasExpected && (
              <p className="mt-1 flex items-center gap-2 text-xs">
                <span aria-hidden="true" className="h-0 w-3 shrink-0 border-t border-dashed border-slate-500" />
                <span className="min-w-0 flex-1 text-slate-500">{t('an.chart.normal')}</span>
                <span className="font-semibold tabular-nums text-slate-900">{compact(((expectedTotal ?? 0) * hovered.day) / daysInMonth)}</span>
              </p>
            )}
          </div>
        )}
        <div aria-hidden="true" className="relative mt-1 h-4">
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
