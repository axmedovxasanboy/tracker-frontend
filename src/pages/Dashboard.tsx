import { useState } from 'react'
import { Plus, TrendingUp, TrendingDown, Hash, Wallet, Landmark } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SummaryCard } from '../components/dashboard/SummaryCard'
import { IncomeExpenseChart } from '../components/dashboard/IncomeExpenseChart'
import { CategoryBreakdownChart } from '../components/dashboard/CategoryBreakdownChart'
import { RecentTransactions } from '../components/dashboard/RecentTransactions'
import { TransactionModal } from '../components/transactions/TransactionModal'
import { TransactionDetailModal } from '../components/transactions/TransactionDetailModal'
import { useApi } from '../hooks/useApi'
import { IncomeRequiredNotice } from '../components/ui/IncomeRequiredNotice'
import { useSettings } from '../context/SettingsContext'
import { useConfirm } from '../context/ConfirmContext'
import { useLang } from '../i18n/LanguageContext'
import { dashboardApi } from '../api/dashboard'
import { transactionsApi } from '../api/transactions'
import { formatCurrency, formatNumber } from '../utils/format'
import type { TransactionType, Currency, Transaction } from '../types'

interface Props { currency: Currency }

export function Dashboard({ currency }: Props) {
  const { t } = useLang()
  const { hasStableIncome } = useSettings()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [modalOpen, setModalOpen] = useState(false)
  // Which type a NEW transaction opens as; undefined = generic (defaults to Expense).
  const [presetType, setPresetType] = useState<TransactionType | undefined>()
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const year = new Date().getFullYear()

  const summary  = useApi(() => dashboardApi.getSummary(currency), [currency])
  const monthly  = useApi(() => dashboardApi.getMonthly(currency, year), [currency, year])
  const breakdown = useApi(() => dashboardApi.getCategoryBreakdown('EXPENSE', currency), [currency])
  const recent   = useApi(() => transactionsApi.getRecent(currency), [currency])

  const s = summary.data
  // Older cached payloads (or stale backend before restart) may not include the newer fields.
  const availableBalance = s?.availableBalance ?? 0
  const spendable = s?.spendableBalance ?? availableBalance
  const netWorth = s?.netWorth ?? (s?.netBalance ?? availableBalance)

  const handleDeleteFromDetail = async (id: number) => {
    if (!await confirm({ message: t('tx.confirmDelete'), destructive: true })) return
    setDeleting(true)
    try {
      await transactionsApi.delete(id)
      setDetailTx(null)
      summary.refetch(); monthly.refetch(); breakdown.refetch(); recent.refetch()
    } finally { setDeleting(false) }
  }

  const refetchAll = () => {
    summary.refetch(); monthly.refetch(); breakdown.refetch(); recent.refetch()
  }

  return (
    <div className="p-6 space-y-6">
      <IncomeRequiredNotice />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t('nav.overview')}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{year} · {currency}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {([
            ['INCOME',  'tx.addIncome',  'bg-emerald-600 hover:bg-emerald-700'],
            ['EXPENSE', 'tx.addExpense', 'bg-rose-600 hover:bg-rose-700'],
            [undefined, 'tx.addOther',   'bg-indigo-600 hover:bg-indigo-700'],
          ] as const).map(([type, key, colour]) => (
            <button
              key={key}
              onClick={() => { setPresetType(type); setModalOpen(true) }}
              disabled={!hasStableIncome}
              title={!hasStableIncome ? t('income.requiredTooltip') : undefined}
              className={`flex items-center gap-2 ${colour} text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Plus className="w-4 h-4" /> {t(key)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards — clickable. Values rendered with K/M/B abbreviations. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <SummaryCard
          title={t('page.dashboard.spendable')} icon={Wallet} color="indigo"
          value={s ? formatCurrency(spendable, currency, true) : '—'}
          subtitle={t('page.dashboard.spendableHint')}
          isCached={summary.isCached} cachedAt={summary.cachedAt}
          onClick={() => navigate('/cards')}
        />
        <SummaryCard
          title={t('page.dashboard.totalIncome')} icon={TrendingUp} color="emerald"
          value={s ? formatCurrency(s.totalIncome, currency, true) : '—'}
          isCached={summary.isCached} cachedAt={summary.cachedAt}
          onClick={() => navigate('/transactions?type=INCOME')}
        />
        <SummaryCard
          title={t('page.dashboard.totalExpenses')} icon={TrendingDown} color="rose"
          value={s ? formatCurrency(s.totalExpense, currency, true) : '—'}
          isCached={summary.isCached} cachedAt={summary.cachedAt}
          onClick={() => navigate('/transactions?type=EXPENSE')}
        />
        <SummaryCard
          title={t('page.dashboard.netWorth')} icon={Landmark} color="emerald"
          value={s ? formatCurrency(netWorth, currency, true) : '—'}
          subtitle={t('page.dashboard.netWorthHint')}
          isCached={summary.isCached} cachedAt={summary.cachedAt}
          onClick={() => navigate('/months')}
        />
        <SummaryCard
          title={t('nav.transactions')} icon={Hash} color="amber"
          value={s ? formatNumber(s.transactionCount) : '—'}
          subtitle={t('page.dashboard.inCurrency', { currency })}
          isCached={summary.isCached} cachedAt={summary.cachedAt}
          onClick={() => navigate(`/transactions?currency=${currency}`)}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <IncomeExpenseChart data={monthly.data ?? []} loading={monthly.loading} currency={currency}
            isCached={monthly.isCached} cachedAt={monthly.cachedAt} />
        </div>
        <CategoryBreakdownChart data={breakdown.data ?? []} loading={breakdown.loading} currency={currency}
          isCached={breakdown.isCached} cachedAt={breakdown.cachedAt} />
      </div>

      {/* Recent transactions */}
      <RecentTransactions
        transactions={recent.data?.content ?? []} loading={recent.loading}
        currency={currency} isCached={recent.isCached} cachedAt={recent.cachedAt}
        onTransactionClick={setDetailTx}
      />

      {/* Add modal */}
      <TransactionModal
        open={modalOpen} onClose={() => setModalOpen(false)}
        onSaved={refetchAll} defaultCurrency={currency}
        presetType={presetType}
      />

      {/* Edit modal (opened from detail) */}
      <TransactionModal
        open={!!editTx} onClose={() => setEditTx(null)}
        onSaved={() => { setEditTx(null); refetchAll() }}
        transaction={editTx} defaultCurrency={currency}
      />

      {/* Detail modal */}
      <TransactionDetailModal
        transaction={detailTx} open={!!detailTx}
        onClose={() => setDetailTx(null)}
        onEdit={(t) => { setDetailTx(null); setEditTx(t) }}
        onDelete={handleDeleteFromDetail} deleting={deleting}
      />
    </div>
  )
}
