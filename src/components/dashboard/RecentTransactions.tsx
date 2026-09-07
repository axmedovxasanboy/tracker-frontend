import { ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { CacheBadge } from '../ui/CacheBadge'
import { ErrorTile } from '../ui/ErrorTile'
import { ListRow, ListTile } from '../ui/ListRow'
import { Skeleton } from '../ui/Skeleton'
import type { TileSpan } from '../ui/Tile'
import { useLang } from '../../i18n/LanguageContext'
import type { Currency, Transaction } from '../../types'
import { formatDate, moneyFull } from '../../utils/format'

interface Props {
  transactions: Transaction[]
  loading: boolean
  /** A later fetch while the rows are still on screen — dim them, never blank them. */
  refreshing?: boolean
  error?: string | null
  onRetry?: () => void
  isCached?: boolean
  cachedAt?: string | null
  onTransactionClick: (t: Transaction) => void
  span?: TileSpan
}

/**
 * The last few entries, as the way back into the app.
 *
 * Amounts are `moneyFull` rather than the compact form the stat tiles use: this is a list, and a
 * list is where the reader checks whether a specific figure is the one they recorded.
 */
export function RecentTransactions({
  transactions, loading, refreshing, error, onRetry, isCached, cachedAt, onTransactionClick, span,
}: Props) {
  const { t: translate, categoryName, lang } = useLang()
  const navigate = useNavigate()
  const uncategorizedLabel = translate('cmp.dashboard.uncategorized')

  const header = (
    <>
      <div className="min-w-0">
        <h3 className="text-title text-slate-900">{translate('cmp.dashboard.recentTransactions')}</h3>
        <p className="text-sm text-slate-500 mt-0.5">{translate('cmp.dashboard.latest8')}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <CacheBadge isCached={!!isCached} cachedAt={cachedAt ?? null} />
        <Button
          size="sm"
          variant="ghost"
          icon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
          label={translate('cmp.dashboard.seeAll')}
          onClick={() => navigate('/transactions')}
        />
      </div>
    </>
  )

  if (loading) {
    return <ListTile span={span} header={header}><Skeleton variant="row" count={5} bare /></ListTile>
  }

  // The tile is already drawn, so the compact strip — message plus Retry — carries the failure;
  // without it a 4xx would look exactly like an account with nothing recorded in it.
  if (error && transactions.length === 0) {
    return (
      <ListTile span={span} header={header} empty={<ErrorTile compact message={error} onRetry={onRetry} />}>
        {null}
      </ListTile>
    )
  }

  return (
    <ListTile span={span} header={header} empty={translate('cmp.dashboard.noTransactionsYet')}>
      {error && (
        <div className="px-4 py-3">
          <ErrorTile compact message={error} onRetry={onRetry} />
        </div>
      )}
      {transactions.map(tx => {
        const income = tx.type === 'INCOME'
        return (
          <ListRow
            key={tx.id}
            className={refreshing ? 'opacity-60 transition-opacity' : undefined}
            leading={
              <span
                className={`w-9 h-9 rounded-chip flex items-center justify-center ${
                  income ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                }`}
              >
                {income
                  ? <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  : <ArrowDownRight className="w-4 h-4" aria-hidden="true" />}
              </span>
            }
            title={tx.description}
            subtitle={`${tx.category ? categoryName(tx.category) : uncategorizedLabel} · ${formatDate(tx.transactionDate, lang, 'dayShort')}`}
            amount={`${income ? '+' : '−'}${moneyFull(tx.amount, tx.currency as Currency)}`}
            amountTone={income ? 'in' : 'out'}
            onClick={() => onTransactionClick(tx)}
          />
        )
      })}
    </ListTile>
  )
}
