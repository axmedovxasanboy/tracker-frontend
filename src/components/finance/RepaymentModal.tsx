import { useState, useEffect } from 'react'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, snap, todayLocal } from '../../utils/format'
import { CompactDate, MONEY_INPUT, MONEY_INPUT_INVALID } from '../transactions/formParts'
import { WalletPicker } from '../transactions/WalletPicker'
import { rememberWallet, useWalletChoice, useWallets } from '../transactions/wallets'
import type { Currency, DebtResponse, LoanGivenResponse, LoanTakenResponse, RepaymentRequest } from '../../types'

export type RepayTarget =
  | { kind: 'loan-taken'; record: LoanTakenResponse }
  | { kind: 'debt';       record: DebtResponse }
  | { kind: 'loan-given'; record: LoanGivenResponse }

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  target: RepayTarget | null
  /** Start on this amount (capped at what is left) instead of the whole balance — e.g. this month's payment. */
  defaultAmount?: number
}

const FORM_ID = 'repayment-form'

function getInfo(target: RepayTarget | null, t: (key: TKey) => string) {
  if (!target) return { label: '', person: '', remaining: 0, currency: 'UZS' as Currency, maxAmount: 0 }
  if (target.kind === 'loan-taken') {
    return {
      label: t('cmp.repay.title.loanTaken'),
      person: target.record.lenderName,
      remaining: target.record.remainingAmount,
      currency: target.record.currency,
      maxAmount: target.record.remainingAmount,
    }
  }
  if (target.kind === 'debt') {
    return {
      label: t('cmp.repay.title.debt'),
      person: target.record.creditorName,
      remaining: target.record.remainingAmount,
      currency: target.record.currency,
      maxAmount: target.record.remainingAmount,
    }
  }
  return {
    label: t('home.form.repay.returnedTitle'),
    person: target.record.debtorName,
    remaining: target.record.pendingAmount,
    currency: target.record.currency,
    maxAmount: target.record.pendingAmount,
  }
}

/**
 * Pay back one loan or debt, or record money a borrower paid back to you. The amount starts on
 * `defaultAmount` when the caller knows this month's payment, else on the whole balance.
 */
export function RepaymentModal({ open, onClose, onSaved, target, defaultAmount }: Props) {
  const { t } = useLang()
  const { showSuccess } = useToast()
  const info = getInfo(target, t)
  const incoming = target?.kind === 'loan-given'
  const [amount, setAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState(todayLocal())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'amount' | 'wallet' | null>(null)

  const wallets = useWallets(open && !!target, info.currency)
  const choice = useWalletChoice({
    open: open && !!target,
    cards: wallets.cards,
    cashBalance: wallets.cashBalance,
    loaded: wallets.loaded,
    amount,
    incoming,
  })

  useEffect(() => {
    if (open) {
      const start = defaultAmount != null && defaultAmount > 0
        ? Math.min(defaultAmount, info.maxAmount)
        : info.maxAmount
      setAmount(snap(start))
      setPaymentDate(todayLocal())
      setError(null)
      setInvalid(null)
    }
    // `info` is derived from `target`, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target, defaultAmount])

  const validate = () => {
    if (amount <= 0) { setInvalid('amount'); setError(t('cmp.err.amountPositive')); return false }
    if (amount > info.maxAmount + 0.001) {
      setInvalid('amount')
      setError(t('cmp.err.cannotExceedRemaining', { amount: moneyFull(info.maxAmount, info.currency) }))
      return false
    }
    if (choice.value == null || choice.value === 'none') {
      setInvalid('wallet'); setError(t('cmp.err.pickCardOrCash')); return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target || !validate()) return

    setSaving(true); setError(null); setInvalid(null)
    const wallet = choice.value
    const req: RepaymentRequest = { amount, paymentDate, cardId: typeof wallet === 'number' ? wallet : undefined }
    try {
      if (target.kind === 'loan-taken') await financeApi.repayLoanTaken(target.record.id, req)
      else if (target.kind === 'debt')  await financeApi.repayDebt(target.record.id, req)
      else                              await financeApi.markLoanGivenReturned(target.record.id, req)
      rememberWallet(wallet)
      // The write confirms itself — the audit found nine payment flows that ended in silence.
      showSuccess(t('cmp.repay.recordedToast', { amount: moneyFull(amount, info.currency) }))
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={info.label}
      maxWidth="max-w-md"
      footer={
        <div className="flex gap-3">
          <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
            label={saving ? t('action.saving') : incoming ? t('action.save') : t('page.shared.payButton')} />
        </div>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-control border border-hairline px-3 py-2.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-chip ${
            incoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            {incoming
              ? <ArrowUpCircle className="w-4 h-4" aria-hidden="true" />
              : <ArrowDownCircle className="w-4 h-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{info.person}</p>
            <p className="text-xs text-slate-500">
              {t(incoming ? 'home.form.repay.stillOwedToYou' : 'home.form.repay.leftToPay', {
                amount: moneyFull(info.remaining, info.currency),
              })}
            </p>
          </div>
        </div>

        <Field id="repay-amount" label={t('tx.amount')} required
          error={invalid === 'amount' ? error ?? undefined : undefined}>
          <AmountInput
            value={amount || 0}
            currency={info.currency}
            onChange={v => { setAmount(v); if (invalid === 'amount') { setInvalid(null); setError(null) } }}
            className={invalid === 'amount' ? MONEY_INPUT_INVALID : MONEY_INPUT}
            placeholder="0"
            suffix={info.currency}
          />
        </Field>

        {/* Quick fill — a quarter, a half, or the whole thing. */}
        <div className="flex gap-2">
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <Button
              key={pct}
              size="sm"
              variant="ghost"
              label={pct === 1 ? t('cmp.repay.full') : `${pct * 100}%`}
              onClick={() => { setAmount(snap(info.maxAmount * pct)); setInvalid(null); setError(null) }}
              className="flex-1 bg-slate-100"
            />
          ))}
        </div>

        <WalletPicker
          id="repay-wallet"
          label={t(incoming ? 'home.wallet.to' : 'home.wallet.from')}
          cards={wallets.cards}
          cashBalance={wallets.cashBalance}
          currency={info.currency}
          loaded={wallets.loaded}
          failed={wallets.failed}
          onRetry={wallets.reload}
          value={choice.value}
          onChange={v => { choice.choose(v); if (invalid === 'wallet') { setInvalid(null); setError(null) } }}
          error={invalid === 'wallet' ? error ?? undefined : undefined}
        />

        <CompactDate id="repay-date" label={t('tx.date')} value={paymentDate} onChange={setPaymentDate} />

        {amount > 0 && amount <= info.maxAmount + 0.001 && (
          <p className="text-xs tabular-nums text-slate-500">
            {t(incoming ? 'home.form.repay.stillOwedAfter' : 'home.form.repay.leftAfter', {
              amount: moneyFull(Math.max(0, info.remaining - amount), info.currency),
            })}
          </p>
        )}

        {error && !invalid && (
          <p role="alert" className="rounded-control border border-rose-200 px-3 py-2 text-sm text-expense">{error}</p>
        )}
      </form>
    </Modal>
  )
}
