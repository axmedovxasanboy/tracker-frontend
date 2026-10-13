import { ArrowUpRight } from 'lucide-react'
import { BulletRow, vsExpected } from '../../components/analytics/BulletRow'
import { CumulativeChart } from '../../components/analytics/CumulativeChart'
import { DeltaBadge } from '../../components/analytics/DeltaBadge'
import { Donut } from '../../components/analytics/Donut'
import { FigureTile } from '../../components/analytics/FigureTile'
import { isOpenMonth, lineDrawn, lineLabel, rankLines } from '../../components/analytics/figures'
import { FigureInfo } from '../../components/analytics/Info'
import { LineList, OutLinesInfo, outParts } from '../../components/analytics/LineList'
import { SlotStrip, slotValues } from '../../components/analytics/MiniColumns'
import { assignSlots, segmentsOf } from '../../components/analytics/palette'
import { compact, SERIES_BG } from '../../components/analytics/shared'
import { Tile } from '../../components/ui/Tile'
import { useLang } from '../../i18n/LanguageContext'
import type { BreakdownLine } from '../../types/analyticsBreakdown'
import {
  amountOf, Block, FigureTileInfo, MiniCard, MiniRow, NotCountedBlock, PageGrid, TileHead, TileInfo, useAnalytics,
  useLastMonthLine,
} from './common'
import type { PageProps } from './common'

/** How many Out lines the 12-months mini names before the rest become "Other". */
const MINI_ROWS = 4
/** "Through the month" needs a few days to be a line at all (§3.3). */
const CHART_MIN_DAYS = 3

/**
 * Page 3, Out (§3.3): where the money went, by category, and which categories are above normal;
 * is everyday spending on pace?
 *
 * One ranked list that adds up to Out exactly: each bill sits in its category (Housing = everyday
 * + rent), and "Not itemised" and "Loan payments" are rows of their own. Tapping a row opens it in
 * place. "Through the month" draws itemised everyday spending against the straight line a normal
 * month would draw — the one figure that builds up day by day.
 *
 * On a month (2026-10-13 restyle): Out as a stat tile with its badge against last month, "Through
 * the month" beside it, then the categories as a ring with the list beside it — each line in its
 * ring colour, "Not itemised" hatched grey, everything past the fifth colour grey ("Other").
 */
