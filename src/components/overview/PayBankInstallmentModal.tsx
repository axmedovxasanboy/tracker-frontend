import { useEffect, useState } from 'react'
import { Landmark } from 'lucide-react'
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
import { transactionsApi } from '../../api/transactions'
import { extractErrorMessage } from '../../api/client'
import { money, moneyFull, todayLocal } from '../../utils/format'
import type { BankLoanResponse, CardResponse } from '../../types'

const INPUT = 'w-full border border-slate-200 rounded-control px-3 py-2.5 text-sm text-slate-900 focus-ring'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  defaultMonth: string  // YYYY-MM
}

export function PayBankInstallmentModal({ open, onClose, onSaved, defaultMonth }: Props) {
  const { t } = useLang()
  const { showSuccess } = useToast()
  const bankLoans = useApi(() => financeApi.getBankLoans(), [])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayLocal())
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
    // The viewer's clock, not UTC: before 05:00 in Tashkent toISOString() named yesterday, which
    // for a payment made just after midnight on the 1st filed it into the previous month.
    const cur = todayLocal()
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

  /** One confirmation for both write paths, so neither can be added without the other. */
  const confirmSaved = (currency: BankLoanResponse['currency']) => {
    showSuccess(t('cmp.payBankInstallment.recordedToast', { amount: moneyFull(amount, currency) }))
    onSaved(); onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) { setError(t('cmp.err.pickBankLoanToPay')); return }
    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return }
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
      confirmSaved(selected.currency)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const markAlreadyPaid = async () => {
    if (!selected) { setError(t('cmp.err.pickBankLoanToPay')); return }
    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return }
    setSaving(true); setError(null)
    try {
      await financeApi.markPaid({
        kind: 'BANK', refId: selected.id,
        amount, currency: selected.currency, month: date.slice(0, 7),
      })
      confirmSaved(selected.currency)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const footer = list.length === 0 ? (
    <Button label={t('action.close')} onClick={onClose} className="w-full" />
  ) : (
    <div className="space-y-2">
      {/* Was a `title` on the "Already paid" button — a tooltip no touch user could reach. */}
      <p className="text-xs text-slate-500">{t('cmp.hint.markInstallmentMetNoTx')}</p>
      <div className="flex flex-wrap gap-3">
        <Button label={t('action.cancel')} onClick={onClose} className="flex-1 min-w-[8rem]" />
        <Button label={t('cmp.action.alreadyPaid')} onClick={markAlreadyPaid}
          disabled={saving || !selected}
          disabledReason={!selected ? t('cmp.err.pickBankLoanToPay') : undefined}
          className="flex-1 min-w-[8rem]" />
        <Button type="submit" form="pay-bank-form" variant="primary" loading={saving}
          disabled={!selected}
          disabledReason={!selected ? t('cmp.err.pickBankLoanToPay') : undefined}
          label={saving ? t('action.saving') : t('cmp.action.recordInstallment')}
          className="flex-1 min-w-[8rem]" />
      </div>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={t('cmp.payBankInstallment.title')} maxWidth="max-w-lg" footer={footer}>
      <form id="pay-bank-form" onSubmit={handleSubmit} className="space-y-4">
        {bankLoans.loading && !bankLoans.data ? (
          <Skeleton variant="row" count={3} bare />
        ) : bankLoans.error && !bankLoans.data ? (
          <ErrorTile message={bankLoans.error} onRetry={bankLoans.refetch} />
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-600">{t('cmp.payBankInstallment.noLoans')}</p>
        ) : (
          <>
            {/* Loan picker */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600" id="pay-bank-picker">
                {t('cmp.payBankInstallment.pickLoan')}
              </p>
              <div role="radiogroup" aria-labelledby="pay-bank-picker" className="space-y-1.5">
                {list.map(b => (
                  <button key={b.id} type="button"
                    role="radio"
                    aria-checked={selectedId === b.id}
                    onClick={() => { setSelectedId(b.id); setAmount(b.monthlyPayment ?? 0) }}
                    className={`w-full flex items-center gap-3 p-3 rounded-control border text-left
                                cursor-pointer transition-colors focus-ring ${
                      selectedId === b.id
                        ? 'bg-indigo-50 border-indigo-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}>
                    <div className="w-9 h-9 shrink-0 rounded-chip bg-slate-100 text-slate-500 flex items-center justify-center">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{b.bankName} — {b.loanName}</p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {t('cmp.payBankInstallment.total')} {moneyFull(b.totalAmount, b.currency)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {t('cmp.payBankInstallment.perMonth', { amount: money(b.monthlyPayment ?? 0, b.currency) })}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <>
                <Field id="pbank-amount" required label={t('cmp.field.amountRequired')}
                  help={t('cmp.payBankInstallment.defaultHint', {
                    amount: moneyFull(selected.monthlyPayment ?? 0, selected.currency),
                  })}>
                  <AmountInput required value={amount} currency={selected.currency}
                    onChange={v => setAmount(v)}
                    className={INPUT} suffix={selected.currency} />
                </Field>
                <Field id="pbank-date" required label={t('cmp.field.dateRequired')}>
                  <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
                </Field>
                <Field id="pbank-source"
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
