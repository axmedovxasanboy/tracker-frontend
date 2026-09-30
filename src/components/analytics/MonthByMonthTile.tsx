import { Bar, CartesianGrid, ComposedChart, Line, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Tile } from '../ui/Tile'
import { TileHead } from '../home/HomeTiles'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { formatDate, moneyExact, moneyFull } from '../../utils/format'
import { CHART_CHROME, SERIES_BG, SERIES_TEXT, TOOLTIP_BOX, compact } from './shared'
import type { Series } from './shared'
import { DONATION_COUNTS_AS_SAVED, savedAndGiven } from './decisions'
import type { AnalyticsResponse } from '../../types/analytics'

const EVEN = 1000

type Part = 'everyday' | 'bills' | 'loans' | 'saved' | 'given'

/** Bottom to top in every column — the same order, and the same colours, as the hero's bar. */
const PARTS: { key: Part; series: Series; nameKey: TKey }[] = [
  { key: 'everyday', series: 'everyday', nameKey: 'analytics.group.everyday' },
  { key: 'bills', series: 'bills', nameKey: 'analytics.group.bills' },
  { key: 'loans', series: 'loans', nameKey: 'analytics.group.loans' },
  { key: 'saved', series: 'saved', nameKey: 'shell.history.saved' },
  // Only when a donation is not counted as saved (see decisions.ts).
  ...(DONATION_COUNTS_AS_SAVED ? [] : [{ key: 'given' as const, series: 'given' as const, nameKey: 'analytics.group.given' as const }]),
]

interface Row {
  month: string
  /** The x-axis label: the month's short name. */
  label: string
  complete: boolean
  earned: number
  out: number
  leftOver: number
  everyday: number
  bills: number
  loans: number
  saved: number
  given: number
}

/**
 * C′. Month by month: one stacked column per month — everyday spending, bills, loan payments and
 * savings — with what came in drawn as an ink tick across it. A column that pokes above its tick
 * is a month that cost more than it brought.
 *
 * In is a tick and not a second bar so there is one shape per month to compare, and so the income
 * green never has to sit beside the spending colours. One money axis, from zero.
 *
 * The table under the chart is its text equivalent and is always shown; a row opens that month.
 */
