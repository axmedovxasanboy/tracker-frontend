import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { Tile, TileGrid } from '../components/ui/Tile'
import { useApi } from '../hooks/useApi'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useLang } from '../i18n/LanguageContext'
import { transactionsApi } from '../api/transactions'
import { categoriesApi } from '../api/categories'
import {
  formatDate, formatMonth, money, moneyExact, moneyFull, monthLocal, shiftMonth, snap, todayLocal,
} from '../utils/format'
import type { Category, Currency, Transaction, TransactionFilters as Filters } from '../types'
import type { MoneyFlow, MonthTransactions } from '../types/shell'

// ────────────────────────────────────────────────────────────────────────────────
// The month's rows, and what each one counts as
// ────────────────────────────────────────────────────────────────────────────────

/** The server's own cap on a page (app.pagination.max-page-size); asking for more gets this. */
const PAGE_SIZE = 100
/** 2.000 rows is years of this owner's spending in one month — a guard, not a limit anyone meets. */
const MAX_PAGES = 20

/** First and last day of a YYYY-MM month, on the calendar — never through a UTC timestamp. */
export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` }
}

/**
 * Every transaction dated in `month`, all pages of it.
 *
 * One user means a few hundred rows a month at most, so the whole month comes down and every
 * figure on the screen is added up from exactly the rows the list shows. The server caps a page
 * at 100, so a busy month is two or three requests, fetched together.
 */
export async function fetchMonthTransactions(month: string): Promise<{
  data: MonthTransactions
  isCached?: boolean
  cachedAt?: string
}> {
  const { start, end } = monthBounds(month)
  const query = (page: number) => transactionsApi.getAll({
    page, size: PAGE_SIZE, sortBy: 'transactionDate', sortDir: 'desc', startDate: start, endDate: end,
  })
  const first = await query(0)
  const pages = Math.min(first.data.totalPages, MAX_PAGES)
  const rest = pages > 1
    ? await Promise.all(Array.from({ length: pages - 1 }, (_, i) => query(i + 1)))
    : []
  // A row added between two page requests shifts the pages under us; never count one twice.
  const seen = new Set<number>()
  const rows: Transaction[] = []
  for (const res of [first, ...rest]) {
    for (const tx of res.data.content) {
      if (seen.has(tx.id)) continue
      seen.add(tx.id)
      rows.push(tx)
    }
  }
  // `api/client.ts` bolts the offline-cache flags onto the response at runtime, untyped.
  const cached = [first, ...rest]
    .map(r => r as unknown as { isCached?: boolean; cachedAt?: string })
    .find(r => r.isCached)
  return { data: { month, rows }, isCached: !!cached, cachedAt: cached?.cachedAt }
}

const SAVING_SUB_TYPES = new Set(['DONATION', 'EMERGENCY_CONTRIBUTION', 'INVESTMENT', 'STOCK_PURCHASE'])

/**
 * What a transaction counts as on History.
 *
 * In is money earned — borrowed money, money paid back to you and moves between your own wallets
 * all arrive in a wallet without being earned. Out is money spent, apart from moves between
 * wallets and money put into savings, which is its own figure. Lending is not spending either:
 * money lent is its own line, and getting it back is skipped, as borrowing is.
 *
 * A wallet check books what it finds as EVERYDAY_SPENDING: an expense when a wallet held less than
 * the app worked out, an income when it held more. Both are the same correction, so the surplus is
 * taken back off Out (as the server's own everyday figure does) rather than counted as earned —
 * that way In, Out and Saved still add up to what the wallets did.
 */
export function flowOf(tx: Transaction): MoneyFlow {
  const sub = tx.subType
  if (tx.transferPairId != null || sub === 'TRANSFER_IN' || sub === 'TRANSFER_OUT') return 'skip'
  if (tx.type === 'INCOME') {
    if (sub === 'LOAN_RECEIVED') return 'borrowed'
    if (sub === 'EVERYDAY_SPENDING') return 'surplus'
    if (sub === 'LOAN_RETURNED_TO_ME') return 'skip'
    return 'in'
  }
  if (sub === 'LOAN_GIVEN') return 'lent'
  if (sub && SAVING_SUB_TYPES.has(sub)) return 'saved'
  return 'out'
}

// ────────────────────────────────────────────────────────────────────────────────
// History
// ────────────────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
  type: '', currency: '', categoryId: '', cardId: '', investmentId: '', search: '',
  startDate: '', endDate: '', page: 0, size: PAGE_SIZE,
  sortBy: 'transactionDate', sortDir: 'desc',
}

/** How many categories "Where it went" names before the rest become "Other". */
const TOP_CATEGORIES = 6

const HALF = 'md:col-span-6 xl:col-span-6'
const FULL = 'md:col-span-6 xl:col-span-12'

const YM = /^\d{4}-\d{2}$/

interface Props {
  currency: Currency
}

export function History({ currency }: Props) {
  const { t, lang, categoryName } = useLang()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { showSuccess } = useToast()
  const { hasStableIncome, loading: settingsLoading, error: settingsError } = useSettings()
  const [searchParams] = useSearchParams()

  const thisMonth = monthLocal()
  const [month, setMonth] = useState(() => {
    const asked = searchParams.get('month') ?? searchParams.get('startDate')?.slice(0, 7) ?? ''
    return YM.test(asked) && asked <= thisMonth ? asked : thisMonth
  })

  // Links from elsewhere (and the old /transactions?type=… bookmarks) arrive as query params.
  const [filters, setFilters] = useState<Filters>(() => {
    const num = (key: string): number | '' => {
      const v = searchParams.get(key)
      return v && !Number.isNaN(Number(v)) ? Number(v) : ''
    }
    const type = searchParams.get('type')
    return {
      ...DEFAULT_FILTERS,
      type: type === 'INCOME' || type === 'EXPENSE' ? type : '',
      categoryId: num('categoryId'),
      cardId: num('cardId'),
      investmentId: num('investmentId'),
    }
  })
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('search') ?? '')
  // The whole month is already here, so a search is a filter over it, not a request — deferring
  // it just keeps typing smooth on a long month.
  const search = useDeferredValue(searchDraft)
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const updateFilters = useCallback((partial: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...partial }))
  }, [])
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setSearchDraft('')
  }, [])

  const monthTx = useApi(() => fetchMonthTransactions(month), [month])
  const categories = useApi(() => categoriesApi.getAll(), [])

  // Only the month on screen counts. While another month is loading, the hook still holds the
  // previous one — drawing its figures under the new month's name would be a wrong answer.
  const current = monthTx.data?.month === month ? monthTx.data : null
  const rows = useMemo(() => current?.rows ?? [], [current])

  const goMonth = (next: string) => {
    setMonth(next)
    // A From/To date belongs to the month it was picked in.
    setFilters(prev => ({ ...prev, startDate: '', endDate: '' }))
  }

  // The backend refuses every write until a monthly income exists. The button stays live and
  // takes the owner to the one field that unblocks it, the way the other pages do. A failed
  // settings read says nothing about the income, so it must not route anyone away.
  const incomeMissing = !settingsLoading && !settingsError && !hasStableIncome
  const openAdd = () => {
    if (incomeMissing) { navigate('/'); return }
    setEditTarget(null); setModalOpen(true)
  }
  const openEdit = (tx: Transaction) => { setEditTarget(tx); setModalOpen(true) }

  const handleDelete = async (id: number) => {
    if (!await confirm({ message: t('tx.confirmDelete'), destructive: true })) return
    setDeleting(id)
    try {
      await transactionsApi.delete(id)
      setDetailTx(null)
      await monthTx.refetch()
      showSuccess(t('page.transactions.deletedToast'))
    } finally {
      setDeleting(null)
    }
  }

  // ── The month in three figures ──────────────────────────────────────────────
  const totals = useMemo(() => {
    let earned = 0, spent = 0, saved = 0, borrowed = 0, lent = 0
    for (const tx of rows) {
      // UZS is the reporting currency; a dormant foreign cash pot never enters a total.
      if (tx.currency !== 'UZS') continue
      const flow = flowOf(tx)
      if (flow === 'in') earned += tx.amount
      else if (flow === 'out') spent += tx.amount
      else if (flow === 'surplus') spent -= tx.amount
      else if (flow === 'saved') saved += tx.amount
      else if (flow === 'borrowed') borrowed += tx.amount
      else if (flow === 'lent') lent += tx.amount
    }
    return {
      earned: snap(earned), spent: snap(spent), saved: snap(saved), borrowed: snap(borrowed), lent: snap(lent),
    }
  }, [rows])

  // ── Where it went: Out, by top-level category ────────────────────────────────
  const spending = useMemo(() => {
    // Sub-categories roll up into their parent — "Food" is one line, not four.
    const rootOf = new Map<number, Category>()
    // The line a wallet check files what it found missing under; its surplus comes off the same line.
    let everydayRootId: number | null = null
    for (const root of categories.data ?? []) {
      rootOf.set(root.id, root)
      for (const child of root.children ?? []) rootOf.set(child.id, root)
      if (root.applicableSubType === 'EVERYDAY_SPENDING') everydayRootId = root.id
    }
    const byRoot = new Map<number, { category: Category; amount: number }>()
    let uncategorised = 0
    let surplus = 0
    // A check's shortfalls with no category (the server files them only when it finds exactly one
    // Everyday category) sit in "Other" instead.
    let everydayUncategorised = 0
    for (const tx of rows) {
      if (tx.currency !== 'UZS') continue
      const flow = flowOf(tx)
      if (flow === 'surplus') { surplus += tx.amount; continue }
      if (flow !== 'out') continue
      const c = tx.category
      if (!c) {
        uncategorised += tx.amount
        if (tx.subType === 'EVERYDAY_SPENDING') everydayUncategorised += tx.amount
        continue
      }
      const root = rootOf.get(c.id) ?? (c.parentId != null ? rootOf.get(c.parentId) : undefined) ?? c
      if (tx.subType === 'EVERYDAY_SPENDING') everydayRootId = root.id
      const entry = byRoot.get(root.id)
      if (entry) entry.amount += tx.amount
      else byRoot.set(root.id, { category: root, amount: tx.amount })
    }
    // Net, the way Out is — a line cannot go below nothing, so one that nets to zero drops out.
    let left = surplus
    const everyday = everydayRootId != null ? byRoot.get(everydayRootId) : undefined
    if (everyday && left > 0) {
      const take = Math.min(left, everyday.amount)
      everyday.amount -= take
      left -= take
      if (snap(everyday.amount) <= 0) byRoot.delete(everyday.category.id)
    }
    uncategorised -= Math.min(left, everydayUncategorised)
    const sorted = [...byRoot.values()].sort((a, b) => b.amount - a.amount)
    const top = sorted.slice(0, TOP_CATEGORIES).map(e => ({ ...e, amount: snap(e.amount) }))
    const other = snap(sorted.slice(TOP_CATEGORIES).reduce((s, e) => s + e.amount, 0) + uncategorised)
    return { top, other }
  }, [rows, categories.data])

  // ── The list ─────────────────────────────────────────────────────────────────
  const query = search.trim().toLocaleLowerCase()
  const visible = useMemo(() => rows.filter(tx => {
    if (filters.type && tx.type !== filters.type) return false
    // A parent category means its sub-categories too.
    if (filters.categoryId && !(tx.category
      && (tx.category.id === filters.categoryId || tx.category.parentId === filters.categoryId))) return false
    if (filters.cardId && tx.card?.id !== filters.cardId) return false
    if (filters.investmentId && tx.investmentId !== filters.investmentId) return false
    if (filters.startDate && tx.transactionDate < filters.startDate) return false
    if (filters.endDate && tx.transactionDate > filters.endDate) return false
    if (query) {
      const haystack = [
        tx.description, tx.note, tx.category?.name, tx.category?.nameUz, tx.card?.name,
      ].filter(Boolean).join(' ').toLocaleLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  }), [rows, filters, query])

  const filtersActive = !!(
    filters.type || filters.categoryId || filters.cardId || filters.investmentId
    || filters.startDate || filters.endDate || query
  )

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

  const listRows: ReactNode[] = []
  let currentDay: string | null = null
  for (const tx of visible) {
    if (tx.transactionDate !== currentDay) {
      currentDay = tx.transactionDate
      listRows.push(
        <div key={`day-${currentDay}`} className="bg-slate-50 px-4 py-1.5">
          <span className="text-label uppercase text-slate-500">{dayLabel(currentDay)}</span>
        </div>,
      )
    }
    listRows.push(
      <Row
        key={tx.id}
        tx={tx}
        deleting={deleting === tx.id}
        onOpen={() => setDetailTx(tx)}
        onEdit={() => openEdit(tx)}
        onDelete={() => handleDelete(tx.id)}
      />,
    )
  }

  const monthLabel = formatMonth(month, lang)
  const waiting = !current && (monthTx.loading || monthTx.refreshing)
  const failed = !current && !waiting && !!monthTx.error
  const dim = monthTx.refreshing && !!current ? 'opacity-60 transition-opacity' : ''

  const emptyList = filtersActive ? (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-slate-600">{t('tx.none')}</p>
      <Button label={t('action.clearFilters')} onClick={resetFilters} />
    </div>
  ) : (
    <div className="flex flex-col items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-chip bg-slate-100 text-slate-500">
        <Receipt className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-title text-slate-900">{t('shell.history.empty', { month: monthLabel })}</p>
      <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} label={t('action.add')} onClick={openAdd} />
    </div>
  )

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={t('shell.nav.history')}
        monthStepper={{
          label: monthLabel,
          onPrev: () => goMonth(shiftMonth(month, -1)),
          // Nothing is recorded ahead of today's month.
          onNext: month < thisMonth ? () => goMonth(shiftMonth(month, 1)) : undefined,
        }}
        primary={{
          label: t('action.add'),
          onClick: openAdd,
          icon: <Plus className="h-4 w-4" aria-hidden="true" />,
        }}
      />

      <div className="mt-4 xl:mt-5">
        <TileGrid>
          <IncomeRequiredNotice className={FULL} />

          {waiting ? (
            <>
              <Skeleton variant="stat" className={HALF} />
              <Skeleton variant="text" count={6} className={HALF} />
              <Skeleton variant="row" count={6} className={FULL} />
            </>
          ) : failed ? (
            <ErrorTile className={FULL} message={monthTx.error!} onRetry={monthTx.refetch} />
          ) : (
            <>
              {monthTx.error && (
                <ErrorTile compact className={FULL} message={monthTx.error} onRetry={monthTx.refetch} />
              )}

              {/* The hero: the month in three figures, added up from the very rows listed below. */}
              <Tile span={6} mdSpan={6} padding="hero" as="section" className={dim}>
                <h2 className="text-label uppercase text-slate-500">{monthLabel}</h2>
                <dl className="mt-3 divide-y divide-hairline">
                  <HeroLine label={t('shell.history.in')} amount={totals.earned} tone="in" />
                  {/* Wallet checks that found more than recorded can outweigh a quiet month's spending;
                      Out still never reads below nothing. */}
                  <HeroLine label={t('shell.history.out')} amount={Math.max(0, totals.spent)} tone="out" />
                  <HeroLine label={t('shell.history.saved')} amount={totals.saved} tone="neutral" />
                </dl>
                {(totals.borrowed > 0 || totals.lent > 0) && (
                  <div className="mt-3 space-y-1 text-sm text-slate-600 tabular-nums">
                    {totals.borrowed > 0 && <p>{t('shell.history.borrowed', { amount: moneyFull(totals.borrowed) })}</p>}
                    {totals.lent > 0 && <p>{t('shell.history.lent', { amount: moneyFull(totals.lent) })}</p>}
                  </div>
                )}
                {monthTx.isCached && (
                  <div className="mt-3">
                    <CacheBadge isCached cachedAt={monthTx.cachedAt} />
                  </div>
                )}
              </Tile>

              <Tile span={6} mdSpan={6} as="section" className={dim}>
                <h2 className="text-title text-slate-900">{t('shell.history.whereItWent')}</h2>
                {spending.top.length === 0 && spending.other === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">{t('shell.history.nothingSpent', { month: monthLabel })}</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {(() => {
                      const peak = Math.max(spending.top[0]?.amount ?? 0, spending.other)
                      const bar = (key: string, label: string, amount: number, color: string) => (
                        <li key={key}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 truncate text-sm text-slate-700">{label}</span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900" title={moneyExact(amount)}>
                              {money(amount)}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${peak > 0 ? Math.max(3, (amount / peak) * 100) : 0}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        </li>
                      )
                      return (
                        <>
                          {spending.top.map(e => bar(`c-${e.category.id}`, categoryName(e.category), e.amount, e.category.color))}
                          {spending.other > 0 && bar('other', t('shell.history.other'), spending.other, '#94a3b8')}
                        </>
                      )
                    })()}
                  </ul>
                )}
                {categories.error && !categories.data && (
                  <ErrorTile compact className="mt-3" message={categories.error} onRetry={categories.refetch} />
                )}
              </Tile>

              {/* A month with nothing in it gets the empty state and nothing to operate it with. */}
              {(rows.length > 0 || filtersActive || searchDraft) && (
                <Tile span={12}>
                  <TransactionFilters
                    filters={filters}
                    categories={categories.data ?? []}
                    searchDraft={searchDraft}
                    onSearchDraftChange={setSearchDraft}
                    searching={searchDraft !== search}
                    expanded={filtersExpanded}
                    onExpandedChange={setFiltersExpanded}
                    onChange={updateFilters}
                    onReset={resetFilters}
                  />
                </Tile>
              )}

              <ListTile span={12} empty={emptyList} className={dim}>
                {listRows}
              </ListTile>
            </>
          )}
        </TileGrid>
      </div>

      <TransactionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
        onSaved={() => { monthTx.refetch() }}
        transaction={editTarget}
        defaultCurrency={currency}
      />

      <TransactionDetailModal
        transaction={detailTx}
        open={!!detailTx}
        onClose={() => setDetailTx(null)}
        onEdit={(tx) => { setDetailTx(null); openEdit(tx) }}
        onDelete={handleDelete}
        deleting={deleting === detailTx?.id}
      />
    </div>
  )
}

/** One of the hero's three figures: the word on the left, the amount on the right. */
function HeroLine({ label, amount, tone }: { label: string; amount: number; tone: 'in' | 'out' | 'neutral' }) {
  const colour = tone === 'in' ? 'text-income' : tone === 'out' ? 'text-expense' : 'text-slate-900'
  return (
    <div className="flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className={`text-stat tabular-nums whitespace-nowrap ${colour}`} title={moneyExact(amount)}>
        {money(amount)}
      </dd>
    </div>
  )
}

/**
 * One transaction as a row: the description is the title, the category rides as a badge, and the
 * signed green/red amount is the one colour convention the app has always kept.
 */
function Row({ tx, deleting, onOpen, onEdit, onDelete }: {
  tx: Transaction
  deleting: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t, categoryName } = useLang()
  const isSplit = (tx.cashAmount ?? 0) > 0 && (tx.cardAmount ?? 0) > 0 && !!tx.card
  const income = tx.type === 'INCOME'
  const subtitle = [tx.note || '', tx.card ? `${tx.card.name} ••${tx.card.lastFourDigits}` : '']
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
      title={tx.description}
      badges={
        <>
          {tx.category && (
            <span className="inline-flex items-center gap-1.5 rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tx.category.color }} />
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
