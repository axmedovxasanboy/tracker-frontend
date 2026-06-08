import { useState, useEffect, useMemo } from 'react'
import { Calendar, CreditCard, Wallet } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { cardsApi } from '../../api/cards'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency, snap } from '../../utils/format'
import type {
  CardResponse,
  MonthlyPaymentMode,
  MonthlyPaymentPayRequest,
  MonthlyPaymentResponse,
} from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  subscription: MonthlyPaymentResponse | null
}

export function PaySubscriptionModal({ open, onClose, onSaved, subscription }: Props) {
  const defaultAmount = subscription?.amount ?? 0
  const currency = subscription?.currency ?? 'USD'

  const [mode, setMode] = useState<MonthlyPaymentMode>('CARD')
  const [amount, setAmount] = useState(defaultAmount)
  const [cashInput, setCashInput] = useState(0)
  const [cardInput, setCardInput] = useState(defaultAmount)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [cardId, setCardId] = useState<number | undefined>()
  const [updateForFuture, setUpdateForFuture] = useState(false)
  const [cards, setCards] = useState<CardResponse[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && subscription) {
      setMode('CARD')
      setAmount(subscription.amount)
      setCashInput(0)
      setCardInput(subscription.amount)
      setPaymentDate(new Date().toISOString().split('T')[0])
      setCardId(undefined)
      setUpdateForFuture(false)
      setError(null)
      cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
    }
  }, [open, subscription])

  // Keep `amount` in sync with split inputs when BOTH is active.
  useEffect(() => {
    if (mode === 'BOTH') {
      setAmount(snap(cashInput + cardInput))
    } else if (mode === 'CARD') {
      setAmount(cardInput)
    } else if (mode === 'CASH') {
      setAmount(cashInput)
    }
  }, [mode, cashInput, cardInput])

  const filteredCards = useMemo(
    () => cards.filter(c => c.currency === currency),
    [cards, currency],
  )

  const amountDiffersFromDefault = useMemo(() => {
    if (!subscription) return false
    return Math.abs(amount - subscription.amount) > 0.001
  }, [amount, subscription])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subscription) return

    if (amount <= 0) { setError('Amount must be greater than 0'); return }
    if (mode === 'CARD' && !cardId) { setError('Pick a card or switch to Cash.'); return }
    if (mode === 'BOTH') {
      if (!cardId) { setError('Pick a card for the card portion.'); return }
      if (cashInput <= 0 || cardInput <= 0) { setError('Both cash and card portions must be greater than 0.'); return }
    }

    const req: MonthlyPaymentPayRequest = {
      amount,
      paymentDate,
      mode,
      cardId: (mode === 'CARD' || mode === 'BOTH') ? cardId : undefined,
      cashAmount: mode === 'BOTH' ? cashInput : undefined,
      updateAmountForFuture: amountDiffersFromDefault ? updateForFuture : false,
    }

    setSaving(true); setError(null)
    try {
      await financeApi.payMonthlyPayment(subscription.id, req)
      onSaved(); onClose()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const markAlreadyPaid = async () => {
    if (!subscription) return
    if (amount <= 0) { setError('Amount must be greater than 0'); return }
    setSaving(true); setError(null)
    try {
      await financeApi.markPaid({
        kind: 'SUBSCRIPTION', refId: subscription.id,
        amount, currency, month: paymentDate.slice(0, 7),
      })
      onSaved(); onClose()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  if (!subscription) return null

  return (
    <Modal open={open} onClose={onClose} title={`Pay ${subscription.name}`} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Summary header */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-100">
          <Calendar className="w-5 h-5 text-violet-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{subscription.name}</p>
            <p className="text-xs text-slate-500">
              Default: <span className="font-semibold">{formatCurrency(subscription.amount, currency)}</span>
              {subscription.dueDay != null && <> · Due day {subscription.dueDay}</>}
            </p>
          </div>
        </div>

        {/* Payment method tabs */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Payment method</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'CARD', label: 'Card',  Icon: CreditCard },
              { value: 'CASH', label: 'Cash',  Icon: Wallet },
              { value: 'BOTH', label: 'Both',  Icon: CreditCard },
            ] as { value: MonthlyPaymentMode; label: string; Icon: typeof CreditCard }[]).map(opt => (
              <button key={opt.value} type="button" onClick={() => setMode(opt.value)}
                className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 border transition-colors ${
                  mode === opt.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}>
                <opt.Icon className="w-4 h-4" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card mode */}
        {mode === 'CARD' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Card *</label>
              <select required value={cardId ?? ''} onChange={e => setCardId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">— Choose a card —</option>
                {filteredCards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} •••• {c.lastFourDigits} · {formatCurrency(c.currentBalance, c.currency)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Amount *</label>
              <AmountInput required value={cardInput || 0} currency={currency}
                onChange={v => setCardInput(v)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                suffix={currency} />
            </div>
          </div>
        )}

        {/* Cash mode */}
        {mode === 'CASH' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Amount *</label>
            <AmountInput required value={cashInput || 0} currency={currency}
              onChange={v => setCashInput(v)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              suffix={currency} />
          </div>
        )}

        {/* Both mode */}
        {mode === 'BOTH' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Card *</label>
              <select required value={cardId ?? ''} onChange={e => setCardId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">— Choose a card —</option>
                {filteredCards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} •••• {c.lastFourDigits} · {formatCurrency(c.currentBalance, c.currency)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cash *</label>
                <AmountInput required value={cashInput || 0} currency={currency}
                  onChange={v => setCashInput(v)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  suffix={currency} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Card *</label>
                <AmountInput required value={cardInput || 0} currency={currency}
                  onChange={v => setCardInput(v)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  suffix={currency} />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Total: <span className="font-semibold text-slate-700">{formatCurrency(amount, currency)}</span>
            </p>
          </div>
        )}

        {/* Payment date */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Payment date *</label>
          <input required type="date" value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>

        {/* "Use this amount for future payments?" — only when changed */}
        {amountDiffersFromDefault && (
          <label className="flex items-start gap-2 cursor-pointer p-3 rounded-xl bg-amber-50 border border-amber-100">
            <input type="checkbox" checked={updateForFuture}
              onChange={e => setUpdateForFuture(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-indigo-600" />
            <span className="text-xs text-amber-900 leading-relaxed">
              Amount differs from the saved default ({formatCurrency(subscription.amount, currency)} → {formatCurrency(amount, currency)}).
              Use <span className="font-semibold">{formatCurrency(amount, currency)}</span> as the default for future payments?
            </span>
          </label>
        )}

        {error && (
          <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={markAlreadyPaid} disabled={saving}
            title="Mark this month covered without recording a transaction"
            className="flex-1 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-60">
            Already paid
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? 'Recording…' : 'Record payment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
