import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDownRight, ArrowLeftRight, ArrowUpRight, ChevronDown, ClipboardCheck, Pencil, Plus, Receipt, Trash2,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAddForm } from '../context/AddFormContext'
import { TransactionDetailModal } from '../components/transactions/TransactionDetailModal'
import { TransactionFilters } from '../components/transactions/TransactionFilters'
import { CategoryBars } from '../components/analytics/CategoryBars'
import { SERIES_BG } from '../components/analytics/shared'
import { LinkButton } from '../components/home/HomeTiles'
import { Button } from '../components/ui/Button'
import { CacheBadge } from '../components/ui/CacheBadge'
import { ErrorTile } from '../components/ui/ErrorTile'
import { ExactAmount } from '../components/ui/ExactAmount'
import { IncomeRequiredNotice } from '../components/ui/IncomeRequiredNotice'
import { ListRow, ListTile } from '../components/ui/ListRow'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { Tile, TileGrid } from '../components/ui/Tile'
import { useApi } from '../hooks/useApi'
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
import type { TransactionFlow } from '../types/fixes'

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
 * The month a row counts in: the month a pay is for, when it says so — September's salary paid on
 * 2 October counts in September — else the month of its date. Only income carries a `salaryMonth`
 * (the server drops it on anything else). The server's own rule (`Transaction.accountingMonth`),
 * the one Profile, Home and the savings targets already count by.
 */
export function accountingMonthOf(tx: Transaction): string {
  return tx.type === 'INCOME' && tx.salaryMonth ? tx.salaryMonth.slice(0, 7) : tx.transactionDate.slice(0, 7)
}

/**
 * Every transaction of `month`, all pages of it.
 *
 * By default the month is its calendar days — the rows dated in it, the way money moved (Loans
 * reads the month's payments so). With `accountingMonth` it is the rows that COUNT in it (see
 * `accountingMonthOf`): September's salary paid on 2 October comes with September and not with
 * October. A server from before that flag ignores it and answers by date, as it always did.
 *
 * One user means a few hundred rows a month at most, so the whole month comes down and every
 * figure on the screen is added up from exactly the rows the list shows. The server caps a page
 * at 100, so a busy month is two or three requests, fetched together.
 */
