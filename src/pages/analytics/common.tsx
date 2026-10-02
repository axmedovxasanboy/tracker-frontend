import type { ReactNode } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Maximize2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Tile, TileGrid } from '../../components/ui/Tile'
import type { TileMdSpan, TileSpan } from '../../components/ui/Tile'
import { TextRow } from '../../components/analytics/BulletRow'
import { dayWord, historyHref, lineLabel, monthWord } from '../../components/analytics/figures'
import type { LineMode } from '../../components/analytics/figures'
import { SECTION_LABEL } from '../../components/analytics/sections'
import type { Section } from '../../components/analytics/sections'
import { compact } from '../../components/analytics/shared'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { formatNumber } from '../../utils/format'
import type { AnalyticsBreakdown, BreakdownLine, ReceivedForOtherMonth } from '../../types/analyticsBreakdown'
import type { TransactionFlow } from '../../types/fixes'

/**
 * What the layout hands every Analytics page through `<Outlet context>`: the ONE answer for the
 * month (or the twelve months) on screen. Pages draw it and fetch nothing of their own.
 */
export interface AnalyticsCtx {
  d: AnalyticsBreakdown
  /** The month on screen, YYYY-MM. On 12 months, the current month. */
  month: string
  thisMonth: string
  /** `?month=…` (empty for the current month), carried by every link between the pages. */
  search: string
  /** Faded while newer figures load (§3.0 "Refreshing after a save"). */
  dim: string
}

export function useAnalytics(): AnalyticsCtx {
  return useOutletContext<AnalyticsCtx>()
}

/** How a page is drawn: on its own route, or inside a 12-months card or sheet (§3.6). */
export interface PageProps {
  mode?: LineMode
  size?: 'full' | 'mini'
  /** The mini card's Open button. */
  onOpen?: () => void
}

// ── Layout ───────────────────────────────────────────────────────────────────────────────────

/**
 * A page's grid. On its own route it is the tile grid; inside a 12-months sheet — already a
 * surface, and narrower than the grid's breakpoints assume — the blocks simply stack.
 */
export function PageGrid({ mode, children }: { mode: LineMode; children: ReactNode }) {
  const { dim } = useAnalytics()
  if (mode === 'range') return <div className="space-y-6">{children}</div>
  return <TileGrid className={dim}>{children}</TileGrid>
}

/** One block of a page: a tile on the grid, or a plain section in a sheet. */
export function Block({ mode, span = 12, mdSpan, rows, title, children }: {
  mode: LineMode
  span?: TileSpan
  mdSpan?: TileMdSpan
  rows?: 1 | 2
  title?: string
  children: ReactNode
}) {
  if (mode === 'range') {
    // Inside a sheet, whose own title is the h2.
    return (
      <section className="border-t border-hairline pt-4 first:border-t-0 first:pt-0">
        {title && <h3 className="text-title text-slate-900">{title}</h3>}
        {children}
      </section>
    )
  }
  return (
    <Tile span={span} mdSpan={mdSpan} rows={rows} as="section">
      {title && <h2 className="text-title text-slate-900">{title}</h2>}
      {children}
    </Tile>
  )
}

/** A figure in a range is exact (the sheet adds up digit for digit); on a month page it is compact. */
export function amountOf(value: number, mode: LineMode): string {
  return mode === 'range' ? formatNumber(value) : compact(value)
}

// ── In: money that belongs to one month and arrived in another (§1.3) ─────────────────────────

/** The leaves' "received in another month" entries — a root's own when it has no children. */
function otherMonthEntries(lines: BreakdownLine[]): { date: string; amount: number }[] {
  return lines.flatMap(l => {
    const fromChildren = l.children.flatMap(c => c.otherMonth)
    return fromChildren.length > 0 ? fromChildren : l.otherMonth
  })
}

/**
 * "7,2 M of it received 2 Oct" — money counted in this month that arrived in another; several
 * dates are summed: "… received in other months". Null when there is none.
 */
