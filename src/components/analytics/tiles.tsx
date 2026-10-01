import { useState } from 'react'
import type { ReactNode, Ref } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronUp, Target,
} from 'lucide-react'
import { Tile } from '../ui/Tile'
import type { TileSpan } from '../ui/Tile'
import { Button } from '../ui/Button'
import { CacheBadge } from '../ui/CacheBadge'
import { IconChip } from '../ui/IconChip'
import { LinkButton, TileHead } from '../home/HomeTiles'
import { SAVINGS_ICON, SAVINGS_NAME_KEY } from '../savings/SavingsThisMonth'
import { useLang } from '../../i18n/LanguageContext'
import { formatDate, money, moneyExact, moneyFull, plural } from '../../utils/format'
import { CategoryBars } from './CategoryBars'
import type { CategoryBarItem } from './CategoryBars'
import { Meter } from './Meter'
import { SplitBar } from './SplitBar'
import type { SplitSegment } from './SplitBar'
import { LegendRow, shareOf } from './shared'
import type { Series } from './shared'
import { DONATION_COUNTS_AS_SAVED, SHOW_WITHOUT_BONUS_LINE, savedAndGiven } from './decisions'
import type {
  AnalyticsLoanLine, AnalyticsPosition, AnalyticsResponse, AnalyticsSavingKind, AnalyticsSavingLine,
} from '../../types/analytics'

export type AnalyticsView = 'month' | 'year'

/** How many categories "Everyday spending" names before the rest become "Other". */
const TOP_CATEGORIES = 6
/** Below this, a difference is "about the same" — one so'm of rounding is not a result. */
const EVEN = 1000

/** What every tile is told about the period on screen. */
export interface PeriodInfo {
  view: AnalyticsView
  /** The month links into History carry: the month on screen, or the range's last one. */
  month: string
  /** A heading: "September 2026", "Last 12 months". */
  label: string
  /** The month before the one on screen, by name ("August") — only when it has data. */
  previousName: string | null
}

// ── A. The period in one line ──────────────────────────────────────────────────────────────────

/**
 * The hero: what was left of what came in, and where the rest went — one figure, History's In /
 * Out / Saved line, and two bars on a shared scale ("In" above "Where it went"). The lists under
 * the bars are the bars' text equivalent; the four places money goes jump to the tile that
 * details them. Kept short on purpose: the rows carry the exact amounts, the tiles the detail.
 */