export async function fetchMonthTransactions(month: string, { accountingMonth = false } = {}): Promise<{
  data: MonthTransactions
  isCached?: boolean
  cachedAt?: string
}> {
  const { start, end } = monthBounds(month)
  const query = (page: number) => transactionsApi.getAll({
    page, size: PAGE_SIZE, sortBy: 'transactionDate', sortDir: 'desc', startDate: start, endDate: end,
    accountingMonth,
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
  // The list draws one header per day, newest first. A pay dated outside the month sits among the
  // rest by its own date whatever page it came on (a stable sort keeps each day's own order).
  rows.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
  // `api/client.ts` bolts the offline-cache flags onto the response at runtime, untyped.
  const cached = [first, ...rest]
    .map(r => r as unknown as { isCached?: boolean; cachedAt?: string })
    .find(r => r.isCached)
  return { data: { month, rows }, isCached: !!cached, cachedAt: cached?.cachedAt }
}

const SAVING_SUB_TYPES = new Set(['DONATION', 'EMERGENCY_CONTRIBUTION', 'INVESTMENT', 'STOCK_PURCHASE'])

/**
 * What a transaction counts as on History — the page's OWN rule, kept only as the fallback for a
 * server that does not send `flow` on each row (see `totalsOf`). With `flow` it is not consulted.
 *
 * In is money earned — borrowed money, money paid back to you and moves between your own wallets
 * all arrive in a wallet without being earned. Out is money spent, apart from moves between
 * wallets and money put into savings, which is its own figure. Lending is not spending either:
 * money lent is its own line, and getting it back is skipped, as borrowing is. Money taken out of
 * savings arrives without being earned or spent, so it is its own line too ("From savings").
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
    if (sub === 'INVESTMENT_WITHDRAWAL') return 'fromSavings'
    if (sub === 'EVERYDAY_SPENDING') return 'surplus'
    if (sub === 'LOAN_RETURNED_TO_ME') return 'skip'
    return 'in'
  }
  if (sub === 'LOAN_GIVEN') return 'lent'
  if (sub && SAVING_SUB_TYPES.has(sub)) return 'saved'
  return 'out'
}

/** The month in figures, added up from the listed rows. */
export interface MonthTotals {
  earned: number
  /** Everyday spending + bills + loan payments, less what wallet checks found extra. */
  out: number
  saved: number
  /** Donations — by the server's `flow`, or by the row's DONATION sub-type on an older server. */
  given: number
  borrowed: number
  lent: number
  returned: number
  fromSavings: number
  /** Out, in its three parts. Null when the server does not classify the rows. */
  parts: { everyday: number; bills: number; loans: number } | null
}

/**
 * The month's totals.
 *
 * Every figure is the sum of the listed rows by the server's own `flow` — the same rule Analytics
 * uses, so the two pages cannot disagree. On a server from before `flow` (or an offline copy saved
 * from one) no row carries it, and the page falls back to the rule it always had (`flowOf`): then
 * Out is not split. A donation is Given, not Saved, either way — Analytics already shows it so, and
 * the two pages must agree whichever server answers. One row without a `flow` sends the whole month
 * down the old rule — half of each would be a total nobody could check.
 */
export function totalsOf(rows: Transaction[]): MonthTotals {
  // UZS is the reporting currency; a dormant foreign cash pot never enters a total.
  const uzs = rows.filter(tx => tx.currency === 'UZS')

  if (uzs.length > 0 && uzs.every(tx => tx.flow != null)) {
    const sum: Record<TransactionFlow, number> = {
      EARNED: 0, BORROWED: 0, RETURNED: 0, FROM_SAVINGS: 0, CORRECTION: 0, LENT: 0,
      SAVED: 0, GIVEN: 0, LOAN_PAYMENT: 0, BILL: 0, EVERYDAY: 0, TRANSFER: 0,
    }
    for (const tx of uzs) {
      // A word this build does not know (a newer server) is left out rather than guessed at.
      if (tx.flow! in sum) sum[tx.flow!] += tx.amount
    }
    // A wallet check that found MORE than expected is the same correction as one that found
    // less, with the other sign: it comes back off everyday spending, never counted as earned.
    const everyday = snap(sum.EVERYDAY - sum.CORRECTION)
    const bills = snap(sum.BILL)
    const loans = snap(sum.LOAN_PAYMENT)
    return {
      earned: snap(sum.EARNED),
      out: snap(everyday + bills + loans),
      saved: snap(sum.SAVED),
      given: snap(sum.GIVEN),
      borrowed: snap(sum.BORROWED),
      lent: snap(sum.LENT),
      returned: snap(sum.RETURNED),
      fromSavings: snap(sum.FROM_SAVINGS),
      parts: { everyday, bills, loans },
    }
  }

  let earned = 0, spent = 0, saved = 0, given = 0, borrowed = 0, lent = 0, fromSavings = 0, returned = 0
  for (const tx of uzs) {
    const flow = flowOf(tx)
    if (flow === 'in') earned += tx.amount
    else if (flow === 'out') spent += tx.amount
    else if (flow === 'surplus') spent -= tx.amount
    else if (flow === 'saved') { if (tx.subType === 'DONATION') given += tx.amount; else saved += tx.amount }
    else if (flow === 'borrowed') borrowed += tx.amount
    else if (flow === 'lent') lent += tx.amount
    else if (flow === 'fromSavings') fromSavings += tx.amount
    else if (!isMoveLeg(tx) && tx.subType === 'LOAN_RETURNED_TO_ME') returned += tx.amount
  }
  return {
    earned: snap(earned), out: snap(spent), saved: snap(saved), given: snap(given),
    borrowed: snap(borrowed), lent: snap(lent), returned: snap(returned), fromSavings: snap(fromSavings),
    parts: null,
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// The list: one line per thing that happened
// ────────────────────────────────────────────────────────────────────────────────

/** Half of a move between the owner's own wallets. */
export const isMoveLeg = (tx: Transaction): boolean =>
  tx.transferPairId != null || tx.subType === 'TRANSFER_IN' || tx.subType === 'TRANSFER_OUT'

/** What a wallet check booked for one wallet: less than expected (an expense) or more (an income). */
export const isCheckRow = (tx: Transaction): boolean => !isMoveLeg(tx) && tx.subType === 'EVERYDAY_SPENDING'

/** The word a loan row carries instead of income-green / expense-red; null for any other row. */
function loanWord(tx: Transaction): 'fix.chip.borrowed' | 'fix.chip.lent' | 'fix.chip.paidBack' | 'fix.chip.loanPayment' | null {
  if (isMoveLeg(tx)) return null
  switch (tx.subType) {
    case 'LOAN_RECEIVED': return 'fix.chip.borrowed'
    case 'LOAN_GIVEN': return 'fix.chip.lent'
    case 'LOAN_RETURNED_TO_ME': return 'fix.chip.paidBack'
    case 'LOAN_REPAYMENT':
    case 'BANK_LOAN_PAYMENT': return 'fix.chip.loanPayment'
    default: return null
  }
}

/**
 * One line of the list. The rows under it are the server's own and stay what they were — a merged
 * line only changes how they are shown, so each can still be opened, changed and deleted.
 */
export type HistoryEntry =
  | { kind: 'row'; key: string; date: string; tx: Transaction }
  /** A move between two wallets: the row that left one and the row that arrived in the other. */
  | { kind: 'move'; key: string; date: string; from: Transaction | null; to: Transaction | null }
  /** One day's wallet check: what it booked, one row per wallet that was off. */
  | { kind: 'check'; key: string; date: string; rows: Transaction[] }

/** The rows behind a line — what search and the filters are asked about. */
export function rowsOf(e: HistoryEntry): Transaction[] {
  if (e.kind === 'row') return [e.tx]
  if (e.kind === 'check') return e.rows
  return [e.from, e.to].filter((tx): tx is Transaction => tx != null)
}

/**
 * The month's rows as lines, in the order they arrived (newest day first).
 *
 * A move is two rows with the same `transferPairId`; they become one line wherever in the month
 * the two sit — the whole month is loaded, so a pair is never cut in half by a page. A leg whose
 * partner is not among the rows (it would take a broken record) stays a line of its own, still
 * shown as a move and never as money earned or spent.
 *
 * A day's wallet-check rows become one line per currency, so an amount in one currency is never
 * added to another's.
 */
export function entriesOf(rows: Transaction[]): HistoryEntry[] {
  const entries: HistoryEntry[] = []
  const moves = new Map<number, Extract<HistoryEntry, { kind: 'move' }>>()
  const checks = new Map<string, Extract<HistoryEntry, { kind: 'check' }>>()
  for (const tx of rows) {
    if (isMoveLeg(tx)) {
      const side = tx.type === 'EXPENSE' ? 'from' : 'to'
      const open = tx.transferPairId != null ? moves.get(tx.transferPairId) : undefined
      if (open && open[side] == null) { open[side] = tx; continue }
      const entry: Extract<HistoryEntry, { kind: 'move' }> = {
        // Keyed by the pair, not by whichever leg came first: the two can swap order between
        // fetches, and an unfolded move must stay unfolded. (A stray third row keeps its own id.)
        kind: 'move', key: tx.transferPairId != null && !open ? `move-${tx.transferPairId}` : `move-leg-${tx.id}`,
        date: tx.transactionDate, from: null, to: null,
      }
      entry[side] = tx
      entries.push(entry)
      if (tx.transferPairId != null && !open) moves.set(tx.transferPairId, entry)
    } else if (isCheckRow(tx)) {
      const key = `check-${tx.transactionDate}-${tx.currency}`
      const known = checks.get(key)
      if (known) { known.rows.push(tx); continue }
      const entry: Extract<HistoryEntry, { kind: 'check' }> = { kind: 'check', key, date: tx.transactionDate, rows: [tx] }
      checks.set(key, entry)
      entries.push(entry)
    } else {
      entries.push({ kind: 'row', key: `tx-${tx.id}`, date: tx.transactionDate, tx })
    }
  }
  return entries
}

// ────────────────────────────────────────────────────────────────────────────────
// History
// ────────────────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
  type: '', currency: '', categoryId: '', cardId: '', investmentId: '', search: '',
  startDate: '', endDate: '', page: 0, size: PAGE_SIZE,
  sortBy: 'transactionDate', sortDir: 'desc', flows: [], walletCheck: false,
}

/** Every word a row's `flow` can be — what `?flow=` accepts; anything else in it is ignored. */
const FLOWS: ReadonlySet<TransactionFlow> = new Set<TransactionFlow>([
  'EARNED', 'BORROWED', 'RETURNED', 'FROM_SAVINGS', 'CORRECTION', 'LENT',
  'SAVED', 'GIVEN', 'LOAN_PAYMENT', 'BILL', 'EVERYDAY', 'TRANSFER',
])

/** How many categories "Where it went" names before the rest become "Other". */
const TOP_CATEGORIES = 6

const HALF = 'md:col-span-6 xl:col-span-6'
const FULL = 'md:col-span-6 xl:col-span-12'

const YM = /^\d{4}-\d{2}$/
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

interface Props {
  currency: Currency
}

export function History({ currency }: Props) {
  const { t, lang, categoryName } = useLang()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { showSuccess } = useToast()
  const [searchParams] = useSearchParams()

  const thisMonth = monthLocal()
  // The furthest month that can hold anything: next month's pay received ahead (a salary or an
  // advance marked "For November" on 2 October) counts in, and is listed under, next month — the
  // most a pay can be ahead of its date. Without it that row would be out of reach until November.
  const lastMonth = shiftMonth(thisMonth, 1)
  const [month, setMonth] = useState(() => {
    // `from` is how Analytics links to one day (or a few): its month is the month to open.
    const asked = searchParams.get('month') ?? searchParams.get('startDate')?.slice(0, 7)
      ?? searchParams.get('from')?.slice(0, 7) ?? ''
    return YM.test(asked) && asked <= lastMonth ? asked : thisMonth
  })

  // Links from elsewhere (and the old /transactions?type=… bookmarks) arrive as query params.
  const [filters, setFilters] = useState<Filters>(() => {
    const num = (key: string): number | '' => {
      const v = searchParams.get(key)
      return v && !Number.isNaN(Number(v)) ? Number(v) : ''
    }
    // `from` / `to` (YYYY-MM-DD) open the list already narrowed to those days — a day tapped on
    // Analytics. Only days inside the month on screen count; anything else is ignored.
    const day = (key: string): string => {
      const v = searchParams.get(key) ?? ''
      return ISO_DAY.test(v) && v.slice(0, 7) === month ? v : ''
    }
    const type = searchParams.get('type')
    // Analytics opens exactly a figure's rows: `flow=` (a comma list of the server's words) and
    // `walletCheck=1` (the rows behind "Not itemised"), each ANDed with the rest.
    const flows = (searchParams.get('flow') ?? '').split(',')
      .filter((f): f is TransactionFlow => FLOWS.has(f as TransactionFlow))
    return {
      ...DEFAULT_FILTERS,
      startDate: day('from'),
      endDate: day('to'),
      type: type === 'INCOME' || type === 'EXPENSE' ? type : '',
      categoryId: num('categoryId'),
      cardId: num('cardId'),
      investmentId: num('investmentId'),
      flows,
      walletCheck: searchParams.get('walletCheck') === '1',
    }
  })
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('search') ?? '')
  // The whole month is already here, so a search is a filter over it, not a request — deferring
  // it just keeps typing smooth on a long month.
  const search = useDeferredValue(searchDraft)
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  // Adding and changing a row both use the shell's one form; after a save the month re-loads on
  // its own (see AddFormContext).
  const addForm = useAddForm()
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  // Which merged lines (a move, a day's wallet check) are unfolded to their own rows.
  const [unfolded, setUnfolded] = useState<Set<string>>(new Set())
  const toggleUnfolded = (key: string) => setUnfolded(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const updateFilters = useCallback((partial: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...partial }))
  }, [])
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setSearchDraft('')
  }, [])

  // The month: the rows that count in it — September's salary paid on 2 October is September's.
  // Every figure on the page is added up from these rows, and the month's list shows them.
  const monthTx = useApi(() => fetchMonthTransactions(month, { accountingMonth: true }), [month])
  // Days picked inside the month (a day tapped on Analytics, or From/To) are days on the calendar:
  // the list then shows what is dated in them, whatever month a pay is for — which takes the month
  // by date. Only while such days are picked; the figures stay the month's.
  const dayRange = !!(filters.startDate || filters.endDate)
  const datedTx = useApi<MonthTransactions | null>(
    () => dayRange ? fetchMonthTransactions(month) : Promise.resolve({ data: null }),
    [month, dayRange],
  )
  const categories = useApi(() => categoriesApi.getAll(), [])

  // Only the month on screen counts. While another month is loading, the hook still holds the
  // previous one — drawing its figures under the new month's name would be a wrong answer.
  const current = monthTx.data?.month === month ? monthTx.data : null
  // Taken as the server sent them: a server that knows `accountingMonth` sends the rows that count
  // in the month; an older one ignores the flag and sends the month by date, so a pay marked for
  // another month stays, then, where it always was — with its "For …" chip.
  const rows = useMemo(() => current?.rows ?? [], [current])
  // What the list is drawn from. Until the days' own rows arrive (or if they fail), the month's rows
  // narrowed to the days stand in — they differ only by a pay received on those days for another month.
  const dated = dayRange && datedTx.data?.month === month ? datedTx.data.rows : null
  const listSource = dated ?? rows

  const goMonth = (next: string) => {
    setMonth(next)
    // A From/To date belongs to the month it was picked in.
    setFilters(prev => ({ ...prev, startDate: '', endDate: '' }))
  }

  const openAdd = () => addForm.open()
  const openEdit = (tx: Transaction) => addForm.edit(tx)

  const handleDelete = async (id: number) => {
    if (!await confirm({ message: t('tx.confirmDelete'), destructive: true })) return
    setDeleting(id)
    try {
      await transactionsApi.delete(id)
      setDetailTx(null)
      await Promise.all([monthTx.refetch(), datedTx.refetch()])
      showSuccess(t('page.transactions.deletedToast'))
    } finally {
      setDeleting(null)
    }
  }

  // ── The month in figures ─────────────────────────────────────────────────────
  const totals = useMemo(() => totalsOf(rows), [rows])

  // ── Where it went: Out, by top-level category ────────────────────────────────
  // Only drawn when the server does not classify rows (`totals.parts` is null); with `flow` the
  // tile shows Out's three parts instead, and the categories live on Analytics.
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
  // The month view keeps every row of `rows` — the month's, a pay dated in another month included.
  // Only picked days ask about the date.
  const visible = useMemo(() => listSource.filter(tx => {
    if (filters.type && tx.type !== filters.type) return false
    // A parent category means its sub-categories too.
    if (filters.categoryId && !(tx.category
      && (tx.category.id === filters.categoryId || tx.category.parentId === filters.categoryId))) return false
    if (filters.cardId && tx.card?.id !== filters.cardId) return false
    if (filters.investmentId && tx.investmentId !== filters.investmentId) return false
    // By the server's own word for the row; a row without one (an older server) matches none.
    if (filters.flows?.length && !(tx.flow && filters.flows.includes(tx.flow))) return false
    if (filters.walletCheck && !(tx.subType === 'EVERYDAY_SPENDING' || tx.flow === 'CORRECTION')) return false
    if (filters.startDate && tx.transactionDate < filters.startDate) return false
    if (filters.endDate && tx.transactionDate > filters.endDate) return false
    if (query) {
      const haystack = [
        tx.description, tx.note, tx.category?.name, tx.category?.nameUz, tx.card?.name,
      ].filter(Boolean).join(' ').toLocaleLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  }), [listSource, filters, query])

  const filtersActive = !!(
    filters.type || filters.categoryId || filters.cardId || filters.investmentId
    || filters.flows?.length || filters.walletCheck
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
    // A day outside the month on screen only holds pay received then for this month (September's
    // salary on 2 October): "Received 2 Oct 2026", never "Today · …" — today is not September's.
    if (date.slice(0, 7) !== month) return t('shell.history.received', { date: full })
    if (date === today) return `${t('page.transactions.today')} · ${full}`
    if (date === yesterday) return `${t('page.transactions.yesterday')} · ${full}`
    return full
  }

  // Search and the filters are asked about the rows themselves; a merged line shows when any of
  // its rows match, and then shows whole — a move is never drawn as half of itself.
  const entries = useMemo(() => entriesOf(listSource), [listSource])
  const shown = useMemo(() => {
    const ids = new Set(visible.map(tx => tx.id))
    return entries.filter(e => rowsOf(e).some(tx => ids.has(tx.id)))
  }, [entries, visible])

  const walletOf = (tx: Transaction) => tx.card?.name ?? t('tx.cash')
  const rowFor = (tx: Transaction, nested = false) => (
    <Row
      key={tx.id}
      tx={tx}
      nested={nested}
      deleting={deleting === tx.id}
      onOpen={() => setDetailTx(tx)}
      onEdit={() => openEdit(tx)}
      onDelete={() => handleDelete(tx.id)}
    />
  )

  const listRows: ReactNode[] = []
  let currentDay: string | null = null
  for (const e of shown) {
    if (e.date !== currentDay) {
      currentDay = e.date
      listRows.push(
        <div key={`day-${currentDay}`} className="bg-slate-50 px-4 py-1.5">
          <span className="text-label uppercase text-slate-500">{dayLabel(currentDay)}</span>
        </div>,
      )
    }
    const under = rowsOf(e)
    // Nothing to merge: one row is its own line (a lone leg of a move still reads as a move).
    if (under.length === 1) { listRows.push(rowFor(under[0])); continue }

    const open = unfolded.has(e.key)
    if (e.kind === 'move') {
      const leg = e.from ?? e.to!
      listRows.push(
        <GroupRow
          key={e.key}
          icon={<ArrowLeftRight className="h-4 w-4" aria-hidden="true" />}
          title={t('fix.history.moved')}
          detail={`${walletOf(e.from!)} → ${walletOf(e.to!)}`}
          amount={moneyFull(leg.amount, leg.currency)}
          open={open}
          onToggle={() => toggleUnfolded(e.key)}
        />,
      )
    } else {
      // What the day's check came to: less than expected is spending nobody itemised.
      const net = snap(under.reduce((sum, tx) => sum + (tx.type === 'EXPENSE' ? tx.amount : -tx.amount), 0))
      const currencyOfCheck = under[0].currency
      const found = net > 0
        ? t('fix.history.checkShort', { amount: moneyFull(net, currencyOfCheck) })
        : net < 0
          ? t('fix.history.checkMore', { amount: moneyFull(-net, currencyOfCheck) })
          : t('fix.history.checkEven')
      listRows.push(
        <GroupRow
          key={e.key}
          icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
          title={t('fix.history.check')}
          detail={`${found} · ${t('fix.history.walletsMany', { count: under.length })}`}
          open={open}
          onToggle={() => toggleUnfolded(e.key)}
        />,
      )
    }
    if (open) for (const tx of under) listRows.push(rowFor(tx, true))
  }

  const monthLabel = formatMonth(month, lang)
  const waiting = !current && (monthTx.loading || monthTx.refreshing)
  const failed = !current && !waiting && !!monthTx.error
  const dim = monthTx.refreshing && !!current ? 'opacity-60 transition-opacity' : ''
  // The list also waits on the picked days' own rows, when there are such days.
  const listDim = dim || (dayRange && (datedTx.loading || datedTx.refreshing) ? 'opacity-60 transition-opacity' : '')

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
          // Nothing counts further ahead than next month (see `lastMonth`).
          onNext: month < lastMonth ? () => goMonth(shiftMonth(month, 1)) : undefined,
        }}
        primary={{
          label: t('action.add'),
          onClick: openAdd,
          icon: <Plus className="h-4 w-4" aria-hidden="true" />,
          // On a phone the bottom bar's ＋ is this button; the top bar does not repeat it.
          hideOnPhone: true,
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
              {dayRange && datedTx.error && (
                <ErrorTile compact className={FULL} message={datedTx.error} onRetry={datedTx.refetch} />
              )}

              {/* The hero: the month in figures, added up from the very rows listed below. */}
              <Tile span={6} mdSpan={6} padding="hero" as="section" className={dim}>
                <h2 className="text-label uppercase text-slate-500">{monthLabel}</h2>
                <dl className="mt-3 divide-y divide-hairline">
                  <HeroLine label={t('shell.history.in')} amount={totals.earned} tone="in" />
                  {/* Wallet checks that found more than recorded can outweigh a quiet month's spending;
                      Out still never reads below nothing. */}
                  <HeroLine label={t('shell.history.out')} amount={Math.max(0, totals.out)} tone="out" />
                  <HeroLine label={t('shell.history.saved')} amount={totals.saved} tone="neutral" />
                  {/* A donation is given, not saved — its own line. */}
                  {totals.given > 0 && (
                    <HeroLine label={t('fix.given')} amount={totals.given} tone="neutral" />
                  )}
                </dl>
                {(totals.borrowed > 0 || totals.lent > 0 || totals.returned > 0 || totals.fromSavings > 0) && (
                  <div className="mt-3 space-y-1 text-sm text-slate-600 tabular-nums">
                    {totals.borrowed > 0 && <p>{t('shell.history.borrowed', { amount: moneyFull(totals.borrowed) })}</p>}
                    {totals.lent > 0 && <p>{t('shell.history.lent', { amount: moneyFull(totals.lent) })}</p>}
                    {totals.returned > 0 && <p>{t('fix.history.returned', { amount: moneyFull(totals.returned) })}</p>}
                    {totals.fromSavings > 0 && <p>{t('shell.history.fromSavings', { amount: moneyFull(totals.fromSavings) })}</p>}
                  </div>
                )}
                {monthTx.isCached && (
                  <div className="mt-3">
                    <CacheBadge isCached cachedAt={monthTx.cachedAt} />
                  </div>
                )}
                {/* The same month, from further away: where it all went, and how it compares. Not
                    for next month (reachable for pay marked ahead): Analytics stops at this month. */}
                {month <= thisMonth && (
                  <div className="mt-2">
                    <LinkButton
                      label={t('analytics.fromHistory', { month: formatDate(month, lang, 'monthName') })}
                      onClick={() => navigate(`/analytics?month=${month}`)}
                    />
                  </div>
                )}
              </Tile>

              <Tile span={6} mdSpan={6} as="section" className={dim}>
                <h2 className="text-title text-slate-900">{t('shell.history.whereItWent')}</h2>
                {totals.parts ? (
                  // Out in its three parts. Which categories the everyday part went to is
                  // Analytics' question — the link under the month's figures goes there.
                  totals.out <= 0 ? (
                    <p className="mt-3 text-sm text-slate-500">{t('shell.history.nothingSpent', { month: monthLabel })}</p>
                  ) : (
                    <CategoryBars
                      items={[
                        { key: 'everyday', label: t('analytics.group.everyday'), amount: Math.max(0, totals.parts.everyday), colorClass: SERIES_BG.everyday },
                        { key: 'bills', label: t('analytics.group.bills'), amount: totals.parts.bills, colorClass: SERIES_BG.bills },
                        { key: 'loans', label: t('analytics.group.loans'), amount: totals.parts.loans, colorClass: SERIES_BG.loans },
                      ].filter(it => it.amount > 0)}
                    />
                  )
                ) : spending.top.length === 0 && spending.other === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">{t('shell.history.nothingSpent', { month: monthLabel })}</p>
                ) : (
                  <CategoryBars
                    items={[
                      ...spending.top.map(e => ({
                        key: `c-${e.category.id}`,
                        label: categoryName(e.category),
                        amount: e.amount,
                        color: e.category.color,
                      })),
                      ...(spending.other > 0
                        ? [{ key: 'other', label: t('shell.history.other'), amount: spending.other, color: '#94a3b8' }]
                        : []),
                    ]}
                  />
                )}
                {!totals.parts && categories.error && !categories.data && (
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

              <ListTile span={12} empty={emptyList} className={listDim}>
                {listRows}
              </ListTile>
            </>
          )}
        </TileGrid>
      </div>

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
      <dd className={`text-right text-stat tabular-nums whitespace-nowrap ${colour}`} title={moneyExact(amount)}>
        {money(amount)}
        <ExactAmount amount={amount} />
      </dd>
    </div>
  )
}

