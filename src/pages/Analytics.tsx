import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { CloudOff } from 'lucide-react'
import { AnalyticsSkeleton } from '../components/analytics/AnalyticsFallback'
import { MonthByMonthTile } from '../components/analytics/MonthByMonthTile'
import { PaceTile, hasPace } from '../components/analytics/PaceTile'
import {
  BiggestTile, BillsLoansTile, EverydayTile, OwnOweTile, PeriodHero, SavedTile, hasPosition,
} from '../components/analytics/tiles'
import type { AnalyticsView, PeriodInfo } from '../components/analytics/tiles'
import { Button } from '../components/ui/Button'
import { ErrorTile } from '../components/ui/ErrorTile'
import { IconChip } from '../components/ui/IconChip'
import { PageHeader } from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { Tile, TileGrid } from '../components/ui/Tile'
import { useApi } from '../hooks/useApi'
import { useLang } from '../i18n/LanguageContext'
import { analyticsApi } from '../api/analytics'
import { formatDate, formatMonth, shiftMonth, todayLocal } from '../utils/format'
import type { AnalyticsResponse } from '../types/analytics'

const FULL = 'md:col-span-6 xl:col-span-12'
const YM = /^\d{4}-\d{2}$/
/** How many months the "12 months" view reaches back, the current one included. */
const YEAR_SPAN = 12
/** A month with fewer counted days than this has "just started". */
const JUST_STARTED_DAYS = 3

/**
 * What one request came back with, tagged with the period it was asked for — so the page can tell
 * the period on screen from an answer for another one that `useApi` is still holding.
 */
type Result =
  | { kind: 'ok'; key: string; res: AnalyticsResponse }
  /** A server from before this page has no /analytics (404). */
  | { kind: 'outdated'; key: string }

/**
 * A list the server left out is an empty list. The backend ships separately from this page, and
 * a missing array must cost a tile its rows, never the page its render. `everyday.biggest` is
 * deliberately left as it came: absent means "not sent" and drops its tile, empty means "none".
 */
function withDefaults(res: AnalyticsResponse): AnalyticsResponse {
  const e = res.everyday ?? ({} as Partial<AnalyticsResponse['everyday']>)
  return {
    ...res,
    months: res.months ?? [],
    income: res.income ?? [],
    bills: res.bills ?? [],
    loanPayments: res.loanPayments ?? [],
    savings: res.savings ?? [],
    position: res.position ?? null,
    previous: res.previous ?? null,
    notYetCount: res.notYetCount ?? 0,
    everyday: {
      ...e,
      total: e.total ?? res.totals?.everyday ?? 0,
      days: e.days ?? 0,
      perDay: e.perDay ?? null,
      unitemised: e.unitemised ?? 0,
      categories: e.categories ?? [],
      daily: e.daily ?? [],
      previousDaily: e.previousDaily ?? null,
    },
  }
}

/**
 * Analytics: what happened to the owner's money — in one month, or across the last twelve.
 *
 * Home says what to do; this page says what happened, in History's words (In, Out, Saved). Seven
 * tiles, each one question answered in a sentence and then shown. Everything comes from
 * `GET /analytics`: the server classifies every row and this page only draws what it is given.
 *
 * The period lives in the URL (`?month=YYYY-MM`, `?view=year`), so a refresh, a bookmark and a
 * link from History all land on the same view.
 */
