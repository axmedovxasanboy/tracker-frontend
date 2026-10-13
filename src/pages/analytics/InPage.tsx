import { ArrowDownLeft } from 'lucide-react'
import { BulletRow, scaleOf, vsExpected } from '../../components/analytics/BulletRow'
import { DeltaBadge } from '../../components/analytics/DeltaBadge'
import { Donut } from '../../components/analytics/Donut'
import { FigureTile } from '../../components/analytics/FigureTile'
import { InfoList } from '../../components/analytics/Info'
import type { InfoListItem } from '../../components/analytics/Info'
import {
  bonusInExpected, expectedIn, historyHref, isOpenMonth, lineDrawn, lineLabel, rankLines,
} from '../../components/analytics/figures'
import { SlotStrip, slotValues } from '../../components/analytics/MiniColumns'
import { assignSlots, segmentsOf } from '../../components/analytics/palette'
import { ShareRow } from '../../components/analytics/ShareRow'
import { compact, SERIES_BG, shareOf } from '../../components/analytics/shared'
import { Tile } from '../../components/ui/Tile'
import { useLang } from '../../i18n/LanguageContext'
import type { BreakdownLine } from '../../types/analyticsBreakdown'
import {
  amountOf, Block, FigureTileInfo, MiniCard, MiniRow, NotCountedBlock, PageGrid, TileHead, TileInfo, useAnalytics,
  useLastMonthLine, useReceivedCaptions, useStableIncomeCaption,
} from './common'
import type { PageProps } from './common'

/** How many sources the 12-months mini names before the rest become "Other". */
const MINI_ROWS = 4

/**
 * Page 2, In (§3.2): where the month's money came from, and what is still to come from each.
 *
 * The rows are the income category tree exactly as Categories has it — every root, then its
 * children — so a new source (Family) appears on its own, marked "new" in its first month. Every
 * expected source is listed even at 0, with its tick: that is the answer to "what am I waiting
 * for". Ordered by expected, so rows keep their place from day to day.
 *
 * On a month (2026-10-13 restyle): In as a stat tile with its badge against last month, and the
 * sources as a ring — each source its colour in the list's order — with the list beside it, names
 * and amounts only; what is expected of each source and what is still to come is behind the "!".
 * The 12-months sheet keeps its rows, captions and month strips.
 */
