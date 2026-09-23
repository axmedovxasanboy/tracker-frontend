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
import { financeApi } from '../../api/finance'
import { transactionsApi } from '../../api/transactions'
import { extractErrorMessage } from '../../api/client'
import { money, moneyFull, todayLocal } from '../../utils/format'
import { CompactDate, MONEY_INPUT, MONEY_INPUT_INVALID } from '../transactions/formParts'
import { WalletPicker } from '../transactions/WalletPicker'
import { rememberWallet, useWalletChoice, useWallets } from '../transactions/wallets'
import type { BankLoanResponse } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  defaultMonth: string  // YYYY-MM
  /** Open straight on this bank loan — "Pay" beside it on Home. The picker is then skipped. */
  bankLoanId?: number
  /** Start on this amount instead of the loan's monthly payment. */
  defaultAmount?: number
}

const FORM_ID = 'pay-bank-form'

/** Pay a bank loan's monthly payment: which loan (skipped when it is known), how much, from where. */
export function PayBankInstallmentModal({ open, onClose, onSaved, defaultMonth, bankLoanId, defaultAmount }: Props) {
  const { t } = useLang()
  const { showSuccess } = useToast()
  const bankLoans = useApi(() => financeApi.getBankLoans(), [])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayLocal())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'amount' | 'wallet' | null>(null)

  const list = (bankLoans.data ?? []).filter(b => b.monthlyPayment != null && b.monthlyPayment > 0)
  const selected: BankLoanResponse | undefined = list.find(b => b.id === selectedId)
    // A loan opened by id may have no monthly payment set; it is still the one to pay.
    ?? (bankLoanId != null && selectedId === bankLoanId
      ? (bankLoans.data ?? []).find(b => b.id === bankLoanId)
      : undefined)
  const currency = selected?.currency ?? 'UZS'

  const wallets = useWallets(open, currency)
  const choice = useWalletChoice({
    open,
    cards: wallets.cards,
    cashBalance: wallets.cashBalance,
    loaded: wallets.loaded,
    amount,
  })

  const refetchLoans = bankLoans.refetch
  useEffect(() => {
    if (!open) return
    setSelectedId(bankLoanId ?? null)
    setAmount(defaultAmount && defaultAmount > 0 ? defaultAmount : 0)
    setError(null)
    setInvalid(null)
    // The viewer's clock, not UTC: before 05:00 in Tashkent toISOString() named yesterday.
    const cur = todayLocal()
    setDate(cur.startsWith(defaultMonth) ? cur : `${defaultMonth}-01`)
    refetchLoans()
  }, [open, defaultMonth, bankLoanId, defaultAmount, refetchLoans])

  // One loan and nothing picked: it is the one.
  useEffect(() => {
    if (!open || selectedId != null || list.length !== 1) return
    setSelectedId(list[0].id)
    // `list` is rebuilt every render; the payload it comes from is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId, bankLoans.data])

  // A picked loan fills in its monthly payment, unless an amount was handed in or typed.
  useEffect(() => {
    if (selected && amount === 0 && selected.monthlyPayment != null) setAmount(selected.monthlyPayment)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) { setError(t('cmp.err.pickBankLoanToPay')); return }
    if (amount <= 0) { setInvalid('amount'); setError(t('cmp.err.amountPositive')); return }
    const wallet = choice.value
    if (wallet == null || wallet === 'none') { setInvalid('wallet'); setError(t('cmp.err.pickCardOrCash')); return }
    setSaving(true); setError(null); setInvalid(null)
    try {
      // Booked as a BANK_LOAN_PAYMENT transaction: bank loans keep no paid total of their own.
      await transactionsApi.create({
        type: 'EXPENSE',
        subType: 'BANK_LOAN_PAYMENT',
        amount, currency: selected.currency,
        description: `Bank installment — ${selected.bankName} (${selected.loanName})`,
        transactionDate: date,
        cardId: typeof wallet === 'number' ? wallet : undefined,
        cashAmount: typeof wallet === 'number' ? 0 : amount,
      })
      rememberWallet(wallet)
      showSuccess(t('cmp.payBankInstallment.recordedToast', { amount: moneyFull(amount, selected.currency) }))
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const knownLoan = bankLoanId != null && !!selected
  const nothingToPay = !bankLoans.loading && list.length === 0 && !knownLoan

  const footer = nothingToPay ? (
    <Button label={t('action.close')} onClick={onClose} className="w-full" />
  ) : (
    <div className="flex gap-3">
      <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
      <Button type="submit" form={FORM_ID} variant="primary" loading={saving}
        disabled={!selected}
        disabledReason={!selected ? t('cmp.err.pickBankLoanToPay') : undefined}
        label={saving ? t('action.saving') : t('page.shared.payButton')}
        className="flex-1" />
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={t('cmp.payBankInstallment.title')} maxWidth="max-w-lg" footer={footer}>
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        {bankLoans.loading && !bankLoans.data ? (
          <Skeleton variant="row" count={2} bare />
        ) : bankLoans.error && !bankLoans.data ? (
          <ErrorTile message={bankLoans.error} onRetry={bankLoans.refetch} />
        ) : nothingToPay ? (
          <p className="text-sm text-slate-600">{t('home.form.bank.none')}</p>
        ) : (
          <>
            {knownLoan || list.length === 1 ? (
              selected && (
                <div className="flex items-center gap-3 rounded-control border border-hairline px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-slate-100 text-slate-500">
                    <Landmark className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{selected.bankName} — {selected.loanName}</p>
                    {selected.monthlyPayment != null && (
                      <p className="text-xs tabular-nums text-slate-500">
                        {t('cmp.payBankInstallment.perMonth', { amount: moneyFull(selected.monthlyPayment, selected.currency) })}
                      </p>
                    )}
                  </div>
                </div>
              )
            ) : (
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
                        <Landmark className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{b.bankName} — {b.loanName}</p>
                      <p className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {t('cmp.payBankInstallment.perMonth', { amount: money(b.monthlyPayment ?? 0, b.currency) })}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected && (
              <>
                <Field id="pbank-amount" required label={t('tx.amount')}
                  error={invalid === 'amount' ? error ?? undefined : undefined}>
                  <AmountInput value={amount} currency={selected.currency}
                    onChange={v => { setAmount(v); if (invalid === 'amount') { setInvalid(null); setError(null) } }}
                    className={invalid === 'amount' ? MONEY_INPUT_INVALID : MONEY_INPUT} suffix={selected.currency} />
                </Field>
                <WalletPicker
                  id="pbank-wallet"
                  label={t('home.wallet.from')}
                  cards={wallets.cards}
                  cashBalance={wallets.cashBalance}
                  currency={selected.currency}
                  loaded={wallets.loaded}
                  failed={wallets.failed}
                  onRetry={wallets.reload}
                  value={choice.value}
                  onChange={v => { choice.choose(v); if (invalid === 'wallet') { setInvalid(null); setError(null) } }}
                  error={invalid === 'wallet' ? error ?? undefined : undefined}
                />
                <CompactDate id="pbank-date" label={t('tx.date')} value={date} onChange={setDate} />
              </>
            )}

            {error && !invalid && <p role="alert" className="text-sm text-expense">{error}</p>}
          </>
        )}
      </form>
    </Modal>
  )
}
