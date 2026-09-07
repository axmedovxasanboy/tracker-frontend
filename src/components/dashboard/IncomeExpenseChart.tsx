import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { CacheBadge } from '../ui/CacheBadge'
import { ErrorTile } from '../ui/ErrorTile'
import { Skeleton } from '../ui/Skeleton'
import { Tile } from '../ui/Tile'
import type { TileSpan } from '../ui/Tile'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import type { MonthlyData, Currency } from '../../types'
import { money, moneyAxis, moneyExact, moneyFull } from '../../utils/format'

interface Props {
  data: MonthlyData[]
  loading: boolean
  /** A later fetch while the bars are still on screen — dim them, never blank them. */
  refreshing?: boolean
  error?: string | null
  onRetry?: () => void
  currency: Currency
  isCached?: boolean
  cachedAt?: string | null
  /** The empty state's one action: there is nothing to chart until something is recorded. */
  onAdd?: () => void
  span?: TileSpan
}

/**
 * The month names come from the dictionary, not from the payload: the backend builds `monthName`
 * as `Month.of(m).name().substring(0, 3)`, which is "SEP" in every language.
 *
 * Exported because Home's Activity totals name the range they cover; sharing the array is what
 * keeps the caption's month names identical to the ones on the axis beside them.
 */
export const MONTH_KEYS = [
  'month.short.1', 'month.short.2', 'month.short.3', 'month.short.4',
  'month.short.5', 'month.short.6', 'month.short.7', 'month.short.8',
  'month.short.9', 'month.short.10', 'month.short.11', 'month.short.12',
] as const satisfies readonly TKey[]

const INCOME = '#10b981'
const EXPENSE = '#f43f5e'

/** Past six months the labels start colliding, and the axis already carries the magnitude. */
const MAX_LABELLED_MONTHS = 6

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * recharts grows the bars by rewriting each rect's `y` and `height` **attributes** on a raf loop,
 * so there is no animation-duration or transition-duration for `index.css`'s reduced-motion block
 * to override — the one place that rule was written for is the one place CSS cannot reach. The
 * setting has to be read in JS and handed to the chart.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.(REDUCED_MOTION).matches ?? false)

  useEffect(() => {
    const mq = window.matchMedia?.(REDUCED_MOTION)
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * Income against expenses, one bar per month that has data.
 *
 * It used to be a monotone spline area chart, which drew a smooth curve between two points and
 * so invented a trend across months nobody had recorded anything in. Bars can only state what is
 * there: a month with no data has no bar, and two months read as two months rather than a slope.
 */
export function IncomeExpenseChart({
  data, loading, refreshing, error, onRetry, currency, isCached, cachedAt, onAdd, span,
}: Props) {
  const { t } = useLang()
  const reducedMotion = usePrefersReducedMotion()

  // A zero-zero month is not a low month, it is a month that was not tracked — and a bar of
  // height zero claims the former. Drop it.
  const rows = useMemo(
    () => data
      .filter(m => m.income !== 0 || m.expense !== 0)
      .map(m => ({
        ...m,
        name: MONTH_KEYS[m.month - 1] ? t(MONTH_KEYS[m.month - 1]) : m.monthName,
      })),
    [data, t],
  )

  const showLabels = rows.length <= MAX_LABELLED_MONTHS

  return (
    <Tile span={span} as="section">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-title text-slate-900">{t('cmp.dashboard.incomeVsExpenses')}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{t('cmp.dashboard.monthlyOverview')}</p>
        </div>
        <CacheBadge isCached={!!isCached} cachedAt={cachedAt ?? null} />
      </div>

      {loading ? (
        <Skeleton variant="chart" bare />
      ) : error && rows.length === 0 ? (
        // The tile around this is already drawn, so the strip — message plus Retry — is the whole
        // failure state here; a second bordered box inside a tile would read as a nested card.
        <ErrorTile compact message={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <ChartPlaceholder text={t('cmp.dashboard.chartEmpty')}>
          {onAdd && (
            <Button
              icon={<Plus className="w-4 h-4" aria-hidden="true" />}
              label={t('tx.addTransaction')}
              onClick={onAdd}
            />
          )}
        </ChartPlaceholder>
      ) : rows.length === 1 ? (
        // One month is a fact, not a comparison. Print the two figures rather than a lone pair of
        // bars floating against an axis that has nothing to compare them to.
        <>
          {/* The figure below is the last good answer; without this the refresh that failed would
              be invisible here even though the bar chart branch states it. */}
          {error && <ErrorTile compact message={error} onRetry={onRetry} className="mb-3" />}
          <ChartPlaceholder text={t('cmp.dashboard.chartOneMonth')}>
            {/* A 28px figure with tabular-nums is an unbreakable ~160px token, so two nine-digit
                amounts side by side outgrow a 318px tile on a 390px phone and push the page into a
                horizontal scroll. Compact figures — the scale every other tile on Home uses — with
                the exact value on the title, and a wrap so they stack rather than spill. */}
            <div className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2">
              <p className="text-sm text-slate-500">
                {t('tx.income')}{' '}
                <span className="text-stat text-income tabular-nums" title={moneyExact(rows[0].income, currency)}>
                  {money(rows[0].income, currency)}
                </span>
              </p>
              <p className="text-sm text-slate-500">
                {t('tx.expense')}{' '}
                <span className="text-stat text-expense tabular-nums" title={moneyExact(rows[0].expense, currency)}>
                  {money(rows[0].expense, currency)}
                </span>
              </p>
            </div>
          </ChartPlaceholder>
        </>
      ) : (
        <>
          {error && <ErrorTile compact message={error} onRetry={onRetry} className="mb-3" />}
          <div className={refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <ResponsiveContainer width="100%" height={248}>
              <BarChart
                data={rows}
                margin={{ top: showLabels ? 18 : 4, right: 4, left: 0, bottom: 0 }}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={8}
                />
                {/* 44px, because a tick keeps one decimal when the value is not whole ("999,9M"). */}
                <YAxis
                  width={44}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => moneyAxis(v, currency)}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                  formatter={(value: number) => [moneyFull(value, currency), '']}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="income" name={t('tx.income')} fill={INCOME} radius={[6, 6, 0, 0]} maxBarSize={28}
                  isAnimationActive={!reducedMotion}
                >
                  {showLabels && (
                    <LabelList
                      dataKey="income" position="top" fill="#64748b" fontSize={10}
                      formatter={(v: number) => moneyAxis(v, currency)}
                    />
                  )}
                </Bar>
                <Bar
                  dataKey="expense" name={t('tx.expense')} fill={EXPENSE} radius={[6, 6, 0, 0]} maxBarSize={28}
                  isAnimationActive={!reducedMotion}
                >
                  {showLabels && (
                    <LabelList
                      dataKey="expense" position="top" fill="#64748b" fontSize={10}
                      formatter={(v: number) => moneyAxis(v, currency)}
                    />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Tile>
  )
}

/** Same 248px box the chart occupies, so nothing on the page moves when data arrives. */
function ChartPlaceholder({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="h-[248px] flex flex-col items-center justify-center gap-3 text-center">
      <p className="max-w-xs text-sm text-slate-500">{text}</p>
      {children}
    </div>
  )
}
