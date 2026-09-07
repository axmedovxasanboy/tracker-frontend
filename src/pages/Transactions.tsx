import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDownRight, ArrowLeftRight, ArrowUpRight, CalendarDays, ChevronLeft,
  ChevronRight, Pencil, Plus, Receipt, Trash2, TrendingDown, TrendingUp,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BalanceTransferModal } from '../components/transactions/BalanceTransferModal'
import { useLang } from '../i18n/LanguageContext'
import { TransactionModal } from '../components/transactions/TransactionModal'
import { TransactionDetailModal } from '../components/transactions/TransactionDetailModal'
import { TransactionFilters } from '../components/transactions/TransactionFilters'
import { Button } from '../components/ui/Button'
import { CacheBadge } from '../components/ui/CacheBadge'
import { ErrorTile } from '../components/ui/ErrorTile'
import { IncomeRequiredNotice } from '../components/ui/IncomeRequiredNotice'
import { ListRow, ListTile } from '../components/ui/ListRow'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { StatTile } from '../components/ui/StatTile'
import { Tile, TileGrid } from '../components/ui/Tile'
import { useApi } from '../hooks/useApi'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { parseTransportDescription } from '../utils/transactionDescription'
import { useConfirm } from '../context/ConfirmContext'
import { transactionsApi } from '../api/transactions'
import { categoriesApi } from '../api/categories'
import { dashboardApi } from '../api/dashboard'
import { formatDate, formatMonth, formatNumber, money, moneyExact, moneyFull, monthLocal, todayLocal } from '../utils/format'
import type { Currency, Transaction, TransactionFilters as Filters, TransactionType } from '../types'

interface Props {
  currency: Currency
}

const DEFAULT_FILTERS: Filters = {
  type: '', currency: '', categoryId: '', cardId: '', search: '',
  startDate: '', endDate: '', page: 0, size: 15,
  sortBy: 'transactionDate', sortDir: 'desc',
}

/** Long enough that a typed word is one request, short enough that the list still feels live. */
const SEARCH_DEBOUNCE_MS = 300

/** The two grid slots the page uses before a tile exists to occupy them. */
const HALF_SLOT = 'md:col-span-3 xl:col-span-6'
const FULL_SLOT = 'md:col-span-6 xl:col-span-12'

