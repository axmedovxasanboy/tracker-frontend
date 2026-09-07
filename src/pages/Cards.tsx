import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownRight, ArrowLeftRight, ArrowUpRight, CreditCard, Eye, EyeOff, Info,
  Pencil, Plus, Trash2, Wallet,
} from 'lucide-react'
import { Sheet } from '../components/ui/Sheet'
import { PageHeader, OverflowMenu } from '../components/ui/PageHeader'
import type { OverflowAction } from '../components/ui/PageHeader'
import { Tile, TileGrid } from '../components/ui/Tile'
import { StatTile } from '../components/ui/StatTile'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { ListRow } from '../components/ui/ListRow'
import { ErrorTile } from '../components/ui/ErrorTile'
import { CacheBadge } from '../components/ui/CacheBadge'
import { IncomeRequiredNotice } from '../components/ui/IncomeRequiredNotice'
import { Skeleton } from '../components/ui/Skeleton'
import { InfoDot } from '../components/ui/InfoDot'
import { ExplainModal } from '../components/ui/ExplainModal'
import { AmountInput } from '../components/ui/AmountInput'
import { BalanceTransferModal } from '../components/transactions/BalanceTransferModal'
import { TransactionDetailModal } from '../components/transactions/TransactionDetailModal'
import { TransactionModal } from '../components/transactions/TransactionModal'
import { useApi } from '../hooks/useApi'
import { useRadioGroupKeys } from '../hooks/useRadioGroupKeys'
import { useLang } from '../i18n/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useSettings } from '../context/SettingsContext'
import { cardsApi } from '../api/cards'
import { transactionsApi } from '../api/transactions'
import { cashBalancesApi } from '../api/cashBalances'
import { extractErrorMessage } from '../api/client'
import { formatDate, money, moneyExact, moneyFull, plural } from '../utils/format'
import type {
  CardRequest, CardResponse, CardType, CashBalanceResponse, PageResponse, Transaction, TransactionFilters,
} from '../types'

/**
 * The network worn on the card face. Neutral on the user's colour rather than each brand's own
 * hue — the surface behind it is a colour the owner picked, and two palettes on one card fight.
 * CASH is legacy: the form has not offered it since cash became a pot of its own.
 */
const CARD_NETWORK_LABEL: Record<CardType, string> = {
  UZCARD: 'Uzcard',
  HUMO: 'Humo',
  VISA: 'VISA',
  CASH: 'Cash',
}

/** The networks a new card may be created as. */
const CARD_NETWORKS: CardType[] = ['UZCARD', 'HUMO', 'VISA']

const CARD_COLORS = [
  '#0f172a', '#1e40af', '#6366f1', '#7c3aed',
  '#0891b2', '#0d9488', '#059669', '#d97706',
  '#dc2626', '#be185d',
]

const defaultForm: CardRequest = {
  name: '',
  bankName: '',
  type: 'UZCARD',
  lastFourDigits: '',
  initialBalance: 0,
  currency: 'UZS',
  color: '#0f172a',
}

/** The submit button lives in the sheet's sticky footer, outside the <form> it submits. */
const CARD_FORM_ID = 'wallet-card-form'
const CASH_FORM_ID = 'wallet-cash-form'
const REVEAL_FORM_ID = 'wallet-reveal-form'

// ────────────────────────────────────────────────────────────────────────────────
// One card, as a tile in the page grid
// ────────────────────────────────────────────────────────────────────────────────

