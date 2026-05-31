import { useState, useEffect } from 'react'
import { ArrowRight, AlertTriangle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { useToast } from '../../context/ToastContext'
import { cardsApi } from '../../api/cards'
import { transactionsApi } from '../../api/transactions'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency } from '../../utils/format'
import type { BalanceTransferRequest, CardResponse } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  preselectedFromCardId?: number
}

const emptyForm = (): BalanceTransferRequest => ({
  fromCardId: 0,
  toCardId: 0,
  amount: 0,
  description: '',
  transactionDate: new Date().toISOString().split('T')[0],
})

export function BalanceTransferModal({ open, onClose, onSaved, preselectedFromCardId }: Props) {
  const { showSuccess } = useToast()
  const [cards, setCards] = useState<CardResponse[]>([])
  const [form, setForm] = useState<BalanceTransferRequest>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    cardsApi.getAll().then(r => {
      setCards(r.data)
      const f = emptyForm()
      if (preselectedFromCardId) {
        f.fromCardId = preselectedFromCardId
      } else if (r.data.length > 0) {
        f.fromCardId = r.data[0].id
      }
      if (r.data.length > 1) {
        const other = r.data.find(c => c.id !== f.fromCardId)
        if (other) f.toCardId = other.id
      }
      setForm(f)
    }).catch(() => {})
    setError(null)
  }, [open, preselectedFromCardId])

  const set = <K extends keyof BalanceTransferRequest>(k: K, v: BalanceTransferRequest[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  const fromCard = cards.find(c => c.id === form.fromCardId)
  const toCard = cards.find(c => c.id === form.toCardId)
  const currencyMismatch = fromCard && toCard && fromCard.currency !== toCard.currency
  const sameCard = form.fromCardId && form.toCardId && form.fromCardId === form.toCardId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fromCardId || !form.toCardId) { setError('Select both cards'); return }
    if (form.fromCardId === form.toCardId) { setError('Source and destination cards must be different'); return }
    if (!form.amount || form.amount <= 0) { setError('Enter a valid amount'); return }
    setSaving(true); setError(null)
    try {
      await transactionsApi.transfer(form)
      onSaved()
      onClose()
      showSuccess(`Transferred ${form.amount} successfully`)
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Transfer Balance" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Card selector row */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">From Card *</label>
            <select
              required
              value={form.fromCardId || ''}
              onChange={e => {
                const id = Number(e.target.value)
                set('fromCardId', id)
                if (form.toCardId === id) set('toCardId', 0)
              }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Select card…</option>
              {cards.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} •••• {c.lastFourDigits}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center pt-5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <ArrowRight className="w-4 h-4 text-indigo-600" />
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">To Card *</label>
            <select
              required
              value={form.toCardId || ''}
              onChange={e => set('toCardId', Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Select card…</option>
              {cards.filter(c => c.id !== form.fromCardId).map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} •••• {c.lastFourDigits}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Balance preview */}
        {(fromCard || toCard) && (
          <div className="flex items-stretch gap-3">
            {fromCard && (
              <div className="flex-1 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-rose-400 font-medium uppercase tracking-wide">From balance</p>
                <p className="text-sm font-bold text-rose-700 mt-0.5">
                  {formatCurrency(fromCard.currentBalance, fromCard.currency)}
                </p>
                <p className="text-[10px] text-rose-400">{fromCard.currency}</p>
              </div>
            )}
            {toCard && (
              <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-wide">To balance</p>
                <p className="text-sm font-bold text-emerald-700 mt-0.5">
                  {formatCurrency(toCard.currentBalance, toCard.currency)}
                </p>
                <p className="text-[10px] text-emerald-400">{toCard.currency}</p>
              </div>
            )}
          </div>
        )}

        {/* Currency mismatch warning */}
        {currencyMismatch && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              These cards have different currencies ({fromCard!.currency} → {toCard!.currency}). The same amount will be credited to the destination card without conversion.
            </p>
          </div>
        )}

        {/* Same card error */}
        {sameCard && (
          <p className="text-xs text-rose-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
            Source and destination cards must be different
          </p>
        )}

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Amount *</label>
          <AmountInput
            required
            value={form.amount || 0}
            currency={fromCard?.currency}
            onChange={v => set('amount', v)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="0"
            suffix={fromCard?.currency}
          />
          {fromCard && form.amount > 0 && form.amount > fromCard.currentBalance && (
            <p className="text-xs text-rose-500 mt-1 pl-1">
              Exceeds available balance ({formatCurrency(fromCard.currentBalance, fromCard.currency)})
            </p>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Date *</label>
          <input
            required
            type="date"
            value={form.transactionDate}
            onChange={e => set('transactionDate', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Description <span className="text-slate-300">(optional)</span></label>
          <input
            type="text"
            value={form.description ?? ''}
            onChange={e => set('description', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="e.g. Monthly savings transfer"
          />
        </div>

        {/* Info banner */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 text-xs text-indigo-700">
          Two transactions will be created: an <strong>expense</strong> on the source card and an <strong>income</strong> on the destination card. Both appear in the Transactions page.
        </div>

        {error && (
          <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !!sameCard}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
