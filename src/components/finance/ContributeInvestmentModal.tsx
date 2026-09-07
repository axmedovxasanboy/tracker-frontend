import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { cardsApi } from '../../api/cards'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, todayLocal } from '../../utils/format'
import type { CardResponse, InvestmentResponse } from '../../types'

const FORM_ID = 'contribute-investment-form'
/** Matches the 44px control every standalone page uses; the bare padding this replaced came
 *  out 42px, so the same field differed between a dialog and a page. */
const CONTROL = 'focus-ring w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500'
const INPUT = `${CONTROL} h-11`
/** `AmountInput` overlays its `suffix` at `right-3`, which `px-3` leaves no room for. */
const MONEY_INPUT = `${INPUT} pr-14`
/** A textarea sizes from `rows`, so it takes padding where an input takes a height. */
const TEXTAREA = `${CONTROL} py-2.5`

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  investment: InvestmentResponse | null
}

/** Add money to an existing investment / savings goal. Contribution currency matches the goal. */
export function ContributeInvestmentModal({ open, onClose, onSaved, investment }: Props) {
  const { t } = useLang()
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayLocal())
  const [description, setDescription] = useState('')
  // Source: 'cash' | 'none' (record only, no wallet) | a card id as a string.
  const [source, setSource] = useState<string>('cash')
  const [cards, setCards] = useState<CardResponse[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmount(0); setDate(todayLocal()); setDescription(''); setSource('cash'); setError(null)
    cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
  }, [open])

  if (!investment) return null
  const currency = investment.currency
  const matchingCards = cards.filter(c => c.currency === currency)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return }
    setSaving(true); setError(null)
    try {
      await financeApi.contributeInvestment(investment.id, {
        amount, currency, date,
        cardId: /^\d+$/.test(source) ? Number(source) : undefined,
        noWallet: source === 'none',
        description: description.trim() || undefined,
      })
      // No toast here: InvestmentsPage's `onGoalSaved` already confirms the write, and two
      // banners for one action is worse than a generic one.
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
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-3">
        <Field id="contrib-amount" label={t('cmp.field.amountWithCurrency', { currency })}>
          <AmountInput required value={amount} currency={currency}
            onChange={v => setAmount(v)} className={MONEY_INPUT} suffix={currency} />
        </Field>

        <Field id="contrib-date" label={t('cmp.field.dateRequired')}>
          <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
        </Field>

        <Field
          id="contrib-source"
          label={t('cmp.field.source')}
          help={source === 'none' ? t('cmp.contributeInvestment.noWalletHint') : undefined}
        >
          <select value={source} onChange={e => setSource(e.target.value)} className={INPUT}>
            <option value="none">{t('cmp.source.noneOption')}</option>
            <option value="cash">{t('tx.cash')}</option>
            {matchingCards.map(c => (
              <option key={c.id} value={String(c.id)}>
                {c.name} •••• {c.lastFourDigits} · {moneyFull(c.currentBalance, c.currency)}
              </option>
            ))}
          </select>
        </Field>

        <Field id="contrib-desc" label={t('tx.description')}>
          <textarea rows={2} value={description}
            onChange={e => setDescription(e.target.value)}
            className={`${TEXTAREA} resize-none`} />
        </Field>

        {error && (
          <p role="alert" className="rounded-control border border-rose-200 px-3 py-2 text-sm text-expense">{error}</p>
        )}
      </form>
    </Modal>
  )
}
