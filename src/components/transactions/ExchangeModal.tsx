import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Wallet, CreditCard, ArrowLeftRight } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { useToast } from '../../context/ToastContext'
import { cardsApi } from '../../api/cards'
import { cashBalancesApi } from '../../api/cashBalances'
import { transactionsApi } from '../../api/transactions'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency, snap } from '../../utils/format'
import type { CardResponse, CashBalanceResponse, Currency, ExchangeRequest } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  defaultCurrency: Currency
}

type WalletKind = 'CASH' | 'CARD'

const CURRENCIES: Currency[] = ['UZS', 'USD', 'EUR']

// Relative unit value, only used to pick a friendly default rate direction so the user
// types a number ≥ 1 (the stronger currency becomes the "1 X = …" unit).
const CURRENCY_STRENGTH: Record<Currency, number> = { UZS: 0, USD: 2, EUR: 2 }

const todayIso = () => new Date().toISOString().split('T')[0]

/**
 * Exchange between any two wallets (cash or card), in any two currencies.
 * The user enters how much leaves the source and how much arrives at the destination.
 * The implied rate is auto-calculated; touching the rate field updates "amount received"
 * to match. Cards lock their currency to the card's own.
 */
export function ExchangeModal({ open, onClose, onSaved, defaultCurrency }: Props) {
  const { showSuccess } = useToast()
  const [cards, setCards] = useState<CardResponse[]>([])
  const [cashBalances, setCashBalances] = useState<CashBalanceResponse[]>([])

  const [fromKind, setFromKind] = useState<WalletKind>('CASH')
  const [fromCardId, setFromCardId] = useState<number | undefined>()
  const [fromCurrency, setFromCurrency] = useState<Currency>(defaultCurrency)
  const [fromAmount, setFromAmount] = useState(0)

  const [toKind, setToKind] = useState<WalletKind>('CASH')
  const [toCardId, setToCardId] = useState<number | undefined>()
  const [toCurrency, setToCurrency] = useState<Currency>(defaultCurrency)
  const [toAmount, setToAmount] = useState(0)

  // Cross-currency rate. `rateInverted` controls which way it reads so the user always
  // types an easy ≥1 number: false → "1 fromCurrency = rate toCurrency";
  // true → "1 toCurrency = rate fromCurrency" (e.g. "1 USD = 12 500 UZS" for a UZS→USD move).
  const [rateText, setRateText] = useState('')
  const [rateInverted, setRateInverted] = useState(false)

  const [transactionDate, setTransactionDate] = useState(todayIso())
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * "Fully exchanged" means every unit of the source amount makes it to the destination
   * (no fees, no leftover). When ON, the To-amount field is hidden — we derive it
   * automatically from From-amount (same currency) or from rate × From-amount (cross-
   * currency). This is the common case for cash↔card same-currency moves where typing
   * the amount twice felt redundant.
   */
  const [fullyExchanged, setFullyExchanged] = useState(true)

  useEffect(() => {
    if (!open) return
    cardsApi.getAll().then(r => setCards(r.data.filter(c => c.type !== 'CASH'))).catch(() => {})
    cashBalancesApi.getAll().then(r => setCashBalances(r.data)).catch(() => {})
    setFromKind('CASH'); setFromCardId(undefined); setFromCurrency(defaultCurrency); setFromAmount(0)
    setToKind('CASH'); setToCardId(undefined); setToCurrency(defaultCurrency); setToAmount(0)
    setTransactionDate(todayIso())
    setDescription('')
    setError(null)
    setRateText('')
    setRateInverted(false)
    setFullyExchanged(true)
  }, [open, defaultCurrency])

  const fromCard = cards.find(c => c.id === fromCardId)
  const toCard = cards.find(c => c.id === toCardId)

  // Keep currency locked to the chosen card.
  useEffect(() => { if (fromCard) setFromCurrency(fromCard.currency) }, [fromCard])
  useEffect(() => { if (toCard) setToCurrency(toCard.currency) }, [toCard])

  const fromCashBalance = useMemo(
    () => cashBalances.find(b => b.currency === fromCurrency),
    [cashBalances, fromCurrency],
  )
  const toCashBalance = useMemo(
    () => cashBalances.find(b => b.currency === toCurrency),
    [cashBalances, toCurrency],
  )

  const crossCurrency = fromCurrency !== toCurrency

  // toCurrency received per 1 fromCurrency sent, from the typed rate + its direction.
  const effectiveToPerFrom = useMemo(() => {
    const r = Number(rateText.replace(',', '.'))
    if (!Number.isFinite(r) || r <= 0) return null
    return rateInverted ? 1 / r : r
  }, [rateText, rateInverted])

  // Default the rate direction to the stronger currency whenever the pair changes, so the
  // user types a ≥1 number rather than a tiny fraction.
  useEffect(() => {
    if (crossCurrency) {
      setRateInverted(CURRENCY_STRENGTH[toCurrency] > CURRENCY_STRENGTH[fromCurrency])
    }
  }, [fromCurrency, toCurrency, crossCurrency])

  // Derive the received amount:
  //   same currency  → received = sent (when "fully exchanged" is on)
  //   cross currency → received = sent × rate (the rate always drives it)
  useEffect(() => {
    if (!crossCurrency) {
      if (fullyExchanged) setToAmount(fromAmount)
      return
    }
    if (effectiveToPerFrom != null) setToAmount(snap(fromAmount * effectiveToPerFrom))
  }, [crossCurrency, fullyExchanged, fromAmount, effectiveToPerFrom])

  const sameSide = fromKind === 'CARD' && toKind === 'CARD' && fromCardId && fromCardId === toCardId
  const samePureCashSameCurrency =
    fromKind === 'CASH' && toKind === 'CASH' && fromCurrency === toCurrency

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (fromKind === 'CARD' && !fromCardId) { setError('Pick a source card'); return }
    if (toKind === 'CARD' && !toCardId) { setError('Pick a destination card'); return }
    if (sameSide) { setError('Source and destination cards must be different'); return }
    if (samePureCashSameCurrency) { setError('Exchanging cash to cash in the same currency does nothing'); return }
    if (fromAmount <= 0) { setError('Enter how much you are exchanging'); return }
    if (toAmount <= 0) { setError('Enter how much you are receiving'); return }

    const req: ExchangeRequest = {
      fromCardId: fromKind === 'CARD' ? fromCardId : undefined,
      fromCurrency,
      fromAmount,
      toCardId: toKind === 'CARD' ? toCardId : undefined,
      toCurrency,
      toAmount,
      transactionDate,
      description: description.trim() || undefined,
    }

    setSaving(true); setError(null)
    try {
      await transactionsApi.exchange(req)
      onSaved()
      onClose()
      showSuccess('Exchange recorded')
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Exchange" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
          <SidePanel
            label="From"
            kind={fromKind}
            onKind={setFromKind}
            cards={cards}
            cardId={fromCardId}
            onCard={setFromCardId}
            currency={fromCurrency}
            onCurrency={setFromCurrency}
            amount={fromAmount}
            onAmount={setFromAmount}
            cashBalance={fromCashBalance}
            color="rose"
          />
          <div className="flex items-center justify-center md:pt-8">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <ArrowRight className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <SidePanel
            label="To"
            kind={toKind}
            onKind={setToKind}
            cards={cards}
            cardId={toCardId}
            onCard={setToCardId}
            currency={toCurrency}
            onCurrency={setToCurrency}
            amount={toAmount}
            onAmount={setToAmount}
            cashBalance={toCashBalance}
            color="emerald"
            hideAmount={crossCurrency ? true : fullyExchanged}
          />
        </div>

        {/* Fully-exchanged toggle — same-currency only (received = sent, no second field).
            Cross-currency always derives the received amount from the rate below. */}
        {!crossCurrency && (
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={fullyExchanged}
              onChange={e => setFullyExchanged(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <span>
              Fully exchanged
              <span className="ml-1 text-xs text-slate-400">(received = sent)</span>
            </span>
          </label>
        )}

        {/* Rate row — cross-currency only. Entered in the stronger-currency direction so
            it's always an easy ≥1 number; the Flip button swaps the direction. */}
        {crossCurrency && (
          <div className="px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
            <div className="flex items-center">
              <label className="text-[11px] font-medium text-amber-700 uppercase tracking-wide">Exchange rate</label>
              <button type="button" onClick={() => setRateInverted(v => !v)}
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900">
                <ArrowLeftRight className="w-3 h-3" /> Flip
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-amber-800 whitespace-nowrap">
                1 {rateInverted ? toCurrency : fromCurrency} =
              </span>
              <input
                type="text" inputMode="decimal"
                value={rateText}
                onChange={e => setRateText(e.target.value)}
                placeholder="e.g. 12 500"
                className="flex-1 min-w-0 border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <span className="text-sm text-amber-800 whitespace-nowrap">
                {rateInverted ? fromCurrency : toCurrency}
              </span>
            </div>
            <p className="text-xs text-amber-700">
              {effectiveToPerFrom != null && fromAmount > 0
                ? <>Send {formatCurrency(fromAmount, fromCurrency)} → receive{' '}
                    <span className="font-semibold">{formatCurrency(snap(fromAmount * effectiveToPerFrom), toCurrency)}</span></>
                : <>Type the rate as an easy number — tap <span className="font-medium">Flip</span> if it should read the other way.</>}
            </p>
          </div>
        )}

        {/* Date + description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date *</label>
            <input required type="date" value={transactionDate}
              onChange={e => setTransactionDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Note <span className="text-slate-300">(optional)</span></label>
            <input type="text" value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. cashed out at exchange office" />
          </div>
        </div>

        {error && (
          <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 text-xs text-indigo-700">
          Two paired transactions will be saved (one outgoing, one incoming). They are excluded
          from dashboard income/expense totals — they only move money between your wallets.
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Exchange'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface SideProps {
  label: string
  kind: WalletKind
  onKind: (k: WalletKind) => void
  cards: CardResponse[]
  cardId: number | undefined
  onCard: (id: number | undefined) => void
  currency: Currency
  onCurrency: (c: Currency) => void
  amount: number
  onAmount: (n: number) => void
  cashBalance: CashBalanceResponse | undefined
  color: 'rose' | 'emerald'
  /** When true, render the derived amount as a read-only display instead of an input. */
  hideAmount?: boolean
}

function SidePanel(p: SideProps) {
  const tint = p.color === 'rose' ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
  const muted = p.color === 'rose' ? 'text-rose-400' : 'text-emerald-400'
  const strong = p.color === 'rose' ? 'text-rose-700' : 'text-emerald-700'
  const sameCurrencyCards = p.cards.filter(c => c.currency === p.currency)
  return (
    <div className={`rounded-xl border p-3 space-y-2.5 ${tint}`}>
      <div className="flex items-center justify-between">
        <p className={`text-[10px] uppercase font-semibold tracking-widest ${muted}`}>{p.label}</p>
        <div className="flex bg-white/70 rounded-lg p-0.5 gap-0.5">
          <button type="button" onClick={() => p.onKind('CASH')}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 ${p.kind === 'CASH' ? 'bg-amber-500 text-white' : 'text-slate-500'}`}>
            <Wallet className="w-3 h-3" /> Cash
          </button>
          <button type="button" onClick={() => p.onKind('CARD')}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 ${p.kind === 'CARD' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
            <CreditCard className="w-3 h-3" /> Card
          </button>
        </div>
      </div>

      {p.kind === 'CARD' ? (
        <div>
          <select required value={p.cardId ?? ''}
            onChange={e => p.onCard(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-white rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">— Pick a card —</option>
            {sameCurrencyCards.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} •••• {c.lastFourDigits} · {formatCurrency(c.currentBalance ?? 0, c.currency)}
              </option>
            ))}
            {sameCurrencyCards.length === 0 && p.cards.length > 0 && (
              <optgroup label="other currency (pick one to switch)">
                {p.cards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} •••• {c.lastFourDigits} · {c.currency} · {formatCurrency(c.currentBalance ?? 0, c.currency)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      ) : (
        <div>
          <select value={p.currency}
            onChange={e => p.onCurrency(e.target.value as Currency)}
            className="w-full border border-white rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
            {CURRENCIES.map(c => <option key={c} value={c}>Cash · {c}</option>)}
          </select>
          {p.cashBalance && (
            <p className={`text-[10px] mt-1 pl-1 ${strong}`}>
              current {formatCurrency(p.cashBalance.currentBalance, p.cashBalance.currency)}
            </p>
          )}
        </div>
      )}

      <div>
        {p.hideAmount ? (
          <div className="w-full border border-white rounded-lg px-2.5 py-2 text-sm bg-white/70 text-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-400">Receives</span>
            <span className="font-semibold">
              {formatCurrency(p.amount || 0, p.currency)}
            </span>
          </div>
        ) : (
          <AmountInput
            value={p.amount || 0}
            currency={p.currency}
            onChange={p.onAmount}
            className="w-full border border-white rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="0"
            suffix={p.currency}
          />
        )}
      </div>
    </div>
  )
}
