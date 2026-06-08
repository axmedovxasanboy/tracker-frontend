import { useEffect, useState } from 'react'
import { ArrowDownCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { useApi } from '../../hooks/useApi'
import { cardsApi } from '../../api/cards'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency, snap } from '../../utils/format'
import type { CardResponse, Currency } from '../../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  defaultMonth: string
}

type Pickable = {
  kind: 'loan-taken' | 'debt'
  id: number
  person: string
  total: number
  remaining: number
  monthly: number | null
  currency: Currency
}

function today() {
  return new Date().toISOString().split('T')[0]
}

const PAYDOWN_RATE = 0.34

// Both money borrowed from a person (loan-taken) and debts are "debt" → paid at 34% of the
// ORIGINAL total, capped at the residual (final month). Only bank loans have a monthly installment
// (paid via PayBankInstallmentModal, not this one).
function suggestedFor(p: Pickable): number {
  return snap(Math.min(p.total * PAYDOWN_RATE, p.remaining))
}

function suggestLabel(_p: Pickable): string {
  return '34% of total'
}

export function PayPersonalLoanModal({ open, onClose, onSaved, defaultMonth }: Props) {
  const loansTaken = useApi(() => financeApi.getLoansTaken(), [])
  const debts = useApi(() => financeApi.getDebts(), [])
  const [selected, setSelected] = useState<Pickable | null>(null)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today())
  const [cardId, setCardId] = useState<number | undefined>()
  const [cards, setCards] = useState<CardResponse[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelected(null)
    setAmount(0)
    setError(null)
    setCardId(undefined)
    const cur = today()
    setDate(cur.startsWith(defaultMonth) ? cur : `${defaultMonth}-01`)
    cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
  }, [open, defaultMonth])

  // Build the unified picker list — only loans with remaining > 0.
  const list: Pickable[] = [
    ...(loansTaken.data ?? [])
      .map(l => ({
        kind: 'loan-taken' as const,
        id: l.id,
        person: l.lenderName,
        total: l.totalAmount,
        remaining: l.remainingAmount,
        monthly: l.monthlyPayment,
        currency: l.currency,
      }))
      .filter(p => p.remaining > 0),
    ...(debts.data ?? [])
      .map(d => ({
        kind: 'debt' as const,
        id: d.id,
        person: d.creditorName,
        total: d.totalAmount,
        remaining: d.remainingAmount,
        monthly: null,
        currency: d.currency,
      }))
      .filter(p => p.remaining > 0),
  ]

  const matchingCards = selected ? cards.filter(c => c.currency === selected.currency) : []

  const pick = (p: Pickable) => {
    setSelected(p)
    setAmount(suggestedFor(p))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) { setError('Pick a loan to pay.'); return }
    if (amount <= 0) { setError('Amount must be greater than 0.'); return }
    if (amount > selected.remaining) {
      setError(`Amount cannot exceed remaining (${formatCurrency(selected.remaining, selected.currency)}).`)
      return
    }
    setSaving(true); setError(null)
    try {
      const req = { amount, paymentDate: date, cardId }
      if (selected.kind === 'loan-taken') {
        await financeApi.repayLoanTaken(selected.id, req)
      } else {
        await financeApi.repayDebt(selected.id, req)
      }
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const markAlreadyPaid = async () => {
    if (!selected) { setError('Pick a loan to pay.'); return }
    if (amount <= 0) { setError('Amount must be greater than 0.'); return }
    if (amount > selected.remaining) {
      setError(`Amount cannot exceed remaining (${formatCurrency(selected.remaining, selected.currency)}).`)
      return
    }
    setSaving(true); setError(null)
    try {
      await financeApi.markPaid({
        kind: selected.kind === 'loan-taken' ? 'PERSONAL_LOAN' : 'DEBT',
        refId: selected.id, amount, currency: selected.currency, month: date.slice(0, 7),
      })
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const loading = loansTaken.loading || debts.loading
  const hasData = (loansTaken.data ?? []).length + (debts.data ?? []).length > 0

  return (
    <Modal open={open} onClose={onClose} title="Pay your debts (34% of total)" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {loading && !hasData ? (
          <div className="h-32 flex items-center justify-center"><Spinner /></div>
        ) : list.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-500">
            No personal loans with a remaining balance.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">
                Pick a debt — the amount pre-fills with 34% of its total (capped at remaining)
              </label>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {list.map(p => {
                  const isSel = selected?.kind === p.kind && selected.id === p.id
                  const suggested = suggestedFor(p)
                  return (
                    <button key={`${p.kind}-${p.id}`} type="button" onClick={() => pick(p)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                        isSel
                          ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}>
                      <ArrowDownCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">
                          {p.person}
                          <span className="ml-2 text-[11px] font-normal text-slate-400 uppercase">
                            {p.kind === 'loan-taken' ? 'Borrowed' : 'Debt'}
                          </span>
                        </p>
                        <p className="text-xs text-slate-400">
                          Remaining: <span className="font-semibold text-rose-600">{formatCurrency(p.remaining, p.currency)}</span>
                        </p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="text-[11px] text-slate-400">{suggestLabel(p)}</p>
                        <p className="text-sm font-bold text-indigo-700">{formatCurrency(suggested, p.currency)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {selected && (
              <>
                <Field label="Amount *">
                  <AmountInput required value={amount} currency={selected.currency}
                    onChange={v => setAmount(v)}
                    className={INPUT} suffix={selected.currency} />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Suggested {suggestLabel(selected).toLowerCase()}: {formatCurrency(suggestedFor(selected), selected.currency)} ·
                    Cap (remaining): {formatCurrency(selected.remaining, selected.currency)}
                  </p>
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
              </>
            )}

            {error && (
              <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={markAlreadyPaid} disabled={saving || !selected}
                title="Reduce the balance without recording a transaction"
                className="flex-1 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-60">
                Already paid
              </button>
              <button type="submit" disabled={saving || !selected}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Spinner className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Record repayment'}
              </button>
            </div>
          </>
        )}
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
