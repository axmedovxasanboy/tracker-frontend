import { useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Lock, PiggyBank, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { CashflowChart } from '../../components/analytics/CashflowChart'
import { capFirst, monthWord } from '../../components/analytics/figures'
import { FigureTile } from '../../components/analytics/FigureTile'
import { SECTION_LABEL, SECTION_PATH } from '../../components/analytics/sections'
import type { Section } from '../../components/analytics/sections'
import { compact } from '../../components/analytics/shared'
import { Button } from '../../components/ui/Button'
import { IconChip } from '../../components/ui/IconChip'
import { Sheet } from '../../components/ui/Sheet'
import { Tile, TileGrid } from '../../components/ui/Tile'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import type { IconTone } from '../../components/ui/StatTile'
import { shiftMonth } from '../../utils/format'
import { FigureTileInfo, useAnalytics } from './common'
import { GoalsPage } from './GoalsPage'
import { InPage } from './InPage'
import { OutPage } from './OutPage'
import { SetAsidePage } from './SetAsidePage'

/** The pages a 12-months mini opens full size, by their `?open=` value. */
const SHEETS: ReadonlyArray<Section> = ['in', 'out', 'set-aside', 'goals']

/**
 * Page 6, 12 months (§3.6): over the last year, how much came in, went out and was set aside,
 * what a normal month is, and how each part looks month by month.
 *
 * "A month" is the average of COMPLETE tracked months only, and says how many. Since the 2026-10-13
 * restyle the four figures are stat tiles and month by month is a cash-flow chart (In above zero,
 * Out and Set aside below). Below it, the four month pages in small — one slot per month on a shared scale — each with an
 * Open button that shows the same page in range mode in a sheet (full screen on a phone). The
 * sheet lives in the URL (`?open=out`): Back closes it, and a bookmark opens it.
 */
export function YearPage() {
  const { d } = useAnalytics()
  if (d.history.tracked.length < 2) return <LockedPanel />
  return <Year />
}

function Year() {
  const { t } = useLang()
  const { d, dim } = useAnalytics()
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const headingRef = useRef<HTMLHeadingElement>(null)

  const asked = params.get('open')
  const sheet = SHEETS.find(s => s === asked) ?? null

  // A push, flagged, so Back closes the sheet (§3.6).
  const openSheet = (section: Section) => {
    const next = new URLSearchParams(params)
    next.set('open', section)
    navigate({ search: `?${next.toString()}` }, { state: { openedHere: true } })
  }
  // Opened here: step back, so Back never reopens it. Opened from a link or a bookmark: drop
  // `open` in place. Either way the owner stays on 12 months.
  const closeSheet = () => {
    if ((location.state as { openedHere?: boolean } | null)?.openedHere) {
      navigate(-1)
      return
    }
    const next = new URLSearchParams(params)
    next.delete('open')
    const search = next.toString()
    navigate({ search: search ? `?${search}` : '' }, { replace: true })
  }

  const avg = d.average?.flow ?? null
  const icon = 'h-4 w-4'
  const figures: Array<{ key: TKey; total: number; average: number | null; icon: ReactNode; tone: IconTone }> = [
    { key: 'shell.history.in', total: d.total.earned, average: avg?.earned ?? null, icon: <ArrowDownLeft className={icon} aria-hidden="true" />, tone: 'teal' },
    { key: 'shell.history.out', total: d.total.out, average: avg?.out ?? null, icon: <ArrowUpRight className={icon} aria-hidden="true" />, tone: 'amber' },
    { key: 'fix.setAside', total: d.total.saved, average: avg?.saved ?? null, icon: <PiggyBank className={icon} aria-hidden="true" />, tone: 'pink' },
    { key: 'analytics.group.leftOver', total: d.total.leftOver, average: avg?.leftOver ?? null, icon: <Wallet className={icon} aria-hidden="true" />, tone: 'neutral' },
  ]

  return (
    <>
      <TileGrid className={dim}>
        {figures.map(f => (
          <FigureTile
            key={f.key}
            stretch
            label={t(f.key)}
            icon={f.icon}
            iconTone={f.tone}
            amount={compact(f.total)}
            value={f.total}
            info={<FigureTileInfo title={t(f.key)} amount={f.total} lines={[
              f.average != null ? t('an.year.aMonth', { amount: compact(f.average) }) : null,
            ]} />}
          />
        ))}

        <Tile span={12} as="section">
          <h2 className="text-title text-slate-900">{t('an.year.monthByMonth')}</h2>
          <div className="mt-4">
            <CashflowChart months={d.months} />
          </div>
        </Tile>

        <InPage mode="range" size="mini" onOpen={() => openSheet('in')} />
        <OutPage mode="range" size="mini" onOpen={() => openSheet('out')} />
        <SetAsidePage mode="range" size="mini" onOpen={() => openSheet('set-aside')} />
        <GoalsPage mode="range" size="mini" onOpen={() => openSheet('goals')} />
      </TileGrid>

      {/* A sibling after the grid — never inside a tile or the faded grid. */}
      <Sheet
        open={sheet != null}
        onClose={closeSheet}
        title={sheet ? t('an.sheetTitle', { page: t(SECTION_LABEL[sheet]) }) : ''}
        maxWidth="max-w-3xl"
        fullScreenOnPhone
        titleRef={headingRef}
        initialFocusRef={headingRef}
      >
        {sheet === 'in' && <InPage mode="range" />}
        {sheet === 'out' && <OutPage mode="range" />}
        {sheet === 'set-aside' && <SetAsidePage mode="range" />}
        {sheet === 'goals' && <GoalsPage mode="range" />}
      </Sheet>
    </>
  )
}

/**
 * Fewer than two tracked months: the tab stays and navigates here, and this says when it opens
 * (§3.6) — with the way back to the month.
 */
function LockedPanel() {
  const { t, lang } = useLang()
  const { d, thisMonth } = useAnalytics()
  const navigate = useNavigate()
  const tracked = d.history.tracked
  // The month whose first entry opens it: the next one when only this month has entries.
  const opensWith = tracked.length === 1 && tracked[0] === thisMonth ? shiftMonth(thisMonth, 1) : thisMonth
  return (
    <TileGrid>
      <Tile span={12} as="section">
        <div className="flex items-start gap-3">
          <IconChip tone="neutral"><Lock className="h-4 w-4" aria-hidden="true" /></IconChip>
          <div className="min-w-0 pt-1.5">
            <p className="text-sm text-slate-700">
              {tracked.length === 0
                ? t('analytics.tab.yearLockedNoData')
                : capFirst(t('analytics.tab.yearLocked', { month: monthWord(opensWith, lang) }))}
            </p>
            <div className="mt-3">
              <Button
                label={t('analytics.backToMonth', { month: monthWord(thisMonth, lang) })}
                onClick={() => navigate(SECTION_PATH.totals)}
              />
            </div>
          </div>
        </div>
      </Tile>
    </TileGrid>
  )
}
