import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { CloudOff, Inbox } from 'lucide-react'
import { AnalyticsSkeleton } from '../../components/analytics/AnalyticsFallback'
import { AnalyticsNav } from '../../components/analytics/AnalyticsNav'
import { monthWord, rangeLabel } from '../../components/analytics/figures'
import { MonthPicker, RangeLabel } from '../../components/analytics/MonthPicker'
import { monthSearch, sectionOf, SECTION_PATH } from '../../components/analytics/sections'
import type { Section } from '../../components/analytics/sections'
import { CacheBadge } from '../../components/ui/CacheBadge'
import { ErrorTile } from '../../components/ui/ErrorTile'
import { IconChip } from '../../components/ui/IconChip'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tile, TileGrid } from '../../components/ui/Tile'
import { useApi } from '../../hooks/useApi'
import { useLang } from '../../i18n/LanguageContext'
import { analyticsApi } from '../../api/analytics'
import { formatMonth, shiftMonth, todayLocal } from '../../utils/format'
import { withBreakdownDefaults } from '../../types/analyticsBreakdown'
import type { AnalyticsBreakdown } from '../../types/analyticsBreakdown'
import type { AnalyticsCtx } from './common'
import { GoalsPage } from './GoalsPage'
import { InPage } from './InPage'
import { OutPage } from './OutPage'
import { SetAsidePage } from './SetAsidePage'
import { TotalsPage } from './TotalsPage'
import { YearPage } from './YearPage'

const FULL = 'md:col-span-6 xl:col-span-12'
/** A month the URL may name: 2026-09, never 2025-13 or 2026-00 (the server would answer 400). */
const YM = /^\d{4}-(0[1-9]|1[0-2])$/
/** How many months "12 months" reaches back, the current one included. */
const YEAR_SPAN = 12

/**
 * What one request came back with, tagged with the period it was asked for — so the page can tell
 * the period on screen from an answer for another one that `useApi` is still holding.
 */
type Result =
  | { kind: 'ok'; key: string; res: AnalyticsBreakdown }
  /** A server from before V2 has no /analytics/breakdown — §4.5 deploy order. */
  | { kind: 'outdated'; key: string }

/**
 * Analytics: what happened to the owner's money, on six pages under one sticky navbar
 * (ANALYTICS-V2-SPEC.md §2–§3). This layout is the whole lazy chunk's entry. It owns:
 *
 * - the month, from the URL (`?month=YYYY-MM`, left out for the current month; steps are written
 *   with replace, page changes are pushes) and the page, from the path;
 * - ONE request for the month on screen, shared by the five month pages through `<Outlet
 *   context>`; 12 months makes its own (the last twelve months);
 * - the shared states: loading, failed, a server without the endpoint, nothing recorded yet, a
 *   past month with no entries; and the header line every page starts with.
 *
 * Old addresses keep working: `?view=year` goes to 12 months, an unknown page to Totals.
 */
