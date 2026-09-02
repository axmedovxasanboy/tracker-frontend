import { useState } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, CreditCard, Wallet, ArrowUpRight, ArrowDownRight, X, ArrowLeftRight } from 'lucide-react'
import { format } from 'date-fns'
import { Modal } from '../components/ui/Modal'
import { useLang } from '../i18n/LanguageContext'
import { Spinner } from '../components/ui/Spinner'
import { BalanceTransferModal } from '../components/transactions/BalanceTransferModal'
import { TransactionDetailModal } from '../components/transactions/TransactionDetailModal'
import { TransactionModal } from '../components/transactions/TransactionModal'
import { useApi } from '../hooks/useApi'
import { IncomeRequiredNotice } from '../components/ui/IncomeRequiredNotice'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { cardsApi } from '../api/cards'
import { transactionsApi } from '../api/transactions'
import { cashBalancesApi } from '../api/cashBalances'
import { extractErrorMessage } from '../api/client'
import { formatCurrency } from '../utils/format'
import { AmountInput } from '../components/ui/AmountInput'
import type { CardRequest, CardResponse, CardType, CashBalanceResponse, Currency, Transaction, TransactionFilters } from '../types'

// Logos rendered as text badges per card network
const CARD_NETWORK_BADGE: Record<CardType, { label: string; style: string }> = {
  UZCARD: { label: 'Uzcard', style: 'bg-blue-600 text-white' },
  HUMO:   { label: 'Humo',  style: 'bg-emerald-600 text-white' },
  VISA:   { label: 'VISA',  style: 'bg-white/20 text-white font-bold italic' },
  CASH:   { label: 'Cash',  style: 'bg-amber-500 text-white' },
}

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
  fullNumber: '',
  pin: '',
  initialBalance: 0,
  currency: 'UZS',
  color: '#0f172a',
}

function CardVisual({ card }: { card: CardResponse }) {
  const { t } = useLang()
  const badge = CARD_NETWORK_BADGE[card.type]
  return (
    <div
      className="relative rounded-2xl p-5 text-white overflow-hidden select-none"
      style={{ background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}bb 100%)`, minHeight: 170 }}
    >
      {/* Decorative circles */}
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
      <div className="absolute -right-4 top-16 w-24 h-24 rounded-full bg-white/5" />

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/60 text-xs font-medium uppercase tracking-widest">{card.bankName}</p>
            <p className="text-white font-semibold mt-0.5">{card.name}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${badge.style}`}>
            {badge.label}
          </span>
        </div>
        <div className="mt-4">
          <p className="text-white/50 text-xs mb-1">{t('page.cards.cardNumberLabel')}</p>
          <p className="text-white font-mono text-base tracking-widest">
            •••• •••• •••• {card.lastFourDigits}
          </p>
        </div>
        <div className="flex items-end justify-between mt-4">
          <div>
            <p className="text-white/50 text-xs">{t('page.cards.balanceLabel')}</p>
            <p className="text-white font-bold text-lg">
              {formatCurrency(card.currentBalance ?? 0, card.currency)}
            </p>
          </div>
          <CreditCard className="w-8 h-8 text-white/30" />
        </div>
      </div>
    </div>
  )
}

