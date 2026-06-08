import { useEffect, useState } from 'react'
import { Landmark } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { useApi } from '../../hooks/useApi'
import { cardsApi } from '../../api/cards'
import { financeApi } from '../../api/finance'
import { transactionsApi } from '../../api/transactions'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency } from '../../utils/format'
import type { BankLoanResponse, CardResponse } from '../../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  defaultMonth: string  // YYYY-MM
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export function PayBankInstallmentModal({ open, onClose, onSaved, defaultMonth }: Props) {
  const bankLoans = useApi(() => financeApi.getBankLoans(), [])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today())
  const [cardId, setCardId] = useState<number | undefined>()
  const [cards, setCards] = useState<CardResponse[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelectedId(null)
    setAmount(0)
    setError(null)
    setCardId(undefined)
    const cur = today()
    setDate(cur.startsWith(defaultMonth) ? cur : `${defaultMonth}-01`)
    cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
  }, [open, defaultMonth])

  const list = (bankLoans.data ?? []).filter(b => b.monthlyPayment != null && b.monthlyPayment > 0)
  const selected: BankLoanResponse | undefined = list.find(b => b.id === selectedId)
  const matchingCards = selected ? cards.filter(c => c.currency === selected.currency) : []

  // When a loan is picked, default the amount to its saved monthly payment.
  useEffect(() => {
    if (selected && amount === 0 && selected.monthlyPayment != null) {
      setAmount(selected.monthlyPayment)
    }
  }, [selected])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) { setError('Pick a bank loan to pay.'); return }
    if (amount <= 0) { setError('Amount must be greater than 0.'); return }
    setSaving(true); setError(null)
    try {
      // Record as a BANK_LOAN_PAYMENT Transaction. (Bank loans don't have a /repay
      // endpoint today because they have no per-loan paid_amount column — the
      // installment lives only as the recurring schedule on the BankLoan row.)
      await transactionsApi.create({
        type: 'EXPENSE',
        subType: 'BANK_LOAN_PAYMENT',
        amount, currency: selected.currency,
        description: `Bank installment — ${selected.bankName} (${selected.loanName})`,
        transactionDate: date,
        cardId: cardId,
        cashAmount: cardId ? 0 : amount,
      })
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const markAlreadyPaid = async () => {
    if (!selected) { setError('Pick a bank loan to pay.'); return }
    if (amount <= 0) { setError('Amount must be greater than 0.'); return }
    setSaving(true); setError(null)
    try {
      await financeApi.markPaid({
        kind: 'BANK', refId: selected.id,
        amount, currency: selected.currency, month: date.slice(0, 7),
      })
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Pay bank installment" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {bankLoans.loading && !bankLoans.data ? (
          <div className="h-32 flex items-center justify-center"><Spinner /></div>
        ) : list.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-500">
            No bank loans with a monthly payment set. Edit a bank loan in Finance → Bank Loans
            to give it a monthly amount, then return here.
          </div>
        ) : (
          <>
            {/* Loan picker */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Pick a bank loan</label>
              <div className="space-y-1.5">
                {list.map(b => (
                  <button key={b.id} type="button"
                    onClick={() => { setSelectedId(b.id); setAmount(b.monthlyPayment ?? 0) }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                      selectedId === b.id
                        ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}>
                    <Landmark className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{b.bankName} — {b.loanName}</p>
                      <p className="text-xs text-slate-400">Total: {formatCurrency(b.totalAmount, b.currency)}</p>
                    </div>
                    <p className="text-sm font-bold text-indigo-700 whitespace-nowrap">
                      {formatCurrency(b.monthlyPayment ?? 0, b.currency)} / mo
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <>
                <Field label="Amount *">
                  <AmountInput required value={amount} currency={selected.currency}
                    onChange={v => setAmount(v)}
                    className={INPUT} suffix={selected.currency} />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Default = saved monthly ({formatCurrency(selected.monthlyPayment ?? 0, selected.currency)}). Lower it if you can't pay in full this month.
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
                title="Count this installment as met without recording a transaction"
                className="flex-1 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-60">
                Already paid
              </button>
              <button type="submit" disabled={saving || !selected}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Spinner className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Record installment'}
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