export function AnalyticsLayout() {
  const { t, lang } = useLang()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const today = todayLocal()
  const thisMonth = today.slice(0, 7)
  const section = sectionOf(location.pathname)
  const year = section === '12-months'
  const redirect = searchParams.get('view') === 'year' || section == null

  // How much history there is, from the latest answer of either kind: it bounds the picker and
  // decides whether 12 months is open. The answer on screen speaks for itself; this covers the
  // wait for the next one.
  const [known, setKnown] = useState<AnalyticsBreakdown['history'] | null>(null)

  // A bad or future month is the current one; one before the history start is the start (§2.3).
  const asked = searchParams.get('month') ?? ''
  const valid = YM.test(asked) && asked <= thisMonth ? asked : thisMonth
  const clamp = (start: string | null | undefined) => (start && valid < start ? start : valid)
  // 12 months reaches back eleven months, or to the history start when that is later (§4.1).
  const yearFrom = (start: string | null | undefined) => {
    const back = shiftMonth(thisMonth, -(YEAR_SPAN - 1))
    return start && start > back ? start : back
  }
  const periodKey = (start: string | null | undefined) => {
    const m = clamp(start)
    return year ? `${yearFrom(start)}|${thisMonth}|${today}` : `${m}|${m}|${today}`
  }

  // What is asked for: the period as far as the history start is known.
  const from = year ? yearFrom(known?.start) : clamp(known?.start)
  const to = year ? thisMonth : clamp(known?.start)
  const key = `${from}|${to}|${today}`

  const q = useApi<Result | null>(async () => {
    if (redirect) return { data: null }
    try {
      const res = await analyticsApi.breakdown(from, to, today)
      // Spread first: an offline answer carries its isCached / cachedAt flags on the response.
      return { ...res, data: { kind: 'ok' as const, key, res: withBreakdownDefaults(res.data) } }
    } catch (err) {
      // A server from before V2 has no such route. Its security answers an unknown route with 401
      // rather than 404 (the error dispatch runs without the token), so a 401 that survived a
      // brand-new token — the client refreshed, retried, and kept the session — says the same.
      const ax = err as AxiosError
      const status = ax?.response?.status
      if (status === 404 || (status === 401 && ax.config?._retry)) return { data: { kind: 'outdated' as const, key } }
      throw err
    }
  }, [from, to, today, redirect])

  // The history start from the answer in hand — the same in every answer, whatever its period —
  // so a month before it is clamped in the render that learns it, never drawn as a page of zeros
  // under its own name first (§2.3); and 12 months asks again from the start when that is later.
  const start = (q.data?.kind === 'ok' ? q.data.res.history.start : null) ?? known?.start ?? null
  const month = clamp(start)

  // Only the period on screen counts. While another one loads, the hook still holds the previous
  // answer — drawing its figures under the new month's name would be a wrong answer. An answer
  // the start has just moved past is waited out the same way: the next request is on its way.
  const current = q.data && q.data.key === key && key === periodKey(start) ? q.data : null
  const d = current?.kind === 'ok' ? current.res : null
  const failed = !current && !!q.error && !q.loading && !q.refreshing
  const waiting = !current && !failed

  useEffect(() => {
    if (q.data?.kind === 'ok') setKnown(q.data.res.history)
  }, [q.data])
  const history = d?.history ?? known

  // The URL says what is on screen: an invalid or clamped month is rewritten in place.
  useEffect(() => {
    if (redirect) return
    const want = month === thisMonth ? null : month
    if ((searchParams.get('month') ?? null) === want) return
    const next = new URLSearchParams(searchParams)
    if (want) next.set('month', want)
    else next.delete('month')
    setSearchParams(next, { replace: true, state: location.state })
  }, [month, thisMonth, redirect, searchParams, setSearchParams, location.state])

  // A new page opens at its top; a new month keeps the scroll, so the same row can be compared
  // month to month (rows are ordered by expected, so they keep their place).
  useLayoutEffect(() => {
    const main = document.getElementById('main')
    if (main) main.scrollTop = 0
  }, [section])

  // While the next month loads, its placeholder keeps the height of what was on screen — the
  // scroll position survives the wait instead of collapsing onto a short skeleton.
  const contentRef = useRef<HTMLDivElement>(null)
  const lastHeight = useRef(0)
  useLayoutEffect(() => {
    if (d && contentRef.current) lastHeight.current = contentRef.current.offsetHeight
  })

  if (searchParams.get('view') === 'year') {
    return <Navigate to={{ pathname: SECTION_PATH['12-months'], search: monthSearch(valid, thisMonth) }} replace />
  }
  if (section == null) return <Navigate to={{ pathname: SECTION_PATH.totals, search: location.search }} replace />

  const setMonth = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next === thisMonth) params.delete('month')
    else params.set('month', next)
    // Replace: stepping through months does not fill Back.
    setSearchParams(params, { replace: true })
  }

  const search = monthSearch(month, thisMonth)
  // "No history at all" locks nothing: every page says so instead.
  const yearLocked = history != null && history.start != null && history.tracked.length < 2
  const picker = year
    ? (d && d.months.length > 0
        ? <RangeLabel label={rangeLabel(d.months[0].month, d.months[d.months.length - 1].month, lang)} />
        : null)
    : (
      <MonthPicker
        label={formatMonth(month, lang)}
        onPrev={!history?.start || month > history.start ? () => setMonth(shiftMonth(month, -1)) : undefined}
        onNext={month < thisMonth ? () => setMonth(shiftMonth(month, 1)) : undefined}
      />
    )

  const ctx: AnalyticsCtx | null = d
    ? { d, month: year ? thisMonth : month, thisMonth, search, dim: q.refreshing && current ? 'opacity-60 transition-opacity' : '' }
    : null

  const body = () => {
    if (waiting) {
      return (
        <div style={{ minHeight: lastHeight.current || undefined }}>
          <TileGrid><AnalyticsSkeleton /></TileGrid>
        </div>
      )
    }
    if (failed) return <TileGrid><ErrorTile className={FULL} message={q.error!} onRetry={q.refetch} /></TileGrid>
    if (current?.kind === 'outdated') {
      return (
        <TileGrid>
          <Notice icon={<CloudOff className="h-4 w-4" aria-hidden="true" />} text={t('analytics.outdated')} />
        </TileGrid>
      )
    }
    if (!d || !ctx) return null

    const stale = q.error && <ErrorTile compact className="mb-4" message={q.error} onRetry={q.refetch} />
    if (d.history.start == null) {
      return (
        <>
          {stale}
          <TileGrid><Notice icon={<Inbox className="h-4 w-4" aria-hidden="true" />} text={t('an.empty.none')} /></TileGrid>
        </>
      )
    }
    const shown = d.months[d.months.length - 1]
    // No month at all is a month the server has nothing for — said as such, never as zeros.
    const emptyPast = !year && (shown == null || (!shown.tracked && shown.complete))
    return (
      <>
        {stale}
        <HeaderLine d={d} section={section} cached={{ isCached: q.isCached, cachedAt: q.cachedAt }} />
        {emptyPast ? (
          <TileGrid>
            <Notice
              icon={<Inbox className="h-4 w-4" aria-hidden="true" />}
              text={t('an.empty.month', { month: formatMonth(month, lang) })}
            />
          </TileGrid>
        ) : (
          <Routes>
            <Route element={<Outlet context={ctx} />}>
              <Route index element={<TotalsPage />} />
              <Route path="in" element={<InPage />} />
              <Route path="out" element={<OutPage />} />
              <Route path="set-aside" element={<SetAsidePage />} />
              <Route path="goals" element={<GoalsPage />} />
              <Route path="12-months" element={<YearPage />} />
            </Route>
          </Routes>
        )}
      </>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={t('shell.nav.analytics')} barExtra={picker} />
      <AnalyticsNav search={search} yearLocked={yearLocked} trailing={picker} />
      <div ref={contentRef} className="mt-3 xl:mt-4">{body()}</div>
    </div>
  )
}

