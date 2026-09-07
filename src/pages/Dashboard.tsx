import { useMemo, useState } from 'react'
import { Plus, Scale, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IncomeExpenseChart, MONTH_KEYS } from '../components/dashboard/IncomeExpenseChart'
import { CardInfoModal, type InfoKind } from '../components/dashboard/CardInfoModal'
import { AllocationPanel } from '../components/dashboard/AllocationPanel'
import { GetStartedHero, INCOME_FIELD_ID } from '../components/dashboard/GetStartedHero'
import { RecentTransactions } from '../components/dashboard/RecentTransactions'
import { TransactionModal } from '../components/transactions/TransactionModal'
import { TransactionDetailModal } from '../components/transactions/TransactionDetailModal'
import { ErrorTile } from '../components/ui/ErrorTile'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { StatTile } from '../components/ui/StatTile'
import { Tabs } from '../components/ui/Tabs'
import { Tile, TileGrid } from '../components/ui/Tile'
import { CacheBadge } from '../components/ui/CacheBadge'
import { useApi } from '../hooks/useApi'
import { useConfirm } from '../context/ConfirmContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import { extractErrorMessage } from '../api/client'
import { cardsApi } from '../api/cards'
import { cashBalancesApi } from '../api/cashBalances'
import { dashboardApi } from '../api/dashboard'
import { monthsApi } from '../api/months'
import { overviewApi } from '../api/overview'
import { transactionsApi } from '../api/transactions'
import { money, moneyExact, monthLocal } from '../utils/format'
import type { MonthlyData, Transaction, TransactionType, Currency } from '../types'

interface Props { currency: Currency }

/** Past this many, the hero's wallet strip stops being a glance and starts being a list. */
const MAX_WALLET_CHIPS = 3

/**
 * Home's two panels. `summary` is first, and first is load-bearing: it is what a bare "/" shows,
 * so the landing URL the sidebar links to carries no query string at all.
 */
type HomeTab = 'summary' | 'activity'

const TAB_IDS: HomeTab[] = ['summary', 'activity']

const TAB_LABEL: Record<HomeTab, TKey> = {
  summary:  'page.home.tabSummary',
  activity: 'page.home.tabActivity',
}

/**
 * The active tab rides in a search param rather than a path segment.
 *
 * Finance can use `/finance/:tab` because every one of its tabs is a sub-path. Home IS "/", and a
 * `/home/:tab` shape would need two files this change does not own: the route in `App.tsx`, and
 * `Sidebar.tsx`, whose Home item matches "/" exactly and would go dark on every tab but the
 * first. `?tab=` is linkable, survives a reload and needs neither.
 */
const TAB_PARAM = 'tab'

/** A full-width row of the twelve-column page grid. */
const FULL = 'md:col-span-6 xl:col-span-12'

/**
 * `index.css`'s reduced-motion block sets `scroll-behavior: auto`, but the CSSOM-View algorithm
 * only consults the computed style when the caller asks for `'auto'` — an explicit `'smooth'` in
 * the options bag wins over it. So the setting has to be read here instead.
 */
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

