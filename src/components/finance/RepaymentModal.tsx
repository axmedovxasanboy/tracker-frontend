import { useState, useEffect } from 'react'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { cardsApi } from '../../api/cards'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency, snap } from '../../utils/format'
import type { CardResponse, Currency, DebtResponse, LoanGivenResponse, LoanTakenResponse, RepaymentRequest } from '../../types'

type RepayTarget =
  | { kind: 'loan-taken'; record: LoanTakenResponse }
  | { kind: 'debt';       record: DebtResponse }
  | { kind: 'loan-given'; record: LoanGivenResponse }

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  target: RepayTarget | null
}

function getInfo(target: RepayTarget | null) {
  if (!target) return { label: '', person: '', remaining: 0, currency: 'USD' as Currency, maxAmount: 0 }
  if (target.kind === 'loan-taken') {
    return {
      label: 'Pay Back Borrowed Loan',
      person: target.record.lenderName,
      remaining: target.record.remainingAmount,
      currency: target.record.currency,
      maxAmount: target.record.remainingAmount,
    }
  }
  if (target.kind === 'debt') {
    return {
      label: 'Pay Off Debt',
      person: target.record.creditorName,
      remaining: target.record.remainingAmount,
      currency: target.record.currency,
      maxAmount: target.record.remainingAmount,
    }
  }
  return {
    label: 'Mark Loan Returned',
    person: target.record.debtorName,
    remaining: target.record.pendingAmount,
    currency: target.record.currency,
    maxAmount: target.record.pendingAmount,
  }
}

export function RepaymentModal({ open, onClose, onSaved, target }: Props) {
  const info = getInfo(target)
  const [amount, setAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [cardId, setCardId] = useState<number | undefined>()
  const [cards, setCards] = useState<CardResponse[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount(info.maxAmount)
      setPaymentDate(new Date().toISOString().split('T')[0])
      setCardId(undefined)
      setError(null)
      cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
    }
  }, [open, target])

  const filteredCards = cards.filter(c => c.currency === info.currency)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) { setError('Amount must be greater than 0'); return }
    if (amount > info.maxAmount) { setError(`Cannot exceed remaining: ${formatCurrency(info.maxAmount, info.currency)}`); return }

    setSaving(true); setError(null)
    const req: RepaymentRequest = { amount, paymentDate, cardId }
    try {
      if (!target) return
      if (target.kind === 'loan-taken') await financeApi.repayLoanTaken(target.record.id, req)
      else if (target.kind === 'debt')  await financeApi.repayDebt(target.record.id, req)
      else                              await financeApi.markLoanGivenReturned(target.record.id, req)
      onSaved(); onClose()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  // "Already paid" — only for money you owe (borrowed loans + debts), not a loan returned TO you.
  const canMarkPaid = target?.kind === 'loan-taken' || target?.kind === 'debt'
  const markAlreadyPaid = async () => {
    if (!target || !canMarkPaid) return
    if (amount <= 0) { setError('Amount must be greater than 0'); return }
    if (amount > info.maxAmount) { setError(`Cannot exceed remaining: ${formatCurrency(info.maxAmount, info.currency)}`); return }
    setSaving(true); setError(null)
    try {
      await financeApi.markPaid({
        kind: target.kind === 'loan-taken' ? 'PERSONAL_LOAN' : 'DEBT',
        refId: target.record.id,
        amount, currency: info.currency as Currency,
        month: paymentDate.slice(0, 7),
      })
      onSaved(); onClose()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const icon = target?.kind === 'loan-given'
    ? <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
    : <ArrowDownCircle className="w-5 h-5 text-rose-500" />

  return (
    <Modal open={open} onClose={onClose} title={info.label} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Loan summary */}
        <div className={`flex items-center gap-3 p-3 rounded-xl ${
          target?.kind === 'loan-given' ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'
        }`}>
          {icon}
          <div>
            <p className="text-sm font-semibold text-slate-800">{info.person}</p>
            <p className="text-xs text-slate-500">
              {target?.kind === 'loan-given' ? 'Pending return: ' : 'Remaining: '}
              <span className="font-semibold">{formatCurrency(info.remaining, info.currency as Currency)}</span>
            </p>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Payment Amount * <span className="text-slate-400">(max {formatCurrency(info.maxAmount, info.currency as Currency)})</span>
          </label>
          <AmountInput
            required
            value={amount || 0}
            currency={info.currency as Currency}
            onChange={v => setAmount(v)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="0"
            suffix={info.currency}
          />
          {/* Quick fill buttons */}
          <div className="flex gap-2 mt-1.5">
            {[0.25, 0.5, 0.75, 1].map(pct => (
              <button key={pct} type="button"
                onClick={() => setAmount(snap(info.maxAmount * pct))}
                className="flex-1 py-1 text-xs bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg transition-colors">
                {pct === 1 ? 'Full' : `${pct * 100}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Payment date */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Payment Date *</label>
          <input required type="date" value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>

        {/* Card (optional) */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Pay From Card <span className="text-slate-400">(optional)</span>
          </label>
          <select value={cardId ?? ''} onChange={e => setCardId(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">— Cash / No card —</option>
            {filteredCards.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} •••• {c.lastFourDigits} · {formatCurrency(c.currentBalance, c.currency)}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* Summary preview */}
        {amount > 0 && (
          <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Paying now</span>
              <span className="font-semibold text-indigo-700">{formatCurrency(amount, info.currency as Currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining after</span>
              <span className="font-semibold">{formatCurrency(Math.max(0, info.remaining - amount), info.currency as Currency)}</span>
            </div>
            {Math.abs(amount - info.remaining) < 0.001 && (
              <p className="text-emerald-600 font-semibold text-center pt-0.5">Full payment — will be marked as Paid</p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
            Cancel
          </button>
          {canMarkPaid && (
            <button type="button" onClick={markAlreadyPaid} disabled={saving}
              title="Reduce the balance without recording a transaction"
              className="flex-1 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-60">
              Already paid
            </button>
          )}
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? 'Processing…' : 'Confirm Payment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
