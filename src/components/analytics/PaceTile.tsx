import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Tile } from '../ui/Tile'
import { TileHead } from '../home/HomeTiles'
import { useLang } from '../../i18n/LanguageContext'
import { formatDate, money, moneyFull, plural } from '../../utils/format'
import { CHART_CHROME, TOOLTIP_BOX, compact } from './shared'
import type { PeriodInfo } from './tiles'
import type { AnalyticsResponse } from '../../types/analytics'

/** A line needs a few points before it says anything; under this the tile is words only. */
const MIN_DAYS_FOR_CHART = 3
const EVEN = 1000

interface Row {
  day: number
  /** YYYY-MM-DD of this day in the month on screen; null past today. */
  date: string | null
  /** Everyday spending so far this month; null past today. */
  current: number | null
  amount: number
  unitemised: number
  /** The month before, so far by the same day; null when it has no such day. */
  previous: number | null
}

/** Whether "Through the month" has anything to say: some day of the month carries spending. */
export function hasPace(d: AnalyticsResponse): boolean {
  return (d.everyday.daily ?? []).some(x => x.amount !== 0)
}

/**
 * C. Through the month: everyday spending adding up day by day, with the month before in grey.
 *
 * A running total rather than a bar per day, because a wallet check books several days of
 * spending on one date — a daily bar chart would show spikes that never happened, while a
 * running total just steps. "Faster or slower than last month" is then read from the slope.
 */
