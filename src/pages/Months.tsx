import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  CalendarCheck, CalendarClock, ChevronDown, ChevronRight, Coins, Lock, PiggyBank,
  TrendingUp, Wallet,
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { monthsApi } from '../api/months'
import { formatMonth, money, moneyExact, moneyFull, monthLocal } from '../utils/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Tile, TileGrid } from '../components/ui/Tile'
import { StatTile } from '../components/ui/StatTile'
import { ListRow } from '../components/ui/ListRow'
import { Button } from '../components/ui/Button'
import { ErrorTile } from '../components/ui/ErrorTile'
import { CacheBadge } from '../components/ui/CacheBadge'
import { Skeleton } from '../components/ui/Skeleton'
import { InfoDot } from '../components/ui/InfoDot'
import { ExplainModal } from '../components/ui/ExplainModal'
import type { ExplainRow } from '../components/ui/ExplainModal'
import { CloseMonthModal } from '../components/months/CloseMonthModal'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import type { Currency, MonthCloseResponse, MonthSummaryResponse } from '../types'

interface Props { currency: Currency }



/** Which envelope figure's "where did this come from?" popup is open. */
type InfoKey = 'start' | 'earned' | 'spent' | 'left' | 'tagged'

/** `YYYY-MM` shifted by whole months, on the viewer's clock. */
function shiftMonth(ym: string, by: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Calendar days from today to the last day of `ym`. Built from local date parts rather than
 * `toISOString()`, which names yesterday in Tashkent before 05:00 — and this figure is the one
 * the page uses to say "closes in N days".
 */
function daysLeftInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0)                 // day 0 of the next month = last day of this one
  const today = new Date()
  return Math.round(
    (last.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime())
    / 86_400_000,
  )
}

/**
 * A slice of the month's spending. The colour lives on the bar segment and its legend dot and
 * nowhere else — never on the tile behind them.
 */
interface Slice { key: string; label: string; value: number; color: string }