export function PeriodHero({ d, period, cached, justStarted, onSeePrevious, onJump }: {
  d: AnalyticsResponse
  period: PeriodInfo
  cached: { isCached: boolean; cachedAt: string | null }
  /** The month on screen has only just begun and the one before it has data. */
  justStarted: boolean
  /** Go to the month before — offered on an empty or just-started current month. */
  onSeePrevious?: { label: string; go: () => void }
  onJump: (to: 'everyday' | 'fixed' | 'saved') => void
}) {
  const { t } = useLang()
  const f = d.totals
  const { saved, given } = savedAndGiven(f)
  // A wallet check that found more than expected can outweigh a quiet period's spending; a bar
  // cannot be shorter than nothing, and History clamps its "Out" the same way.
  const everyday = Math.max(0, f.everyday)
  const out = Math.max(0, f.out)
  const went = everyday + f.bills + f.loanPayments + saved + given
  const left = f.leftOver
  const short = left <= -EVEN
  const scale = Math.max(f.earned, went)

  if (f.count === 0) {
    return (
      <Tile span={12} padding="hero" as="section">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-label uppercase text-slate-500">{period.label}</h2>
          <CacheBadge isCached={cached.isCached} cachedAt={cached.cachedAt} />
        </div>
        <p className="mt-3 text-title text-slate-900">{t('analytics.a.empty')}</p>
        <NotYetLine count={d.notYetCount} />
        {onSeePrevious && (
          <div className="mt-4">
            <Button label={t('analytics.a.seeMonth', { month: onSeePrevious.label })} onClick={onSeePrevious.go} />
          </div>
        )}
      </Tile>
    )
  }

  const inSegments: SplitSegment[] = [
    { key: 'pay', value: f.earnedPay, series: 'pay' },
    { key: 'bonus', value: f.earnedBonus, series: 'bonus' },
    { key: 'other', value: f.earnedOther, series: 'other' },
  ]
  const wentSegments: SplitSegment[] = [
    { key: 'everyday', value: everyday, series: 'everyday' },
    { key: 'bills', value: f.bills, series: 'bills' },
    { key: 'loans', value: f.loanPayments, series: 'loans' },
    { key: 'saved', value: saved, series: 'saved' },
    { key: 'given', value: given, series: 'given' },
    { key: 'left', value: Math.max(0, left), hatched: true },
  ]

  // Without the bonus, would what went out still have been covered?
  const withoutBonus = f.leftOver - f.earnedBonus
  const bonusLine = SHOW_WITHOUT_BONUS_LINE && f.earnedBonus > 0 && withoutBonus <= -EVEN
    ? t(period.view === 'month' ? 'analytics.a.withoutBonus' : 'analytics.a.withoutBonusRange',
        { amount: money(-withoutBonus) })
    : null

  // Against the month before — Month view only, and only when that month has anything in it.
  const prev = period.view === 'month' ? d.previous : null
  const comparison = prev && period.previousName
    ? (() => {
        const before = Math.max(0, prev.out)
        const diff = out - before
        if (Math.abs(diff) < Math.max(EVEN, before * 0.01)) return t('analytics.a.outSame', { month: period.previousName })
        return t(diff > 0 ? 'analytics.a.outMore' : 'analytics.a.outLess',
          { amount: money(Math.abs(diff)), month: period.previousName })
      })()
    : null

  // Exact figures, as History writes its own "Borrowed" and "Lent" lines: a compact "2 M" for
  // 1.955.000 would not match the row it came from.
  const moved = [
    f.borrowed > 0 ? t('analytics.a.borrowed', { amount: moneyFull(f.borrowed) }) : null,
    f.lent > 0 ? t('analytics.a.lent', { amount: moneyFull(f.lent) }) : null,
    f.returned > 0 ? t('analytics.a.returned', { amount: moneyFull(f.returned) }) : null,
    f.fromSavings > 0 ? t('analytics.a.fromSavings', { amount: moneyFull(f.fromSavings) }) : null,
  ].filter(Boolean)

  const months = Math.max(1, d.months.length)

  return (
    <Tile span={12} padding="hero" as="section">
      <div className="flex items-start justify-between gap-3">
        <h2 className={`text-label uppercase ${short ? 'text-expense' : 'text-slate-500'}`}>
          {t(short ? 'analytics.a.short' : 'analytics.a.leftOver', { period: period.label })}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <CacheBadge isCached={cached.isCached} cachedAt={cached.cachedAt} />
          {short && (
            <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-rose-50 text-expense" aria-hidden="true">
              <AlertTriangle className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>

      <p
        className={`mt-3 text-hero tabular-nums whitespace-nowrap ${short ? 'text-expense' : 'text-slate-900'}`}
        title={moneyExact(Math.abs(left))}
      >
        {money(Math.abs(left))}
      </p>

      {/* The same three figures History shows for this month, in History's words. */}
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular-nums text-slate-500">
        <span>{t('shell.history.in')} <span className="font-medium text-slate-900">{money(f.earned)}</span></span>
        <span>{t('shell.history.out')} <span className="font-medium text-slate-900">{money(out)}</span></span>
        <span>{t('shell.history.saved')} <span className="font-medium text-slate-900">{money(saved)}</span></span>
        {given > 0 && (
          <span>{t('fix.given')} <span className="font-medium text-slate-900">{money(given)}</span></span>
        )}
      </p>
      {period.view === 'year' && (
        <p className="mt-1 text-sm tabular-nums text-slate-500">
          {t('analytics.a.perMonth', { in: money(f.earned / months), out: money(out / months) })}
        </p>
      )}

      {/* Two bars, one scale: whichever is longer is the answer. */}
      <div className="mt-5 space-y-4">
        <div>
          <BarHead name={t('shell.history.in')} total={moneyFull(f.earned)} />
          <SplitBar segments={inSegments} scale={scale} />
        </div>
        <div>
          <BarHead name={t('shell.history.whereItWent')} total={moneyFull(went)} />
          <SplitBar segments={wentSegments} scale={scale} marker={left < 0 ? f.earned : undefined} />
          {short && (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium tabular-nums text-expense">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('analytics.a.moreThanIn', { amount: moneyFull(-left) })}
            </p>
          )}
        </div>
      </div>

      <div className={`mt-4 grid gap-x-10 gap-y-3 ${f.earned > 0 ? 'md:grid-cols-2' : ''}`}>
        {/* Nothing came in: no list to show, and the other takes the row. */}
        {f.earned > 0 && <ul aria-label={t('shell.history.in')}>
          {f.earnedPay > 0 && (
            <LegendRow series="pay" name={t('analytics.a.pay')}
              amount={moneyFull(f.earnedPay)} share={shareOf(f.earnedPay, f.earned)} />
          )}
          {f.earnedBonus > 0 && (
            <LegendRow series="bonus" name={t('analytics.a.bonus')}
              amount={moneyFull(f.earnedBonus)} share={shareOf(f.earnedBonus, f.earned)} />
          )}
          {f.earnedOther > 0 && (
            <LegendRow series="other" name={t('analytics.a.otherIncome')}
              amount={moneyFull(f.earnedOther)} share={shareOf(f.earnedOther, f.earned)} />
          )}
        </ul>}
        <ul aria-label={t('shell.history.whereItWent')}>
          <LegendRow series="everyday" name={t('analytics.group.everyday')}
            amount={moneyFull(everyday)} share={shareOf(everyday, f.earned)}
            onClick={() => onJump('everyday')} />
          <LegendRow series="bills" name={t('analytics.group.bills')}
            amount={moneyFull(f.bills)} share={shareOf(f.bills, f.earned)}
            onClick={() => onJump('fixed')} />
          <LegendRow series="loans" name={t('analytics.group.loans')}
            amount={moneyFull(f.loanPayments)} share={shareOf(f.loanPayments, f.earned)}
            onClick={() => onJump('fixed')} />
          <LegendRow series="saved" name={t('shell.history.saved')}
            amount={moneyFull(saved)} share={shareOf(saved, f.earned)}
            onClick={() => onJump('saved')} />
          {given > 0 && (
            <LegendRow series="given" name={t('fix.given')}
              amount={moneyFull(given)} share={shareOf(given, f.earned)}
              onClick={() => onJump('saved')} />
          )}
          {left >= EVEN && (
            <LegendRow hatched name={t('analytics.group.leftOver')}
              amount={moneyFull(left)} share={shareOf(left, f.earned)} />
          )}
        </ul>
      </div>

      {(bonusLine || comparison || moved.length > 0 || d.notYetCount > 0 || (justStarted && onSeePrevious)) && (
        <div className="mt-4 space-y-2 border-t border-hairline pt-4">
          {bonusLine && (
            <p className="flex items-start gap-2 text-sm font-medium text-amber-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{bonusLine}</span>
            </p>
          )}
          {comparison && <p className="text-sm tabular-nums text-slate-700">{comparison}</p>}
          {moved.length > 0 && (
            <p className="text-sm tabular-nums text-slate-500">
              {t('analytics.a.alsoMoved')} {moved.join(' · ')}
            </p>
          )}
          <NotYetLine count={d.notYetCount} />
          {justStarted && onSeePrevious && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm text-slate-500">{t('analytics.a.justStarted')}</p>
              <LinkButton label={t('analytics.a.seeMonth', { month: onSeePrevious.label })} onClick={onSeePrevious.go} />
            </div>
          )}
        </div>
      )}

      <HowItAddsUp d={d} out={out} saved={saved} given={given} />
    </Tile>
  )
}

/** A bar's name on the left and its total on the right, above the bar. */
function BarHead({ name, total }: { name: string; total: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="min-w-0 text-sm font-medium text-slate-700">{name}</span>
      <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">{total}</span>
    </div>
  )
}

/** "2 entries dated later this month are not counted yet." — nothing when there are none. */
function NotYetLine({ count }: { count: number }) {
  const { t, lang } = useLang()
  if (!(count > 0)) return null
  return (
    <p className="text-sm text-slate-500">
      {plural(count, t('analytics.a.notYetOne'), t('analytics.a.notYet'), lang)}
    </p>
  )
}

/**
 * "How is this worked out?" — the same disclosure Home's hero has. It ends on what the wallets
 * actually did, which is the proof that the page's figures add up.
 */
function HowItAddsUp({ d, out, saved, given }: {
  d: AnalyticsResponse
  out: number
  saved: number
  given: number
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const f = d.totals
  const panelId = 'analytics-how-panel'
  const row = 'flex items-baseline justify-between gap-3 py-1.5 text-sm'
  const strong = 'flex items-baseline justify-between gap-3 border-t border-hairline py-1.5 text-sm font-semibold text-slate-900'

  const line = (label: string, sign: '+' | '−', amount: number) => (
    <div className={row}>
      <span className="min-w-0 text-slate-600">{label}</span>
      <span className="shrink-0 whitespace-nowrap tabular-nums text-slate-900">{sign}{moneyFull(amount)}</span>
    </div>
  )

  return (
    <div className="mt-4 border-t border-hairline pt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="focus-ring flex min-h-[44px] w-full items-center justify-between gap-3 rounded-control text-left text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        {t('home.how.toggle')}
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
      </button>
      {open && (
        <div id={panelId} className="pb-1 md:max-w-md">
          {line(t('shell.history.in'), '+', f.earned)}
          {line(t('shell.history.out'), '−', out)}
          {line(t('shell.history.saved'), '−', saved)}
          {given > 0 && line(t('fix.given'), '−', given)}
          <div className={strong}>
            <span className="min-w-0">{t('analytics.group.leftOver')}</span>
            <span className="shrink-0 whitespace-nowrap tabular-nums">{moneyFull(f.leftOver)}</span>
          </div>
          {f.borrowed > 0 && line(t('analytics.a.how.borrowed'), '+', f.borrowed)}
          {f.lent > 0 && line(t('analytics.a.how.lent'), '−', f.lent)}
          {f.returned > 0 && line(t('analytics.a.how.returned'), '+', f.returned)}
          {f.fromSavings > 0 && line(t('analytics.a.how.fromSavings'), '+', f.fromSavings)}
          <div className={strong}>
            <span className="min-w-0">{t('analytics.a.walletsChanged')}</span>
            <span className="shrink-0 whitespace-nowrap tabular-nums">{moneyFull(f.walletChange)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared tile furniture ──────────────────────────────────────────────────────────────────────

/**
 * A tile's title, its one figure and at most one short line. The exact amount is the figure's
 * tooltip only: on this page the rows under it already print every amount in full.
 */
function TileLead({ title, headingRef, figure, exact, sentence, tone = 'neutral' }: {
  title: string
  headingRef?: Ref<HTMLHeadingElement>
  figure?: string
  exact?: string
  sentence?: ReactNode
  tone?: 'neutral' | 'out'
}) {
  return (
    <>
      <TileHead title={title} headingRef={headingRef} />
      {figure && (
        <p className={`mt-2 text-stat tabular-nums ${tone === 'out' ? 'text-expense' : 'text-slate-900'}`} title={exact}>
          {figure}
        </p>
      )}
      {sentence && <p className="mt-1 text-sm text-slate-600">{sentence}</p>}
    </>
  )
}

// ── B. Everyday spending ───────────────────────────────────────────────────────────────────────

/**
 * Everyday spending by top-level category, largest first — the six biggest, then "Other", then
 * what wallet checks found with no details behind it, kept apart so it never passes for detail.
 */
export function EverydayTile({ d, period, span, headingRef, onCategory, onHistory }: {
  d: AnalyticsResponse
  period: PeriodInfo
  span: TileSpan
  headingRef?: Ref<HTMLHeadingElement>
  /** Open History on one category (null: no category) in the period's month. */
  onCategory: (categoryId: number | null) => void
  onHistory: () => void
}) {
  const { t, categoryName } = useLang()
  const e = d.everyday
  const total = Math.max(0, e.total)
  const categories = [...(e.categories ?? [])].filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount)
  const top = categories.slice(0, TOP_CATEGORIES)
  const otherAmount = categories.slice(TOP_CATEGORIES).reduce((sum, c) => sum + c.amount, 0)
  const unitemised = Math.max(0, e.unitemised)
  const nameOf = (c: { categoryId: number | null; name: string; nameUz: string | null }) =>
    c.categoryId == null ? t('analytics.b.uncategorised') : categoryName(c)

  const pct = (amount: number) => {
    const s = shareOf(amount, total)
    return s ? `${s}%` : null
  }
  // Against the month before: an arrow and the words, never the colour alone.
  const change = (amount: number, before: number | null) => {
    if (period.view !== 'month' || before == null || !period.previousName) return null
    const diff = amount - before
    if (Math.abs(diff) < EVEN) return null
    const Icon = diff > 0 ? ArrowUp : ArrowDown
    return (
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        {t(diff > 0 ? 'analytics.b.more' : 'analytics.b.less', { amount: money(Math.abs(diff)), month: period.previousName })}
      </span>
    )
  }
  const note = (parts: ReactNode[]) => {
    const shown = parts.filter(Boolean)
    if (shown.length === 0) return undefined
    return (
      <span className="flex flex-wrap items-center gap-x-2 tabular-nums">
        {shown.map((p, i) => <span key={i}>{p}</span>)}
      </span>
    )
  }

  const items: CategoryBarItem[] = [
    ...top.map(c => ({
      key: `c-${c.categoryId ?? 'none'}`,
      label: nameOf(c),
      amount: c.amount,
      color: c.color ?? undefined,
      colorClass: c.color ? undefined : 'bg-chart-muted',
      note: note([pct(c.amount), change(c.amount, c.previousAmount)]),
      onClick: () => onCategory(c.categoryId),
    })),
    ...(otherAmount > 0 ? [{
      key: 'other',
      label: t('shell.history.other'),
      amount: otherAmount,
      colorClass: 'bg-chart-muted',
      note: note([pct(otherAmount)]),
      onClick: onHistory,
    }] : []),
    ...(unitemised > 0 ? [{
      key: 'unitemised',
      label: t('analytics.b.notItemised'),
      amount: unitemised,
      colorClass: 'bg-chart-muted',
      note: note([pct(unitemised), t('analytics.b.notItemisedHint')]),
    }] : []),
  ]

  // The share only — the first bar already names the biggest part.
  const share = shareOf(total, d.totals.earned)
  const sentence = [
    share ? t('analytics.shareOfIn', { percent: share }) : null,
    period.view === 'year' && total > 0
      ? t('analytics.perMonth', { amount: money(total / Math.max(1, d.months.length)) })
      : null,
  ].filter(Boolean).join(' ')

  return (
    <Tile span={span} mdSpan={6} as="section">
      {items.length === 0 ? (
        <>
          <TileHead title={t('analytics.group.everyday')} headingRef={headingRef} />
          <p className="mt-3 text-sm text-slate-500">{t('analytics.b.empty')}</p>
        </>
      ) : (
        <>
          <TileLead
            title={t('analytics.group.everyday')}
            headingRef={headingRef}
            figure={money(total)}
            exact={moneyExact(total)}
            sentence={sentence || undefined}
          />
          <CategoryBars items={items} className="mt-3 space-y-1" />
          <div className="mt-1">
            <LinkButton label={t('analytics.b.seeInHistory')} onClick={onHistory} />
          </div>
        </>
      )}
    </Tile>
  )
}

// ── D. Bills and loans ─────────────────────────────────────────────────────────────────────────

const loanKindKey = (l: AnalyticsLoanLine) =>
  l.kind === 'BANK' ? 'analytics.d.kind.bank' as const
    : l.asap ? 'analytics.d.kind.asap' as const
      : 'analytics.d.kind.monthly' as const

/** What the fixed payments took: every bill and every loan paid in the period, item by item. */
export function BillsLoansTile({ d, period, span, headingRef, onOpen }: {
  d: AnalyticsResponse
  period: PeriodInfo
  span: TileSpan
  headingRef?: Ref<HTMLHeadingElement>
  onOpen: () => void
}) {
  const { t } = useLang()
  const f = d.totals
  const paid = f.bills + f.loanPayments
  const bills = [...(d.bills ?? [])].filter(b => b.paid > 0).sort((a, b) => b.paid - a.paid)
  const loans = [...(d.loanPayments ?? [])].filter(l => l.paid > 0).sort((a, b) => b.paid - a.paid)
  const share = shareOf(paid, f.earned)
  // Against the monthly pay in Settings — one month at a time, where the comparison means something.
  const income = period.view === 'month' && d.stableIncome != null && d.stableIncome > 0 ? d.stableIncome : null

  const rowOf = (key: string, name: string, kind: string, amount: number) => (
    <li key={key} className="flex min-h-[44px] items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">{name}</p>
        <p className="text-xs text-slate-500">{kind}</p>
      </div>
      <p className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">{moneyFull(amount)}</p>
    </li>
  )

  return (
    <Tile span={span} mdSpan={6} as="section">
      {paid <= 0 ? (
        <>
          <TileHead title={t('analytics.d.title')} headingRef={headingRef} />
          <p className="mt-3 text-sm text-slate-500">{t('analytics.d.empty')}</p>
        </>
      ) : (
        <>
          <TileLead
            title={t('analytics.d.title')}
            headingRef={headingRef}
            figure={money(paid)}
            exact={moneyExact(paid)}
            sentence={share ? t('analytics.shareOfIn', { percent: share }) : undefined}
          />
          {income != null && (
            <div className="mt-3">
              <Meter value={paid} max={income} />
              <p className="mt-1.5 text-xs tabular-nums text-slate-600">
                {t('analytics.d.meter', { paid: moneyFull(paid), income: moneyFull(income) })}
                {paid > income && <span className="font-medium text-amber-700"> {t('analytics.d.overPay')}</span>}
              </p>
            </div>
          )}
          <ul className="mt-2 divide-y divide-hairline">
            {bills.map((b, i) => rowOf(`bill-${b.refId ?? 'none'}-${i}`, b.name, t('analytics.d.kind.bill'), b.paid))}
            {loans.map((l, i) => rowOf(`loan-${l.kind}-${l.refId ?? 'none'}-${i}`, l.name, t(loanKindKey(l)), l.paid))}
          </ul>
        </>
      )}
      <div className="mt-1">
        <LinkButton label={t('analytics.d.open')} onClick={onOpen} />
      </div>
    </Tile>
  )
}

// ── E. Saved ───────────────────────────────────────────────────────────────────────────────────

const FIXED_SAVINGS: Exclude<AnalyticsSavingKind, 'GOAL'>[] = ['DONATION', 'EMERGENCY', 'INVESTMENTS']

/**
 * What was set aside, kind by kind, against what the month asked for (when it asked). With
 * donations counted apart the tile is "Set aside" — saved and given together, which is what the
 * month's ask covers — and its sentence says how much of it was each.
 */
export function SavedTile({ d, period, span, headingRef, onOpen }: {
  d: AnalyticsResponse
  period: PeriodInfo
  span: TileSpan
  headingRef?: Ref<HTMLHeadingElement>
  onOpen: () => void
}) {
  const { t } = useLang()
  const { saved, given } = savedAndGiven(d.totals)
  const total = saved + given
  const title = t(DONATION_COUNTS_AS_SAVED ? 'shell.history.saved' : 'fix.setAside')
  const lines = d.savings ?? []
  // Always the three kinds in their fixed order, then each goal that was paid into or asked for.
  const rows: AnalyticsSavingLine[] = [
    ...FIXED_SAVINGS
      .map(kind => lines.find(l => l.kind === kind) ?? { kind, refId: null, name: null, saved: 0, asked: null }),
    ...lines.filter(l => l.kind === 'GOAL' && (l.saved > 0 || (l.asked ?? 0) > 0)),
  ]
  const anything = rows.some(r => r.saved > 0 || (r.asked ?? 0) > 0)
  // The share only — the rows below already split it into saved and given.
  const share = shareOf(total, d.totals.earned)
  const sentence = [
    share ? t('analytics.shareOfIn', { percent: share }) : null,
    period.view === 'year' && total > 0
      ? t('analytics.perMonth', { amount: money(total / Math.max(1, d.months.length)) })
      : null,
  ].filter(Boolean).join(' ')

  return (
    <Tile span={span} mdSpan={6} as="section">
      {!anything ? (
        <>
          <TileHead title={title} headingRef={headingRef} />
          <p className="mt-3 text-sm text-slate-500">{t('analytics.e.empty')}</p>
        </>
      ) : (
        <>
          <TileLead
            title={title}
            headingRef={headingRef}
            figure={money(total)}
            exact={moneyExact(total)}
            sentence={sentence || undefined}
          />
          <ul className="mt-2 divide-y divide-hairline">
            {rows.map((r, i) => {
              const goal = r.kind === 'GOAL'
              const icon = goal
                ? { icon: <Target className="h-4 w-4" aria-hidden="true" />, tone: 'indigo' as const }
                : SAVINGS_ICON[r.kind as Exclude<AnalyticsSavingKind, 'GOAL'>]
              const name = goal
                ? r.name?.trim() || t('page.advisor.bucket.savings')
                : t(SAVINGS_NAME_KEY[r.kind as Exclude<AnalyticsSavingKind, 'GOAL'>])
              const asked = r.asked != null && r.asked > 0 ? r.asked : null
              const done = asked != null && r.saved >= asked - 0.5
              return (
                <li key={`${r.kind}-${r.refId ?? i}`} className="flex min-h-[56px] items-center gap-3 py-2">
                  <IconChip tone={icon.tone}>{icon.icon}</IconChip>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">{name}</p>
                    <p className="text-xs tabular-nums text-slate-500">
                      {asked != null
                        ? t('home.savings.ofTarget', { paid: moneyFull(r.saved), target: moneyFull(asked) })
                        : moneyFull(r.saved)}
                    </p>
                    {asked != null && <Meter value={r.saved} max={asked} fillClass="bg-income" className="mt-1.5" />}
                  </div>
                  {done && (
                    <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-income">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {t('ui.status.done')}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      <div className="mt-1">
        <LinkButton label={t('home.savings.open')} onClick={onOpen} />
      </div>
    </Tile>
  )
}

// ── F. Biggest purchases ───────────────────────────────────────────────────────────────────────

/** The five largest single everyday purchases — itemised ones only. */
export function BiggestTile({ d, period, span, onHistory }: {
  d: AnalyticsResponse
  period: PeriodInfo
  span: TileSpan
  onHistory: () => void
}) {
  const { t, lang, categoryName } = useLang()
  const rows = (d.everyday.biggest ?? []).slice(0, 5)

  return (
    <Tile span={span} mdSpan={6} as="section">
      <TileHead title={t('analytics.f.title')} />
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('analytics.f.empty')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-hairline">
          {rows.map(r => {
            const category = r.categoryName ? categoryName({ name: r.categoryName, nameUz: r.categoryNameUz }) : null
            return (
              <li key={r.id} className="flex min-h-[56px] items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">
                    {r.description?.trim() || category || '—'}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                    {category && (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 shrink-0 rounded-full ${r.color ? '' : 'bg-chart-muted'}`}
                          style={r.color ? { backgroundColor: r.color } : undefined}
                        />
                        {category}
                      </span>
                    )}
                    {category && <span aria-hidden="true">·</span>}
                    <span className="tabular-nums">{formatDate(r.date, lang, 'dayShort')}</span>
                  </p>
                </div>
                <p className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">
                  {moneyFull(r.amount)}
                </p>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-1">
        <LinkButton
          label={t('analytics.seeHistory', { month: formatDate(period.month, lang, 'monthName') })}
          onClick={onHistory}
        />
      </div>
    </Tile>
  )
}

// ── G. Own and owe ─────────────────────────────────────────────────────────────────────────────

/** Whether there is anything to show: something owned, a loan, or money owed to the owner. */
export function hasPosition(p: AnalyticsPosition | null | undefined): p is AnalyticsPosition {
  return !!p && (p.own > 0 || (p.loans ?? []).length > 0 || p.owedToYou > 0)
}

/**
 * Today's picture: what the owner owns against what is left to repay, as the same two bars the
 * hero uses. A loan whose remaining amount is not known is named as such in the list AND beside
 * every total it is missing from — no figure here silently leaves it out.
 */
export function OwnOweTile({ p, span }: { p: AnalyticsPosition; span: TileSpan }) {
  const { t, lang } = useLang()
  const loans = p.loans ?? []
  const known = loans.filter(l => l.left != null && l.left > 0)
  const unknown = loans.filter(l => l.left == null)
  const unknownNames = unknown.map(l => l.name).join(', ')
  const negative = p.net < 0

  const ownParts: { key: string; name: string; value: number; series: Series }[] = [
    { key: 'wallets', name: t('nav.wallets'), value: Math.max(0, p.wallets), series: 'wallets' },
    { key: 'emergency', name: t('cmp.bucket.emergency'), value: Math.max(0, p.emergencyFund), series: 'emergency' },
    { key: 'investments', name: t('cmp.bucket.investments'), value: Math.max(0, p.investments), series: 'investments' },
    { key: 'goals', name: t('home.goals.title'), value: Math.max(0, p.goals), series: 'goals' },
  ]
  const own = Math.max(0, p.own)
  const scale = Math.max(own, p.loansLeft)

  return (
    <Tile span={span} mdSpan={6} as="section">
      <div className="flex items-start justify-between gap-3">
        <TileHead title={t('analytics.g.title')} />
        {negative && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-rose-50 text-expense" aria-hidden="true">
            <AlertTriangle className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-label uppercase text-slate-500">{t('analytics.g.net')}</p>
      <p className={`mt-1 text-stat tabular-nums ${negative ? 'text-expense' : 'text-slate-900'}`} title={moneyExact(p.net)}>
        {money(p.net)}
      </p>
      {/* No sentence: the two bars below carry both totals. */}
      {unknown.length > 0 && (
        <p className="mt-1 flex items-start gap-2 text-sm font-medium text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="[overflow-wrap:anywhere]">{t('analytics.g.notCounting', { names: unknownNames })}</span>
        </p>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <BarHead name={t('analytics.g.own')} total={moneyFull(own)} />
          <SplitBar segments={ownParts.map(o => ({ key: o.key, value: o.value, series: o.series }))} scale={scale} />
        </div>
        <div>
          {/* "≥" when a loan's amount is missing: the total is a floor, and it says so. */}
          <BarHead
            name={t('analytics.g.leftToRepay')}
            total={`${unknown.length > 0 ? '≥ ' : ''}${moneyFull(p.loansLeft)}`}
          />
          <SplitBar segments={known.map((l, i) => ({ key: `loan-${i}`, value: l.left ?? 0, series: 'loans' as const }))} scale={scale} />
        </div>
      </div>

      <div className="mt-4 grid gap-x-10 gap-y-3 md:grid-cols-2">
        <ul aria-label={t('analytics.g.own')}>
          {ownParts.filter(o => o.value > 0).map(o => (
            <LegendRow key={o.key} series={o.series} name={o.name} amount={moneyFull(o.value)} />
          ))}
        </ul>
        <ul aria-label={t('analytics.g.leftToRepay')}>
          {loans.map((l, i) => (
            <LegendRow
              key={`${l.kind}-${l.refId ?? i}`}
              series={l.left != null ? 'loans' : undefined}
              name={l.name}
              amount={l.left != null ? moneyFull(l.left) : '—'}
              note={l.left == null
                ? t('analytics.g.unknown')
                : l.monthly != null && l.monthly > 0 && l.paidOffBy
                  ? t('analytics.g.paidOffBy', { monthly: moneyFull(l.monthly), month: formatDate(l.paidOffBy, lang, 'monthShort') })
                  : undefined}
            />
          ))}
        </ul>
      </div>

      {p.owedToYou > 0 && (
        <p className="mt-3 border-t border-hairline pt-3 text-sm tabular-nums text-slate-500">
          {t('analytics.g.owedToYou', { amount: moneyFull(p.owedToYou) })}
        </p>
      )}
    </Tile>
  )
}
