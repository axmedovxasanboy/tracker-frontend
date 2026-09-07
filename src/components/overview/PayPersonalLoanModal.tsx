import { useEffect, useState } from 'react'
import { ArrowDownCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { ErrorTile } from '../ui/ErrorTile'
import { Skeleton } from '../ui/Skeleton'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useApi } from '../../hooks/useApi'
import { cardsApi } from '../../api/cards'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { money, moneyFull, snap, todayLocal } from '../../utils/format'
import type { CardResponse, Currency } from '../../types'

const INPUT = 'w-full border border-slate-200 rounded-control px-3 py-2.5 text-sm text-slate-900 focus-ring'

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

const PAYDOWN_RATE = 0.34

// Both money borrowed from a person (loan-taken) and debts are "debt" → paid at 34% of the
// ORIGINAL total, capped at the residual (final month). Only bank loans have a monthly installment
// (paid via PayBankInstallmentModal, not this one).
function suggestedFor(p: Pickable): number {
  return snap(Math.min(p.total * PAYDOWN_RATE, p.remaining))
}

export function PayPersonalLoanModal({ open, onClose, onSaved, defaultMonth }: Props) {
  const { t } = useLang()
  const { showSuccess } = useToast()
  const suggestLabel = (): string => t('cmp.payPersonalLoan.suggestLabel')
  const loansTaken = useApi(() => financeApi.getLoansTaken(), [])
  const debts = useApi(() => financeApi.getDebts(), [])
  const [selected, setSelected] = useState<Pickable | null>(null)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayLocal())
  const [cardId, setCardId] = useState<number | undefined>()
  const [cards, setCards] = useState<CardResponse[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // `refetch` is stable here: both hooks were given an empty dep array, so useApi's useCallback
  // never re-creates them and this effect cannot re-fire on its own.
  const refetchLoans = loansTaken.refetch
  const refetchDebts = debts.refetch

  useEffect(() => {
    if (!open) return
    setSelected(null)
    setAmount(0)
    setError(null)
    setCardId(undefined)
    // The viewer's clock, not UTC — see the same note in PayBankInstallmentModal.
    const cur = todayLocal()
    setDate(cur.startsWith(defaultMonth) ? cur : `${defaultMonth}-01`)
    cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
    // The page mounts this dialog once and keeps it mounted, so without this the picker still
    // shows the balances it fetched when Plan loaded. A payment made earlier in the same visit
    // would then be priced against a pre-payment `remaining`: the suggested amount, the row label
    // and the client-side ceiling all come from it, so 700.000 would pass local validation against
    // a debt of 660.000 and the server would be the first thing to say no.
    refetchLoans()
    refetchDebts()
  }, [open, defaultMonth, refetchLoans, refetchDebts])

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

  // `selected` is a copy of a picker row, and the amount cap is read from that copy. When fresher
  // figures land — the refetch above, or a retry from the error tile — the selection has to move
  // with them, or the form keeps validating against the balance the row had before.
  const loansData = loansTaken.data
  const debtsData = debts.data
  useEffect(() => {
    if (!selected) return
    const fresh = list.find(p => p.kind === selected.kind && p.id === selected.id)
    if (!fresh) {
      // Settled in full since it was picked: there is nothing left to pay against it.
      setSelected(null)
      setAmount(0)
      return
    }
    if (fresh.remaining === selected.remaining && fresh.total === selected.total) return
    setSelected(fresh)
    setAmount(a => Math.min(a, fresh.remaining))
    // `list` is rebuilt every render, so the two payloads it is derived from are the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loansData, debtsData])

  const matchingCards = selected ? cards.filter(c => c.currency === selected.currency) : []

  const pick = (p: Pickable) => {
    setSelected(p)
    setAmount(suggestedFor(p))
  }

  /** One confirmation for both write paths, so neither can be added without the other. */
  const confirmSaved = (p: Pickable) => {
    showSuccess(t('cmp.payPersonalLoan.recordedToast', {
      name: p.person, amount: moneyFull(amount, p.currency),
    }))
    onSaved(); onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) { setError(t('cmp.err.pickLoanToPay')); return }
    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return }
    if (amount > selected.remaining) {
      setError(t('cmp.err.amountCannotExceedRemaining', { amount: moneyFull(selected.remaining, selected.currency) }))
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
      confirmSaved(selected)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const markAlreadyPaid = async () => {
    if (!selected) { setError(t('cmp.err.pickLoanToPay')); return }
    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return }
    if (amount > selected.remaining) {
      setError(t('cmp.err.amountCannotExceedRemaining', { amount: moneyFull(selected.remaining, selected.currency) }))
      return
    }
    setSaving(true); setError(null)
    try {
      await financeApi.markPaid({
        kind: selected.kind === 'loan-taken' ? 'PERSONAL_LOAN' : 'DEBT',
        refId: selected.id, amount, currency: selected.currency, month: date.slice(0, 7),
      })
      confirmSaved(selected)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const loading = loansTaken.loading || debts.loading
  const refreshing = loansTaken.refreshing || debts.refreshing
  const hasData = (loansTaken.data ?? []).length + (debts.data ?? []).length > 0
  const loadError = loansTaken.error ?? debts.error
  const retry = () => { refetchLoans(); refetchDebts() }

  const footer = list.length === 0 ? (
    <Button label={t('action.close')} onClick={onClose} className="w-full" />
  ) : (
    <div className="space-y-2">
      {/* Was a `title` on the "Already paid" button — a tooltip no touch user could reach. */}
      <p className="text-xs text-slate-500">{t('cmp.hint.reduceBalanceNoTx')}</p>
      <div className="flex flex-wrap gap-3">
        <Button label={t('action.cancel')} onClick={onClose} className="flex-1 min-w-[8rem]" />
        <Button label={t('cmp.action.alreadyPaid')} onClick={markAlreadyPaid}
          disabled={saving || !selected}
          disabledReason={!selected ? t('cmp.err.pickLoanToPay') : undefined}
          className="flex-1 min-w-[8rem]" />
        <Button type="submit" form="pay-personal-form" variant="primary" loading={saving}
          disabled={!selected}
          disabledReason={!selected ? t('cmp.err.pickLoanToPay') : undefined}
          label={saving ? t('action.saving') : t('cmp.action.recordRepayment')}
          className="flex-1 min-w-[8rem]" />
      </div>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={t('cmp.payPersonalLoan.title')} maxWidth="max-w-lg" footer={footer}>
      <form id="pay-personal-form" onSubmit={handleSubmit} className="space-y-4">
        {loading && !hasData ? (
          <Skeleton variant="row" count={3} bare />
        ) : loadError && !hasData ? (
          <ErrorTile message={loadError} onRetry={retry} />
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-600">{t('cmp.payPersonalLoan.noLoans')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600" id="pay-personal-picker">
                {t('cmp.payPersonalLoan.pickHint')}
              </p>
              {/* The balances are re-read every time this opens; the height is reserved so the
                  picker does not jump when the fresh figures land. */}
              <p role="status" className="h-4 text-xs text-slate-500">
                {refreshing ? t('ui.loading') : ''}
              </p>
              <div role="radiogroup" aria-labelledby="pay-personal-picker"
                className="space-y-1.5 max-h-64 overflow-y-auto">
                {list.map(p => {
                  const isSel = selected?.kind === p.kind && selected.id === p.id
                  const suggested = suggestedFor(p)
                  return (
                    <button key={`${p.kind}-${p.id}`} type="button"
                      role="radio"
                      aria-checked={isSel}
                      onClick={() => pick(p)}
                      className={`w-full flex items-center gap-3 p-3 rounded-control border text-left
                                  cursor-pointer transition-colors focus-ring ${
                        isSel
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}>
                      <div className="w-9 h-9 shrink-0 rounded-chip bg-slate-100 text-slate-500 flex items-center justify-center">
                        <ArrowDownCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {p.person}
                          <span className="ml-2 text-xs font-normal uppercase text-slate-500">
                            {p.kind === 'loan-taken' ? t('cmp.payPersonalLoan.borrowed') : t('cmp.payPersonalLoan.debt')}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {t('cmp.repay.remaining')}
                          <span className="font-semibold text-slate-900">{money(p.remaining, p.currency)}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right whitespace-nowrap">
                        <p className="text-xs text-slate-500">{suggestLabel()}</p>
                        <p className="text-sm font-semibold text-slate-900 tabular-nums">{money(suggested, p.currency)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {selected && (
              <>
                <Field id="ploan-amount" required label={t('cmp.field.amountRequired')}
                  help={t('cmp.payPersonalLoan.suggestedHint', {
                    label: suggestLabel().toLowerCase(),
                    amount: moneyFull(suggestedFor(selected), selected.currency),
                    cap: moneyFull(selected.remaining, selected.currency),
                  })}>
                  <AmountInput required value={amount} currency={selected.currency}
                    onChange={v => setAmount(v)}
                    className={INPUT} suffix={selected.currency} />
                </Field>
                <Field id="ploan-date" required label={t('cmp.field.dateRequired')}>
                  <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
                </Field>
                <Field id="ploan-source"
                  label={`${t('cmp.field.source')} ${matchingCards.length === 0 ? t('cmp.source.cashNoMatchingCards') : ''}`}>
                  <select value={cardId ?? ''}
                    onChange={e => setCardId(e.target.value ? Number(e.target.value) : undefined)}
                    className={`${INPUT} bg-white`}>
                    <option value="">{t('cmp.source.cashOnly')}</option>
                    {matchingCards.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} •••• {c.lastFourDigits} · {moneyFull(c.currentBalance, c.currency)}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {error && <p role="alert" className="text-sm text-expense">{error}</p>}
          </>
        )}
      </form>
    </Modal>
  )
}