function CardTile({ card, onOpen, onTopUp, onReveal, onExplain, onEdit, onDelete }: {
  card: CardResponse
  onOpen: () => void
  onTopUp: () => void
  onReveal: () => void
  onExplain: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useLang()
  const balance = card.currentBalance ?? 0

  const actions: OverflowAction[] = [
    ...(card.hasFullNumber && card.hasPin
      ? [{ label: t('page.cards.revealNumberTitle'), icon: <Eye className="h-4 w-4" />, onClick: onReveal }]
      : []),
    { label: t('cmp.cardInfo.button', { title: t('page.cards.balanceLabel') }), icon: <Info className="h-4 w-4" />, onClick: onExplain },
    { label: t('action.edit'), icon: <Pencil className="h-4 w-4" />, onClick: onEdit },
    { label: t('action.delete'), icon: <Trash2 className="h-4 w-4" />, onClick: onDelete, danger: true },
  ]

  return (
    <Tile span={4} padding="none" onClick={onOpen} className="flex h-full flex-col">
      {/* The card as an object. Flat fill, no 135° gradient and no decorative circles: they were
          the only ornament in the app and they made the one figure that matters hardest to read. */}
      <div className="select-none rounded-t-tile px-5 py-4 text-white" style={{ backgroundColor: card.color }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* New cards no longer ask for a bank name (it mirrors the nickname); older cards
                that carry a real one still show it. */}
            {card.bankName && card.bankName !== card.name && (
              <p className="truncate text-[11px] font-semibold uppercase tracking-widest text-white/70">
                {card.bankName}
              </p>
            )}
            <p className="truncate font-semibold">{card.name}</p>
          </div>
          <span className={`shrink-0 rounded-chip bg-white/20 px-2 py-1 text-xs font-semibold ${
            card.type === 'VISA' ? 'italic' : ''
          }`}>
            {CARD_NETWORK_LABEL[card.type]}
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="font-mono text-sm tracking-widest text-white/80">•••• {card.lastFourDigits}</p>
          <CreditCard className="h-5 w-5 shrink-0 text-white/40" />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-label uppercase text-slate-500">{t('page.cards.balanceLabel')}</p>
        <p className="mt-2 text-stat tabular-nums text-slate-900">{money(balance, card.currency)}</p>
        <p className="mt-1 text-sm tabular-nums text-slate-600">
          {t('ui.exactValue', { value: moneyExact(balance, card.currency) })}
        </p>

        {/* Always painted. The row this replaces was `sm:opacity-0 sm:group-hover:opacity-100` —
            a viewport query, so on a touch tablet these actions did not exist at all. */}
        <div className="mt-auto flex items-center gap-2 pt-4" onClick={e => e.stopPropagation()}>
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            label={t('page.cards.topUp')}
            onClick={onTopUp}
            className="flex-1"
          />
          <OverflowMenu actions={actions} className="shrink-0" />
        </div>
      </div>
    </Tile>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// The per-wallet transaction sheet
// ────────────────────────────────────────────────────────────────────────────────

/** The shape `useApi` hands back for a page of transactions. */
interface TxQuery {
  data: PageResponse<Transaction> | null
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * One list for both wallet kinds. The only thing that differs between a card and the cash pot is
 * which slice of a split payment the wallet actually moved, so that arrives as `portionOf`.
 */
function WalletTxSheet({ open, onClose, title, subtitle, emptyText, query, page, onPage, portionOf, onSelect }: {
  open: boolean
  onClose: () => void
  title: string
  subtitle: string
  emptyText: string
  query: TxQuery
  page: number
  onPage: (next: number) => void
  /** The amount that moved on THIS wallet — never the whole transaction when it was split. */
  portionOf: (tx: Transaction) => number
  onSelect: (tx: Transaction) => void
}) {
  const { t, lang, categoryName } = useLang()
  const data = query.data
  const rows = data?.content ?? []
  const totalPages = data?.totalPages ?? 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-2xl"
      footer={totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm tabular-nums text-slate-500">
            {t('page.pagination.pageOf', { page: (data?.page ?? 0) + 1, total: totalPages })}
          </p>
          <div className="flex gap-2">
            <Button size="sm" label={t('page.pagination.prev')} disabled={page === 0} onClick={() => onPage(page - 1)} />
            <Button size="sm" label={t('page.pagination.next')} disabled={data?.last ?? true} onClick={() => onPage(page + 1)} />
          </div>
        </div>
      ) : undefined}
    >
      <p className="-mt-2 mb-4 text-sm text-slate-600">{subtitle}</p>

      {query.loading ? (
        <Skeleton variant="row" count={4} bare />
      ) : query.error && !data ? (
        <ErrorTile message={query.error} onRetry={query.refetch} />
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">{emptyText}</p>
      ) : (
        <>
          {query.error && <ErrorTile compact message={query.error} onRetry={query.refetch} className="mb-3" />}
          {/* Bled to the sheet's edges and framed once, rather than as a stack of floating cards. */}
          <div className={`-mx-5 divide-y divide-hairline border-y border-hairline sm:-mx-7 ${
            query.refreshing ? 'opacity-60 transition-opacity' : ''
          }`}>
            {rows.map(tx => {
              const portion = portionOf(tx)
              const isIncome = tx.type === 'INCOME'
              // A payment is split when both wallets moved; the row then shows only its own half.
              const isSplit = (tx.cashAmount ?? 0) > 0 && (tx.cardAmount ?? 0) > 0
              return (
                <ListRow
                  key={tx.id}
                  onClick={() => onSelect(tx)}
                  leading={
                    <div className={`flex h-9 w-9 items-center justify-center rounded-chip ${
                      isIncome ? 'bg-emerald-100 text-income' : 'bg-rose-100 text-expense'
                    }`}>
                      {isIncome ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                  }
                  title={tx.description}
                  badges={isSplit ? (
                    <span className="rounded-chip bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      {t('page.shared.splitBadge')}
                    </span>
                  ) : undefined}
                  subtitle={`${tx.category ? categoryName(tx.category) : '—'} · ${formatDate(tx.transactionDate, lang)}`}
                  amount={`${isIncome ? '+' : '-'}${moneyFull(portion, tx.currency)}`}
                  amountTone={isIncome ? 'in' : 'out'}
                />
              )
            })}
          </div>
        </>
      )}
    </Sheet>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Wallets
// ────────────────────────────────────────────────────────────────────────────────

export function Cards() {
  const { t, lang } = useLang()
  const { showSuccess } = useToast()
  const confirm = useConfirm()
  // `ready` first: until the settings row lands `hasStableIncome` is false for an account that
  // has had an income for months, which is what made every Top up flash disabled on a reload
  // with a reason that was not true.
  const { hasStableIncome, ready: settingsReady, error: settingsError } = useSettings()
  // A failed settings read is not an answer about the income (see SettingsContext.error), so it
  // must not gate anything: the server still refuses the transfer if the income really is unset.
  const incomeGated = settingsReady && !settingsError && !hasStableIncome
  const navigate = useNavigate()

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CardResponse | null>(null)
  const [form, setForm] = useState<CardRequest>(defaultForm)
  const [formDirty, setFormDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [revealModal, setRevealModal] = useState<CardResponse | null>(null)
  const [pin, setPin] = useState('')
  const [revealedNumber, setRevealedNumber] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [revealError, setRevealError] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferToCard, setTransferToCard] = useState<CardResponse | null>(null)
  const [txCard, setTxCard] = useState<CardResponse | null>(null) // card whose transactions are shown
  const [txPage, setTxPage] = useState(0)
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [deletingTx, setDeletingTx] = useState(false)

  // Cash transactions view — mirrors the per-card view but for the cash pot.
  const [txCash, setTxCash] = useState<CashBalanceResponse | null>(null)
  const [txCashPage, setTxCashPage] = useState(0)

  const TX_FILTERS: TransactionFilters = {
    page: txPage, size: 10, sortBy: 'transactionDate', sortDir: 'desc',
    cardId: txCard?.id ?? '', type: '', currency: '', categoryId: '', search: '',
  }
  const cardTxs = useApi(
    () => txCard ? transactionsApi.getAll(TX_FILTERS) : Promise.resolve({ data: null } as never),
    [txCard?.id, txPage],
  )

  const CASH_TX_FILTERS: TransactionFilters = {
    page: txCashPage, size: 10, sortBy: 'transactionDate', sortDir: 'desc',
    currency: txCash?.currency ?? '', cardId: '', type: '', categoryId: '', search: '',
    cashOnly: true,
  }
  const cashTxs = useApi(
    () => txCash ? transactionsApi.getAll(CASH_TX_FILTERS) : Promise.resolve({ data: null } as never),
    [txCash?.currency, txCashPage],
  )

  const cards = useApi(() => cardsApi.getAll(), [])
  const cashBalances = useApi(() => cashBalancesApi.getAll(), [])

  /**
   * Every figure on this page moves together: a transfer, a transaction edit or a delete changes
   * a card AND the cash pot at the same time. Refetching one and not the other is what left the
   * cash tile stale after a transfer.
   */
  const refetchWallets = () => {
    cards.refetch()
    cashBalances.refetch()
    // No-ops while their panel is closed — the fetcher resolves null without a request.
    cardTxs.refetch()
    cashTxs.refetch()
  }

  // Inline cash editor. UZS-only: there is one pot and it cannot change currency.
  const [cashEdit, setCashEdit] = useState<{ initialBalance: number } | null>(null)
  const [cashDirty, setCashDirty] = useState(false)
  const [savingCash, setSavingCash] = useState(false)
  const [cashError, setCashError] = useState<string | null>(null)

  const openCashEdit = (b?: CashBalanceResponse | null) => {
    setCashEdit({ initialBalance: b?.initialBalance ?? 0 })
    setCashDirty(false)
    setCashError(null)
  }
  const saveCash = async () => {
    if (!cashEdit) return
    setSavingCash(true); setCashError(null)
    try {
      await cashBalancesApi.upsert({ currency: 'UZS', initialBalance: cashEdit.initialBalance })
      cashBalances.refetch()
      setCashEdit(null)
      showSuccess(t('page.cards.cashSavedToast'))
    } catch (err) {
      setCashError(extractErrorMessage(err))
    } finally {
      setSavingCash(false)
    }
  }

  const cardList = cards.data ?? []
  /**
   * UZS only, on both sides. `TransactionService.computeAvailableBalance` sums exactly these two
   * things for the Spendable figure Home sends the user here to reconcile against, and it skips
   * anything not in the reporting currency — so a legacy foreign row must be skipped here too or
   * this hero would claim a total the rest of the app does not agree with.
   */
  const cashPot = (cashBalances.data ?? []).find(b => b.currency === 'UZS') ?? null
  const cardsTotal = cardList.reduce((sum, c) => c.currency === 'UZS' ? sum + (c.currentBalance ?? 0) : sum, 0)
  const cashTotal = cashPot?.currentBalance ?? 0
  const held = cardsTotal + cashTotal
  const walletCount = cardList.length + (cashPot ? 1 : 0)

  // Shares of the proportion bar. Negative balances cannot be drawn as a width, so the bar is
  // built from magnitudes and simply disappears when there is nothing to hold.
  const barBase = Math.abs(cardsTotal) + Math.abs(cashTotal)
  const cardsShare = barBase > 0 ? (Math.abs(cardsTotal) / barBase) * 100 : 0
  const cashShare = barBase > 0 ? (Math.abs(cashTotal) / barBase) * 100 : 0

  const walletsLoading = cards.loading || cashBalances.loading
  const walletsError = cards.error ?? cashBalances.error
  const walletsRefreshing = cards.refreshing || cashBalances.refreshing

  const openNew = () => {
    setEditTarget(null); setForm(defaultForm); setFormDirty(false); setError(null); setModalOpen(true)
  }
  const openEdit = (c: CardResponse) => {
    setEditTarget(c)
    setForm({ name: c.name, bankName: c.bankName, type: c.type, lastFourDigits: c.lastFourDigits, initialBalance: c.initialBalance, currency: c.currency, color: c.color })
    setFormDirty(false)
    setError(null)
    setModalOpen(true)
  }

  /**
   * Transfers are refused by the server until a monthly income is set
   * (`TransactionService.transferBalance` → `assertStableIncomeSet`), and the refusal used to
   * arrive as untranslated English after the whole form had been filled in.
   *
   * Same answer as Home and Transactions give: the button stays live and takes the user to the
   * field that unblocks it. A toast that only says no is one more thing to dismiss.
   */
  const openTransfer = (toCard: CardResponse | null) => {
    // `incomeGated`, not `!hasStableIncome`: while the settings row is still in flight the button
    // above is deliberately live, and refusing here would hand the user the same untrue reason
    // the disabled flash used to. If the income really is unset the server still refuses.
    if (incomeGated) { navigate('/'); return }
    setTransferToCard(toCard)
    setTransferOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      // bankName is @NotBlank in the DTO and NOT NULL in the schema, but is no longer
      // asked for: fall back to the nickname so new cards satisfy it, while an edited
      // card keeps whatever bank name it was originally created with.
      const payload: CardRequest = { ...form, bankName: (form.bankName || form.name).trim() }
      if (editTarget) { await cardsApi.update(editTarget.id, payload) }
      else { await cardsApi.create(payload) }
      setModalOpen(false)
      setFormDirty(false)
      refetchWallets()
      showSuccess(editTarget ? t('page.cards.updatedToast') : t('page.cards.createdToast'))
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const handleDelete = async (card: CardResponse) => {
    if (deleting !== null) return
    const ok = await confirm({
      title: t('page.cards.deleteCardTitle'),
      message: t('page.cards.deleteCardMessage'),
      destructive: true,
    })
    if (!ok) return
    setDeleting(card.id)
    try {
      await cardsApi.delete(card.id)
      if (txCard?.id === card.id) setTxCard(null)
      refetchWallets()
      showSuccess(t('page.cards.deletedToast'))
    }
    finally { setDeleting(null) }
  }

  const openReveal = (c: CardResponse) => {
    setRevealModal(c); setPin(''); setRevealedNumber(null); setRevealError(null)
  }

  const handleReveal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!revealModal) return
    setRevealing(true); setRevealError(null)
    try {
      const res = await cardsApi.revealFullNumber(revealModal.id, pin)
      setRevealedNumber(res.data.fullNumber)
    } catch (err: unknown) {
      setRevealError(extractErrorMessage(err))
    } finally { setRevealing(false) }
  }

  const set = <K extends keyof CardRequest>(k: K, v: CardRequest[K]) => {
    setFormDirty(true)
    setForm(p => ({ ...p, [k]: v }))
  }

  // A role="radiogroup" promises forms-mode arrow navigation: one tab stop for the group, arrows
  // to move and pick. Without these the arrows did nothing and each swatch was its own stop.
  const networkKeys = useRadioGroupKeys(CARD_NETWORKS, form.type, v => set('type', v))
  const colourKeys = useRadioGroupKeys(CARD_COLORS, form.color, v => set('color', v))

  // Which wallet explanation is open. One per KIND, not per wallet — the arithmetic is the
  // same for every card, so a popup on each of them would be the same text many times over.
  const [info, setInfo] = useState<'card' | 'cash' | 'total' | null>(null)

  return (
    // No `space-y-*` here: a Sheet renders in place as `fixed inset-0`, and the sibling margin
    // that utility applies would push the whole dialog 20px down the screen.
    <div className="p-4 sm:p-6">
      <PageHeader
        title={t('page.wallets')}
        subtitle={walletCount > 0
          ? plural(walletCount, t('page.cards.accountsCountOne'), t('page.cards.accountsCount'), lang)
          : undefined}
        primary={{ label: t('page.cards.addCard'), onClick: openNew, icon: <Plus className="h-4 w-4" /> }}
        overflow={[
          { label: t('action.transfer'), icon: <ArrowLeftRight className="h-4 w-4" />, onClick: () => openTransfer(null) },
        ]}
      />

      <TileGrid className={`mt-5 ${walletsRefreshing ? 'opacity-60 transition-opacity' : ''}`}>
        {/* The same notice Transactions shows, in the same words: the gate is one feature. */}
        <IncomeRequiredNotice className="md:col-span-6 xl:col-span-12" />

        {walletsLoading ? (
          <>
            <Tile span={6} rows={2} padding="none"><Skeleton variant="stat" bare className="p-6" /></Tile>
            <Tile span={6} rows={2} padding="none"><Skeleton variant="stat" bare className="p-5" /></Tile>
          </>
        ) : walletsError && !cards.data && !cashBalances.data ? (
          // ErrorTile draws its own surface, so it takes the grid span itself rather than being
          // nested in a Tile — two white boxes with two borders would read as a framing mistake.
          <ErrorTile message={walletsError} onRetry={refetchWallets} className="md:col-span-6 xl:col-span-12" />
        ) : (
          <>
            {walletsError && (
              <ErrorTile compact message={walletsError} onRetry={refetchWallets} className="md:col-span-6 xl:col-span-12" />
            )}

            {/* The one number this page exists for: what Home's Spendable card promises when it
                sends the user here. It did not exist anywhere on the page before. */}
            <StatTile
              hero
              span={6}
              rows={2}
              label={t('page.cards.everythingYouHold')}
              value={money(held)}
              caption={t('ui.exactValue', { value: moneyExact(held) })}
              icon={<Wallet className="h-4 w-4" />}
              onInfo={() => setInfo('total')}
            >
              <div className="space-y-3">
                <div className="flex h-2 overflow-hidden rounded-chip bg-slate-100" aria-hidden="true">
                  <div className="bg-slate-800" style={{ width: `${cardsShare}%` }} />
                  <div className="bg-amber-400" style={{ width: `${cashShare}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-slate-800" aria-hidden="true" />
                    {t('page.cards.cardsLabel')}
                    <span className="font-semibold tabular-nums text-slate-900">{moneyFull(cardsTotal)}</span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                    {t('page.cards.cashLabel')}
                    <span className="font-semibold tabular-nums text-slate-900">{moneyFull(cashTotal)}</span>
                  </span>
                </div>
                {/* Cached figures are pixel-identical to live ones; only this says which. */}
                <CacheBadge
                  isCached={cards.isCached || cashBalances.isCached}
                  cachedAt={cards.cachedAt ?? cashBalances.cachedAt}
                />
              </div>
            </StatTile>

            {/* Cash sits in the same grid as the cards, on the same white surface. It used to be a
                separate band of amber tiles — the only yellow surfaces in the app. */}
            <Tile span={6} rows={2} className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <p className="text-label uppercase text-slate-500">{t('page.cards.cashLabel')}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-chip bg-amber-100 text-amber-600">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <InfoDot
                    label={t('cmp.cardInfo.button', { title: t('page.cards.cashLabel') })}
                    onClick={() => setInfo('cash')}
                    className="p-3 -m-3"
                  />
                </div>
              </div>

              <p className="mt-3 text-stat tabular-nums text-slate-900">{money(cashTotal)}</p>

              {cashPot ? (
                <p className="mt-2 text-sm tabular-nums text-slate-600">
                  {t('ui.exactValue', { value: moneyExact(cashTotal) })}
                  {' · '}
                  {t('page.cards.startingAmount', { amount: moneyFull(cashPot.initialBalance) })}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-600">{t('page.cards.cashBalancesEmptyHint')}</p>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                {cashPot && (
                  <Button
                    size="sm"
                    icon={<Wallet className="h-4 w-4" />}
                    label={t('page.cards.viewTransactions')}
                    onClick={() => { setTxCash(cashPot); setTxCashPage(0); setTxCard(null) }}
                  />
                )}
                <Button
                  size="sm"
                  icon={cashPot ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  label={cashPot ? t('page.cards.updateCash') : t('page.cards.addCashBalance')}
                  onClick={() => openCashEdit(cashPot)}
                />
              </div>
            </Tile>

            {cardList.length === 0 ? (
              <Tile span={12} className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-chip bg-slate-100 text-slate-500">
                  <Wallet className="h-6 w-6" />
                </div>
                <p className="text-sm text-slate-600">{t('page.cards.noCardsYet')}</p>
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} label={t('page.cards.addCard')} onClick={openNew} />
              </Tile>
            ) : (
              cardList.map(card => (
                <CardTile
                  key={card.id}
                  card={card}
                  onOpen={() => { setTxCard(card); setTxPage(0); setTxCash(null) }}
                  onTopUp={() => openTransfer(card)}
                  onReveal={() => openReveal(card)}
                  onExplain={() => setInfo('card')}
                  onEdit={() => openEdit(card)}
                  onDelete={() => handleDelete(card)}
                />
              ))
            )}
          </>
        )}
      </TileGrid>

      {info && (
        <ExplainModal
          open onClose={() => setInfo(null)}
          title={t(`cmp.walletInfo.${info}.title`)}
          meaning={t(`cmp.walletInfo.${info}.meaning`)}
          formula={t(`cmp.walletInfo.${info}.formula`)}
          note={t(`cmp.walletInfo.${info}.note`)}
          rows={info === 'total' ? [
            { label: t('page.cards.cardsLabel'), value: moneyFull(cardsTotal) },
            { label: t('page.cards.cashLabel'), value: moneyFull(cashTotal) },
            { label: t('page.cards.everythingYouHold'), value: moneyFull(held), strong: true },
          ] : undefined}
        />
      )}

      {/* Add / edit card */}
      <Sheet
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? t('page.cards.editCardTitle') : t('page.cards.newCardTitle')}
        dirty={formDirty && !saving}
        footer={
          <div className="flex gap-3">
            <Button label={t('action.cancel')} onClick={() => setModalOpen(false)} className="flex-1" />
            <Button
              variant="primary"
              type="submit"
              form={CARD_FORM_ID}
              loading={saving}
              label={saving ? t('action.saving') : editTarget ? t('action.update') : t('action.create')}
              className="flex-1"
            />
          </div>
        }
      >
        <form id={CARD_FORM_ID} onSubmit={handleSave} className="space-y-4">
          {/* Card network — cash is no longer a card; it is the pot on the page behind this. */}
          <div>
            <p id="card-network-label" className="mb-1 text-xs font-medium text-slate-600">
              {t('page.cards.cardNetworkLabel')}
              <span aria-hidden="true" className="text-expense"> *</span>
            </p>
            <div role="radiogroup" aria-labelledby="card-network-label" className="flex gap-1 rounded-control bg-slate-100 p-1">
              {CARD_NETWORKS.map((net, i) => (
                <button
                  key={net}
                  type="button"
                  role="radio"
                  aria-checked={form.type === net}
                  {...networkKeys(i)}
                  onClick={() => set('type', net)}
                  className={`focus-ring min-h-[44px] flex-1 rounded-chip text-xs font-semibold transition-colors focus-visible:ring-offset-slate-100 ${
                    form.type === net ? 'bg-white text-indigo-600 shadow-tile' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {CARD_NETWORK_LABEL[net]}
                </button>
              ))}
            </div>
          </div>

          <Field id="card-name" label={t('page.cards.nicknameLabel')} required>
            <input
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="focus-ring h-11 w-full rounded-control border border-slate-200 px-3 text-sm"
              placeholder={t('page.cards.nicknamePlaceholder')}
            />
          </Field>

          <Field id="card-last4" label={t('page.cards.last4Label')} required>
            <input
              required
              maxLength={4}
              pattern="\d{4}"
              inputMode="numeric"
              value={form.lastFourDigits}
              onChange={e => set('lastFourDigits', e.target.value)}
              className="focus-ring h-11 w-full rounded-control border border-slate-200 px-3 text-sm tabular-nums"
              placeholder="4521"
            />
          </Field>

          <Field id="card-initial" label={t('page.cards.initialBalanceLabel')} required>
            <AmountInput
              required
              value={form.initialBalance}
              currency={form.currency}
              onChange={v => set('initialBalance', v)}
              className="focus-ring h-11 w-full rounded-control border border-slate-200 px-3 text-sm"
              placeholder="0"
              suffix={form.currency}
            />
          </Field>

          <div>
            <p id="card-colour-label" className="mb-2 text-xs font-medium text-slate-600">{t('page.cards.cardColorLabel')}</p>
            <div role="radiogroup" aria-labelledby="card-colour-label" className="flex flex-wrap gap-2">
              {/* The dot stays 36px so the strip still reads as swatches; the pseudo-element
                  carries the 44px touch target, exactly as Button's `sm` size does. */}
              {CARD_COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={form.color === c}
                  aria-label={t('page.cards.colorOption', { n: i + 1 })}
                  {...colourKeys(i)}
                  onClick={() => set('color', c)}
                  className={`focus-ring relative h-9 w-9 rounded-full transition-transform after:absolute after:-inset-1 after:content-[''] ${
                    form.color === c ? 'ring-2 ring-slate-500 ring-offset-2' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Plain text, the way Field renders its own errors — a tinted panel here would be the
              only tinted surface left on the page. */}
          {error && <p role="alert" className="text-sm text-expense">{error}</p>}
        </form>
      </Sheet>

      {/* Reveal the full card number */}
      <Sheet
        open={!!revealModal}
        onClose={() => { setRevealModal(null); setRevealedNumber(null) }}
        title={t('page.cards.revealModalTitle')}
        maxWidth="max-w-md"
        footer={!revealedNumber ? (
          <Button
            variant="primary"
            type="submit"
            form={REVEAL_FORM_ID}
            loading={revealing}
            disabled={!pin}
            icon={<Eye className="h-4 w-4" />}
            label={revealing ? t('page.cards.verifying') : t('page.cards.revealButton')}
            className="w-full"
          />
        ) : undefined}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t('page.cards.revealPromptPre')} <strong className="text-slate-900">{revealModal?.name}</strong>.
          </p>
          {!revealedNumber ? (
            <form id={REVEAL_FORM_ID} onSubmit={handleReveal}>
              <Field id="reveal-pin" label={t('page.cards.revealPinLabel')} error={revealError ?? undefined}>
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  className="focus-ring h-11 w-full rounded-control border border-slate-200 px-3 text-center text-sm tracking-widest"
                  placeholder={t('page.cards.enterPinPlaceholder')}
                  autoFocus
                />
              </Field>
            </form>
          ) : (
            <div className="space-y-3 text-center">
              <p className="rounded-control border border-slate-200 bg-slate-50 py-3 font-mono text-xl tracking-widest tabular-nums text-slate-900">
                {revealedNumber.replace(/(.{4})/g, '$1 ').trim()}
              </p>
              <Button
                variant="ghost"
                icon={<EyeOff className="h-4 w-4" />}
                label={t('page.cards.hideButton')}
                onClick={() => setRevealedNumber(null)}
                className="mx-auto"
              />
            </div>
          )}
        </div>
      </Sheet>

      <BalanceTransferModal
        open={transferOpen}
        onClose={() => { setTransferOpen(false); setTransferToCard(null) }}
        onSaved={() => { refetchWallets(); setTransferOpen(false); setTransferToCard(null) }}
        preselectedToCardId={transferToCard?.id}
      />

      {/* Card transactions — the CARD PORTION per row, so a split payment contributes only the
          amount that actually moved on this card. The sheet stays mounted but closed while a
          detail/edit dialog sits on top, so only one dialog is ever on screen and closing the
          child returns you to the list. */}
      {txCard && (
        <WalletTxSheet
          open={!detailTx && !editTx}
          onClose={() => setTxCard(null)}
          title={`${txCard.name} •••• ${txCard.lastFourDigits}`}
          subtitle={t('page.cards.cardTxSubtitle', { currency: txCard.currency })}
          emptyText={t('page.cards.noCardTx')}
          query={cardTxs}
          page={txPage}
          onPage={setTxPage}
          portionOf={tx => tx.cardAmount ?? (tx.amount - (tx.cashAmount ?? 0))}
          onSelect={setDetailTx}
        />
      )}

      {/* Cash transactions — pure-cash rows and the cash half of split payments. */}
      {txCash && (
        <WalletTxSheet
          open={!detailTx && !editTx}
          onClose={() => setTxCash(null)}
          title={t('page.cards.cashLabel')}
          subtitle={t('page.cards.cashTxSubtitle', { balance: moneyFull(txCash.currentBalance, txCash.currency) })}
          emptyText={t('page.cards.noCashTx', { currency: txCash.currency })}
          query={cashTxs}
          page={txCashPage}
          onPage={setTxCashPage}
          portionOf={tx => tx.cashAmount ?? 0}
          onSelect={setDetailTx}
        />
      )}

      <TransactionDetailModal
        transaction={detailTx} open={!!detailTx}
        onClose={() => setDetailTx(null)}
        onEdit={(tx) => { setDetailTx(null); setEditTx(tx) }}
        onDelete={async (id) => {
          if (!await confirm({ message: t('tx.confirmDelete'), destructive: true })) return
          setDeletingTx(true)
          try { await transactionsApi.delete(id); setDetailTx(null); refetchWallets() }
          finally { setDeletingTx(false) }
        }}
        deleting={deletingTx}
      />
      <TransactionModal
        open={!!editTx} onClose={() => setEditTx(null)}
        onSaved={() => { setEditTx(null); refetchWallets() }}
        transaction={editTx} defaultCurrency={txCard?.currency ?? 'UZS'}
      />

      {/* Cash pot — one pot, always UZS. */}
      <Sheet
        open={!!cashEdit}
        onClose={() => setCashEdit(null)}
        title={t('page.cards.cashModalTitle')}
        maxWidth="max-w-md"
        dirty={cashDirty && !savingCash}
        footer={
          <div className="flex gap-3">
            <Button label={t('action.cancel')} onClick={() => setCashEdit(null)} className="flex-1" />
            <Button
              variant="primary"
              type="submit"
              form={CASH_FORM_ID}
              loading={savingCash}
              label={savingCash ? t('action.saving') : t('action.save')}
              className="flex-1"
            />
          </div>
        }
      >
        {cashEdit && (
          <form id={CASH_FORM_ID} onSubmit={e => { e.preventDefault(); saveCash() }} className="space-y-4">
            <Field
              id="cash-initial"
              label={t('page.cards.cashHoldLabel', { currency: 'UZS' })}
              help={t('page.cards.cashHoldHint')}
              error={cashError ?? undefined}
            >
              <AmountInput
                autoFocus
                value={cashEdit.initialBalance}
                currency="UZS"
                onChange={v => { setCashDirty(true); setCashEdit(p => p ? { ...p, initialBalance: v } : p) }}
                className="focus-ring h-11 w-full rounded-control border border-slate-200 px-3 text-sm"
                placeholder="0"
                suffix="UZS"
              />
            </Field>
          </form>
        )}
      </Sheet>
    </div>
  )
}