export function Analytics() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const today = todayLocal()
  const thisMonth = today.slice(0, 7)
  const view: AnalyticsView = searchParams.get('view') === 'year' ? 'year' : 'month'
  const asked = searchParams.get('month') ?? ''
  const month = YM.test(asked) && asked <= thisMonth ? asked : thisMonth

  const from = view === 'year' ? shiftMonth(thisMonth, -(YEAR_SPAN - 1)) : month
  const to = view === 'year' ? thisMonth : month
  const key = `${from}|${to}|${today}`

  const q = useApi<Result>(async () => {
    try {
      const res = await analyticsApi.get(from, to, today)
      // Spread first: an offline answer carries its isCached / cachedAt flags on the response.
      return { ...res, data: { kind: 'ok' as const, key, res: withDefaults(res.data) } }
    } catch (err) {
      if ((err as AxiosError)?.response?.status === 404) return { data: { kind: 'outdated' as const, key } }
      throw err
    }
  }, [from, to, today])

  // Only the period on screen counts. While another one loads, the hook still holds the previous
  // answer — drawing its figures under the new period's name would be a wrong answer.
  const current = q.data && q.data.key === key ? q.data : null
  const d = current?.kind === 'ok' ? current.res : null
  const failed = !current && !!q.error && !q.loading && !q.refreshing
  // Everything else without an answer for this period is a wait — including the one render
  // between a period change and the hook starting its request.
  const waiting = !current && !failed

  // How much history there is, from the latest answer of either view: it decides whether
  // "12 months" is open and how far back the stepper may go.
  // The answer on screen speaks for itself; the remembered one covers the wait for the next.
  const [remembered, setRemembered] = useState<{ months: number; first: string | null } | null>(null)
  useEffect(() => {
    if (q.data?.kind === 'ok') {
      setRemembered({ months: q.data.res.monthsWithData, first: q.data.res.firstMonth })
    }
  }, [q.data])
  const history = d ? { months: d.monthsWithData, first: d.firstMonth } : remembered
  const yearLocked = history != null && history.months < 2

  const setPeriod = (next: { view?: AnalyticsView; month?: string }) => {
    const v = next.view ?? view
    const m = next.month ?? month
    const params: Record<string, string> = {}
    if (m !== thisMonth) params.month = m
    if (v === 'year') params.view = 'year'
    setSearchParams(params, { replace: true })
  }

  // ── The period, in words ─────────────────────────────────────────────────────
  const monthLabel = formatMonth(month, lang)
  const previousMonth = shiftMonth(month, -1)
  const previousName = formatDate(previousMonth, lang, 'monthName')
  const rangeLabel = (() => {
    if (!d || d.months.length >= YEAR_SPAN || d.months.length === 0) return null
    const first = d.months[0].month
    const last = d.months[d.months.length - 1].month
    return `${formatDate(first, lang, 'monthShort')} – ${formatDate(last, lang, 'monthShort')}`
  })()
  const period: PeriodInfo = view === 'month'
    ? { view, month, label: monthLabel, previousName: d?.previous ? previousName : null }
    : {
        view,
        month: thisMonth,
        label: rangeLabel ?? t('analytics.period.last12'),
        previousName: null,
      }

  // ── Moving around ────────────────────────────────────────────────────────────
  const everydayRef = useRef<HTMLHeadingElement>(null)
  const fixedRef = useRef<HTMLHeadingElement>(null)
  const savedRef = useRef<HTMLHeadingElement>(null)
  const jump = (target: 'everyday' | 'fixed' | 'saved') => {
    const el = (target === 'everyday' ? everydayRef : target === 'fixed' ? fixedRef : savedRef).current
    if (!el) return
    // Centred, not top-aligned: on a phone the top of the scroller sits under the fixed app bar.
    el.scrollIntoView({ block: 'center' })
    el.focus({ preventScroll: true })
  }
  const openHistory = () => navigate(`/history?month=${period.month}`)
  const openCategory = (categoryId: number | null) =>
    navigate(`/history?month=${period.month}${categoryId != null ? `&categoryId=${categoryId}` : ''}`)
  const openDay = (date: string) => navigate(`/history?month=${date.slice(0, 7)}&from=${date}&to=${date}`)

  // ── What goes on the grid ────────────────────────────────────────────────────
  const tiles = () => {
    if (!d) return null
    const empty = d.totals.count === 0
    const position = hasPosition(d.position) ? d.position : null
    // A server that does not send the list yet drops the tile; an empty list says "none".
    const showBiggest = d.everyday.biggest !== undefined
    // The month before, offered when this one is empty or has only just begun — and has data.
    const monthView = view === 'month'
    const isThisMonth = monthView && month === thisMonth
    const justStarted = isThisMonth && !empty && d.previous != null
      && (d.months[0]?.days ?? JUST_STARTED_DAYS) < JUST_STARTED_DAYS
    const seePrevious = isThisMonth && d.previous != null && (empty || justStarted)
      ? { label: previousName, go: () => setPeriod({ month: previousMonth }) }
      : undefined

    const hero = (
      <PeriodHero
        d={d}
        period={period}
        cached={{ isCached: q.isCached, cachedAt: q.cachedAt }}
        justStarted={justStarted}
        onSeePrevious={seePrevious}
        onJump={jump}
      />
    )

    if (empty) {
      return (
        <>
          {hero}
          {position && <OwnOweTile p={position} span={12} />}
        </>
      )
    }

    if (monthView) {
      const pace = hasPace(d)
      return (
        <>
          {hero}
          <EverydayTile d={d} period={period} span={pace ? 6 : 12} headingRef={everydayRef}
            onCategory={openCategory} onHistory={openHistory} />
          {pace && <PaceTile d={d} period={period} onDay={openDay} />}
          <BillsLoansTile d={d} period={period} span={6} headingRef={fixedRef} onOpen={() => navigate('/loans')} />
          <SavedTile d={d} period={period} span={6} headingRef={savedRef} onOpen={() => navigate('/savings')} />
          {showBiggest && <BiggestTile d={d} period={period} span={position ? 6 : 12} onHistory={openHistory} />}
          {position && <OwnOweTile p={position} span={showBiggest ? 6 : 12} />}
        </>
      )
    }

    return (
      <>
        {hero}
        <MonthByMonthTile d={d} onMonth={m => setPeriod({ view: 'month', month: m })} />
        <EverydayTile d={d} period={period} span={6} headingRef={everydayRef}
          onCategory={openCategory} onHistory={openHistory} />
        <BillsLoansTile d={d} period={period} span={6} headingRef={fixedRef} onOpen={() => navigate('/loans')} />
        <SavedTile d={d} period={period} span={showBiggest ? 6 : 12} headingRef={savedRef} onOpen={() => navigate('/savings')} />
        {showBiggest && <BiggestTile d={d} period={period} span={6} onHistory={openHistory} />}
        {position && <OwnOweTile p={position} span={12} />}
      </>
    )
  }

  // "12 months" with one month of data: the tab stays, and its panel says when it opens.
  const lockedPanel = () => {
    const first = history?.first ?? null
    // The month whose first entry unlocks the comparison: the one after the only month with data.
    const opensWith = first != null && first === thisMonth ? shiftMonth(thisMonth, 1) : thisMonth
    return (
      <Tile span={12} as="section">
        <p className="text-sm text-slate-700">
          {history != null && history.months === 0
            ? t('analytics.tab.yearLockedNoData')
            : t('analytics.tab.yearLocked', { month: formatDate(opensWith, lang, 'monthName') })}
        </p>
        <div className="mt-3">
          <Button label={t('analytics.backToMonth', { month: monthLabel })} onClick={() => setPeriod({ view: 'month' })} />
        </div>
      </Tile>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={t('shell.nav.analytics')}
        monthStepper={view === 'month' ? {
          label: monthLabel,
          // Nothing is recorded before the first month with data, or ahead of today's month.
          onPrev: history?.first != null && month > history.first
            ? () => setPeriod({ month: previousMonth })
            : undefined,
          onNext: month < thisMonth ? () => setPeriod({ month: shiftMonth(month, 1) }) : undefined,
        } : undefined}
      />

      {/* One period control, above everything it scopes. */}
      <Tabs
        className="mt-3 sm:max-w-xs"
        active={view}
        onChange={id => setPeriod({ view: id })}
        tabs={[
          { id: 'month', label: t('analytics.tab.month') },
          {
            id: 'year',
            label: t('analytics.tab.year'),
            locked: yearLocked,
            lockReason: yearLocked ? t('analytics.tab.yearLockReason') : undefined,
          },
        ]}
      />

      <div className="mt-4 xl:mt-5" role="tabpanel" aria-labelledby={`tab-${view}`}>
        <TileGrid className={q.refreshing && current ? 'opacity-60 transition-opacity' : ''}>
          {view === 'year' && yearLocked ? (
            lockedPanel()
          ) : waiting ? (
            <AnalyticsSkeleton />
          ) : failed ? (
            <ErrorTile className={FULL} message={q.error!} onRetry={q.refetch} />
          ) : current?.kind === 'outdated' ? (
            <Tile span={12} as="section">
              <div className="flex items-start gap-3">
                <IconChip tone="neutral"><CloudOff className="h-4 w-4" aria-hidden="true" /></IconChip>
                <p className="min-w-0 pt-1.5 text-sm text-slate-700">{t('analytics.outdated')}</p>
              </div>
            </Tile>
          ) : (
            <>
              {q.error && <ErrorTile compact className={FULL} message={q.error} onRetry={q.refetch} />}
              {tiles()}
            </>
          )}
        </TileGrid>
      </div>
    </div>
  )
}