export function Cards() {
  const { t, categoryName } = useLang()
  const { showSuccess } = useToast()
  const { hasStableIncome } = useSettings()
  const confirm = useConfirm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CardResponse | null>(null)
  const [form, setForm] = useState<CardRequest>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [revealModal, setRevealModal] = useState<CardResponse | null>(null)
  const [pin, setPin] = useState('')
  const [revealedNumber, setRevealedNumber] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [revealError, setRevealError] = useState<string | null>(null)
  const [addCard, setAddCard] = useState<CardResponse | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferFromCard, setTransferFromCard] = useState<CardResponse | null>(null)
  const [txCard, setTxCard] = useState<CardResponse | null>(null) // card whose transactions are shown
  const [txPage, setTxPage] = useState(0)
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [deletingTx, setDeletingTx] = useState(false)

  // Cash transactions view — mirrors the per-card view but for the cash balance of a currency.
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

  // Inline cash-balance editor.
  const [cashEdit, setCashEdit] = useState<{ currency: Currency; initialBalance: number } | null>(null)
  const [savingCash, setSavingCash] = useState(false)
  const [cashError, setCashError] = useState<string | null>(null)

  const openCashEdit = (b?: CashBalanceResponse, currency?: Currency) => {
    setCashEdit({
      currency: b?.currency ?? currency ?? 'UZS',
      initialBalance: b?.initialBalance ?? 0,
    })
    setCashError(null)
  }
  const saveCash = async () => {
    if (!cashEdit) return
    setSavingCash(true); setCashError(null)
    try {
      await cashBalancesApi.upsert(cashEdit)
      cashBalances.refetch()
      setCashEdit(null)
    } catch (err) {
      setCashError(extractErrorMessage(err))
    } finally {
      setSavingCash(false)
    }
  }
  const hasUzsCash = (cashBalances.data ?? []).some(b => b.currency === 'UZS')

  const openNew = () => { setEditTarget(null); setForm(defaultForm); setError(null); setModalOpen(true) }
  const openEdit = (c: CardResponse) => {
    setEditTarget(c)
    setForm({ name: c.name, bankName: c.bankName, type: c.type, lastFourDigits: c.lastFourDigits, initialBalance: c.initialBalance, currency: c.currency, color: c.color })
    setError(null)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      if (editTarget) { await cardsApi.update(editTarget.id, form) }
      else { await cardsApi.create(form) }
      setModalOpen(false)
      cards.refetch()
      showSuccess(editTarget ? t('page.cards.updatedToast') : t('page.cards.createdToast'))
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: t('page.cards.deleteCardTitle'),
      message: t('page.cards.deleteCardMessage'),
      destructive: true,
    })
    if (!ok) return
    setDeleting(id)
    try { await cardsApi.delete(id); cards.refetch() }
    finally { setDeleting(null) }
  }

  const openReveal = (c: CardResponse) => {
    setRevealModal(c); setPin(''); setRevealedNumber(null); setRevealError(null)
  }

  const handleReveal = async () => {
    if (!revealModal) return
    setRevealing(true); setRevealError(null)
    try {
      const res = await cardsApi.revealFullNumber(revealModal.id, pin)
      setRevealedNumber(res.data.fullNumber)
    } catch (err: unknown) {
      setRevealError(extractErrorMessage(err))
    } finally { setRevealing(false) }
  }

  const set = <K extends keyof CardRequest>(k: K, v: CardRequest[K]) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="p-6 space-y-6">
      <IncomeRequiredNotice />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t('page.cards')}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{t('page.cards.accountsCount', { count: cards.data?.length ?? 0 })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTransferFromCard(null); setTransferOpen(true) }} className="flex items-center gap-2 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
            <ArrowLeftRight className="w-4 h-4" /> {t('action.transfer')}
          </button>
          <button onClick={openNew} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> {t('page.cards.addCard')}
          </button>
        </div>
      </div>

      {/* Cash balances — replaces the old "Cash wallet" card concept. */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{t('page.cards.cashBalancesHeading')}</h3>
          {!hasUzsCash && (
            <button onClick={() => openCashEdit(undefined, 'UZS')}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors">
              <Plus className="w-3 h-3" /> {t('page.cards.addCashBalance')}
            </button>
          )}
        </div>
        {(cashBalances.data?.length ?? 0) === 0 ? (
          <p className="text-xs text-slate-400">
            {t('page.cards.cashBalancesEmptyHint')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {cashBalances.data?.map(b => (
              <div key={b.id} className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
                <button onClick={() => openCashEdit(b)} className="block w-full text-left">
                  <p className="text-[10px] uppercase tracking-widest text-amber-600 font-semibold">{b.currency} · {t('tx.cash')}</p>
                  <p className="text-lg font-bold text-amber-800 mt-1">
                    {formatCurrency(b.currentBalance, b.currency)}
                  </p>
                  <p className="text-xs text-amber-700/80 mt-0.5">
                    {t('page.cards.startingAmount', { amount: formatCurrency(b.initialBalance, b.currency) })}
                  </p>
                </button>
                <button onClick={() => { setTxCash(b); setTxCashPage(0); setTxCard(null) }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-200/60 hover:bg-amber-200 text-amber-800 text-xs font-medium transition-colors">
                  <Wallet className="w-3.5 h-3.5" /> {t('page.cards.viewTransactions')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {cards.loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (cards.data?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Wallet className="w-12 h-12 opacity-30" />
          <p className="text-sm">{t('page.cards.noCardsYet')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {cards.data?.map((card) => (
            <div key={card.id} className="group space-y-2">
              {/* Card visual — no absolute overlap */}
              <CardVisual card={card} />

              {/* Action bar — appears below the card on hover */}
              <div className="flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
                <button onClick={() => { setTxCard(card); setTxPage(0) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors">
                  <CreditCard className="w-3.5 h-3.5" /> {t('page.cards.viewTransactions')}
                </button>
                <button onClick={() => setAddCard(card)} disabled={!hasStableIncome}
                  title={!hasStableIncome ? t('income.requiredTooltip') : undefined}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors">
                  <Plus className="w-3.5 h-3.5" /> {t('action.add')}
                </button>
                <button onClick={() => { setTransferFromCard(card); setTransferOpen(true) }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 transition-colors" title={t('page.cards.transferBalanceTitle')}>
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
                {card.hasFullNumber && card.hasPin && (
                  <button onClick={() => openReveal(card)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors" title={t('page.cards.revealNumberTitle')}>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => openEdit(card)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(card.id)} disabled={deleting === card.id} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50">
                  {deleting === card.id ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? t('page.cards.editCardTitle') : t('page.cards.newCardTitle')}>
        <form onSubmit={handleSave} className="space-y-4">
          {/* Card Network — Cash is no longer a card; managed via the Cash balances widget. */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('page.cards.cardNetworkLabel')}</label>
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              {(['UZCARD', 'HUMO', 'VISA'] as CardType[]).map(net => (
                <button key={net} type="button" onClick={() => set('type', net)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${form.type === net ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {net === 'UZCARD' ? 'Uzcard' : net === 'HUMO' ? 'Humo' : 'VISA'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('page.cards.nicknameLabel')}</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder={t('page.cards.nicknamePlaceholder')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('page.shared.bankNameLabel')}</label>
              <input required value={form.bankName} onChange={e => set('bankName', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Kapitalbank" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('page.cards.last4Label')}</label>
            <input required maxLength={4} pattern="\d{4}" value={form.lastFourDigits}
              onChange={e => set('lastFourDigits', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="4521" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('page.cards.initialBalanceLabel')}</label>
            <AmountInput
              required
              value={form.initialBalance}
              currency={form.currency}
              onChange={v => set('initialBalance', v)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="0"
              suffix={form.currency}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('page.cards.fullNumberLabel')} <span className="text-slate-300">{t('page.cards.fullNumberHint')}</span></label>
            <input type="password" value={form.fullNumber ?? ''} onChange={e => set('fullNumber', e.target.value)} maxLength={19} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder={t('page.cards.fullNumberPlaceholder')} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('page.cards.revealPinLabel')} <span className="text-slate-300">{t('page.cards.revealPinHint')}</span></label>
            <input type="password" value={form.pin ?? ''} onChange={e => set('pin', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder={t('page.cards.setPinPlaceholder')} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">{t('page.cards.cardColorLabel')}</label>
            <div className="flex flex-wrap gap-2">
              {CARD_COLORS.map(c => (
                <button key={c} type="button" onClick={() => set('color', c)} className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {error && <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">{t('action.cancel')}</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Spinner className="w-4 h-4" />}{saving ? t('action.saving') : editTarget ? t('action.update') : t('action.create')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reveal Modal */}
      <Modal open={!!revealModal} onClose={() => { setRevealModal(null); setRevealedNumber(null) }} title={t('page.cards.revealModalTitle')} maxWidth="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{t('page.cards.revealPromptPre')} <strong>{revealModal?.name}</strong>.</p>
          {!revealedNumber ? (
            <>
              <input type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReveal()} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder={t('page.cards.enterPinPlaceholder')} autoFocus />
              {revealError && <p className="text-rose-500 text-sm text-center">{revealError}</p>}
              <button onClick={handleReveal} disabled={revealing || !pin} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {revealing ? <><Spinner className="w-4 h-4" />{t('page.cards.verifying')}</> : <><Eye className="w-4 h-4" />{t('page.cards.revealButton')}</>}
              </button>
            </>
          ) : (
            <div className="text-center space-y-3">
              <p className="font-mono text-xl tracking-widest text-slate-800 bg-slate-50 border border-slate-200 rounded-xl py-3">
                {revealedNumber.replace(/(.{4})/g, '$1 ').trim()}
              </p>
              <button onClick={() => setRevealedNumber(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mx-auto">
                <EyeOff className="w-4 h-4" /> {t('page.cards.hideButton')}
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Balance Transfer Modal */}
      <BalanceTransferModal
        open={transferOpen}
        onClose={() => { setTransferOpen(false); setTransferFromCard(null) }}
        onSaved={() => { cards.refetch(); setTransferOpen(false); setTransferFromCard(null); if (txCard) cardTxs.refetch() }}
        preselectedFromCardId={transferFromCard?.id}
      />

      {/* Quick add a single transaction for a card — preselects that card */}
      <TransactionModal open={!!addCard} onClose={() => setAddCard(null)}
        onSaved={() => { cards.refetch(); setAddCard(null); if (txCard) cardTxs.refetch() }}
        transaction={null} defaultCurrency={addCard?.currency ?? 'UZS'} preselectCardId={addCard?.id} />

      {/* Card Transactions Panel — shows only the CARD PORTION per row so split
          payments contribute the amount that actually moved on this card. */}
      {txCard && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-800">{txCard.name} •••• {txCard.lastFourDigits}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{t('page.cards.cardTxSubtitle', { currency: txCard.currency })}</p>
            </div>
            <button onClick={() => setTxCard(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          {cardTxs.loading ? (
            <div className="h-32 flex items-center justify-center"><Spinner /></div>
          ) : (cardTxs.data?.content.length ?? 0) === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm text-slate-400">{t('page.cards.noCardTx')}</div>
          ) : (
            <div>
              <div className="divide-y divide-slate-50">
                {cardTxs.data?.content.map(tx => {
                  const cardPortion = tx.cardAmount ?? (tx.amount - (tx.cashAmount ?? 0))
                  const isSplit = (tx.cashAmount ?? 0) > 0 && cardPortion > 0
                  return (
                  <button key={tx.id} onClick={() => setDetailTx(tx)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tx.type === 'INCOME' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                      {tx.type === 'INCOME' ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-slate-700 truncate">{tx.description}</p>
                        {isSplit && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase">{t('page.shared.splitBadge')}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{tx.category ? categoryName(tx.category) : '—'} · {format(new Date(tx.transactionDate), 'dd-MMM-yyyy')}</p>
                    </div>
                    <span className={`text-sm font-semibold ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(cardPortion, tx.currency as Currency)}
                    </span>
                  </button>
                  )
                })}
              </div>
              {/* Pagination */}
              {(cardTxs.data?.totalPages ?? 0) > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">{t('page.pagination.pageOf', { page: (cardTxs.data?.page ?? 0) + 1, total: cardTxs.data?.totalPages ?? 0 })}</p>
                  <div className="flex gap-1">
                    <button disabled={txPage === 0} onClick={() => setTxPage(p => p - 1)}
                      className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">{t('page.pagination.prev')}</button>
                    <button disabled={cardTxs.data?.last ?? true} onClick={() => setTxPage(p => p + 1)}
                      className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">{t('page.pagination.next')}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cash Transactions Panel — pure-cash AND split-payment cash portions for the
          chosen currency. Each row shows the cash portion only. */}
      {txCash && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 bg-amber-50/50">
            <div>
              <h3 className="font-semibold text-amber-900">{t('page.cards.cashPanelTitle', { currency: txCash.currency })}</h3>
              <p className="text-xs text-amber-700/80 mt-0.5">
                {t('page.cards.cashTxSubtitle', { balance: formatCurrency(txCash.currentBalance, txCash.currency) })}
              </p>
            </div>
            <button onClick={() => setTxCash(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-amber-100 text-amber-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          {cashTxs.loading ? (
            <div className="h-32 flex items-center justify-center"><Spinner /></div>
          ) : (cashTxs.data?.content.length ?? 0) === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm text-slate-400">{t('page.cards.noCashTx', { currency: txCash.currency })}</div>
          ) : (
            <div>
              <div className="divide-y divide-slate-50">
                {cashTxs.data?.content.map(tx => {
                  const isSplit = (tx.cashAmount ?? 0) > 0 && (tx.cardAmount ?? 0) > 0 && !!tx.card
                  return (
                  <button key={tx.id} onClick={() => setDetailTx(tx)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-amber-50/50 transition-colors text-left">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tx.type === 'INCOME' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                      {tx.type === 'INCOME' ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-slate-700 truncate">{tx.description}</p>
                        {isSplit && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase">{t('page.shared.splitBadge')}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{tx.category ? categoryName(tx.category) : '—'} · {format(new Date(tx.transactionDate), 'dd-MMM-yyyy')}</p>
                    </div>
                    <span className={`text-sm font-semibold ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.cashAmount ?? 0, tx.currency as Currency)}
                    </span>
                  </button>
                  )
                })}
              </div>
              {(cashTxs.data?.totalPages ?? 0) > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-amber-100">
                  <p className="text-xs text-amber-700/80">{t('page.pagination.pageOf', { page: (cashTxs.data?.page ?? 0) + 1, total: cashTxs.data?.totalPages ?? 0 })}</p>
                  <div className="flex gap-1">
                    <button disabled={txCashPage === 0} onClick={() => setTxCashPage(p => p - 1)}
                      className="px-3 py-1 text-xs border border-amber-200 rounded-lg disabled:opacity-40 hover:bg-amber-50">{t('page.pagination.prev')}</button>
                    <button disabled={cashTxs.data?.last ?? true} onClick={() => setTxCashPage(p => p + 1)}
                      className="px-3 py-1 text-xs border border-amber-200 rounded-lg disabled:opacity-40 hover:bg-amber-50">{t('page.pagination.next')}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Transaction Detail Modal (from card view) */}
      <TransactionDetailModal
        transaction={detailTx} open={!!detailTx}
        onClose={() => setDetailTx(null)}
        onEdit={(t) => { setDetailTx(null); setEditTx(t) }}
        onDelete={async (id) => {
          if (!await confirm({ message: t('tx.confirmDelete'), destructive: true })) return
          setDeletingTx(true)
          try { await transactionsApi.delete(id); setDetailTx(null); cards.refetch(); cardTxs.refetch() }
          finally { setDeletingTx(false) }
        }}
        deleting={deletingTx}
      />
      <TransactionModal
        open={!!editTx} onClose={() => setEditTx(null)}
        onSaved={() => { setEditTx(null); cards.refetch(); cardTxs.refetch() }}
        transaction={editTx} defaultCurrency={txCard?.currency ?? 'UZS'}
      />

      {/* Cash-balance set/edit modal */}
      <Modal open={!!cashEdit} onClose={() => setCashEdit(null)}
        title={t('page.cards.cashBalanceModalTitle', { currency: cashEdit?.currency ?? '' })} maxWidth="max-w-md">
        {cashEdit && (
          <form onSubmit={e => { e.preventDefault(); saveCash() }} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t('page.cards.cashHoldLabel', { currency: cashEdit.currency })}
              </label>
              <AmountInput
                autoFocus
                value={cashEdit.initialBalance}
                currency={cashEdit.currency}
                onChange={v => setCashEdit(p => p ? { ...p, initialBalance: v } : p)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                placeholder="0"
                suffix={cashEdit.currency}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {t('page.cards.cashHoldHint')}
              </p>
            </div>
            {cashError && <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{cashError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setCashEdit(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">{t('action.cancel')}</button>
              <button type="submit" disabled={savingCash}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-60 flex items-center justify-center gap-2">
                {savingCash && <Spinner className="w-4 h-4" />}{savingCash ? t('action.saving') : t('action.save')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
