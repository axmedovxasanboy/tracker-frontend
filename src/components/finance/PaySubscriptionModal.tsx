import { useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, todayLocal } from '../../utils/format'
import { CashPart, CompactDate, MONEY_INPUT, MONEY_INPUT_INVALID } from '../transactions/formParts'
import { WalletPicker } from '../transactions/WalletPicker'
import { rememberWallet, useWalletChoice, useWallets } from '../transactions/wallets'
import type { MonthlyPaymentMode, MonthlyPaymentPayRequest, MonthlyPaymentResponse } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  subscription: MonthlyPaymentResponse | null
  /**
   * Start on this amount instead of the bill's usual price — what is still to pay this month, so
   * a bill that is already partly paid is not paid in full a second time.
   */
  defaultAmount?: number
}

const FORM_ID = 'pay-subscription-form'

/**
 * Pay one monthly bill: the amount (what is left to pay, else its usual price), the wallet it comes
 * from, the date.
 *
 * The wallet starts on the one last used, else the card holding the most — never on a cash pot too
 * small for the bill. A split between card and cash is one link away, not a mode to pick first.
 */
export function PaySubscriptionModal({ open, onClose, onSaved, subscription, defaultAmount }: Props) {
  const { t } = useLang()
  const currency = subscription?.currency ?? 'UZS'

  const [amount, setAmount] = useState(subscription?.amount ?? 0)
  const [split, setSplit] = useState(false)
  const [cashPart, setCashPart] = useState(0)
  const [paymentDate, setPaymentDate] = useState(todayLocal())
  const [updateForFuture, setUpdateForFuture] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'amount' | 'wallet' | 'split' | null>(null)

  const wallets = useWallets(open && !!subscription, currency)
  const choice = useWalletChoice({
    open: open && !!subscription,
    cards: wallets.cards,
    cashBalance: wallets.cashBalance,
    loaded: wallets.loaded,
    amount,
    allowCash: !split,
  })

  const startAmount = defaultAmount != null && defaultAmount > 0 ? defaultAmount : subscription?.amount ?? 0

  useEffect(() => {
    if (open && subscription) {
      setAmount(startAmount)
      setSplit(false)
      setCashPart(0)
      setPaymentDate(todayLocal())
      setUpdateForFuture(false)
      setError(null)
      setInvalid(null)
    }
    // Seeded once per open: the amount follows the owner from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subscription])

  if (!subscription) return null

  // "Use this as the usual amount" is for a new price, not for paying what is left of this month's.
  const amountDiffersFromDefault = Math.abs(amount - subscription.amount) > 0.001
    && Math.abs(amount - startAmount) > 0.001
  const wallet = choice.value

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) { setInvalid('amount'); setError(t('cmp.err.amountPositive')); return }
    if (split && (cashPart <= 0 || cashPart >= amount)) {
      setInvalid('split'); setError(t('home.form.err.splitParts')); return
    }
    if (wallet == null || wallet === 'none' || (split && typeof wallet !== 'number')) {
      setInvalid('wallet'); setError(t(split ? 'cmp.err.pickCardForPortion' : 'cmp.err.pickCardOrCash')); return
    }

    const mode: MonthlyPaymentMode = split ? 'BOTH' : wallet === 'cash' ? 'CASH' : 'CARD'
    const req: MonthlyPaymentPayRequest = {
      amount,
      paymentDate,
      mode,
      cardId: typeof wallet === 'number' ? wallet : undefined,
      cashAmount: split ? cashPart : undefined,
      updateAmountForFuture: amountDiffersFromDefault ? updateForFuture : false,
    }

    setSaving(true); setError(null); setInvalid(null)
    try {
      await financeApi.payMonthlyPayment(subscription.id, req)
      rememberWallet(wallet)
      onSaved(); onClose()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cmp.paySubscription.title', { name: subscription.name })}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
            label={saving ? t('action.saving') : t('page.shared.payButton')} />
        </div>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-control border border-hairline px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-indigo-100 text-indigo-600">
            <Calendar className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{subscription.name}</p>
            <p className="text-xs text-slate-500">
              {t('home.form.usualAmount', { amount: moneyFull(subscription.amount, currency) })}
            </p>
          </div>
        </div>

        <Field id="pay-sub-amount" label={t('tx.amount')} required
          error={invalid === 'amount' ? error ?? undefined : undefined}>
          <AmountInput value={amount || 0} currency={currency}
            onChange={v => { setAmount(v); if (invalid === 'amount') { setInvalid(null); setError(null) } }}
            className={invalid === 'amount' ? MONEY_INPUT_INVALID : MONEY_INPUT} suffix={currency} />
        </Field>

        <WalletPicker
          id="pay-sub-wallet"
          label={t('home.wallet.from')}
          cards={wallets.cards}
          cashBalance={wallets.cashBalance}
          currency={currency}
          loaded={wallets.loaded}
          failed={wallets.failed}
          onRetry={wallets.reload}
          value={wallet}
          onChange={v => { choice.choose(v); if (invalid === 'wallet') { setInvalid(null); setError(null) } }}
          split={split}
          onSplitChange={next => {
            setSplit(next)
            if (!next) setCashPart(0)
            if (next && typeof wallet !== 'number' && wallets.cards.length > 0) {
              choice.choose(wallets.cards.reduce((a, c) => (c.currentBalance > a.currentBalance ? c : a)).id)
            }
          }}
          error={invalid === 'wallet' ? error ?? undefined : undefined}
        />
        {split && (
          <CashPart
            id="pay-sub-cash-part"
            total={amount}
            cash={cashPart}
            onCash={v => { setCashPart(v); if (invalid === 'split') { setInvalid(null); setError(null) } }}
            currency={currency}
            error={invalid === 'split' ? error ?? undefined : undefined}
          />
        )}

        <CompactDate id="pay-sub-date" label={t('tx.date')} value={paymentDate} onChange={setPaymentDate} />

        {/* The one tinted panel in this dialog: ticking it changes the bill's saved amount for
            every future month, so it has to stand out. */}
        {amountDiffersFromDefault && amount > 0 && (
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-control border border-amber-200 bg-amber-50 p-3">
            <input type="checkbox" checked={updateForFuture}
              onChange={e => setUpdateForFuture(e.target.checked)}
              className="focus-ring mt-0.5 h-4 w-4 rounded border-amber-300 accent-indigo-600 focus-visible:ring-offset-amber-50" />
            <span className="text-xs leading-relaxed text-amber-900">
              {t('home.form.useAsUsual', { amount: moneyFull(amount, currency) })}
            </span>
          </label>
        )}

        {error && !invalid && (
          <p role="alert" className="rounded-control border border-rose-200 px-3 py-2 text-sm text-expense">{error}</p>
        )}
      </form>
    </Modal>
  )
}