/** One sentence in a tile, with its icon — the shared empty and outdated states (§3.0). */
function Notice({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <Tile span={12} as="section">
      <div className="flex items-start gap-3">
        <IconChip tone="neutral">{icon}</IconChip>
        <p className="min-w-0 pt-1.5 text-sm text-slate-700">{text}</p>
      </div>
    </Tile>
  )
}

/**
 * The first line under the strip (§3.0): the day of a month in progress, what Expected rests on
 * (or that nothing earlier exists), the one place "UZS" is said, and entries dated ahead.
 *
 *   Day 2 of 31 · Expected: average of 1 month (September) · UZS
 *
 * Goals compares with what each plan asks, so it states no average; 12 months states how many
 * months the range holds and how many full months "a month" rests on.
 */
function HeaderLine({ d, section, cached }: {
  d: AnalyticsBreakdown
  section: Section
  cached: { isCached: boolean; cachedAt: string | null }
}) {
  const { t, lang } = useLang()
  const pieces: string[] = []
  const last = d.months[d.months.length - 1]

  if (section === '12-months') {
    pieces.push(t(d.months.length === 1 ? 'an.year.rangeOne' : 'an.year.range', { count: d.months.length }))
    const n = d.average?.basedOn.length ?? 0
    if (n > 0) pieces.push(t(n === 1 ? 'an.year.basisOne' : 'an.year.basisMany', { count: n }))
  } else {
    if (last && !last.complete) pieces.push(t('an.day', { day: last.days, days: last.daysInMonth }))
    if (section !== 'goals') {
      const based = d.expected?.basedOn ?? []
      if (d.expected && based.length > 0) {
        // Month names in full — only chart axes shorten them (§5.4); four or more become a range.
        const names = based.length >= 4
          ? `${monthWord(based[0], lang)}–${monthWord(based[based.length - 1], lang)}`
          : based.map(m => monthWord(m, lang)).join(', ')
        let basis = t(based.length === 1 ? 'an.basis.one' : 'an.basis.many', { count: based.length, months: names })
        if (d.expected.skipped.length > 0) {
          basis += ` ${t('an.basis.skipped', { months: d.expected.skipped.map(m => monthWord(m, lang)).join(', ') })}`
        }
        pieces.push(basis)
      } else {
        pieces.push(t('an.basis.none'))
      }
    }
  }
  pieces.push(t('an.unit'))
  if (d.notYetCount > 0) pieces.push(t(d.notYetCount === 1 ? 'an.notYetOne' : 'an.notYet', { count: d.notYetCount }))

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 xl:mb-4">
      <p className="min-w-0 text-sm text-slate-600 tabular-nums">{pieces.join(' · ')}</p>
      <CacheBadge isCached={cached.isCached} cachedAt={cached.cachedAt} />
    </div>
  )
}