/** The quiet chip a row's icon sits in when the row is neither money earned nor money spent. */
const NEUTRAL_CHIP = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-slate-100 text-slate-600'

/**
 * A merged line — a move between wallets, or a day's wallet check. It is a disclosure: pressing
 * it unfolds the rows it stands for, each with its own Edit and Delete, right under it.
 *
 * The chevron sits in the slot a row's ⋯ menu takes, so amounts stay in one column down the list.
 */
function GroupRow({ icon, title, detail, amount, open, onToggle }: {
  icon: ReactNode
  title: string
  detail: string
  amount?: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      // Inset ring: ListTile clips its corners, and an outside ring would lose its side bands.
      className="focus-ring focus-visible:ring-inset focus-visible:ring-offset-0 flex min-h-[72px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 sm:min-h-[56px] sm:py-2"
    >
      <span className={NEUTRAL_CHIP}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
        <span className="truncate text-sm font-medium text-slate-900">{title}</span>
        <span className="min-w-0 truncate text-xs tabular-nums text-slate-500 sm:shrink-[3]">{detail}</span>
      </span>
      {amount && (
        <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">{amount}</span>
      )}
      <span className="-my-1.5 flex h-11 w-11 shrink-0 items-center justify-center text-slate-500 max-sm:-ml-1 max-sm:-mr-2" aria-hidden="true">
        <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </span>
    </button>
  )
}