export function PaceTile({ d, period, onDay }: {
  d: AnalyticsResponse
  period: PeriodInfo
  /** Open History on one day. */
  onDay: (date: string) => void
}) {
  const { t, lang } = useLang()
  const [numbersOpen, setNumbersOpen] = useState(false)
  const e = d.everyday
  const daily = e.daily ?? []
  const previousDaily = e.previousDaily && e.previousDaily.length > 0 ? e.previousDaily : null
  // The tile's figures are the server's total — the same one "Everyday spending" shows beside
  // it; the line's own end is labelled with the last day's running total.
  const total = Math.max(0, e.total)
  const lineEnd = daily.length > 0 ? daily[daily.length - 1].cumulative : total
  const lastDate = daily.length > 0 ? daily[daily.length - 1].date : null
  const monthName = formatDate(period.month, lang, 'monthName')

  // ── The sentence ─────────────────────────────────────────────────────────────
  // On screen only the comparison with the month before — the figure above already says the rest.
  // The chart's accessible name keeps the plain total as well, since the chart itself is not read.
  const dayCount = daily.length
  const plain = plural(
    dayCount,
    t('analytics.c.plainOne', { amount: money(total) }),
    t('analytics.c.plain', { amount: money(total) }),
    lang,
  )
  let comparison: string | null = null
  if (previousDaily && period.previousName && lastDate) {
    const lastDay = Number(lastDate.slice(8, 10))
    const sameDay = previousDaily.find(p => p.day === lastDay) ?? previousDaily[previousDaily.length - 1]
    const diff = total - sameDay.cumulative
    const vars = { date: formatDate(lastDate, lang, 'dayShort'), amount: money(Math.abs(diff)), month: period.previousName }
    comparison = Math.abs(diff) < EVEN
      ? t('analytics.c.sameAs', vars)
      : t(diff < 0 ? 'analytics.c.lessThan' : 'analytics.c.moreThan', vars)
  }
  const chartLabel = comparison ? `${plain} ${comparison}` : plain

  // ── The chart's rows: every day of the month, so the line visibly stops at today ──
  const [year, monthNo] = period.month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNo, 0).getDate()
  const maxDay = Math.max(daysInMonth, previousDaily ? previousDaily.length : 0)
  const byDay = new Map(daily.map(x => [Number(x.date.slice(8, 10)), x]))
  const previousByDay = new Map((previousDaily ?? []).map(p => [p.day, p.cumulative]))
  const rows: Row[] = Array.from({ length: maxDay }, (_, i) => {
    const day = i + 1
    const cur = byDay.get(day)
    return {
      day,
      date: cur?.date ?? null,
      current: cur ? cur.cumulative : null,
      amount: cur?.amount ?? 0,
      unitemised: cur?.unitemised ?? 0,
      previous: previousByDay.get(day) ?? null,
    }
  })
  let lastIndex = -1
  rows.forEach((r, i) => { if (r.current != null) lastIndex = i })
  const ticks = [1, 8, 15, 22, maxDay]
  const showChart = dayCount >= MIN_DAYS_FOR_CHART

  // The end of this month's line: a dot with a surface ring, and the total beside it.
  const endDot = (props: { cx?: number; cy?: number; index?: number }) => {
    const { cx, cy, index } = props
    if (index !== lastIndex || cx == null || cy == null) return <g key={`dot-${index}`} />
    return (
      <g key={`dot-${index}`}>
        <circle cx={cx} cy={cy} r={4} className="fill-chart-everyday stroke-white" strokeWidth={2} />
        <text x={cx + 8} y={cy} dy="0.35em" className="fill-slate-900 text-[11px] font-semibold">
          {compact(lineEnd)}
        </text>
      </g>
    )
  }

  // ── The numbers, week by week — the chart's text equivalent ───────────────────
  const weeks: { key: string; label: string; spent: number; soFar: number }[] = []
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7)
    const first = chunk[0]
    const last = chunk[chunk.length - 1]
    weeks.push({
      key: first.date,
      label: first.date === last.date
        ? formatDate(first.date, lang, 'dayShort')
        : `${Number(first.date.slice(8, 10))} – ${formatDate(last.date, lang, 'dayShort')}`,
      spent: chunk.reduce((sum, x) => sum + x.amount, 0),
      soFar: last.cumulative,
    })
  }

  const biggestDays = (e.biggestDays ?? []).filter(b => b.amount > 0).slice(0, 3)
  const numbersId = 'analytics-pace-numbers'

  return (
    // min-w-0: a grid item will not shrink below its content, and a chart's content is a fixed
    // pixel width — without it the tile would hold the page wider than a phone after a resize.
    <Tile span={6} mdSpan={6} as="section" className="min-w-0">
      <TileHead title={t('analytics.c.title')} />
      {e.perDay != null && (
        <p className="mt-2 text-stat tabular-nums text-slate-900" title={moneyFull(e.perDay)}>
          {t('analytics.c.perDay', { amount: money(e.perDay) })}
        </p>
      )}
      {comparison && <p className="mt-1 text-sm text-slate-600">{comparison}</p>}

      {showChart && (
        <>
          {/* Two lines need a legend; one line is named by the tile's title. */}
          {previousDaily && period.previousName && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-chart-everyday" />
                {monthName}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-chart-muted" />
                {period.previousName}
              </li>
            </ul>
          )}
          <figure
            aria-label={chartLabel}
            className={`mt-3 h-[180px] w-full min-w-0 sm:h-[200px] ${CHART_CHROME}`}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={rows} margin={{ top: 12, right: 52, bottom: 0, left: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" ticks={ticks} interval={0} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis
                  width={44}
                  tickCount={4}
                  domain={[0, 'auto']}
                  tickFormatter={(v: number) => compact(v)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  isAnimationActive={false}
                  content={props => (
                    <PaceTip
                      row={props.active ? (props.payload?.[0]?.payload as Row | undefined) : undefined}
                      month={period.month}
                      currentName={monthName}
                      previousName={period.previousName}
                    />
                  )}
                />
                {previousDaily && (
                  <Line
                    dataKey="previous"
                    className="text-chart-muted"
                    stroke="currentColor"
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                )}
                <Line
                  dataKey="current"
                  className="text-chart-everyday"
                  stroke="currentColor"
                  strokeWidth={2}
                  dot={endDot}
                  activeDot={{ r: 4, className: 'fill-chart-everyday stroke-white', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </figure>
        </>
      )}

      {biggestDays.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-3">
          <h3 className="text-label uppercase text-slate-500">{t('analytics.c.biggestDays')}</h3>
          <ul className="mt-1">
            {biggestDays.map(b => (
              <li key={b.date}>
                <button
                  type="button"
                  onClick={() => onDay(b.date)}
                  className="focus-ring -mx-2 flex min-h-[44px] w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-control px-2 py-1 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium tabular-nums text-slate-900">
                      {formatDate(b.date, lang, 'dayShort')}
                    </span>
                    {b.topDescription && (
                      <span className="block truncate text-xs text-slate-500">{b.topDescription}</span>
                    )}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">
                    {moneyFull(b.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {weeks.length > 0 && (
        <div className="mt-2 border-t border-hairline pt-1">
          <button
            type="button"
            onClick={() => setNumbersOpen(v => !v)}
            aria-expanded={numbersOpen}
            aria-controls={numbersOpen ? numbersId : undefined}
            className="focus-ring flex min-h-[44px] w-full items-center justify-between gap-3 rounded-control text-left text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            {t('analytics.c.showNumbers')}
            {numbersOpen
              ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              : <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
          </button>
          {numbersOpen && (
            <table id={numbersId} className="w-full text-xs tabular-nums sm:text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th scope="col" className="py-1.5 pr-2 font-medium">{t('analytics.c.colDays')}</th>
                  <th scope="col" className="py-1.5 pl-2 text-right font-medium">{t('analytics.c.colSpent')}</th>
                  <th scope="col" className="py-1.5 pl-2 text-right font-medium">{t('analytics.c.soFar')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline border-t border-hairline">
                {weeks.map(w => (
                  <tr key={w.key}>
                    <th scope="row" className="whitespace-nowrap py-1.5 pr-2 text-left font-normal text-slate-700">{w.label}</th>
                    <td className="whitespace-nowrap py-1.5 pl-2 text-right text-slate-900">{moneyFull(w.spent)}</td>
                    <td className="whitespace-nowrap py-1.5 pl-2 text-right text-slate-900">{moneyFull(w.soFar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Tile>
  )
}

/**
 * One day under the crosshair: values first, names after. It repeats nothing that cannot be read
 * elsewhere — the week table holds the same figures without a pointer.
 */
function PaceTip({ row, month, currentName, previousName }: {
  row: Row | undefined
  month: string
  currentName: string
  previousName: string | null
}) {
  const { t, lang } = useLang()
  if (!row || (row.current == null && row.previous == null)) return null
  const date = row.date ?? `${month}-${String(row.day).padStart(2, '0')}`
  return (
    <div className={TOOLTIP_BOX}>
      <p className="font-semibold text-slate-900">
        {row.current != null ? formatDate(date, lang, 'dayShort') : row.day}
      </p>
      {row.current != null && (
        <div className="mt-1">
          <p className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full bg-chart-everyday" />
            <span className="font-semibold tabular-nums text-slate-900">{moneyFull(row.current)}</span>
            <span>{currentName} · {t('analytics.c.soFar')}</span>
          </p>
          <p className="pl-[18px]">
            <span className="font-medium tabular-nums text-slate-900">{moneyFull(row.amount)}</span>{' '}
            {t('analytics.c.spentThatDay')}
          </p>
          {row.unitemised > 0 && (
            <p className="pl-[18px]">{t('analytics.c.includesCheck', { amount: moneyFull(row.unitemised) })}</p>
          )}
        </div>
      )}
      {row.previous != null && previousName && (
        <p className="mt-1 flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full bg-chart-muted" />
          <span className="font-semibold tabular-nums text-slate-900">{moneyFull(row.previous)}</span>
          <span>{previousName} · {t('analytics.c.soFar')}</span>
        </p>
      )}
    </div>
  )
}
