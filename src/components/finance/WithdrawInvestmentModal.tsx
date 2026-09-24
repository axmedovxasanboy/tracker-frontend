import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, todayLocal } from '../../utils/format'
import { CompactDate, CONTROL, MONEY_INPUT, MONEY_INPUT_INVALID, useOptional } from '../transactions/formParts'
import { WalletPicker } from '../transactions/WalletPicker'
import { rememberWallet, useWalletChoice, useWallets } from '../transactions/wallets'
import { growthOf } from '../savings/growth'
import type { InvestmentResponse } from '../../types'

const FORM_ID = 'withdraw-investment-form'

interface Props {
  open: boolean
  onClose: () => void
  /** Refetch — this dialog raises its own toast. */
  onSaved: () => void
  investment: InvestmentResponse | null
}

/**
 * Take all or part of an investment / the emergency fund out into a wallet. The wallet goes up,
 * the holding goes down, and the money is booked as "from savings" — not as income.
 */
export function WithdrawInvestmentModal({ open, onClose, onSaved, investment }: Props) {
  const { t } = useLang()
  const { showSuccess } = useToast()
  const optional = useOptional()
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayLocal())
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'amount' | 'wallet' | null>(null)

  const currency = investment?.currency ?? 'UZS'
  const wallets = useWallets(open && !!investment, currency)
  const choice = useWalletChoice({
    open: open && !!investment,
    cards: wallets.cards,
    cashBalance: wallets.cashBalance,
    loaded: wallets.loaded,
    amount,
    incoming: true,
  })

  useEffect(() => {
    if (!open) return
    setAmount(0); setDate(todayLocal()); setDescription(''); setError(null); setInvalid(null)
  }, [open])

  if (!investment) return null
  const value = growthOf(investment).value
  const left = value - amount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) { setInvalid('amount'); setError(t('cmp.err.amountPositive')); return }
    if (amount > value) {
      setInvalid('amount'); setError(t('cmp.withdraw.tooMuch', { amount: moneyFull(value, currency) })); return
    }
    const wallet = choice.value
    if (wallet !== 'cash' && typeof wallet !== 'number') {
      setInvalid('wallet'); setError(t('cmp.err.pickCardOrCash')); return
    }
    setSaving(true); setError(null); setInvalid(null)
    try {
      await financeApi.withdrawInvestment(investment.id, {
        amount, currency, date,
        cardId: typeof wallet === 'number' ? wallet : null,
        description: description.trim() || undefined,
      })
      rememberWallet(wallet)
      const walletName = typeof wallet === 'number'
        ? wallets.cards.find(c => c.id === wallet)?.name ?? t('tx.cash')
        : t('tx.cash')
      showSuccess(t('cmp.withdraw.toast', { amount: moneyFull(amount, currency), name: investment.name, wallet: walletName }))
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const clearAmountError = () => { if (invalid === 'amount') { setInvalid(null); setError(null) } }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cmp.withdraw.title', { name: investment.name })}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
            label={saving ? t('action.saving') : t('cmp.withdraw.submit')} />
        </div>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Field id="withdraw-amount" label={t('tx.amount')} required
            error={invalid === 'amount' ? error ?? undefined : undefined}>
            <AmountInput value={amount} currency={currency}
              onChange={v => { setAmount(v); clearAmountError() }}
              className={invalid === 'amount' ? MONEY_INPUT_INVALID : MONEY_INPUT} suffix={currency} />
          </Field>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p aria-live="polite" className={`text-xs tabular-nums ${left < 0 ? 'text-expense' : 'text-slate-500'}`}>
              {t('cmp.withdraw.left', { name: investment.name, amount: moneyFull(Math.max(0, left), currency) })}
            </p>
            <button type="button" disabled={value <= 0}
              onClick={() => { setAmount(value); clearAmountError() }}
              className="focus-ring min-h-[32px] rounded-chip border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {t('cmp.withdraw.all', { amount: moneyFull(value, currency) })}
            </button>
          </div>
        </div>

        <WalletPicker
          id="withdraw-wallet"
          label={t('shell.form.intoWallet')}
          cards={wallets.cards}
          cashBalance={wallets.cashBalance}
          currency={currency}
          loaded={wallets.loaded}
          failed={wallets.failed}
          onRetry={wallets.reload}
          value={choice.value}
          onChange={v => { choice.choose(v); if (invalid === 'wallet') { setInvalid(null); setError(null) } }}
          help={t('cmp.withdraw.walletHelp')}
          error={invalid === 'wallet' ? error ?? undefined : undefined}
        />

        <CompactDate id="withdraw-date" label={t('tx.date')} value={date} onChange={setDate} />

        <Field id="withdraw-note" label={optional(t('tx.note'))}>
          <input value={description} onChange={e => setDescription(e.target.value)} className={CONTROL} />
        </Field>

        {error && !invalid && (
          <p role="alert" className="rounded-control border border-rose-200 px-3 py-2 text-sm text-expense">{error}</p>
        )}
      </form>
    </Modal>
  )
}