export function useReceivedCaptions() {
  const { t, lang } = useLang()
  const receivedOn = (entries: { date: string; amount: number }[]): string | null => {
    const total = entries.reduce((s, e) => s + e.amount, 0)
    if (total === 0) return null
    const dates = [...new Set(entries.map(e => e.date))]
    return dates.length === 1
      ? t('an.receivedOn', { amount: compact(total), date: dayWord(dates[0], lang) })
      : t('an.receivedOnMany', { amount: compact(total) })
  }
  /** "7,2 M received 2 Oct counts in September" — money that arrived here and counts elsewhere. */
  const countsIn = (rows: ReceivedForOtherMonth[]): string | null => {
    const total = rows.reduce((s, r) => s + r.amount, 0)
    if (total === 0) return null
    const one = new Set(rows.map(r => `${r.date}|${r.countedIn}`)).size === 1
    return one
      ? t('an.countsIn', {
          amount: compact(total),
          date: dayWord(rows[0].date, lang),
          month: monthWord(rows[0].countedIn, lang),
        })
      : t('an.countsInMany', { amount: compact(total) })
  }
  return {
    receivedOn,
    /** For a whole list (Totals' In row): every leaf's entries together. */
    receivedOnAll: (lines: BreakdownLine[]) => receivedOn(otherMonthEntries(lines)),
    countsIn,
  }
}

/** "Monthly income: 8 M" beside In — the figure the advisor plans with; never a base (§1.2). */
export function useStableIncomeCaption() {
  const { t } = useLang()
  return (d: AnalyticsBreakdown) =>
    d.stableIncome != null && d.stableIncome > 0 ? t('an.stableIncome', { amount: compact(d.stableIncome) }) : null
}

// ── Not counted as In or Out (§1.4) ──────────────────────────────────────────────────────────

/**
 * Money that moved and is none of In, Out or Set aside: borrowed, lent, paid back, taken from
 * savings. Shown, never compared — no tick, no caption — each a link to its rows in History.
 * Hidden when none of the asked flows moved.
 */
export function NotCountedBlock({ flows, titleKey, mode, span = 5 }: {
  flows: TransactionFlow[]
  titleKey: TKey
  mode: LineMode
  span?: TileSpan
}) {
  const { t, lang, categoryName } = useLang()
  const { d, month } = useAnalytics()
  const lines = flows
    .map(flow => d.moved.find(l => l.flow === flow || l.key === `moved:${flow}`))
    .filter((l): l is BreakdownLine => !!l && l.amount !== 0)
  if (lines.length === 0) return null
  return (
    <Block mode={mode} span={span} mdSpan={6} title={t(titleKey)}>
      <div className="mt-2">
        {lines.map(l => (
          <TextRow
            key={l.key}
            label={lineLabel(l, t, categoryName, lang)}
            amount={amountOf(l.amount, mode)}
            to={mode === 'month' ? historyHref(month, l.history ?? { flow: l.flow ?? undefined }) : null}
          />
        ))}
      </div>
    </Block>
  )
}

// ── 12 months: a page in small ───────────────────────────────────────────────────────────────

/**
 * The frame of a 12-months mini (§3.6): the page's name, its range total and a 44px Open button
 * that shows the page full size. The card is not itself a button — nothing interactive nests.
 */
export function MiniCard({ section, total, onOpen, children }: {
  section: Section
  total?: number
  onOpen?: () => void
  children: ReactNode
}) {
  const { t } = useLang()
  const name = t(SECTION_LABEL[section])
  return (
    <Tile span={6} mdSpan={6} as="section">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-title text-slate-900 [overflow-wrap:anywhere]">{name}</h2>
        <div className="flex shrink-0 items-center gap-2">
          {total != null && <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">{compact(total)}</span>}
          {onOpen && (
            <Button
              variant="secondary"
              size="md"
              icon={<Maximize2 className="h-4 w-4" aria-hidden="true" />}
              label={t('an.open')}
              onClick={onOpen}
              aria-haspopup="dialog"
            />
          )}
        </div>
      </div>
      {children}
    </Tile>
  )
}

/** One row of a mini: the name, its months as slots, and the range total in compact form. */
export function MiniRow({ label, amount, months, strip }: {
  label: string
  amount: number
  /** How many months the range spans, for the screen reader's "in 2 months". */
  months: number
  strip: ReactNode
}) {
  const { t } = useLang()
  return (
    <li className="flex min-h-[32px] items-center gap-3 py-1">
      <span className="min-w-0 flex-1 text-sm text-slate-700 [overflow-wrap:anywhere]">{label}</span>
      {strip}
      <span className="w-14 shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-slate-900">
        {compact(amount)}
        <span className="sr-only"> {t('an.year.inMonths', { count: months })}</span>
      </span>
    </li>
  )
}
