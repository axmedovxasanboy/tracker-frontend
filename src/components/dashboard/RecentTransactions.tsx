import { ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '../ui/Spinner'
import { CacheBadge } from '../ui/CacheBadge'
import type { Currency, Transaction } from '../../types'
import { formatCurrency } from '../../utils/format'

interface Props {
  transactions: Transaction[]
  loading: boolean
  currency: Currency
  isCached?: boolean
  cachedAt?: string | null
  onTransactionClick: (t: Transaction) => void
}

export function RecentTransactions({ transactions, loading, currency, isCached, cachedAt, onTransactionClick }: Props) {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">Recent Transactions</h3>
          <p className="text-xs text-slate-400 mt-0.5">Latest 8 entries</p>
        </div>
        <div className="flex items-center gap-3">
          <CacheBadge isCached={!!isCached} cachedAt={cachedAt ?? null} />
          <button
            onClick={() => navigate('/transactions')}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            See all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center"><Spinner /></div>
      ) : transactions.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No transactions yet</div>
      ) : (
        <>
          <div className="space-y-0.5">
            {transactions.map(t => (
              <button
                key={t.id}
                onClick={() => onTransactionClick(t)}
                className="w-full flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-slate-50 transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  t.type === 'INCOME' ? 'bg-emerald-100' : 'bg-rose-100'
                }`}>
                  {t.type === 'INCOME'
                    ? <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    : <ArrowDownRight className="w-4 h-4 text-rose-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{t.description}</p>
                  <p className="text-xs text-slate-400">
                    {t.category?.name ?? 'Uncategorized'} · {format(new Date(t.transactionDate), 'dd-MMM')}
                  </p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${
                  t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount, t.currency as Currency)}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate('/transactions')}
            className="mt-3 w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
          >
            Show all transactions <ArrowRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  )
}