/**
 * One transaction as a row.
 *
 * Money earned is green and money spent is red — the one colour convention the app has always
 * kept — and everything that is neither is neutral and says what it is in words: a move between
 * wallets, a wallet check, and loans (borrowed, lent, paid back, a repayment), where green and red
 * used to call borrowing "income" and lending "spending".
 */
function Row({ tx, deleting, nested = false, onOpen, onEdit, onDelete }: {
  tx: Transaction
  deleting: boolean
  /** Under an unfolded merged line: tinted and indented, so it reads as part of it. */
  nested?: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t, lang, categoryName } = useLang()
  const isSplit = (tx.cashAmount ?? 0) > 0 && (tx.cardAmount ?? 0) > 0 && !!tx.card
  const income = tx.type === 'INCOME'
  const move = isMoveLeg(tx)
  const check = isCheckRow(tx)
  const loan = loanWord(tx)
  const neutral = move || check || loan != null
  const wallet = tx.card?.name ?? t('tx.cash')
  // Pay that arrived in one month for another — September's salary on 2 October — is listed with
  // the month it is for, under the day it arrived, and says "For September" beside its category.
  // The day it arrived is its day header ("Received 2 Oct 2026" on September), never said twice.
  const payMonth = accountingMonthOf(tx)
  const forOtherMonth = !move && !check && payMonth !== tx.transactionDate.slice(0, 7)
  const subtitle = move
    ? t(income ? 'fix.history.to' : 'fix.history.from', { wallet })
    : check
      ? `${wallet} · ${t(income ? 'fix.history.more' : 'fix.history.notItemised')}`
      : [tx.note || '', tx.card ? `${tx.card.name} ••${tx.card.lastFourDigits}` : ''].filter(Boolean).join(' · ')
  const actions = [
    { label: t('action.edit'), icon: <Pencil className="h-4 w-4" aria-hidden="true" />, onClick: onEdit },
    { label: t('action.delete'), icon: <Trash2 className="h-4 w-4" aria-hidden="true" />, onClick: onDelete, danger: true, disabled: deleting },
  ]
  const Arrow = income ? ArrowUpRight : ArrowDownRight

  return (
    <ListRow
      onClick={onOpen}
      className={nested ? 'bg-slate-50/70 pl-8' : ''}
      leading={
        move ? <span className={NEUTRAL_CHIP}><ArrowLeftRight className="h-4 w-4" aria-hidden="true" /></span>
          : check ? <span className={NEUTRAL_CHIP}><ClipboardCheck className="h-4 w-4" aria-hidden="true" /></span>
            : (
              <span className={neutral ? NEUTRAL_CHIP : `flex h-9 w-9 items-center justify-center rounded-chip ${income ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                <Arrow className="h-4 w-4" aria-hidden="true" />
              </span>
            )
      }
      title={move ? t('fix.history.moved') : check ? t('fix.history.check') : tx.description}
      badges={move || check ? undefined : (
        <>
          {loan && (
            <span className="inline-flex items-center rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {t(loan)}
            </span>
          )}
          {tx.category && !loan && (
            <span className="inline-flex items-center gap-1.5 rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tx.category.color }} />
              {categoryName(tx.category)}
            </span>
          )}
          {forOtherMonth && (
            <span className="inline-flex items-center rounded-chip bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
              {t('shell.history.forMonth', { month: formatDate(payMonth, lang, 'monthName') })}
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
      )}
      subtitle={subtitle || undefined}
      // A move has no direction of its own — the money is still the owner's — so it has no sign.
      amount={move ? moneyFull(tx.amount, tx.currency) : `${income ? '+' : '-'}${moneyFull(tx.amount, tx.currency)}`}
      amountTone={neutral ? 'neutral' : income ? 'in' : 'out'}
      actions={actions}
    />
  )
}