export function MonthByMonthTile({ d, onMonth }: {
  d: AnalyticsResponse
  onMonth: (month: string) => void
}) {
  const { t, lang } = useLang()

  const rows: Row[] = d.months.map(m => {
    const { saved, given } = savedAndGiven(m)
    return {
      month: m.month,
      label: formatDate(m.month, lang, 'monthShort').split(' ')[0],
      complete: m.complete,
      earned: m.earned,
      out: Math.max(0, m.out),
      leftOver: m.leftOver,
      everyday: Math.max(0, m.everyday),
      bills: m.bills,
      loans: m.loanPayments,
      saved,
      given,
    }
  })
  const over = rows.filter(r => r.leftOver <= -EVEN).length
  const sentence = over > 0
    ? t('analytics.m.someOver', { n: over, m: rows.length })
    : t('analytics.m.noneOver')

  /** The topmost part a month's column actually has — the one whose corners are rounded. */
  const topOf = (r: Row): Part | null => {
    for (let i = PARTS.length - 1; i >= 0; i--) if (r[PARTS[i].key] > 0) return PARTS[i].key
    return null
  }
  // A white stroke is the 2px surface gap between stacked parts; an unfinished month is fainter.
  const segment = (part: Part) => (props: unknown) => {
    const p = props as { payload: Row } & Record<string, unknown>
    return (
      <Rectangle
        {...p}
        radius={topOf(p.payload) === part ? [4, 4, 0, 0] : 0}
        className="stroke-white"
        strokeWidth={2}
        opacity={p.payload.complete ? 1 : 0.6}
      />
    )
  }
  // What came in, as a tick across the column.
  const inTick = (props: { cx?: number; cy?: number; index?: number }) => {
    const { cx, cy, index } = props
    if (cx == null || cy == null) return <g key={`in-${index}`} />
    return (
      <line
        key={`in-${index}`}
        x1={cx - 16} x2={cx + 16} y1={cy} y2={cy}
        className="stroke-slate-900" strokeWidth={2} strokeLinecap="round"
      />
    )
  }

  const newestFirst = [...rows].reverse()

  return (
    // min-w-0 so the chart can never hold the tile wider than the screen (see PaceTile).
    <Tile span={12} as="section" className="min-w-0">
      <TileHead title={t('analytics.m.title')} />
      <p className="mt-1 text-sm text-slate-600">{sentence}</p>

      {rows.length >= 2 && (
        <>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {PARTS.map(p => (
              <li key={p.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-[3px] ${SERIES_BG[p.series]}`} />
                {t(p.nameKey)}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-4 shrink-0 rounded-full bg-slate-900" />
              {t('shell.history.in')}
            </li>
          </ul>
          <figure
            aria-label={sentence}
            className={`mt-3 h-[200px] w-full min-w-0 sm:h-[240px] ${CHART_CHROME}`}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} minTickGap={4} tick={{ fontSize: 11 }} />
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
                    <MonthTip row={props.active ? (props.payload?.[0]?.payload as Row | undefined) : undefined} />
                  )}
                />
                {PARTS.map(p => (
                  <Bar
                    key={p.key}
                    dataKey={p.key}
                    stackId="went"
                    maxBarSize={24}
                    className={SERIES_TEXT[p.series]}
                    fill="currentColor"
                    shape={segment(p.key)}
                    isAnimationActive={false}
                  />
                ))}
                <Line
                  dataKey="earned"
                  stroke="none"
                  strokeWidth={0}
                  dot={inTick}
                  activeDot={false}
                  legendType="none"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </figure>
        </>
      )}

      <table className="mt-4 w-full text-xs tabular-nums sm:text-sm">
        <caption className="mb-1 caption-top text-right text-xs font-normal text-slate-500">{t('analytics.m.unit')}</caption>
        <thead>
          <tr className="align-bottom text-slate-500">
            <th scope="col" className="py-1.5 pr-1 text-left font-medium">{t('analytics.m.colMonth')}</th>
            <th scope="col" className="py-1.5 pl-1 text-right font-medium">{t('shell.history.in')}</th>
            <th scope="col" className="py-1.5 pl-1 text-right font-medium">{t('shell.history.out')}</th>
            <th scope="col" className="py-1.5 pl-1 text-right font-medium">{t('shell.history.saved')}</th>
            <th scope="col" className="py-1.5 pl-1 text-right font-medium">{t('analytics.group.leftOver')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline border-t border-hairline">
          {newestFirst.map(r => {
            const name = formatDate(r.month, lang, 'monthShort')
            return (
              <tr key={r.month}>
                <th scope="row" className="pr-1 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onMonth(r.month)}
                    aria-label={t('analytics.m.open', { month: formatDate(r.month, lang, 'month') })}
                    className="focus-ring -ml-1 inline-flex min-h-[44px] flex-col justify-center rounded-control px-1 text-left font-semibold text-indigo-600 hover:underline"
                  >
                    <span className="whitespace-nowrap">{name}</span>
                    {!r.complete && <span className="text-[11px] font-normal text-slate-500">{t('analytics.m.soFar')}</span>}
                  </button>
                </th>
                <td className="whitespace-nowrap pl-1 text-right text-slate-900" title={moneyExact(r.earned)}>{compact(r.earned)}</td>
                <td className="whitespace-nowrap pl-1 text-right text-slate-900" title={moneyExact(r.out)}>{compact(r.out)}</td>
                <td className="whitespace-nowrap pl-1 text-right text-slate-900" title={moneyExact(r.saved)}>{compact(r.saved)}</td>
                <td
                  className={`whitespace-nowrap pl-1 text-right font-semibold ${r.leftOver <= -EVEN ? 'text-expense' : 'text-slate-900'}`}
                  title={moneyExact(r.leftOver)}
                >
                  {compact(r.leftOver)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Tile>
  )
}

/** One month under the pointer: every part of its column, what came in, and what was left. */
function MonthTip({ row }: { row: Row | undefined }) {
  const { t, lang } = useLang()
  if (!row) return null
  const line = (key: string, mark: string, name: string, amount: number) => (
    <p key={key} className="flex items-center gap-1.5">
      <span aria-hidden="true" className={mark} />
      <span className="font-semibold tabular-nums text-slate-900">{moneyFull(amount)}</span>
      <span>{name}</span>
    </p>
  )
  return (
    <div className={TOOLTIP_BOX}>
      <p className="font-semibold text-slate-900">
        {formatDate(row.month, lang, 'month')}{!row.complete && ` · ${t('analytics.m.soFar')}`}
      </p>
      <div className="mt-1 space-y-0.5">
        {line('in', 'h-0.5 w-3 shrink-0 rounded-full bg-slate-900', t('shell.history.in'), row.earned)}
        {PARTS.filter(p => row[p.key] > 0).map(p =>
          line(p.key, `h-2.5 w-2.5 shrink-0 rounded-[3px] ${SERIES_BG[p.series]}`, t(p.nameKey), row[p.key]))}
        <p className="pl-[18px]">
          <span className={`font-semibold tabular-nums ${row.leftOver <= -EVEN ? 'text-expense' : 'text-slate-900'}`}>
            {moneyFull(row.leftOver)}
          </span>{' '}
          {t('analytics.group.leftOver')}
        </p>
      </div>
    </div>
  )
}
