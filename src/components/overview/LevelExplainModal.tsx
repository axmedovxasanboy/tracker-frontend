import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { ErrorTile } from '../ui/ErrorTile'
import { Skeleton } from '../ui/Skeleton'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { overviewApi } from '../../api/overview'
import { extractErrorMessage } from '../../api/client'
import { formatNumber, moneyExact } from '../../utils/format'
import type { AllocationLevelView, Currency, OverviewTierResponse } from '../../types'

/**
 * "Level 1.2" in the viewer's language.
 *
 * `OverviewTierResponse.levelLabel` is composed server-side as English prose
 * (`OverviewService.computeLevelLabel`), so the language switch could never reach it — and it is
 * printed on the Plan header chip, the "How Level 1.2 works" button and this dialog's title. The
 * ordinal itself is on the wire as `level` / `subLevel`; only the word around it needed
 * translating. The server label survives as the fallback for the two states that have no ordinal
 * ("Above tier 6", "Set monthly income to compute tier"); neither renders the chip or this modal.
 */
export function levelWord(
  tier: Pick<OverviewTierResponse, 'level' | 'subLevel' | 'levelLabel'>,
  t: (key: TKey, vars?: Record<string, string | number>) => string,
): string {
  const ordinal = tier.subLevel ?? (tier.level != null ? String(tier.level) : null)
  return ordinal ? t('page.plan.levelWord', { level: ordinal }) : tier.levelLabel
}

/**
 * "Why am I on this level?" — walks the same arithmetic the backend ran, with the user's own
 * numbers, so the level stops looking like a verdict handed down from nowhere.
 *
 * Level comes from LEFT MONEY (income − monthly bills); the sub-level comes from the debt ratio
 * (debt payments ÷ stable income). Deliberately two separate steps, because that is what the
 * engine does — mixing them into one sentence is what makes the level confusing.
 *
 * The denominator matters and used to be printed wrong here: OverviewService divides the debt
 * payments by the STABLE INCOME (OverviewService.java:152-154), never by what is left after
 * bills, so the operand row below is the income and not `leftMoney`. The displayed percentage was
 * always the backend's, which is why the modal's own two rows could not produce its own third.
 */
export function LevelExplainModal({
  open, onClose, tier, currency,
}: {
  open: boolean
  onClose: () => void
  tier: OverviewTierResponse
  currency: Currency
}) {
  const { t } = useLang()
  const [levels, setLevels] = useState<AllocationLevelView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    setLevels(null)
    overviewApi.getAllocationRules()
      .then(r => setLevels(r.data.levels))
      .catch(err => setError(extractErrorMessage(err)))
  }

  useEffect(() => {
    if (!open) return
    load()
  }, [open])

  const money = (n: number) => moneyExact(n, currency)
  const band = levels?.find(l => l.level === tier.level)
  // Read the next band's floor rather than adding 1 to this band's ceiling: the two are equal by
  // construction today, and only one of them stays right if a breakpoint ever moves.
  const next = tier.level != null ? levels?.find(l => l.level === tier.level! + 1) : undefined
  const ratioPct = tier.debtRatio != null ? formatNumber(tier.debtRatio * 100, 1) : null

  return (
    <Modal open={open} onClose={onClose} title={t('cmp.levelWhy.title', { level: levelWord(tier, t) })} maxWidth="max-w-lg">
      <div className="space-y-5">

        {/* Step 1 — what the level is measured on */}
        <section>
          <p className="text-label uppercase text-slate-500 mb-2">
            {t('cmp.levelWhy.step1')}
          </p>
          <div className="rounded-control border border-hairline divide-y divide-hairline text-sm">
            <Row label={t('page.overview.stableIncomeLabel')} value={money(tier.income)} />
            <Row label={t('page.overview.mandatoryLabel')} value={`− ${money(tier.mandatorySubscriptions)}`} />
            <Row label={t('page.overview.leftMoneyLabel')} value={money(tier.leftMoney)} strong />
          </div>
        </section>

        {/* Step 2 — which band that lands in, and what the next one asks for */}
        <section>
          <p className="text-label uppercase text-slate-500 mb-2">
            {t('cmp.levelWhy.step2')}
          </p>
          {error ? (
            <ErrorTile compact message={error} onRetry={load} />
          ) : levels === null ? (
            <Skeleton variant="text" count={2} bare />
          ) : band ? (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t('cmp.levelWhy.bandSentence', {
                  left: money(tier.leftMoney),
                  low: money(band.incomeLow),
                  high: band.incomeHigh > 0 ? money(band.incomeHigh) : '∞',
                  level: String(tier.level ?? ''),
                })}
              </p>
              {next && (
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed tabular-nums">
                  {t('cmp.levelWhy.nextLevel', {
                    level: String(next.level),
                    threshold: money(next.incomeLow),
                    gap: money(Math.max(0, next.incomeLow - tier.leftMoney)),
                  })}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600">{t('cmp.levelWhy.noBand')}</p>
          )}
        </section>

        {/* Step 3 — the sub-level, which is a separate question with a different denominator */}
        {tier.subLevel && (
          <section>
            <p className="text-label uppercase text-slate-500 mb-2">
              {t('cmp.levelWhy.step3', { sub: tier.subLevel })}
            </p>
            <div className="rounded-control border border-hairline divide-y divide-hairline text-sm">
              <Row label={t('page.overview.debtPaymentsLabel')} value={money(tier.debtPayments)} />
              <Row label={t('page.overview.stableIncomeLabel')} value={money(tier.income)} />
              {ratioPct && <Row label={t('cmp.levelWhy.debtRatio')} value={`${ratioPct}%`} strong />}
            </div>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{t('cmp.levelWhy.ratioRule')}</p>
            {tier.debtPayments > 0 && (
              <div className="mt-2 rounded-control border border-hairline px-3 py-2 text-xs text-slate-600 space-y-0.5 tabular-nums">
                <p className="text-slate-500">{t('cmp.levelWhy.debtFrom')}</p>
                <p>· {t('page.finance.tabBankLoans')}: {money(tier.debtBreakdown.bankLoans)}</p>
                <p>· {t('cmp.levelWhy.borrowed')}: {money(tier.debtBreakdown.loansTaken)}</p>
                <p>· {t('cmp.levelWhy.debts')}: {money(tier.debtBreakdown.debts)}</p>
              </div>
            )}
          </section>
        )}

        {/* What the number is actually used for */}
        <p className="text-sm text-slate-600 border-t border-hairline pt-4 leading-relaxed">
          {t('cmp.levelWhy.footer', { base: money(tier.allocationBase) })}
        </p>
      </div>
    </Modal>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className={strong ? 'text-slate-900 font-medium' : 'text-slate-600'}>{label}</span>
      <span className={`shrink-0 tabular-nums ${strong ? 'text-slate-900 font-bold' : 'text-slate-900'}`}>{value}</span>
    </div>
  )
}
