import { ArrowDownLeft, ArrowUpRight, PiggyBank, Wallet } from 'lucide-react'
import { vsExpected } from '../../components/analytics/BulletRow'
import { DeltaBadge } from '../../components/analytics/DeltaBadge'
import { Donut } from '../../components/analytics/Donut'
import { FigureTile } from '../../components/analytics/FigureTile'
import { bonusInExpected, expectedIn, expectedLeftOver, isOpenMonth } from '../../components/analytics/figures'
import { HEX } from '../../components/analytics/palette'
import { SECTION_PATH } from '../../components/analytics/sections'
import { ShareRow } from '../../components/analytics/ShareRow'
import { compact, HATCH, SERIES_BG, shareOf } from '../../components/analytics/shared'
import { Tile } from '../../components/ui/Tile'
import { useLang } from '../../i18n/LanguageContext'
import {
  FigureTileInfo, NotCountedBlock, PageGrid, TileHead, useAnalytics, useLastMonthLine, useReceivedCaptions,
  useStableIncomeCaption,
} from './common'

/**
 * Page 1, Totals (§3.1; restyled 2026-10-13 after the reference dashboards the owner picked): this
 * month, how much came in, went out and was set aside, what is left — and is that normal?
 *
 * Four stat tiles, each with its badge against last month and a meter of so far against expected;
 * what is said about a figure (expected, to come …) is behind its "!". In, Out and Set aside lead
 * to their pages. Then where the money went — Out's three parts and Set aside as one ring — and
 * what moved without being In or Out.
 */
export function TotalsPage() {
  const { t } = useLang()
  const { d, search, prev } = useAnalytics()
  const lastMonth = useLastMonthLine()
  const received = useReceivedCaptions()
  const stableIncome = useStableIncomeCaption()

  const f = d.months[d.months.length - 1] ?? d.total
  const open = isOpenMonth(d)
  const e = d.expected?.flow ?? null
  const expIn = expectedIn(d)
  const expLeft = expectedLeftOver(d)
  const bonus = bonusInExpected(d)
  const paidOff = d.expected?.paidOffLoans ?? 0
  const p = prev?.flow ?? null
  const badge = (value: number, previous: number | undefined, upIsGood = true) => prev
    ? <DeltaBadge value={value} previous={previous} prevMonth={prev.month} open={open} upIsGood={upIsGood} />
    : null

  // Where it went: Out's three parts, then Set aside — the validated ring order (palette.ts).
  const parts = [
    { key: 'everyday', label: t('analytics.group.everyday'), amount: Math.max(0, f.everyday), color: HEX.everyday, to: SECTION_PATH.out },
    { key: 'bills', label: t('analytics.group.bills'), amount: f.bills, color: HEX.bills, to: SECTION_PATH.out },
    { key: 'loans', label: t('analytics.group.loans'), amount: f.loanPayments, color: HEX.loans, to: SECTION_PATH.out },
    { key: 'saved', label: t('fix.setAside'), amount: f.saved, color: HEX.saved, to: SECTION_PATH['set-aside'] },
  ]
  const whole = parts.reduce((s, x) => s + Math.max(0, x.amount), 0)

  return (
    <PageGrid mode="month">
      <FigureTile
        stretch
        label={t('shell.history.in')}
        icon={<ArrowDownLeft className="h-4 w-4" aria-hidden="true" />}
        iconTone="teal"
        amount={compact(f.earned)}
        value={f.earned}
        badge={badge(f.earned, p?.earned)}
        meter={{ expected: expIn, fill: SERIES_BG.bonus }}
        info={<FigureTileInfo title={t('shell.history.in')} amount={f.earned} lines={[
          vsExpected(t, { soFar: f.earned, expected: expIn, open, bonus }),
          lastMonth(p?.earned),
          stableIncome(d),
          received.receivedOnAll(d.income),
          received.countsIn(d.receivedForOtherMonths),
        ]} />}
        to={`${SECTION_PATH.in}${search}`}
      />
      <FigureTile
        stretch
        label={t('shell.history.out')}
        icon={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
        iconTone="amber"
        amount={compact(f.out)}
        value={f.out}
        badge={badge(f.out, p?.out, false)}
        meter={{ expected: e?.out ?? null, fill: SERIES_BG.everyday }}
        info={<FigureTileInfo title={t('shell.history.out')} amount={f.out} lines={[
          vsExpected(t, { soFar: f.out, expected: e?.out ?? null, open, paidOff }),
          lastMonth(p?.out),
        ]} />}
        to={`${SECTION_PATH.out}${search}`}
      />
      <FigureTile
        stretch
        label={t('fix.setAside')}
        icon={<PiggyBank className="h-4 w-4" aria-hidden="true" />}
        iconTone="pink"
        amount={compact(f.saved)}
        value={f.saved}
        badge={badge(f.saved, p?.saved)}
        meter={{ expected: e?.saved ?? null, fill: SERIES_BG.saved }}
        info={<FigureTileInfo title={t('fix.setAside')} amount={f.saved} lines={[
          vsExpected(t, { soFar: f.saved, expected: e?.saved ?? null, open }),
          lastMonth(p?.saved),
        ]} />}
        to={`${SECTION_PATH['set-aside']}${search}`}
      />
      <FigureTile
        stretch
        label={t('analytics.group.leftOver')}
        icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
        amount={compact(f.leftOver)}
        value={f.leftOver}
        badge={badge(f.leftOver, p?.leftOver)}
        meter={{ expected: expLeft, fill: HATCH }}
        info={<FigureTileInfo title={t('analytics.group.leftOver')} amount={f.leftOver} lines={[
          vsExpected(t, { soFar: f.leftOver, expected: expLeft, open, kind: 'leftOver', bonus }),
          lastMonth(p?.leftOver),
        ]} />}
        // Pay usually lands after the spending, so a month still running is not called short.
        negative={open ? 'slate' : 'rose'}
      />

      {whole > 0 && (
        <Tile span={7} mdSpan={6} as="section">
          <TileHead title={t('shell.history.whereItWent')} />
          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <Donut
              segments={parts.map(x => ({ key: x.key, label: x.label, value: x.amount, color: x.color }))}
              total={whole}
              totalLabel={t('an.donut.total')}
              ariaLabel={t('an.donut.whereWent')}
            />
            <ul className="w-full min-w-0 flex-1">
              {parts.filter(x => x.amount !== 0).map(x => (
                <li key={x.key}>
                  <ShareRow
                    slot={{ color: x.color }}
                    label={x.label}
                    amount={compact(x.amount)}
                    share={shareOf(x.amount, whole)}
                    to={`${x.to}${search}`}
                  />
                </li>
              ))}
            </ul>
          </div>
        </Tile>
      )}
      <NotCountedBlock
        mode="month"
        span={whole > 0 ? 5 : 12}
        titleKey="an.notCounted"
        flows={['BORROWED', 'LENT', 'RETURNED', 'FROM_SAVINGS']}
      />
    </PageGrid>
  )
}