export function InPage({ mode = 'month', size = 'full', onOpen }: PageProps) {
  const { t, lang, categoryName } = useLang()
  const { d, month, prev } = useAnalytics()
  const received = useReceivedCaptions()
  const stableIncome = useStableIncomeCaption()
  const lastMonth = useLastMonthLine()

  const range = mode === 'range'
  const f = range ? d.total : d.months[d.months.length - 1] ?? d.total
  const open = !range && isOpenMonth(d)
  const base = !range && d.expected != null
  const expIn = range ? null : expectedIn(d)
  const roots = rankLines(d.income.filter(l => lineDrawn(l, mode)), base, mode)
  const childrenOf = (root: BreakdownLine) => rankLines(root.children.filter(c => lineDrawn(c, mode)), base, mode)

  if (size === 'mini') {
    // The top sources by range total — a root with no children is its own source.
    const leaves = d.income
      .flatMap(r => (r.children.length > 0 ? r.children : [r]))
      .filter(l => l.amount !== 0)
      .sort((a, b) => b.amount - a.amount)
    const shown = leaves.length > MINI_ROWS + 1 ? leaves.slice(0, MINI_ROWS) : leaves
    const others = leaves.slice(shown.length)
    const otherByMonth = d.months.map((_, i) => others.reduce((s, l) => s + (l.byMonth[i] ?? 0), 0))
    const max = Math.max(0, ...shown.flatMap(l => l.byMonth), ...otherByMonth)
    return (
      <MiniCard section="in" total={d.total.earned} onOpen={onOpen}>
        <ul className="mt-2">
          {shown.map(l => (
            <MiniRow
              key={l.key}
              label={lineLabel(l, t, categoryName, lang)}
              amount={l.amount}
              months={d.months.length}
              strip={<SlotStrip values={slotValues(l.byMonth, d.months)} max={max} fillClass={SERIES_BG.bonus} />}
            />
          ))}
          {others.length > 0 && (
            <MiniRow
              label={t('shell.history.other')}
              amount={others.reduce((s, l) => s + l.amount, 0)}
              months={d.months.length}
              strip={<SlotStrip values={slotValues(otherByMonth, d.months)} max={max} fillClass={SERIES_BG.bonus} />}
            />
          )}
        </ul>
      </MiniCard>
    )
  }

  const bonus = range ? null : bonusInExpected(d)

  if (!range) {
    // The sources, each a leaf: a root's children, or the root itself when it has none.
    const leaves = roots.flatMap(r => (childrenOf(r).length > 0 ? childrenOf(r) : [r]))
    const slots = assignSlots(leaves)
    const name = (l: BreakdownLine) => lineLabel(l, t, categoryName, lang)
    const segments = segmentsOf(leaves, slots, name, t('shell.history.other'))
    const tone = (l: BreakdownLine) => (l.amount < 0 && !open ? 'text-expense' : 'text-slate-900')
    const sourceRow = (line: BreakdownLine, leaf: boolean) => (
      <ShareRow
        slot={leaf ? slots.get(line.key) : null}
        label={name(line)}
        amount={compact(line.amount)}
        share={shareOf(line.amount, f.earned)}
        tone={tone(line)}
        to={line.history ? historyHref(month, line.history) : undefined}
      />
    )
    // What the rows no longer say, line by line, in the list's own order.
    const notes = (line: BreakdownLine, leaf: boolean) => [
      vsExpected(t, { soFar: line.amount, expected: line.expected, open, isNew: line.isNew }),
      // Money counted here that arrived in another month — on the source it belongs to.
      leaf ? received.receivedOn(line.otherMonth) : null,
    ]
    const infoItems: InfoListItem[] = roots.flatMap(root => {
      const kids = childrenOf(root)
      return [
        { key: root.key, name: name(root), amount: compact(root.amount), notes: notes(root, kids.length === 0) },
        ...kids.map(c => ({ key: c.key, name: name(c), amount: compact(c.amount), notes: notes(c, true), child: true })),
      ]
    })
    return (
      <PageGrid mode={mode}>
        <FigureTile
          span={4}
          mdSpan={6}
          label={t('shell.history.in')}
          icon={<ArrowDownLeft className="h-4 w-4" aria-hidden="true" />}
          iconTone="teal"
          amount={compact(f.earned)}
          value={f.earned}
          badge={prev ? <DeltaBadge value={f.earned} previous={prev.flow.earned} prevMonth={prev.month} open={open} /> : null}
          meter={{ expected: expIn, fill: SERIES_BG.bonus }}
          info={<FigureTileInfo title={t('shell.history.in')} amount={f.earned} lines={[
            vsExpected(t, { soFar: f.earned, expected: expIn, open, bonus }),
            lastMonth(prev?.flow.earned),
            stableIncome(d),
            received.countsIn(d.receivedForOtherMonths),
          ]} />}
        />
        <Tile span={8} mdSpan={6} as="section">
          <TileHead
            title={t('an.sources')}
            info={<TileInfo title={t('an.sources')}><InfoList items={infoItems} /></TileInfo>}
          />
          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Donut segments={segments} total={f.earned} totalLabel={t('shell.history.in')} ariaLabel={t('an.donut.bySource')} />
            <ul className="w-full min-w-0 flex-1">
              {roots.map(root => (
                <li key={root.key}>
                  {sourceRow(root, childrenOf(root).length === 0)}
                  {childrenOf(root).length > 0 && (
                    // Children are always shown: they are the owner's sources.
                    <ul className="ml-1 border-l-2 border-slate-100 pl-3">
                      {childrenOf(root).map(c => <li key={c.key}>{sourceRow(c, true)}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Tile>
        <NotCountedBlock mode={mode} span={12} titleKey="an.notCountedIn" flows={['BORROWED', 'RETURNED', 'FROM_SAVINGS']} />
      </PageGrid>
    )
  }

  // A range (the 12-months sheet): exact totals, "a month" and each source's month strip.
  const scale = scaleOf([f.earned, ...roots.flatMap(r => [r.amount, ...r.children.map(c => c.amount)])])
  const stripMax = Math.max(0, ...d.income.flatMap(r => [...r.byMonth, ...r.children.flatMap(c => c.byMonth)]))
  const row = (line: BreakdownLine, child: boolean) => (
    <BulletRow
      key={line.key}
      label={lineLabel(line, t, categoryName, lang)}
      amount={amountOf(line.amount, mode)}
      value={line.amount}
      parts={[{ value: line.amount, className: SERIES_BG.bonus }]}
      scale={scale}
      thin={child}
      captions={[line.average != null ? t('an.year.aMonth', { amount: amountOf(line.average, 'month') }) : null]}
      negative="rose"
      strip={<SlotStrip values={slotValues(line.byMonth, d.months)} max={stripMax} fillClass={SERIES_BG.bonus} />}
    />
  )

  return (
    <PageGrid mode={mode}>
      <Block mode={mode}>
        <BulletRow
          lead
          label={t('shell.history.in')}
          amount={amountOf(f.earned, mode)}
          value={f.earned}
          parts={[{ value: f.earned, className: SERIES_BG.bonus }]}
          scale={scale}
          captions={[d.average ? t('an.year.aMonth', { amount: amountOf(d.average.flow.earned, 'month') }) : null]}
          strip={<SlotStrip values={slotValues(d.months.map(m => m.earned), d.months)} max={Math.max(0, ...d.months.map(m => m.earned))} fillClass={SERIES_BG.bonus} />}
        />
      </Block>

      <Block mode={mode} span={7} mdSpan={6} title={t('an.sources')}>
        <ul className="mt-2 space-y-0.5">
          {roots.map(root => (
            <li key={root.key}>
              {row(root, false)}
              {childrenOf(root).length > 0 && (
                // Children are always shown: they are the owner's sources.
                <ul className="ml-1 border-l-2 border-slate-100 pl-3">
                  {childrenOf(root).map(c => <li key={c.key}>{row(c, true)}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Block>

      <NotCountedBlock mode={mode} titleKey="an.notCountedIn" flows={['BORROWED', 'RETURNED', 'FROM_SAVINGS']} />
    </PageGrid>
  )
}
