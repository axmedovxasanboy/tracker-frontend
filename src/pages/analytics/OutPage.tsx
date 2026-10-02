import { BulletRow, scaleOf, vsExpected } from '../../components/analytics/BulletRow'
import { CumulativeChart } from '../../components/analytics/CumulativeChart'
import { isOpenMonth, lineDrawn, lineLabel } from '../../components/analytics/figures'
import { LineList, outParts } from '../../components/analytics/LineList'
import { SlotStrip, slotValues } from '../../components/analytics/MiniColumns'
import { compact, SERIES_BG } from '../../components/analytics/shared'
import { useLang } from '../../i18n/LanguageContext'
import { amountOf, Block, MiniCard, MiniRow, NotCountedBlock, PageGrid, useAnalytics } from './common'
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
 */
export function OutPage({ mode = 'month', size = 'full', onOpen }: PageProps) {
  const { t, lang, categoryName } = useLang()
  const { d, month } = useAnalytics()

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

  const drawn = d.out.filter(l => lineDrawn(l, mode))
  const scale = scaleOf([f.out, e?.flow.out, ...drawn.flatMap(l => [l.amount, l.expected])])

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
  // The list runs down beside the two side tiles only when both are there.
  const lentShown = d.moved.some(l => (l.flow === 'LENT' || l.key === 'moved:LENT') && l.amount !== 0)
  const perDay = !range && m && m.days > 0 && f.everyday > 0
    ? `${t('analytics.group.everyday')}: ${t('an.perDay', { amount: compact(f.everyday / m.days) })}`
    : null

  return (
    <PageGrid mode={mode}>
      <Block mode={mode}>
        <BulletRow
          lead
          label={t('shell.history.out')}
          amount={amountOf(f.out, mode)}
          value={f.out}
          parts={[
            { value: Math.max(0, f.everyday), className: SERIES_BG.everyday },
            { value: f.bills, className: SERIES_BG.bills },
            { value: f.loanPayments, className: SERIES_BG.loans },
          ]}
          expected={e?.flow.out ?? null}
          scale={scale}
          captions={range
            ? [d.average ? t('an.year.aMonth', { amount: compact(d.average.flow.out) }) : null]
            : [
                vsExpected(t, { soFar: f.out, expected: e?.flow.out ?? null, open, paidOff }),
                perDay,
                // With the chart on screen this sentence is its caption instead.
                showChart ? null : byToday,
              ]}
          strip={range
            ? <SlotStrip values={slotValues(d.months.map(x => x.out), d.months)} max={Math.max(0, ...d.months.map(x => x.out))} fillClass={SERIES_BG.everyday} />
            : undefined}
        />
      </Block>

      <Block mode={mode} span={7} mdSpan={6} rows={showChart && lentShown ? 2 : undefined} title={t('an.byCategory')}>
        <LineList
          lines={d.out}
          mode={mode}
          base={e != null}
          open={open}
          month={month}
          months={d.months}
          scale={scale}
          paidOff={paidOff}
        />
      </Block>

      {showChart && m && (
        <Block mode={mode} span={5} mdSpan={6} title={t('an.throughMonth')}>
          <CumulativeChart
            daily={d.everydayDaily}
            daysInMonth={m.daysInMonth}
            expectedTotal={expItemised}
            caption={chartCaption}
          />
        </Block>
      )}

      <NotCountedBlock mode={mode} titleKey="an.notCountedOut" flows={['LENT']} />
    </PageGrid>
  )
}
