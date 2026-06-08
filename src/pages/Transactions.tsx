import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, ArrowLeftRight, Repeat } from 'lucide-react'
import { format } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import { BalanceTransferModal } from '../components/transactions/BalanceTransferModal'
import { ExchangeModal } from '../components/transactions/ExchangeModal'
import { TransactionModal } from '../components/transactions/TransactionModal'
import { TransactionDetailModal } from '../components/transactions/TransactionDetailModal'
import { TransactionFilters } from '../components/transactions/TransactionFilters'
import { Spinner } from '../components/ui/Spinner'
import { CacheBadge } from '../components/ui/CacheBadge'
import { useApi } from '../hooks/useApi'
import { parseTransportDescription } from '../utils/transactionDescription'
import { useConfirm } from '../context/ConfirmContext'
import { transactionsApi } from '../api/transactions'
import { categoriesApi } from '../api/categories'
import { formatCurrency } from '../utils/format'
import type { Currency, Transaction, TransactionFilters as Filters, TransactionType } from '../types'

interface Props {
  currency: Currency
}

const DEFAULT_FILTERS: Filters = {
  type: '', currency: '', categoryId: '', cardId: '', search: '',
  startDate: '', endDate: '', page: 0, size: 15,
  sortBy: 'transactionDate', sortDir: 'desc',
}

export function Transactions({ currency }: Props) {
  const confirm = useConfirm()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => {
    const num = (key: string): number | '' => {
      const v = searchParams.get(key)
      return v && !Number.isNaN(Number(v)) ? Number(v) : ''
    }
    const str = (key: string) => searchParams.get(key) ?? ''
    return {
      ...DEFAULT_FILTERS,
      type: (str('type') as TransactionType | '') || '',
      currency: (str('currency') as Currency | '') || '',
      categoryId: num('categoryId'),
      cardId: num('cardId'),
      investmentId: num('investmentId'),
      startDate: str('startDate'),
      endDate: str('endDate'),
      search: str('search'),
    }
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [exchangeOpen, setExchangeOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const updateFilters = useCallback((partial: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...partial }))
  }, [])

  const transactions = useApi(
    () => transactionsApi.getAll(filters),
    [JSON.stringify(filters)],
  )
  const categories = useApi(() => categoriesApi.getAll(), [])

  const handleDelete = async (id: number) => {
    if (!await confirm({ message: 'Delete this transaction?', destructive: true })) return
    setDeleting(id)
    try {
      await transactionsApi.delete(id)
      setDetailTx(null)
      transactions.refetch()
    } finally {
      setDeleting(null)
    }
  }

  const openEdit = (t: Transaction) => { setEditTarget(t); setModalOpen(true) }
  const openDetail = (t: Transaction) => setDetailTx(t)

  const data = transactions.data
  const total = data?.totalElements ?? 0
  const page = data?.page ?? 0
  const totalPages = data?.totalPages ?? 0

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Transactions</h2>
          {!transactions.loading && (
            <p className="text-sm text-slate-400 mt-0.5">
              {total} record{total !== 1 ? 's' : ''}
              {transactions.isCached && (
                <span className="ml-2 inline-flex">
                  <CacheBadge isCached cachedAt={transactions.cachedAt} />
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTransferOpen(true)}
            className="flex items-center gap-2 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Transfer
          </button>
          <button
            onClick={() => setExchangeOpen(true)}
            className="flex items-center gap-2 border border-amber-200 text-amber-700 hover:bg-amber-50 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <Repeat className="w-4 h-4" />
            Exchange
          </button>
          <button
            onClick={() => { setEditTarget(null); setModalOpen(true) }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <TransactionFilters
        filters={filters}
        categories={categories.data ?? []}
        currency={currency}
        onChange={updateFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {transactions.loading ? (
          <div className="h-48 flex items-center justify-center">
            <Spinner />
          </div>
        ) : (data?.content.length ?? 0) === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
            <p className="text-sm">No transactions found</p>
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="text-xs text-indigo-500 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Date', 'Description', 'Category', 'Amount', 'Currency', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3 first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data?.content.map((t) => {
                  const isTransport = t.category?.kind === 'TRANSPORT'
                  const parsed = parseTransportDescription(t.description, isTransport)
                  const routeFrom = parsed.from ?? t.fromLocation ?? undefined
                  const routeTo = parsed.to ?? t.toLocation ?? undefined
                  const primary = isTransport
                    ? (parsed.note.trim() || (routeFrom || routeTo ? `${routeFrom || '—'} → ${routeTo || '—'}` : t.description))
                    : t.description
                  const subtitle = isTransport && (routeFrom || routeTo) && parsed.note.trim()
                    ? `${routeFrom || '—'} → ${routeTo || '—'}`
                    : (t.note || t.place || '')
                  // Split: a single transaction that paid partly in cash and partly via a card.
                  const isSplit = (t.cashAmount ?? 0) > 0 && (t.cardAmount ?? 0) > 0 && !!t.card
                  return (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors group cursor-pointer" onClick={() => openDetail(t)}>
                    <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                      {format(new Date(t.transactionDate), 'dd-MMM-yyyy')}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                          t.type === 'INCOME' ? 'bg-emerald-100' : 'bg-rose-100'
                        }`}>
                          {t.type === 'INCOME'
                            ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                            : <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                          }
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-slate-700">{primary}</p>
                            {isSplit && (
                              <span
                                title={`Cash ${formatCurrency(t.cashAmount, t.currency)} + Card ${formatCurrency(t.cardAmount, t.currency)}`}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wide"
                              >Split</span>
                            )}
                          </div>
                          {subtitle && (
                            <p className="text-xs text-slate-400 truncate max-w-48">{subtitle}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {t.category ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: t.category.color + '20', color: t.category.color }}
                        >
                          {t.category.name}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className={`px-5 py-3.5 font-semibold whitespace-nowrap ${
                      t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount, t.currency)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{t.currency}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(t)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deleting === t.id}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                        >
                          {deleting === t.id ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table></div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    disabled={page === 0}
                    onClick={() => updateFilters({ page: page - 1 })}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={data?.last ?? true}
                    onClick={() => updateFilters({ page: page + 1 })}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <TransactionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
        onSaved={() => transactions.refetch()}
        transaction={editTarget}
        defaultCurrency={currency}
      />

      <BalanceTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onSaved={() => { transactions.refetch(); setTransferOpen(false) }}
      />

      <ExchangeModal
        open={exchangeOpen}
        onClose={() => setExchangeOpen(false)}
        onSaved={() => { transactions.refetch(); setExchangeOpen(false) }}
        defaultCurrency={currency}
      />

      <TransactionDetailModal
        transaction={detailTx} open={!!detailTx}
        onClose={() => setDetailTx(null)}
        onEdit={(t) => { setDetailTx(null); openEdit(t) }}
        onDelete={handleDelete} deleting={deleting === detailTx?.id}
      />
    </div>
  )
}
