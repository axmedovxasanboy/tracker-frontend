import { useEffect, useState } from 'react'
import { ErrorTile } from '../ui/ErrorTile'
import { Modal } from '../ui/Modal'
import { Skeleton } from '../ui/Skeleton'
import { useLang } from '../../i18n/LanguageContext'
import { extractErrorMessage } from '../../api/client'
import { cardsApi } from '../../api/cards'
import { cashBalancesApi } from '../../api/cashBalances'
import { dashboardApi } from '../../api/dashboard'
import { moneyFull } from '../../utils/format'
import type { Currency } from '../../types'

/** Which summary card is being explained. */
export type InfoKind = 'spendable' | 'income' | 'expenses'

type Source = { label: string; amount: number; color?: string }

/**
 * "What is this number and where did it come from?" for a Dashboard summary card.
 *
 * Every card gets the same three beats: what it means, the rule the backend applied, and the
 * live rows that add up to the figure on the card. The rows are re-fetched from the same
 * endpoints the number came from rather than reconstructed here, so the modal cannot drift
 * into explaining arithmetic the backend no longer does.
 */
export function CardInfoModal({
  open, onClose, kind, currency, total,
}: {
  open: boolean
  onClose: () => void
  kind: InfoKind
  currency: Currency
  total: number | null
}) {
  const { t } = useLang()
  const [sources, setSources] = useState<Source[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Bumped by Retry — the rows come from a plain fetch, not from `useApi`. */
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let alive = true
    setSources(null)
    setError(null)

    const load = async () => {
      if (kind === 'spendable') {
        const [cards, cash] = await Promise.all([cardsApi.getAll(), cashBalancesApi.getAll()])
        const rows: Source[] = cards.data
          .filter(c => c.currency === currency)
          .map(c => ({ label: c.name, amount: c.currentBalance, color: c.color }))
        const pot = cash.data.find(c => c.currency === currency)
        if (pot) rows.push({ label: t('cmp.cardInfo.cashPot'), amount: pot.currentBalance })
        return rows
      }
      const res = await dashboardApi.getCategoryBreakdown(
        kind === 'income' ? 'INCOME' : 'EXPENSE', currency,
      )
      return res.data.map(c => ({ label: c.category, amount: c.amount, color: c.color }))
    }

    load()
      .then(r => { if (alive) setSources(r) })
      // A failed fetch used to render as "nothing recorded yet, so the figure is zero" — the
      // same screen as a genuinely empty account, for what may well be a 500.
      .catch((err: unknown) => { if (alive) { setError(extractErrorMessage(err)); setSources([]) } })
    return () => { alive = false }
  }, [open, kind, currency, t, attempt])

  const money = (n: number) => moneyFull(n, currency)
  const listed = (sources ?? []).reduce((sum, s) => sum + s.amount, 0)
  // The category breakdown INNER JOINs categories, so uncategorised transactions are counted in
  // the card total but have no row here. Show the gap rather than let the rows quietly not add up.
  const unlisted = total != null ? total - listed : 0
  const showUnlisted = kind !== 'spendable' && sources !== null && Math.abs(unlisted) >= 1

  return (
    <Modal open={open} onClose={onClose} title={t(`cmp.cardInfo.${kind}.title`)} maxWidth="max-w-lg">
      <div className="space-y-5">

        {/* What the card means */}
        <p className="text-sm text-slate-600 leading-relaxed">{t(`cmp.cardInfo.${kind}.meaning`)}</p>

        {/* The rule the backend applied */}
        <section>
          <p className="text-label uppercase text-slate-500 mb-2">
            {t('cmp.cardInfo.howItsBuilt')}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-hairline rounded-control px-3 py-2.5">
            {t(`cmp.cardInfo.${kind}.formula`)}
          </p>
        </section>

        {/* The live rows that add up to it */}
        <section>
          <p className="text-label uppercase text-slate-500 mb-2">
            {t(`cmp.cardInfo.${kind}.sourcesLabel`)}
          </p>
          {sources === null ? (
            // The resolved branch is a bordered list of ~36px rows, so a 40px spinner box meant
            // the dialog grew by 100-200px when the rows landed and shoved the caveat below it
            // — on a phone, out from under whatever the reader had started on.
            <Skeleton variant="row" count={3} bare className="rounded-control border border-hairline" />
          ) : error ? (
            <ErrorTile compact message={error} onRetry={() => setAttempt(n => n + 1)} />
          ) : sources.length === 0 && !showUnlisted ? (
            <p className="text-sm text-slate-500">{t('cmp.cardInfo.noSources')}</p>
          ) : (
            <div className="rounded-control border border-hairline divide-y divide-hairline text-sm">
              {sources.map((s, i) => (
                <div key={`${s.label}-${i}`} className="flex items-center justify-between px-3 py-2 gap-3">
                  <span className="flex items-center gap-2 min-w-0 text-slate-600">
                    {s.color && (
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    )}
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="text-slate-700 shrink-0 tabular-nums">{money(s.amount)}</span>
                </div>
              ))}
              {showUnlisted && (
                <div className="flex items-center justify-between px-3 py-2 gap-3">
                  <span className="text-slate-500 italic">{t('cmp.cardInfo.uncategorised')}</span>
                  <span className="text-slate-700 shrink-0 tabular-nums">{money(unlisted)}</span>
                </div>
              )}
              {total != null && (
                <div className="flex items-center justify-between px-3 py-2 gap-3 bg-slate-50/70">
                  <span className="text-slate-700 font-medium">{t('cmp.cardInfo.total')}</span>
                  <span className="text-slate-900 font-bold shrink-0 tabular-nums">{money(total)}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* The caveat that most often surprises people */}
        <p className="text-sm text-slate-500 leading-relaxed">
          {t(`cmp.cardInfo.${kind}.note`)}
        </p>
      </div>
    </Modal>
  )
}