export function Months({ currency }: Props) {
  const { t, lang } = useLang()
  const [month, setMonth] = useState(monthLocal())
  const [closeOpen, setCloseOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [info, setInfo] = useState<InfoKey | null>(null)

  const summary = useApi(() => monthsApi.getSummary(month, currency), [month, currency])
  /**
   * The preview is what replaces an open month's em-dashes with figures: `spendableNow` is the
   * wallet balance the close itself would compute, so Left and Spent can be estimated with the
   * arithmetic the close will actually use rather than guessed at.
   */
  const preview = useApi(() => monthsApi.getPreview(month, currency), [month, currency])
  const history = useApi(() => monthsApi.getClosed(), [])

  const s = summary.data as MonthSummaryResponse | null
  const now = monthLocal()
  const refreshing = summary.refreshing || preview.refreshing || history.refreshing

  // An "already paid" mark raises a bucket's figure but moves no money. `taggedTotal` counts marks
  // on a closed month exactly as on an open one — that is what stops this page and the Plan quoting
  // two totals for one bucket the instant a month is closed — and `taggedRecorded` is the half that
  // really left a wallet. Both come straight from the server, so the page never re-derives either:
  //   taggedTotal = taggedRecorded + markedNotMoved, in both branches.
  const markedInTotal = s?.markedNotMoved ?? 0
  const recordedSetAside = s?.taggedRecorded ?? 0

  // The wallet balance the close itself would compute for this month end. Only meaningful while
  // the month is open and not in the future — a closed month already has the real figure frozen.
  const spendableNow = !!s && !s.closed && month <= now ? preview.data?.spendableNow ?? null : null
  const estSpent = s && spendableNow != null ? s.startBalance + s.income - spendableNow : null

  const left = s?.leftover ?? spendableNow
  const spent = s?.totalSpent ?? estSpent
  const everyday = s?.everydaySpend ?? (estSpent != null ? estSpent - recordedSetAside : null)
  /** True while the figures on screen are the live estimate rather than a frozen snapshot. */
  const estimated = !!s && !s.closed && left != null
  /**
   * The second request has not landed yet. An open month's Left comes entirely from the preview,
   * and the two requests resolve independently — the summary can come straight from the local
   * cache while the preview makes a real round trip. Without this the hero spent that gap telling
   * the user the figure is only knowable once the month is closed, then swapped in a number.
   */
  const previewPending = !!s && !s.closed && month <= now && left == null && preview.loading
  /** The estimate is only as good as the preview it comes from, so say when that failed. */
  const staleError = summary.error ?? (s && !s.closed ? preview.error : null)
  const retryAll = () => { summary.refetch(); preview.refetch() }

  // Months close in order, so the oldest month the backend will accept is the one after the
  // newest closed month. `null` means nothing has been closed yet and any month is fair game.
  const latestClosed = history.data?.[0]?.month ?? null
  const nextToClose = latestClosed ? shiftMonth(latestClosed, 1) : null
  const blockedByEarlier = !!s && !s.closed && nextToClose != null && nextToClose < month

  const monthName = formatMonth(month, lang)

  const dash = '—'
  const fmt = (v: number | null) => v != null ? money(v, currency) : dash
  const exact = (v: number | null) =>
    v != null ? t('ui.exactValue', { value: moneyExact(v, currency) }) : t('page.months.knownOnceClosed')

  const onSaved = () => {
    history.refetch()
    // Landing on the next month is the payoff of closing: its "Started with" is the figure that
    // was just frozen. Staying put would show the user the month they can no longer change.
    const next = shiftMonth(month, 1)
    if (next <= now) setMonth(next)
    else { summary.refetch(); preview.refetch() }
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={t('page.months.header')}
        subtitle={t('page.months.subtitle')}
        monthStepper={{
          label: monthName,
          onPrev: () => setMonth(shiftMonth(month, -1)),
          // A future month has no income, no spending and cannot be closed — there is nothing
          // there to look at, so the stepper stops at the current one.
          onNext: month < now ? () => setMonth(shiftMonth(month, 1)) : undefined,
        }}
        primary={s && !s.closed
          ? {
              label: t('cmp.closeMonth.closeMonth'),
              onClick: () => setCloseOpen(true),
              icon: <CalendarCheck className="w-4 h-4" aria-hidden="true" />,
            }
          : undefined}
      />

      <div className="mt-4 xl:mt-5">
        <TileGrid className={refreshing ? 'opacity-60 transition-opacity' : ''}>
          {summary.loading ? (
            <>
              <Skeleton variant="stat" className="md:col-span-3 xl:col-span-6" />
              <Skeleton variant="stat" className="md:col-span-2 xl:col-span-3" />
              <Skeleton variant="stat" className="md:col-span-2 xl:col-span-3" />
              <Skeleton variant="stat" className="md:col-span-2 xl:col-span-3" />
              <Skeleton variant="stat" className="md:col-span-2 xl:col-span-3" />
              <Skeleton variant="chart" className="md:col-span-3 xl:col-span-6" />
            </>
          ) : summary.error && !s ? (
            <ErrorTile
              className="md:col-span-6 xl:col-span-12"
              message={summary.error}
              onRetry={summary.refetch}
            />
          ) : !s ? (
            <Tile span={12}>
              <p className="text-sm text-slate-500">{t('page.months.noDataForMonth')}</p>
            </Tile>
          ) : (
            <>
              {/* Stale but readable beats blanked: the figures stay, the strip offers the retry. */}
              {staleError && (
                <ErrorTile
                  compact
                  className="md:col-span-6 xl:col-span-12"
                  message={staleError}
                  onRetry={retryAll}
                />
              )}

              {/* The hero: Left, with the chain that produces it printed underneath. */}
              <StatTile
                span={6} rows={2} hero
                label={t('page.months.left')}
                value={fmt(left)}
                caption={previewPending ? t('ui.loading') : exact(left)}
                icon={<PiggyBank className="w-4 h-4" aria-hidden="true" />}
                pill={s.closed
                  ? { text: t('page.months.closedTag'), tone: 'ok' }
                  // Shown while the preview is still in flight too, so the pill does not appear
                  // late and reflow the label row the moment the figure lands.
                  : estimated || previewPending ? { text: t('page.months.estimate'), tone: 'neutral' } : undefined}
                onInfo={() => setInfo('left')}
              >
                <div className="space-y-2">
                  <EquationRow label={t('page.months.startedWith')}
                    value={moneyFull(s.startBalance, currency)} />
                  <EquationRow label={t('page.months.earned')}
                    value={`+ ${moneyFull(s.income, currency)}`} tone="in" />
                  <EquationRow label={t('page.months.spent')}
                    value={spent != null ? `− ${moneyFull(spent, currency)}` : dash} tone="out" />
                  <p className="max-w-md pt-1 text-sm text-slate-500">
                    {s.closed
                      ? t('page.months.leftHintClosed')
                      : estimated || previewPending
                        ? t('page.months.openMonthEstimateHint')
                        : t('page.months.knownOnceClosed')}
                  </p>
                  {/* Cached figures are pixel-identical to live ones; only this says which. */}
                  <CacheBadge isCached={summary.isCached} cachedAt={summary.cachedAt} />
                </div>
              </StatTile>

              <StatTile
                span={3}
                label={t('page.months.startedWith')}
                value={money(s.startBalance, currency)}
                caption={t('page.months.startedWithHint')}
                icon={<Wallet className="w-4 h-4" aria-hidden="true" />}
                onInfo={() => setInfo('start')}
              />

              <StatTile
                span={3} tone="in"
                label={t('page.months.earned')}
                value={money(s.income, currency)}
                caption={t('page.months.earnedHint')}
                icon={<TrendingUp className="w-4 h-4" aria-hidden="true" />}
                onInfo={() => setInfo('earned')}
              />

              <StatTile
                span={3} tone="out"
                label={t('page.months.spent')}
                value={fmt(spent)}
                caption={s.closed ? t('page.months.spentHintClosed') : exact(spent)}
                icon={<Coins className="w-4 h-4" aria-hidden="true" />}
                pill={estimated ? { text: t('page.months.estimate'), tone: 'neutral' } : undefined}
                onInfo={() => setInfo('spent')}
              />

              <StatusTile
                month={month}
                monthName={monthName}
                closed={s.closed}
                isCurrent={month === now}
                pendingMonth={blockedByEarlier ? nextToClose : null}
                onCloseMonth={setCloseOpen}
                onGoToMonth={setMonth}
              />

              <WhereItWent
                summary={s}
                currency={currency}
                everyday={everyday}
                everydayIsEstimate={estimated}
                markedInTotal={markedInTotal}
                onInfo={() => setInfo('tagged')}
              />

              <ClosedMonths
                months={history.data ?? []}
                selected={month}
                open={showHistory}
                loading={history.loading}
                error={history.error}
                onRetry={history.refetch}
                onToggle={() => setShowHistory(v => !v)}
                onSelect={setMonth}
              />
            </>
          )}
        </TileGrid>
      </div>

      {info && s && (
        <ExplainModal
          open onClose={() => setInfo(null)}
          title={t(`cmp.monthInfo.${info}.title`)}
          meaning={t(`cmp.monthInfo.${info}.meaning`)}
          formula={t(`cmp.monthInfo.${info}.formula`)}
          rows={explainRows(info, { t, s, currency, spent, left, everyday, markedInTotal, recordedSetAside })}
          note={t(s.closed ? `cmp.monthInfo.${info}.note` : 'cmp.monthInfo.openMonthNote')}
        />
      )}

      <CloseMonthModal open={closeOpen} onClose={() => setCloseOpen(false)}
        onSaved={onSaved} month={month} currency={currency} />
    </div>
  )
}

// ── The hero's arithmetic ────────────────────────────────────────────────────

const EQUATION_TONE = {
  neutral: 'text-slate-900',
  in: 'text-income',
  out: 'text-expense',
} as const

/**
 * One term of `Started + Earned − Spent = Left`. Capped at `max-w-md` so the label and its figure
 * stay a readable pair instead of drifting to opposite edges of a wide tile.
 */
function EquationRow({ label, value, tone = 'neutral' }: {
  label: string
  value: string
  tone?: keyof typeof EQUATION_TONE
}) {
  return (
    <div className="flex max-w-md items-baseline justify-between gap-4">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${EQUATION_TONE[tone]}`}>{value}</span>
    </div>
  )
}

// ── Month status ─────────────────────────────────────────────────────────────

/**
 * Where this month stands: closed, closing in N days, or waiting on an earlier month that is
 * still open. The state is a sentence and a pill on a white tile — never a tinted band.
 */
function StatusTile({ month, monthName, closed, isCurrent, pendingMonth, onCloseMonth, onGoToMonth }: {
  month: string
  monthName: string
  closed: boolean
  isCurrent: boolean
  /** The earlier month that must be closed first, or null when this month is next in line. */
  pendingMonth: string | null
  onCloseMonth: (open: boolean) => void
  onGoToMonth: (month: string) => void
}) {
  const { t, lang } = useLang()

  if (closed) {
    return (
      <StatusShell
        icon={<Lock className="w-4 h-4" aria-hidden="true" />}
        iconClass="bg-slate-100 text-slate-500"
        pill={{ text: t('page.months.closedTag'), tone: 'ok' }}
        line={`${monthName} ${t('page.months.isClosedAndLocked')}`}
        caption={t('page.months.leftHintClosed')}
      />
    )
  }

  if (pendingMonth) {
    const pendingName = formatMonth(pendingMonth, lang)
    return (
      <StatusShell
        icon={<CalendarClock className="w-4 h-4" aria-hidden="true" />}
        iconClass="bg-amber-100 text-amber-600"
        pill={{ text: t('page.months.openTag'), tone: 'attention' }}
        line={t('page.months.previousStillOpen', { month: pendingName })}
        caption={t('page.months.closeInOrder')}
        action={
          <Button
            label={t('page.months.closeMonth', { month: pendingName })}
            icon={<CalendarCheck className="w-4 h-4" aria-hidden="true" />}
            onClick={() => { onGoToMonth(pendingMonth); onCloseMonth(true) }}
            className="w-full"
          />
        }
      />
    )
  }

  const days = daysLeftInMonth(month)
  const line = !isCurrent
    ? t('page.months.previousStillOpen', { month: monthName })
    : days <= 0 ? t('page.months.closesToday', { month: monthName })
    : days === 1 ? t('page.months.closesInDay', { month: monthName })
    : t('page.months.closesInDays', { month: monthName, days })

  return (
    <StatusShell
      icon={<CalendarClock className="w-4 h-4" aria-hidden="true" />}
      iconClass="bg-slate-100 text-slate-500"
      pill={{ text: t('page.months.openTag'), tone: 'neutral' }}
      line={line}
      caption={t('page.months.closeThisMonthHint')}
    />
  )
}

const STATUS_PILL = {
  ok: 'bg-emerald-50 text-emerald-700',
  attention: 'bg-amber-50 text-amber-700',
  neutral: 'bg-slate-100 text-slate-600',
} as const

function StatusShell({ icon, iconClass, pill, line, caption, action }: {
  icon: ReactNode
  iconClass: string
  pill: { text: string; tone: keyof typeof STATUS_PILL }
  line: string
  caption: string
  action?: ReactNode
}) {
  const { t } = useLang()
  return (
    <Tile span={3} as="section">
      <div className="flex items-start justify-between gap-3">
        <p className="text-label uppercase text-slate-500">{t('page.months.monthStatus')}</p>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-chip ${iconClass}`}>
          {icon}
        </div>
      </div>
      <span className={`mt-3 inline-flex items-center rounded-chip px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[pill.tone]}`}>
        {pill.text}
      </span>
      <p className="mt-2 text-sm font-medium text-slate-900">{line}</p>
      <p className="mt-1 text-sm text-slate-500">{caption}</p>
      {action && <div className="mt-3">{action}</div>}
    </Tile>
  )
}

