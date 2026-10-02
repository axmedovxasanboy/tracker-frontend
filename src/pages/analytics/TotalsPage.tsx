import { BulletRow, scaleOf, vsExpected } from '../../components/analytics/BulletRow'
import { bonusInExpected, expectedIn, expectedLeftOver, isOpenMonth } from '../../components/analytics/figures'
import { SECTION_PATH } from '../../components/analytics/sections'
import { compact, HATCH, SERIES_BG } from '../../components/analytics/shared'
import { Tile } from '../../components/ui/Tile'
import { useLang } from '../../i18n/LanguageContext'
import { NotCountedBlock, PageGrid, useAnalytics, useReceivedCaptions, useStableIncomeCaption } from './common'

/**
 * Page 1, Totals (§3.1): this month, how much came in, went out and was set aside, what is left —
 * and is that normal? Four bullet rows on one scale, each "so far" against its expected month.
 * Because Out + Set aside + Left over = In, the shared scale also shows how In was divided, so no
 * split bar is needed. In, Out and Set aside lead to their pages; Left over leads nowhere.
 */
export function TotalsPage() {
  const { t } = useLang()
  const { d, search } = useAnalytics()
  const received = useReceivedCaptions()
  const stableIncome = useStableIncomeCaption()

  const f = d.months[d.months.length - 1] ?? d.total
  const open = isOpenMonth(d)
  const e = d.expected?.flow ?? null
  const expIn = expectedIn(d)
  const expLeft = expectedLeftOver(d)
  const bonus = bonusInExpected(d)
  const paidOff = d.expected?.paidOffLoans ?? 0
  const scale = scaleOf([f.earned, expIn, f.out, e?.out, f.saved, e?.saved, f.leftOver, expLeft])

  return (
    <PageGrid mode="month">
      <Tile span={7} mdSpan={6} as="section">
        <h2 className="sr-only">{t('analytics.nav.totals')}</h2>
        <BulletRow
          label={t('shell.history.in')}
          amount={compact(f.earned)}
          value={f.earned}
          parts={[{ value: f.earned, className: SERIES_BG.bonus }]}
          expected={expIn}
          scale={scale}
          captions={[
            vsExpected(t, { soFar: f.earned, expected: expIn, open, bonus }),
            stableIncome(d),
            received.receivedOnAll(d.income),
            received.countsIn(d.receivedForOtherMonths),
          ]}
          to={`${SECTION_PATH.in}${search}`}
        />
        <BulletRow
          label={t('shell.history.out')}
          amount={compact(f.out)}
          value={f.out}
          parts={[
            { value: Math.max(0, f.everyday), className: SERIES_BG.everyday },
            { value: f.bills, className: SERIES_BG.bills },
            { value: f.loanPayments, className: SERIES_BG.loans },
          ]}
          expected={e?.out ?? null}
          scale={scale}
          captions={[vsExpected(t, { soFar: f.out, expected: e?.out ?? null, open, paidOff })]}
          to={`${SECTION_PATH.out}${search}`}
        />
        <BulletRow
          label={t('fix.setAside')}
          amount={compact(f.saved)}
          value={f.saved}
          parts={[
            { value: f.savedInvestments, className: SERIES_BG.investments },
            { value: f.savedEmergency, className: SERIES_BG.emergency },
            { value: f.savedGoals, className: SERIES_BG.goals },
            { value: f.savedDonation, className: SERIES_BG.given },
          ]}
          expected={e?.saved ?? null}
          scale={scale}
          captions={[vsExpected(t, { soFar: f.saved, expected: e?.saved ?? null, open })]}
          to={`${SECTION_PATH['set-aside']}${search}`}
        />
        <BulletRow
          label={t('analytics.group.leftOver')}
          amount={compact(f.leftOver)}
          value={f.leftOver}
          parts={[{ value: f.leftOver, className: HATCH }]}
          expected={expLeft}
          scale={scale}
          captions={[vsExpected(t, { soFar: f.leftOver, expected: expLeft, open, kind: 'leftOver', bonus })]}
          // Pay usually lands after the spending, so a month still running is not called short.
          negative={open ? 'slate' : 'rose'}
        />
      </Tile>
      <NotCountedBlock
        mode="month"
        titleKey="an.notCounted"
        flows={['BORROWED', 'LENT', 'RETURNED', 'FROM_SAVINGS']}
      />
    </PageGrid>
  )
}
