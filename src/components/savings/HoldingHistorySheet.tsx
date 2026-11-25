import { ArrowDownToLine, ArrowLeftRight, Landmark, Plus } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { ListRow } from '../ui/ListRow'
import { Skeleton } from '../ui/Skeleton'
import { ErrorTile } from '../ui/ErrorTile'
import { useApi } from '../../hooks/useApi'
import { useLang } from '../../i18n/LanguageContext'
import { financeApi } from '../../api/finance'
import { formatDate, moneyFull, snap } from '../../utils/format'
import { GrowthLine } from './growth'
import type { InvestmentResponse, InvestmentTransferResponse, Transaction } from '../../types'

/** The words the server writes on a put-in or take-out saved without any — the row's kind says it already. */
const SERVER_WORDS = /^(Contribution — |Investment — |Taken from )/

const CHIP = 'flex h-9 w-9 items-center justify-center rounded-chip'

/**
 * One holding's money in and out — every put-in and take-out booked on it, newest first — opened
 * from its row on Savings, the way a wallet opens its own list on Wallets.
 *
 * Money that reached it without a wallet (what it held when tracking began, or a put-in marked
 * "not from a wallet") has no row of its own, so it is one line at the foot: with it the list adds
 * up to what was put in.
 *
 * Moves between investments (INVEST-SPEC.md §2) are in the list too, by date: "Moved → X" / "Moved
 * in ← Y". They carry "put in" along (`putInMoved`), so the foot line counts them as well:
 *   already there = investedAmount − put-ins + take-outs − putInMoved of moves in + putInMoved of moves out.
 */
export function HoldingHistorySheet({ investment: inv, onClose }: {
  investment: InvestmentResponse | null
  onClose: () => void
}) {
  const { t, lang } = useLang()
  const query = useApi(
    () => inv ? financeApi.getInvestmentContributions(inv.id) : Promise.resolve({ data: null } as never),
    [inv?.id],
  )
  // Moves are a list of their own; a server without them (or a failure) leaves just the money in and out.
  const moveQuery = useApi(
    () => inv
      ? financeApi.getInvestmentTransfers({ investmentId: inv.id }).catch(() => ({ data: [] as InvestmentTransferResponse[] }))
      : Promise.resolve({ data: null } as never),
    [inv?.id],
  )
  const rows: Transaction[] = inv ? (query.data ?? []) : []
  const moves: InvestmentTransferResponse[] = inv ? (moveQuery.data ?? []) : []
  const isOut = (tx: Transaction) => tx.type === 'INCOME'
  const movedOut = (m: InvestmentTransferResponse) => m.fromId === inv?.id
  const outside = inv && query.data && moveQuery.data
    ? snap(inv.investedAmount
      - rows.reduce((sum, tx) => sum + (isOut(tx) ? -tx.amount : tx.amount), 0)
      - moves.reduce((sum, m) => sum + (movedOut(m) ? -m.putInMoved : m.putInMoved), 0))
    : 0

  // One list, newest first: a booked entry and a move side by side by their day.
  type Entry = { kind: 'tx'; date: string; tx: Transaction } | { kind: 'move'; date: string; move: InvestmentTransferResponse }
  const entries: Entry[] = [
    ...rows.map(tx => ({ kind: 'tx' as const, date: tx.transactionDate, tx })),
    ...moves.map(move => ({ kind: 'move' as const, date: move.date, move })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const walletOf = (tx: Transaction) => {
    const cash = t('tx.cash')
    if (!tx.card) return cash
    return (tx.cashAmount ?? 0) > 0 ? `${tx.card.name} + ${cash}` : tx.card.name
  }

  return (
    <Sheet open={!!inv} onClose={onClose} title={inv?.name ?? ''} maxWidth="max-w-2xl">
      {inv && (
        <>
          <div className="-mt-2 mb-4">
            {inv.broker && <p className="text-sm text-slate-600">{inv.broker}</p>}
            <GrowthLine i={inv} />
          </div>

          {query.loading || moveQuery.loading ? (
            <Skeleton variant="row" count={4} bare />
          ) : query.error && !query.data ? (
            <ErrorTile message={query.error} onRetry={query.refetch} />
          ) : entries.length === 0 && outside < 1 ? (
            <p className="py-12 text-center text-sm text-slate-500">{t('shell.holding.empty')}</p>
          ) : (
            <>
              {query.error && <ErrorTile compact message={query.error} onRetry={query.refetch} className="mb-3" />}
              {/* Bled to the sheet's edges and framed once, like a wallet's list. */}
              <div className={`-mx-5 divide-y divide-hairline border-y border-hairline sm:-mx-7 ${
                query.refreshing ? 'opacity-60 transition-opacity' : ''
              }`}>
                {entries.map(entry => {
                  if (entry.kind === 'move') {
                    const m = entry.move
                    const out = movedOut(m)
                    return (
                      <ListRow
                        key={`move-${m.id}`}
                        leading={
                          <div className={`${CHIP} ${out ? 'bg-slate-100 text-slate-600' : 'bg-teal-100 text-teal-600'}`}>
                            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                          </div>
                        }
                        title={out
                          ? t('invest.history.movedOut', { name: m.toName })
                          : t('invest.history.movedIn', { name: m.fromName })}
                        subtitle={[formatDate(m.date, lang), m.note].filter(Boolean).join(' · ')}
                        amount={`${out ? '−' : '+'}${moneyFull(m.amount, m.currency)}`}
                        amountTone={out ? 'neutral' : 'in'}
                      />
                    )
                  }
                  const tx = entry.tx
                  const out = isOut(tx)
                  const words = tx.description && !SERVER_WORDS.test(tx.description) ? tx.description : null
                  return (
                    <ListRow
                      key={tx.id}
                      leading={
                        <div className={`${CHIP} ${out ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-income'}`}>
                          {out ? <ArrowDownToLine className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                        </div>
                      }
                      title={t(out ? 'shell.holding.out' : 'shell.holding.in')}
                      subtitle={[formatDate(tx.transactionDate, lang), walletOf(tx), words].filter(Boolean).join(' · ')}
                      amount={`${out ? '−' : '+'}${moneyFull(tx.amount, tx.currency)}`}
                      amountTone={out ? 'neutral' : 'in'}
                    />
                  )
                })}
                {outside >= 1 && (
                  <ListRow
                    leading={
                      <div className={`${CHIP} bg-slate-100 text-slate-600`}>
                        <Landmark className="h-4 w-4" aria-hidden="true" />
                      </div>
                    }
                    title={t('shell.holding.already')}
                    subtitle={t('shell.holding.alreadyHint')}
                    amount={`+${moneyFull(outside, inv.currency)}`}
                    amountTone="in"
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