export function OutPage({ mode = 'month', size = 'full', onOpen }: PageProps) {
  const { t, lang, categoryName } = useLang()
  const { d, month, prev } = useAnalytics()
  const lastMonth = useLastMonthLine()

  const range = mode === 'range'
  const f = range ? d.total : d.months[d.months.length - 1] ?? d.total
  const m = range ? null : d.months[d.months.length - 1] ?? null
  const open = !range && isOpenMonth(d)
  const e = range ? null : d.expected
  const paidOff = e?.paidOffLoans ?? 0

  if (size === 'mini') {
    const lines = d.out.filter(l => l.amount !== 0).sort((a, b) => b.amount - a.amount)
    const shown = lines.length > MINI_ROWS + 1 ? lines.slice(0, MINI_ROWS) : lines
    const others = lines.slice(shown.length)
    const otherByMonth = d.months.map((_, i) => others.reduce((s, l) => s + (l.byMonth[i] ?? 0), 0))
    const max = Math.max(0, ...shown.flatMap(l => l.byMonth), ...otherByMonth)
    return (
      <MiniCard section="out" total={d.total.out} onOpen={onOpen}>
        <ul className="mt-2">
          {shown.map(l => (
            <MiniRow
              key={l.key}
              label={lineLabel(l, t, categoryName, lang)}
              amount={l.amount}
              months={d.months.length}
              strip={<SlotStrip values={slotValues(l.byMonth, d.months)} max={max} fillClass={outParts(l)[0]?.className ?? SERIES_BG.everyday} />}
            />
          ))}
          {others.length > 0 && (
            <MiniRow
              label={t('shell.history.other')}
              amount={others.reduce((s, l) => s + l.amount, 0)}
              months={d.months.length}
              strip={<SlotStrip values={slotValues(otherByMonth, d.months)} max={max} fillClass={SERIES_BG.everyday} />}
            />
          )}
        </ul>
      </MiniCard>
    )
  }

  // The list's own order — by expected on a month with a base — is the ring's.
  const ranked = rankLines(d.out.filter(l => lineDrawn(l, mode)), e != null, mode)
  const unitemised = (l: BreakdownLine) => l.key === 'unitemised' || l.kind === 'NOT_ITEMISED' || l.kind === 'CHECK'
  const slots = assignSlots(ranked, unitemised)
  const list = (
    <LineList
      lines={d.out}
      mode={mode}
      base={e != null}
      open={open}
      month={month}
      months={d.months}
      slots={slots}
      total={f.out}
      paidOff={paidOff}
    />
  )

  // Itemised everyday: what builds up day by day. Wallet-check money lands in lumps on check
  // days and keeps its full-month expected on its own row (§1.2).
  const itemised = f.everyday - f.everydayUnitemised
  const expItemised = e ? e.flow.everyday - e.flow.everydayUnitemised : null
  const byToday = open && e?.everydayByToday != null
    ? t('an.byToday', { amount: compact(itemised), expected: compact(e.everydayByToday) })
    : null
  const showChart = !range && m != null && m.days >= CHART_MIN_DAYS && d.everydayDaily.length > 0
  const chartCaption = byToday ?? (expItemised != null
    ? t('an.itemised', { amount: compact(itemised), expected: compact(expItemised) })
    : t('an.itemisedOnly', { amount: compact(itemised) }))
  const perDay = !range && m && m.days > 0 && f.everyday > 0
    ? `${t('analytics.group.everyday')}: ${t('an.perDay', { amount: compact(f.everyday / m.days) })}`
    : null

  if (!range) {
    const partsLine = [
      { key: 'analytics.group.everyday' as const, amount: Math.max(0, f.everyday) },
      { key: 'analytics.group.bills' as const, amount: f.bills },
      { key: 'analytics.group.loans' as const, amount: f.loanPayments },
    ].filter(x => x.amount !== 0).map(x => `${t(x.key)} ${compact(x.amount)}`).join(' · ')
    const segments = segmentsOf(ranked, slots, l => lineLabel(l, t, categoryName, lang), t('shell.history.other'))
    return (
      <PageGrid mode={mode}>
        <FigureTile
          span={4}
          mdSpan={6}
          label={t('shell.history.out')}
          icon={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
          iconTone="amber"
          amount={compact(f.out)}
          value={f.out}
          badge={prev ? <DeltaBadge value={f.out} previous={prev.flow.out} prevMonth={prev.month} open={open} upIsGood={false} /> : null}
          meter={{ expected: e?.flow.out ?? null, fill: SERIES_BG.everyday }}
          info={<FigureTileInfo title={t('shell.history.out')} amount={f.out} lines={[
            vsExpected(t, { soFar: f.out, expected: e?.flow.out ?? null, open, paidOff }),
            lastMonth(prev?.flow.out),
            partsLine,
            perDay,
            // With the chart on screen this sentence is its "!" instead.
            showChart ? null : byToday,
          ]} />}
        />
        {showChart && m && (
          <Tile span={8} mdSpan={6} as="section">
            <TileHead
              title={t('an.throughMonth')}
              info={(
                <TileInfo title={t('an.throughMonth')}>
                  <FigureInfo amount={d.everydayDaily[d.everydayDaily.length - 1]?.cumulative ?? 0} lines={[chartCaption, t('an.info.itemised')]} />
                </TileInfo>
              )}
            />
            <CumulativeChart daily={d.everydayDaily} daysInMonth={m.daysInMonth} expectedTotal={expItemised} />
          </Tile>
        )}
        <Tile span={showChart ? 12 : 8} mdSpan={6} as="section">
          <TileHead
            title={t('an.byCategory')}
            info={(
              <TileInfo title={t('an.byCategory')}>
                <OutLinesInfo lines={d.out} base={e != null} open={open} paidOff={paidOff} />
              </TileInfo>
            )}
          />
          <div className="mt-4 flex flex-col items-center gap-5 lg:flex-row lg:items-start">
            <Donut segments={segments} total={f.out} totalLabel={t('shell.history.out')} ariaLabel={t('an.donut.byCategory')} />
            <div className="w-full min-w-0 flex-1">{list}</div>
          </div>
        </Tile>
        <NotCountedBlock mode={mode} span={12} titleKey="an.notCountedOut" flows={['LENT']} />
      </PageGrid>
    )
  }

  // A range (the 12-months sheet): exact totals, "a month" and month strips.
  return (
    <PageGrid mode={mode}>
      <Block mode={mode}>
        <BulletRow
          lead
          label={t('shell.history.out')}
          amount={amountOf(f.out, mode)}
          value={f.out}
          parts={[{ value: f.out, className: SERIES_BG.everyday }]}
          scale={f.out}
          captions={[d.average ? t('an.year.aMonth', { amount: compact(d.average.flow.out) }) : null]}
          strip={<SlotStrip values={slotValues(d.months.map(x => x.out), d.months)} max={Math.max(0, ...d.months.map(x => x.out))} fillClass={SERIES_BG.everyday} />}
        />
      </Block>
      <Block mode={mode} title={t('an.byCategory')}>{list}</Block>
      <NotCountedBlock mode={mode} titleKey="an.notCountedOut" flows={['LENT']} />
    </PageGrid>
  )
}
