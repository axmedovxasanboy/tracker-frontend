import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { todayLocal } from '../../utils/format'
import { CompactDate, CONTROL, MONEY_INPUT, MONEY_INPUT_INVALID, useOptional } from '../transactions/formParts'
import { WalletPicker } from '../transactions/WalletPicker'
import { rememberWallet, useWalletChoice, useWallets } from '../transactions/wallets'
import type { InvestmentResponse } from '../../types'

const FORM_ID = 'contribute-investment-form'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  investment: InvestmentResponse | null
  /** Start on this amount — e.g. what this month still asks for a goal. */
  defaultAmount?: number
}

/**
 * Add money to a goal, an investment or the emergency fund: how much, from which wallet, when.
 * "Not from a wallet" records money that was already in the account — the total goes up and no
 * wallet is touched.
 */
export function ContributeInvestmentModal({ open, onClose, onSaved, investment, defaultAmount }: Props) {
  const { t } = useLang()
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
  })

  useEffect(() => {
    if (!open) return
    setAmount(defaultAmount && defaultAmount > 0 ? defaultAmount : 0)
    setDate(todayLocal()); setDescription(''); setError(null); setInvalid(null)
  }, [open, defaultAmount])

  if (!investment) return null

  // Wallet money into an investment or the emergency fund counts toward this month's savings; a
  // goal's money is the goal's own, so it says nothing about the month.
  const walletHelp = choice.value === 'none'
    ? t(investment.savingsGoal ? 'home.wallet.noneHelp' : 'cmp.payBucket.noWalletHint')
    : investment.savingsGoal ? undefined
      : t(investment.emergencyFund ? 'cmp.contributeInvestment.countsEmergency' : 'cmp.contributeInvestment.countsInvestments')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) { setInvalid('amount'); setError(t('cmp.err.amountPositive')); return }
    const wallet = choice.value
    if (wallet == null) { setInvalid('wallet'); setError(t('cmp.err.pickCardOrCash')); return }
    setSaving(true); setError(null); setInvalid(null)
    try {
      await financeApi.contributeInvestment(investment.id, {
        amount, currency, date,
        cardId: typeof wallet === 'number' ? wallet : undefined,
        noWallet: wallet === 'none',
        description: description.trim() || undefined,
      })
      rememberWallet(wallet)
      // No toast here: the callers confirm the write themselves.
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cmp.contributeInvestment.title', { name: investment.name })}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
            label={saving ? t('action.saving') : t('cmp.contributeInvestment.submit')} />
        </div>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        <Field id="contrib-amount" label={t('tx.amount')} required
          error={invalid === 'amount' ? error ?? undefined : undefined}>
          <AmountInput value={amount} currency={currency}
            onChange={v => { setAmount(v); if (invalid === 'amount') { setInvalid(null); setError(null) } }}
            className={invalid === 'amount' ? MONEY_INPUT_INVALID : MONEY_INPUT} suffix={currency} />
        </Field>

        <WalletPicker
          id="contrib-wallet"
          label={t('home.wallet.from')}
          cards={wallets.cards}
          cashBalance={wallets.cashBalance}
          currency={currency}
          loaded={wallets.loaded}
          failed={wallets.failed}
          onRetry={wallets.reload}
          value={choice.value}
          onChange={v => { choice.choose(v); if (invalid === 'wallet') { setInvalid(null); setError(null) } }}
          noneLabel={t('home.wallet.none')}
          help={walletHelp}
          error={invalid === 'wallet' ? error ?? undefined : undefined}
        />

        <CompactDate id="contrib-date" label={t('tx.date')} value={date} onChange={setDate} />

        <Field id="contrib-note" label={optional(t('tx.note'))}>
          <input value={description} onChange={e => setDescription(e.target.value)} className={CONTROL} />
        </Field>

        {error && !invalid && (
          <p role="alert" className="rounded-control border border-rose-200 px-3 py-2 text-sm text-expense">{error}</p>
        )}
      </form>
    </Modal>
  )
}