export function Transactions({ currency }: Props) {
  const { t, lang, categoryName } = useLang()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { showSuccess } = useToast()
  const { hasStableIncome, loading: settingsLoading, error: settingsError } = useSettings()
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
  // The box binds to this; `filters.search` is what the server is actually asked for. Splitting
  // the two is what stops one request per keystroke — the fetch key only moves when typing stops.
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('search') ?? '')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)
  // Which type a NEW transaction opens as. undefined = the generic button (defaults to Expense).
  const [presetType, setPresetType] = useState<TransactionType | undefined>()
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const updateFilters = useCallback((partial: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...partial }))
  }, [])

  const committedSearch = filters.search ?? ''
  useEffect(() => {
    if (searchDraft === committedSearch) return
    const id = setTimeout(
      () => setFilters(prev => ({ ...prev, search: searchDraft, page: 0 })),
      SEARCH_DEBOUNCE_MS,
    )
    return () => clearTimeout(id)
  }, [searchDraft, committedSearch])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setSearchDraft('')
  }, [])

  const transactions = useApi(
    () => transactionsApi.getAll(filters),
    [JSON.stringify(filters)],
  )
  const categories = useApi(() => categoriesApi.getAll(), [])

  // The hero. Deliberately NOT the filtered list: this is the month itself, so it stays true
  // while the user searches. /dashboard/monthly buckets by transaction date and leaves transfers
  // out, which is what makes it an income-and-expenses figure rather than a wallet movement one.
  const thisMonth = monthLocal()
  const year = Number(thisMonth.slice(0, 4))
  const monthNumber = Number(thisMonth.slice(5, 7))
  const monthly = useApi(() => dashboardApi.getMonthly(currency, year), [currency, year])
  const monthRow = monthly.data?.find(m => m.month === monthNumber)
  const monthIncome = monthRow?.income ?? 0
  const monthExpense = monthRow?.expense ?? 0
  const monthNet = monthIncome - monthExpense
  const flowPeak = Math.max(monthIncome, monthExpense)

  /**
   * The income gate, stated instead of enforced with a dead button. The backend refuses every
   * write until a monthly income exists, so the action still cannot go through — but a disabled
   * button with a `title` says why to nobody on a phone, so the buttons stay live and take the
   * user to the one field that unblocks everything.
   */
  const goSetUpIncome = useCallback(() => navigate('/'), [navigate])
  // Only once the answer is known: bouncing a user who *does* have an income set, because the
  // settings fetch had not landed yet, would be a worse race than letting the form open.
  // A failed settings read says nothing about the income, so it must not route the user away
  // from the form: the server still refuses the write if the income really is unset.
  const incomeMissing = !settingsLoading && !settingsError && !hasStableIncome

  const openAdd = (type?: TransactionType) => {
    if (incomeMissing) { goSetUpIncome(); return }
    setEditTarget(null); setPresetType(type); setModalOpen(true)
  }
  const openTransfer = () => {
    if (incomeMissing) { goSetUpIncome(); return }
    setTransferOpen(true)
  }
  const openEdit = (tx: Transaction) => { setEditTarget(tx); setPresetType(undefined); setModalOpen(true) }
  const openDetail = (tx: Transaction) => setDetailTx(tx)

  /** Both queries count the same rows, so both move together or the page contradicts itself. */
  const refetchAll = () => {
    transactions.refetch()
    monthly.refetch()
  }

  const handleDelete = async (id: number) => {
    if (!await confirm({ message: t('tx.confirmDelete'), destructive: true })) return
    setDeleting(id)
    try {
      await transactionsApi.delete(id)
      setDetailTx(null)
      await Promise.all([transactions.refetch(), monthly.refetch()])
      showSuccess(t('page.transactions.deletedToast'))
    } finally {
      setDeleting(null)
    }
  }

  const data = transactions.data
  const items = data?.content ?? []
  const total = data?.totalElements ?? 0
  const page = data?.page ?? 0
  const totalPages = data?.totalPages ?? 0

  const filtersActive = !!(
    filters.type || filters.categoryId || filters.cardId || filters.investmentId
    || filters.startDate || filters.endDate || committedSearch
  )
  // A brand-new account gets the first-run empty state and nothing to operate on it with —
  // filtering a list that has never had a row in it is noise on the one visit that matters.
  const emptyAccount = transactions.hasLoaded && !filtersActive && total === 0

  const today = todayLocal()
  const yesterday = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const dayLabel = (date: string) => {
    const full = formatDate(date, lang)
    if (date === today) return `${t('page.transactions.today')} · ${full}`
    if (date === yesterday) return `${t('page.transactions.yesterday')} · ${full}`
    return full
  }

  // Day headings are emitted per page, not per dataset: page 2 can open in the middle of a day
  // and a heading that claimed to introduce the whole day would be lying about the rows under it.
  const rows: ReactNode[] = []
  let currentDay: string | null = null
  for (const tx of items) {
    if (tx.transactionDate !== currentDay) {
      currentDay = tx.transactionDate
      rows.push(
        <div key={`day-${currentDay}`} className="bg-slate-50 px-4 py-1.5">
          <span className="text-label uppercase text-slate-500">{dayLabel(currentDay)}</span>
        </div>,
      )
    }
    rows.push(<Row
      key={tx.id}
      tx={tx}
      deleting={deleting === tx.id}
      categoryName={categoryName}
      t={t}
      onOpen={() => openDetail(tx)}
      onEdit={() => openEdit(tx)}
      onDelete={() => handleDelete(tx.id)}
    />)
  }

  const emptyState = filtersActive ? (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-slate-600">{t('tx.none')}</p>
      <Button variant="secondary" label={t('action.clearFilters')} onClick={resetFilters} />
    </div>
  ) : (
    <div className="flex flex-col items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-chip bg-slate-100 text-slate-500">
        <Receipt className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-title text-slate-900">{t('tx.noneYet')}</p>
        <p className="mt-1 text-sm text-slate-600">{t('page.transactions.noneHint')}</p>
      </div>
      <Button
        variant="primary"
        icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        label={t('tx.noneYetAction')}
        onClick={() => openAdd('EXPENSE')}
      />
    </div>
  )

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={t('page.transactions')}
        subtitle={t('page.transactions.subtitle')}
        primary={{
          label: t('action.add'),
          onClick: () => openAdd(undefined),
          icon: <Plus className="h-4 w-4" aria-hidden="true" />,
        }}
        overflow={[
          { label: t('page.transactions.addIncome'), onClick: () => openAdd('INCOME'), icon: <TrendingUp className="h-4 w-4" aria-hidden="true" /> },
          { label: t('page.transactions.addExpense'), onClick: () => openAdd('EXPENSE'), icon: <TrendingDown className="h-4 w-4" aria-hidden="true" /> },
          { label: t('action.transfer'), onClick: openTransfer, icon: <ArrowLeftRight className="h-4 w-4" aria-hidden="true" /> },
        ]}
      />

      <div className="mt-4 xl:mt-5">
        <TileGrid>
          <IncomeRequiredNotice className={FULL_SLOT} />

          {monthly.loading ? (
            <Skeleton variant="stat" className={HALF_SLOT} />
          ) : monthly.error && !monthly.data ? (
            <ErrorTile className={HALF_SLOT} message={monthly.error} onRetry={monthly.refetch} />
          ) : (
            <StatTile
              hero
              span={6}
              rows={2}
              label={t('page.transactions.monthSoFar', { month: formatMonth(thisMonth, lang) })}
              value={money(monthNet, currency, { signed: true })}
              tone={monthNet === 0 ? 'neutral' : monthNet < 0 ? 'out' : 'in'}
              caption={`${t('page.transactions.netCaption')} · ${moneyExact(monthNet, currency)}`}
              icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
            >
              <div className="space-y-3">
                <Flow
                  label={t('page.transactions.moneyIn')}
                  amount={money(monthIncome, currency, { signed: true })}
                  tone="in"
                  ratio={flowPeak > 0 ? (monthIncome / flowPeak) * 100 : 0}
                />
                <Flow
                  label={t('page.transactions.moneyOut')}
                  amount={money(-monthExpense, currency)}
                  tone="out"
                  ratio={flowPeak > 0 ? (monthExpense / flowPeak) * 100 : 0}
                />
                <CacheBadge isCached={monthly.isCached} cachedAt={monthly.cachedAt} />
              </div>
            </StatTile>
          )}

          {!emptyAccount && (
            <>
              <StatTile
                span={6}
                label={t('page.transactions.recordsLabel')}
                value={formatNumber(total)}
                caption={filtersActive
                  ? t('page.transactions.matchingFilters')
                  : t('ui.scope.allTime')}
                icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
                pill={transactions.refreshing
                  ? { text: t('page.transactions.updating'), tone: 'neutral' }
                  : undefined}
              >
                {/* Only when there is something to say — the page number lives on the pager. */}
                {transactions.isCached && (
                  <CacheBadge isCached cachedAt={transactions.cachedAt} />
                )}
              </StatTile>

              {/* Full width on purpose. At md a half-width tile is 232px across, which is not
                  enough for a native date input, let alone two of them. */}
              <Tile span={12}>
                <TransactionFilters
                  filters={filters}
                  categories={categories.data ?? []}
                  searchDraft={searchDraft}
                  onSearchDraftChange={setSearchDraft}
                  searching={searchDraft !== committedSearch}
                  expanded={filtersExpanded}
                  onExpandedChange={setFiltersExpanded}
                  onChange={updateFilters}
                  onReset={resetFilters}
                />
                {categories.error && !categories.data && (
                  <ErrorTile
                    compact
                    className="mt-3"
                    message={categories.error}
                    onRetry={categories.refetch}
                  />
                )}
              </Tile>
            </>
          )}

          {transactions.loading ? (
            <Skeleton variant="row" count={6} className={FULL_SLOT} />
          ) : transactions.error && !data ? (
            <ErrorTile className={FULL_SLOT} message={transactions.error} onRetry={transactions.refetch} />
          ) : (
            <>
              {transactions.error && (
                <div className={FULL_SLOT}>
                  <ErrorTile compact message={transactions.error} onRetry={transactions.refetch} />
                </div>
              )}

              <ListTile
                span={12}
                empty={emptyState}
                // Dimmed, never blanked: the rows the user is reading stay put while the next
                // page or the next search settles.
                className={transactions.refreshing ? 'opacity-60 transition-opacity' : undefined}
              >
                {rows}
              </ListTile>

              {totalPages > 1 && (
                <Tile span={12}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm tabular-nums text-slate-600">
                      {t('page.pagination.pageOf', { page: page + 1, total: totalPages })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        icon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
                        label={t('page.pagination.previous')}
                        disabled={page === 0}
                        onClick={() => updateFilters({ page: page - 1 })}
                      />
                      <Button
                        variant="secondary"
                        icon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}
                        label={t('page.pagination.next')}
                        disabled={data?.last ?? true}
                        onClick={() => updateFilters({ page: page + 1 })}
                      />
                    </div>
                  </div>
                </Tile>
              )}
            </>
          )}
        </TileGrid>
      </div>

      <TransactionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
        onSaved={refetchAll}
        transaction={editTarget}
        defaultCurrency={currency}
        presetType={presetType}
      />

      <BalanceTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onSaved={() => { refetchAll(); setTransferOpen(false) }}
      />

      <TransactionDetailModal
        transaction={detailTx} open={!!detailTx}
        onClose={() => setDetailTx(null)}
        onEdit={(tx) => { setDetailTx(null); openEdit(tx) }}
        onDelete={handleDelete} deleting={deleting === detailTx?.id}
      />
    </div>
  )
}