// ── Where it went ────────────────────────────────────────────────────────────

/**
 * The shape of the month's spending: a stacked bar, its legend, and the total the legend adds up
 * to. The rows are built from the payload rather than hard-coded, and any component the backend
 * counts but this list does not name lands in "Other" — so the rows can never fail to sum to the
 * total printed under them.
 */
function WhereItWent({ summary, currency, everyday, everydayIsEstimate, markedInTotal, onInfo }: {
  summary: MonthSummaryResponse
  currency: Currency
  everyday: number | null
  everydayIsEstimate: boolean
  /** The share of `summary.taggedTotal` that was only marked as paid — 0 once the month is closed. */
  markedInTotal: number
  onInfo: () => void
}) {
  const { t } = useLang()

  // Donation, emergency and investments carry their bucket identity hue, which the user meets
  // again on Plan and Finance. Stocks and savings goals have no identity anywhere else in the
  // app, so they take steps of the same neutral ramp as the residual rows below rather than two
  // hues the reader has nothing to match against.
  const buckets: Slice[] = [
    { key: 'donation', label: t('page.months.donation'), value: summary.donation, color: 'bg-pink-500' },
    { key: 'emergency', label: t('page.months.emergency'), value: summary.emergency, color: 'bg-amber-500' },
    { key: 'investments', label: t('page.months.investments'), value: summary.investments, color: 'bg-teal-500' },
    // Stocks was retired as an allocation bucket but the month envelope still counts it, and
    // historical data can still carry one — so it is listed whenever it holds money.
    { key: 'stocks', label: t('page.months.stocks'), value: summary.stocks, color: 'bg-slate-600' },
    { key: 'savings', label: t('page.months.savingsGoals'), value: summary.savings, color: 'bg-slate-500' },
  ].filter(b => b.key !== 'stocks' || b.value !== 0)

  const listed = buckets.reduce((sum, b) => sum + b.value, 0)
  const other = summary.taggedTotal - listed
  // Sub-unit noise is rounding, not a missing bucket; anything larger is real money the list owes
  // the reader an explanation for.
  const rows = Math.abs(other) >= 1
    ? [...buckets, { key: 'other', label: t('page.months.otherSetAside'), value: other, color: 'bg-slate-400' }]
    : buckets

  const segments = [
    ...rows,
    ...(everyday != null ? [{ key: 'everyday', label: t('page.months.everydaySpending'), value: everyday, color: 'bg-slate-300' }] : []),
  ].filter(sg => sg.value > 0)
  const barTotal = segments.reduce((sum, sg) => sum + sg.value, 0)

  return (
    <Tile span={6} as="section">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-title text-slate-900">{t('page.months.whereItWent')}</h2>
        <InfoDot label={t('cmp.cardInfo.button', { title: t('page.months.whereItWent') })}
          onClick={onInfo} className="p-3 -m-3" />
      </div>

      {/* Decorative: every segment is repeated as a legend row below, with the same figure and
          the same dot, so nothing here is the only way to reach a number. */}
      {barTotal > 0 && (
        <div aria-hidden="true" className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
          {segments.map(sg => (
            <div
              key={sg.key}
              className={sg.color}
              style={{ width: `${(sg.value / barTotal) * 100}%` }}
              title={`${sg.label} · ${moneyFull(sg.value, currency)}`}
            />
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {rows.map(r => (
          <LegendRow key={r.key} color={r.color} label={r.label} value={moneyFull(r.value, currency)} />
        ))}

        <div className="flex max-w-md items-center justify-between gap-4 border-t border-hairline pt-2 text-sm font-semibold">
          <span className="text-slate-600">{t('page.months.taggedTotal')}</span>
          <span className="tabular-nums text-slate-900">{moneyFull(summary.taggedTotal, currency)}</span>
        </div>

        {/* A mark says "I already paid this" — the plan counts it, but no wallet moved, so the
            close will not book it. Naming the share is the only honest way to show both. It is a
            share of the total above only while the month is open; a closed month's total never
            contained it, so "of which" would print a part larger than its whole. */}
        {markedInTotal > 0 && (
          <p className="max-w-md text-sm text-slate-500">
            {t('page.months.markedNotMoved')} · <span className="tabular-nums">{moneyFull(markedInTotal, currency)}</span>
          </p>
        )}

        {/* Everyday spending is not part of "Set aside" — it is the rest of Spent — so it sits
            below the total rather than among the rows that produce it. */}
        <div className="pt-1">
          <LegendRow
            color="bg-slate-300"
            label={t('page.months.everydaySpending')}
            value={everyday != null ? moneyFull(everyday, currency) : t('page.months.knownOnceClosed')}
            caption={everyday != null && everydayIsEstimate ? t('page.months.estimate') : undefined}
          />
        </div>
      </div>
    </Tile>
  )
}

function LegendRow({ color, label, value, caption }: {
  color: string
  label: string
  value: string
  caption?: string
}) {
  return (
    <div className="flex max-w-md items-center justify-between gap-4 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-slate-500">
        <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-slate-900">
        <span className="tabular-nums">{value}</span>
        {caption && <span className="ml-1.5 text-slate-500">{caption}</span>}
      </span>
    </div>
  )
}

// ── Closed months ────────────────────────────────────────────────────────────

/**
 * The archive, open by default — it used to be a shut drawer, which is exactly where the answer
 * to "what did last month actually leave me?" lived. Selecting a row moves the whole page to that
 * month, so the history doubles as the way back to any month that has been closed.
 */
function ClosedMonths({ months, selected, open, loading, error, onRetry, onToggle, onSelect }: {
  months: MonthCloseResponse[]
  selected: string
  open: boolean
  loading: boolean
  error: string | null
  onRetry: () => void
  onToggle: () => void
  onSelect: (month: string) => void
}) {
  const { t, lang } = useLang()

  return (
    <Tile span={6} padding="none" as="section">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="focus-ring flex w-full cursor-pointer items-center justify-between gap-3 rounded-tile px-5 py-4 text-left"
      >
        <span className="text-title text-slate-900">
          {t('page.months.closedMonthsCount', { count: months.length })}
        </span>
        {open
          ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
          : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />}
      </button>

      {open && (
        <div className="border-t border-hairline">
          {loading ? (
            <Skeleton variant="row" count={3} bare />
          ) : error && months.length === 0 ? (
            <div className="p-4"><ErrorTile message={error} onRetry={onRetry} /></div>
          ) : months.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">{t('page.months.noClosedMonths')}</p>
          ) : (
            <>
              {error && <ErrorTile compact className="m-4 mb-0" message={error} onRetry={onRetry} />}
              <div className="divide-y divide-hairline">
              {months.map(m => (
                <ListRow
                  key={m.id}
                  leading={
                    <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-slate-100 text-slate-500">
                      <Lock className="w-4 h-4" aria-hidden="true" />
                    </span>
                  }
                  title={formatMonth(m.month, lang)}
                  subtitle={`${t('page.months.earned')} ${moneyFull(m.income, m.currency)} · ${t('page.months.spent')} ${moneyFull(m.totalSpent, m.currency)}`}
                  badges={
                    <span className="rounded-chip bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {t('page.months.closedTag')}
                    </span>
                  }
                  amount={moneyFull(m.leftover, m.currency)}
                  amountCaption={t('page.months.left')}
                  selected={m.month === selected}
                  onClick={() => onSelect(m.month)}
                />
              ))}
              </div>
            </>
          )}
        </div>
      )}
    </Tile>
  )
}

// ── Explanations ─────────────────────────────────────────────────────────────

/**
 * The rows behind each figure. They are computed from exactly the values the tiles rendered, so
 * the explanation can never claim arithmetic the page did not do — including, on an open month,
 * the marked share, which is the whole reason "Set aside" and the figure the close will freeze
 * differ.
 */
function explainRows(info: InfoKey, ctx: {
  t: (key: TKey, vars?: Record<string, string | number>) => string
  s: MonthSummaryResponse
  currency: Currency
  spent: number | null
  left: number | null
  everyday: number | null
  /** Marks counted inside `s.taggedTotal` — 0 for a closed month, whose snapshot excludes them. */
  markedInTotal: number
  recordedSetAside: number
}): ExplainRow[] | undefined {
  const { t, s, currency, spent, left, everyday, markedInTotal, recordedSetAside } = ctx
  const dash = '—'
  const full = (v: number | null) => v != null ? moneyFull(v, currency) : dash
  const row = (key: TKey, value: string, strong = false): ExplainRow => ({ label: t(key), value, strong })

  if (info === 'left') {
    return [
      row('page.months.startedWith', moneyFull(s.startBalance, currency)),
      row('page.months.earned', `+ ${moneyFull(s.income, currency)}`),
      row('page.months.spent', spent != null ? `− ${moneyFull(spent, currency)}` : dash),
      row('page.months.left', full(left), true),
    ]
  }

  if (info === 'spent') {
    const rows = [row('page.months.taggedTotal', moneyFull(s.taggedTotal, currency))]
    // An open month's Set aside counts marks, so without these two lines the figure the close
    // will freeze never appears and the rows below do not reconcile with it. A closed month's
    // Set aside is already the recorded figure, so the deduction is not made and not shown —
    // its three rows add up on their own.
    if (markedInTotal > 0) {
      rows.push(row('page.months.markedNotMoved', `− ${moneyFull(markedInTotal, currency)}`))
      rows.push(row('page.months.setAsideRecorded', moneyFull(recordedSetAside, currency)))
    }
    rows.push(row('page.months.everydaySpending', full(everyday)))
    rows.push(row('page.months.spent', full(spent), true))
    return rows
  }

  if (info === 'tagged') {
    const rows = [
      row('page.months.donation', moneyFull(s.donation, currency)),
      row('page.months.emergency', moneyFull(s.emergency, currency)),
      row('page.months.investments', moneyFull(s.investments, currency)),
    ]
    if (s.stocks !== 0) rows.push(row('page.months.stocks', moneyFull(s.stocks, currency)))
    rows.push(row('page.months.savingsGoals', moneyFull(s.savings, currency)))
    rows.push(row('page.months.taggedTotal', moneyFull(s.taggedTotal, currency), true))
    return rows
  }

  return undefined
}
