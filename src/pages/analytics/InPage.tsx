import { BulletRow, scaleOf, vsExpected } from '../../components/analytics/BulletRow'
import {
  bonusInExpected, expectedIn, historyHref, isOpenMonth, lineDrawn, lineLabel, rankLines,
} from '../../components/analytics/figures'
import { SlotStrip, slotValues } from '../../components/analytics/MiniColumns'
import { SERIES_BG } from '../../components/analytics/shared'
import { useLang } from '../../i18n/LanguageContext'
import type { BreakdownLine } from '../../types/analyticsBreakdown'
import {
  amountOf, Block, MiniCard, MiniRow, NotCountedBlock, PageGrid, useAnalytics, useReceivedCaptions,
  useStableIncomeCaption,
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
 */
export function InPage({ mode = 'month', size = 'full', onOpen }: PageProps) {
  const { t, lang, categoryName } = useLang()
  const { d, month } = useAnalytics()
  const received = useReceivedCaptions()
  const stableIncome = useStableIncomeCaption()

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
  const scale = scaleOf([
    f.earned, expIn,
    ...roots.flatMap(r => [r.amount, r.expected, ...r.children.flatMap(c => [c.amount, c.expected])]),
  ])
  const stripMax = range ? Math.max(0, ...d.income.flatMap(r => [...r.byMonth, ...r.children.flatMap(c => c.byMonth)])) : 0

  const caption = (line: BreakdownLine) => range
    ? (line.average != null ? t('an.year.aMonth', { amount: amountOf(line.average, 'month') }) : null)
    : vsExpected(t, { soFar: line.amount, expected: line.expected, open, isNew: line.isNew })
  const row = (line: BreakdownLine, child: boolean) => (
    <BulletRow
      key={line.key}
      label={lineLabel(line, t, categoryName, lang)}
      amount={amountOf(line.amount, mode)}
      value={line.amount}
      parts={[{ value: line.amount, className: SERIES_BG.bonus }]}
      expected={!range && !line.isNew ? line.expected : null}
      scale={scale}
      thin={child}
      captions={[
        caption(line),
        // Money counted here that arrived in another month — on the source it belongs to.
        !range && (child || line.children.length === 0) ? received.receivedOn(line.otherMonth) : null,
      ]}
      negative={open ? 'slate' : 'rose'}
      to={!range && line.history ? historyHref(month, line.history) : undefined}
      strip={range
        ? <SlotStrip values={slotValues(line.byMonth, d.months)} max={stripMax} fillClass={SERIES_BG.bonus} />
        : undefined}
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
          expected={expIn}
          scale={scale}
          captions={range
            ? [d.average ? t('an.year.aMonth', { amount: amountOf(d.average.flow.earned, 'month') }) : null]
            : [
                vsExpected(t, { soFar: f.earned, expected: expIn, open, bonus }),
                stableIncome(d),
                received.countsIn(d.receivedForOtherMonths),
              ]}
          strip={range
            ? <SlotStrip values={slotValues(d.months.map(m => m.earned), d.months)} max={Math.max(0, ...d.months.map(m => m.earned))} fillClass={SERIES_BG.bonus} />
            : undefined}
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