/** One side of the month: the figure, and how it compares with the other side. */
function Flow({ label, amount, tone, ratio }: {
  label: string
  amount: string
  tone: 'in' | 'out'
  ratio: number
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`text-sm font-semibold tabular-nums ${tone === 'in' ? 'text-income' : 'text-expense'}`}>
          {amount}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div
          className={`h-full rounded-full ${tone === 'in' ? 'bg-income' : 'bg-expense'}`}
          style={{ width: `${Math.max(0, Math.min(100, ratio))}%` }}
        />
      </div>
    </div>
  )
}

/**
 * One transaction as a row. The signed amount and its green/red are the one colour convention
 * this app has always applied consistently, so they are kept exactly as they were.
 */
function Row({ tx, deleting, categoryName, t, onOpen, onEdit, onDelete }: {
  tx: Transaction
  deleting: boolean
  categoryName: (c?: { name: string; nameUz?: string | null } | null) => string
  t: ReturnType<typeof useLang>['t']
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const isTransport = tx.category?.kind === 'TRANSPORT'
  const parsed = parseTransportDescription(tx.description, isTransport)
  const routeFrom = parsed.from ?? tx.fromLocation ?? undefined
  const routeTo = parsed.to ?? tx.toLocation ?? undefined
  const route = routeFrom || routeTo ? `${routeFrom || '—'} → ${routeTo || '—'}` : ''
  const title = isTransport
    ? (parsed.note.trim() || route || tx.description)
    : tx.description
  const detail = isTransport && route && parsed.note.trim()
    ? route
    : (tx.note || tx.place || '')
  // Split: a single transaction that paid partly in cash and partly via a card.
  const isSplit = (tx.cashAmount ?? 0) > 0 && (tx.cardAmount ?? 0) > 0 && !!tx.card
  const income = tx.type === 'INCOME'
  // The card used to be its own meta line; one row means one line, so it joins the detail.
  const subtitle = [detail, tx.card ? `${tx.card.name} ••${tx.card.lastFourDigits}` : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <ListRow
      onClick={onOpen}
      leading={
        <span className={`flex h-9 w-9 items-center justify-center rounded-chip ${income ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
          {income
            ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            : <ArrowDownRight className="h-4 w-4" aria-hidden="true" />}
        </span>
      }
      title={title}
      badges={
        <>
          {tx.category && (
            /* The identity hue survives as the dot only — the same shape the detail sheet uses.
               Painting the category colour as 11px text on a 12% tint of itself never cleared
               2:1 for the warm half of the palette, so an amber category was unreadable. */
            <span className="inline-flex items-center gap-1.5 rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: tx.category.color }}
              />
              {categoryName(tx.category)}
            </span>
          )}
          {isSplit && (
            <span
              title={t('page.transactions.splitTooltip', {
                cash: moneyFull(tx.cashAmount, tx.currency),
                card: moneyFull(tx.cardAmount, tx.currency),
              })}
              className="inline-flex items-center rounded-chip bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
            >
              {t('page.shared.splitBadge')}
            </span>
          )}
        </>
      }
      subtitle={subtitle || undefined}
      amount={`${income ? '+' : '-'}${moneyFull(tx.amount, tx.currency)}`}
      amountTone={income ? 'in' : 'out'}
      actions={[
        { label: t('action.edit'), icon: <Pencil className="h-4 w-4" aria-hidden="true" />, onClick: onEdit },
        { label: t('action.delete'), icon: <Trash2 className="h-4 w-4" aria-hidden="true" />, onClick: onDelete, danger: true, disabled: deleting },
      ]}
    />
  )
}
