import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { cardsApi } from '../../api/cards'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency } from '../../utils/format'
import type { CardResponse, InvestmentResponse } from '../../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

function today() {
  return new Date().toISOString().split('T')[0]
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  investment: InvestmentResponse | null
}

/** Add money to an existing investment / savings goal. Contribution currency matches the goal. */
export function ContributeInvestmentModal({ open, onClose, onSaved, investment }: Props) {
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  const [cardId, setCardId] = useState<number | undefined>()
  const [cards, setCards] = useState<CardResponse[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmount(0); setDate(today()); setDescription(''); setCardId(undefined); setError(null)
    cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
  }, [open])

  if (!investment) return null
  const currency = investment.currency
  const matchingCards = cards.filter(c => c.currency === currency)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) { setError('Amount must be greater than 0.'); return }
    setSaving(true); setError(null)
    try {
      await financeApi.contributeInvestment(investment.id, {
        amount, currency, date,
        cardId,
        description: description.trim() || undefined,
      })
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Contribute to ${investment.name}`} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label={`Amount * (${currency})`}>
          <AmountInput required value={amount} currency={currency}
            onChange={v => setAmount(v)} className={INPUT} suffix={currency} />
        </Field>

        <Field label="Date *">
          <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
        </Field>

        <Field label={`Source ${matchingCards.length === 0 ? '(cash — no matching cards)' : ''}`}>
          <select value={cardId ?? ''}
            onChange={e => setCardId(e.target.value ? Number(e.target.value) : undefined)}
            className={`${INPUT} bg-white`}>
            <option value="">— Cash —</option>
            {matchingCards.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} •••• {c.lastFourDigits} · {formatCurrency(c.currentBalance, c.currency)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description">
          <textarea rows={2} value={description}
            onChange={e => setDescription(e.target.value)}
            className={`${INPUT} resize-none`} />
        </Field>

        {error && (
          <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Contribute'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