export function Dashboard({ currency }: Props) {
  const { t } = useLang()
  const { hasStableIncome, settings, loading: settingsLoading } = useSettings()
  const { showSuccess, showError } = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [modalOpen, setModalOpen] = useState(false)
  // Which type a NEW transaction opens as; undefined = generic (defaults to Expense).
  const [presetType, setPresetType] = useState<TransactionType | undefined>()
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)
  // Which stat tile's "where did this come from?" popup is open.
  const [info, setInfo] = useState<InfoKind | null>(null)
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const requestedTab = searchParams.get(TAB_PARAM) ?? ''
  // An unknown or absent tab lands on the first one rather than on a blank page.
  const activeTab: HomeTab = (TAB_IDS as string[]).includes(requestedTab)
    ? requestedTab as HomeTab
    : TAB_IDS[0]

  const setTab = (id: HomeTab) => {
    // Whatever else is in the query stays: Home is the app's redirect target, so it can be
    // reached carrying someone else's parameters.
    const next = new URLSearchParams(searchParams)
    if (id === TAB_IDS[0]) next.delete(TAB_PARAM)
    else next.set(TAB_PARAM, id)
    setSearchParams(next)
  }

  const year = new Date().getFullYear()
  // The allocation is a per-month figure; Home always shows the current one, read off the
  // viewer's clock rather than toISOString(), which is UTC and names the previous month on the
  // 1st for anyone east of Greenwich.
  const thisMonth = monthLocal()

  const summary = useApi(() => dashboardApi.getSummary(currency), [currency])
  const monthly = useApi(() => dashboardApi.getMonthly(currency, year), [currency, year])
  // The tier lives here rather than inside AllocationPanel so the page and the panel can never
  // disagree about the month, and so a write anywhere on Home can refresh it.
  const tier = useApi(() => overviewApi.getTier(thisMonth, currency), [thisMonth, currency])
  // The same month's envelope, and the only source of the "Set aside" figure the panel prints:
  // the tier knows the three allocation buckets, this knows all five, and Months quotes exactly
  // this total — so the two screens cannot put two numbers under one word.
  const envelope = useApi(() => monthsApi.getSummary(thisMonth, currency), [thisMonth, currency])
  const recent = useApi(() => transactionsApi.getRecent(currency), [currency])
  const cards = useApi(() => cardsApi.getAll(), [])
  const cash = useApi(() => cashBalancesApi.getAll(), [])

  // The chart starts one month BEFORE allocation tracking began — the months before that are
  // structurally empty (nothing was being recorded yet), and a flat zero line across half the
  // year reads as "you earned nothing" rather than "this period isn't tracked".
  const chartData = useMemo(() => {
    const all = monthly.data ?? []
    const start = settings?.allocationTrackingStartMonth
    if (!start) return all
    const d = new Date(start)
    if (d.getFullYear() !== year) return all
    // getMonth() is 0-based, so it is already "the month before" the 1-based start month.
    const from = Math.max(1, d.getMonth())
    return all.filter(m => m.month >= from)
  }, [monthly.data, settings?.allocationTrackingStartMonth, year])

  /**
   * The Activity row is summed from exactly the rows the chart draws, and from no other source.
   *
   * A zero-zero month is a month nobody recorded into, so the chart drops it — which means the
   * totals can name the real first and last month they cover instead of claiming a whole year the
   * figures do not span. Adding the bars up can never disagree with the cards above them.
   */
  const charted = useMemo(
    () => chartData.filter(m => m.income !== 0 || m.expense !== 0),
    [chartData],
  )

  const chartedTotals = useMemo(() => {
    if (charted.length === 0) return null
    return {
      income:  charted.reduce((sum, m) => sum + m.income, 0),
      expense: charted.reduce((sum, m) => sum + m.expense, 0),
      // `net` is the backend's own per-month field, not arithmetic invented here.
      net:     charted.reduce((sum, m) => sum + m.net, 0),
      from: charted[0],
      to:   charted[charted.length - 1],
    }
  }, [charted])

  // The payload's `monthName` is the backend's `Month.of(m).name().substring(0, 3)` — "SEP" in
  // every language — so the range is named from the dictionary, exactly as the chart's axis is.
  const monthLabel = (m: MonthlyData) =>
    MONTH_KEYS[m.month - 1] ? t(MONTH_KEYS[m.month - 1]) : m.monthName

  /** The scope beside every figure in the Activity row: the months those figures actually cover. */
  const chartedRange = chartedTotals
    ? chartedTotals.from.month === chartedTotals.to.month
      ? t('page.home.rangeOne', { month: monthLabel(chartedTotals.from), year })
      : t('page.home.range', {
          from: monthLabel(chartedTotals.from), to: monthLabel(chartedTotals.to), year,
        })
    : ''

  const chartedCaption = (amount: number) => `${chartedRange} · ${moneyExact(amount, currency)}`

  const s = summary.data
  // Older cached payloads (or a stale backend before restart) may not carry the newer fields.
  const availableBalance = s?.availableBalance ?? 0
  const spendable = s?.spendableBalance ?? availableBalance

  const wallets = useMemo(() => {
    const rows = (cards.data ?? [])
      .filter(c => c.currency === currency)
      .map(c => ({ key: `card-${c.id}`, label: c.name, amount: c.currentBalance }))
    const pot = (cash.data ?? []).find(p => p.currency === currency)
    if (pot) rows.push({ key: `cash-${pot.id}`, label: t('cmp.cardInfo.cashPot'), amount: pot.currentBalance })
    return rows
  }, [cards.data, cash.data, currency, t])

  // `hasLoaded` answers "did an attempt finish", not "did it succeed" — the hook sets it in its
  // catch as well — so a failed wallet read satisfied it and the hero said "no wallets yet" to an
  // account with three cards. The empty state now needs the server to have actually answered.
  const walletsError = cards.error ?? cash.error
  const walletsKnown = cards.hasLoaded && cash.hasLoaded
  const refetchWallets = () => { cards.refetch(); cash.refetch() }

  // Every step is derived from server data, so the checklist is only trustworthy once all three
  // sources have answered — otherwise an established account flashes the first-run panel on
  // every load while the first fetch is in flight.
  const firstRunKnown = !settingsLoading && summary.hasLoaded && walletsKnown
  // …and once they answered without failing: a failed summary reads as zero transactions and a
  // failed wallet read as zero wallets, which is the first-run checklist's exact trigger.
  const readsTrustworthy = !summary.error && !walletsError
  const showGetStarted = firstRunKnown && readsTrustworthy
    && (!hasStableIncome || wallets.length === 0 || (s?.transactionCount ?? 0) === 0)

  /** Everything the allocation panel does not own — it refreshes its own two queries. */
  const refetchPage = () => {
    summary.refetch(); monthly.refetch(); recent.refetch(); refetchWallets()
  }
  const refetchAll = () => { refetchPage(); tier.refetch(); envelope.refetch() }

  /**
   * The income gate, without a dead button. A disabled control fires no pointer events, so its
   * `title` never appears on touch and most screen readers skip it — the button stays live and
   * takes the reader to the one field that opens everything instead.
   */
  const focusIncomeSetup = () => {
    const el = document.getElementById(INCOME_FIELD_ID)
    if (!el) { navigate('/settings'); return }
    el.scrollIntoView({ behavior: scrollBehavior(), block: 'center' })
    ;(el as HTMLInputElement).focus({ preventScroll: true })
  }

  const openAdd = (type?: TransactionType) => {
    if (!hasStableIncome) { focusIncomeSetup(); return }
    setEditTarget(null); setPresetType(type); setModalOpen(true)
  }

  const openEdit = (tx: Transaction) => {
    setEditTarget(tx); setPresetType(undefined); setModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!await confirm({ message: t('tx.confirmDelete'), destructive: true })) return
    setDeleting(id)
    try {
      await transactionsApi.delete(id)
      setDetailTx(null)
      refetchAll()
      showSuccess(t('page.transactions.deletedToast'))
    } catch (err: unknown) {
      // A refused delete is a 4xx, and `client.ts` auto-toasts 5xx only — without this the dialog
      // just stayed open saying nothing, which reads as a mis-tap rather than a refusal.
      showError(extractErrorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <TileGrid>
        <div className={FULL}>
          <PageHeader
            title={t('page.home')}
            subtitle={t('page.dashboard.subtitle')}
            primary={{ label: t('action.add'), onClick: () => openAdd(undefined), icon: <Plus className="w-4 h-4" aria-hidden="true" /> }}
            overflow={[
              { label: t('page.dashboard.addIncome'), onClick: () => openAdd('INCOME'), icon: <TrendingUp className="w-4 h-4" aria-hidden="true" /> },
              { label: t('page.dashboard.addExpense'), onClick: () => openAdd('EXPENSE'), icon: <TrendingDown className="w-4 h-4" aria-hidden="true" /> },
            ]}
          />
        </div>

        {/* Above the tab strip, not inside a panel: the checklist is what a brand-new account has
            instead of figures, and a first-run user must not have to find the right tab to be
            told what to do first. It also keeps the tablist directly followed by its tabpanel. */}
        {showGetStarted && (
          <GetStartedHero
            span={12}
            currency={currency}
            walletCount={wallets.length}
            transactionCount={s?.transactionCount ?? 0}
            onStepDone={refetchAll}
            onAddExpense={() => { setEditTarget(null); setPresetType('EXPENSE'); setModalOpen(true) }}
          />
        )}

        <div className={FULL}>
          <Tabs
            tabs={TAB_IDS.map(id => ({ id, label: t(TAB_LABEL[id]) }))}
            active={activeTab}
            onChange={setTab}
          />
        </div>

        {/* `contents` keeps the panel a real element for assistive tech while letting the tiles
            inside it stay direct children of the one page grid. */}
        <div role="tabpanel" aria-label={t(TAB_LABEL[activeTab])} className="contents">
          {activeTab === 'summary' ? (
            <>
              {summary.loading ? (
                // Each placeholder is the tile it stands in for: same span, same padding, and —
                // because the hero also carries a wallet strip — a min height about the size of
                // the loaded hero, so the allocation panel below it does not jump on arrival.
                <>
                  <Tile span={4} mdSpan={6} padding="none" className="min-h-[15rem]">
                    <Skeleton variant="stat" bare className="p-6" />
                  </Tile>
                  <Tile span={4} mdSpan={3} padding="none">
                    <Skeleton variant="stat" bare className="p-5" />
                  </Tile>
                  <Tile span={4} mdSpan={3} padding="none">
                    <Skeleton variant="stat" bare className="p-5" />
                  </Tile>
                </>
              ) : summary.error && !s ? (
                // A failed fetch used to render as three "—" tiles, i.e. exactly like an empty
                // account. It says what went wrong now, and offers the retry.
                <ErrorTile
                  className={FULL}
                  message={summary.error}
                  onRetry={summary.refetch}
                />
              ) : (
                <>
                  {/* Stale but readable: the figures below came from an earlier answer, so they
                      stay and the strip carries the failure — the hook keeps the payload for
                      exactly this. */}
                  {summary.error && (
                    <ErrorTile
                      compact
                      className={FULL}
                      message={summary.error}
                      onRetry={summary.refetch}
                    />
                  )}

                  {/* Three cards, one row. Spendable keeps the hero figure and the wallet strip —
                      it is the number the page exists to answer — but it now shares the row with
                      the two totals instead of towering over them. */}
                  <StatTile
                    span={4} mdSpan={6} hero
                    label={t('page.dashboard.spendable')}
                    value={money(spendable, currency)}
                    caption={t('ui.exactValue', { value: moneyExact(spendable, currency) })}
                    icon={<Wallet className="w-4 h-4" aria-hidden="true" />}
                    onClick={() => navigate('/cards')}
                    onInfo={() => setInfo('spendable')}
                  >
                    <div className="space-y-3">
                      {wallets.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {wallets.slice(0, MAX_WALLET_CHIPS).map(w => (
                            <span key={w.key} className="inline-flex items-center gap-1.5 rounded-chip bg-slate-100 px-2 py-1 text-xs">
                              <span className="max-w-[8rem] truncate font-medium text-slate-900">{w.label}</span>
                              <span className="tabular-nums text-slate-600">{money(w.amount, currency)}</span>
                            </span>
                          ))}
                          {wallets.length > MAX_WALLET_CHIPS && (
                            <span className="inline-flex items-center rounded-chip bg-slate-100 px-2 py-1 text-xs tabular-nums text-slate-600">
                              {t('page.dashboard.walletsMore', { count: wallets.length - MAX_WALLET_CHIPS })}
                            </span>
                          )}
                        </div>
                      ) : walletsKnown && !walletsError ? (
                        <p className="text-sm text-slate-500">{t('page.dashboard.noWalletsYet')}</p>
                      ) : null}

                      {/* The one tile that sends the reader to Wallets must not deny the wallets
                          exist. Shown alongside stale chips too, so "these are yesterday's
                          balances" is stated rather than left to be discovered.
                          The whole hero is clickable, so — exactly as InfoDot does — the retry has
                          to stop its click here or retrying would also navigate away to /cards. */}
                      {walletsError && (
                        <div onClick={e => e.stopPropagation()}>
                          <ErrorTile compact message={walletsError} onRetry={refetchWallets} />
                        </div>
                      )}

                      <CacheBadge isCached={summary.isCached} cachedAt={summary.cachedAt} />
                    </div>
                  </StatTile>

                  <StatTile
                    span={4} mdSpan={3} tone="in"
                    label={t('page.dashboard.totalIncome')}
                    value={money(s?.totalIncome ?? 0, currency)}
                    caption={`${t('ui.scope.allTime')} · ${moneyExact(s?.totalIncome ?? 0, currency)}`}
                    icon={<TrendingUp className="w-4 h-4" aria-hidden="true" />}
                    onClick={() => navigate('/transactions?type=INCOME')}
                    onInfo={() => setInfo('income')}
                  />

                  <StatTile
                    span={4} mdSpan={3} tone="out"
                    label={t('page.dashboard.totalExpenses')}
                    value={money(s?.totalExpense ?? 0, currency)}
                    caption={`${t('ui.scope.allTime')} · ${moneyExact(s?.totalExpense ?? 0, currency)}`}
                    icon={<TrendingDown className="w-4 h-4" aria-hidden="true" />}
                    onClick={() => navigate('/transactions?type=EXPENSE')}
                    onInfo={() => setInfo('expenses')}
                  />
                </>
              )}

              <AllocationPanel
                span={12}
                month={thisMonth}
                currency={currency}
                tier={tier}
                envelope={envelope}
                onWrote={refetchPage}
                onSetUpIncome={focusIncomeSetup}
              />
            </>
          ) : (
            <>
              {monthly.loading ? (
                // The same three boxes the totals will occupy, so the chart below them does not
                // move when the year arrives.
                <>
                  <Tile span={4} padding="none">
                    <Skeleton variant="stat" bare className="p-5" />
                  </Tile>
                  <Tile span={4} padding="none">
                    <Skeleton variant="stat" bare className="p-5" />
                  </Tile>
                  <Tile span={4} padding="none">
                    <Skeleton variant="stat" bare className="p-5" />
                  </Tile>
                </>
              ) : chartedTotals ? (
                // With nothing recorded this year there is no row: three zeroes would be a claim
                // about the year, and the chart's own empty state already says it plainly.
                <>
                  <StatTile
                    span={4} tone="in"
                    label={t('tx.income')}
                    value={money(chartedTotals.income, currency)}
                    caption={chartedCaption(chartedTotals.income)}
                    icon={<TrendingUp className="w-4 h-4" aria-hidden="true" />}
                  />
                  <StatTile
                    span={4} tone="out"
                    label={t('tx.expense')}
                    value={money(chartedTotals.expense, currency)}
                    caption={chartedCaption(chartedTotals.expense)}
                    icon={<TrendingDown className="w-4 h-4" aria-hidden="true" />}
                  />
                  <StatTile
                    span={4} tone={chartedTotals.net < 0 ? 'out' : 'in'}
                    label={t('page.home.difference')}
                    value={money(chartedTotals.net, currency)}
                    caption={chartedCaption(chartedTotals.net)}
                    icon={<Scale className="w-4 h-4" aria-hidden="true" />}
                  />
                </>
              ) : null}

              <IncomeExpenseChart
                span={12}
                data={chartData}
                loading={monthly.loading}
                refreshing={monthly.refreshing}
                error={monthly.error}
                onRetry={monthly.refetch}
                currency={currency}
                isCached={monthly.isCached}
                cachedAt={monthly.cachedAt}
                onAdd={() => openAdd(undefined)}
              />

              <RecentTransactions
                span={12}
                transactions={recent.data?.content ?? []}
                loading={recent.loading}
                refreshing={recent.refreshing}
                error={recent.error}
                onRetry={recent.refetch}
                isCached={recent.isCached}
                cachedAt={recent.cachedAt}
                onTransactionClick={setDetailTx}
              />
            </>
          )}
        </div>
      </TileGrid>

      {/* "What is this number?" popup for whichever tile's ⓘ was clicked */}
      {info && (
        <CardInfoModal
          open onClose={() => setInfo(null)} kind={info} currency={currency}
          total={info === 'spendable' ? (s ? spendable : null)
               : info === 'income'   ? (s ? s.totalIncome : null)
               :                       (s ? s.totalExpense : null)}
        />
      )}

      <TransactionDetailModal
        transaction={detailTx} open={!!detailTx}
        onClose={() => setDetailTx(null)}
        onEdit={tx => { setDetailTx(null); openEdit(tx) }}
        onDelete={handleDelete} deleting={deleting === detailTx?.id}
      />

      <TransactionModal
        open={modalOpen} onClose={() => { setModalOpen(false); setEditTarget(null) }}
        onSaved={refetchAll} defaultCurrency={currency}
        transaction={editTarget}
        presetType={presetType}
      />
    </div>
  )
}
