import { useState, useEffect, useMemo } from 'react'
import { Calendar, CreditCard, Wallet } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { cardsApi } from '../../api/cards'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, snap, todayLocal } from '../../utils/format'
import type {
  CardResponse,
  MonthlyPaymentMode,
  MonthlyPaymentPayRequest,
  MonthlyPaymentResponse,
} from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  subscription: MonthlyPaymentResponse | null
}

const FORM_ID = 'pay-subscription-form'
/** Matches the 44px control every standalone page uses; the bare padding this replaced came
 *  out 42px, so the same field differed between a dialog and a page. */
const CONTROL = 'focus-ring w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500'
const INPUT = `${CONTROL} h-11`
/** `AmountInput` overlays its `suffix` at `right-3`, which `px-3` leaves no room for. */
const MONEY_INPUT = `${INPUT} pr-14`

export function PaySubscriptionModal({ open, onClose, onSaved, subscription }: Props) {
  const { t } = useLang()
  const defaultAmount = subscription?.amount ?? 0
  const currency = subscription?.currency ?? 'UZS'

  const [mode, setMode] = useState<MonthlyPaymentMode>('CARD')
  const [amount, setAmount] = useState(defaultAmount)
  const [cashInput, setCashInput] = useState(0)
  const [cardInput, setCardInput] = useState(defaultAmount)
  const [paymentDate, setPaymentDate] = useState(todayLocal())
  const [cardId, setCardId] = useState<number | undefined>()
  const [updateForFuture, setUpdateForFuture] = useState(false)
  const [cards, setCards] = useState<CardResponse[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && subscription) {
      setMode('CARD')
      setAmount(subscription.amount)
      setCashInput(0)
      setCardInput(subscription.amount)
      setPaymentDate(todayLocal())
      setCardId(undefined)
      setUpdateForFuture(false)
      setError(null)
      cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
    }
  }, [open, subscription])

  // Keep `amount` in sync with split inputs when BOTH is active.
  useEffect(() => {
    if (mode === 'BOTH') {
      setAmount(snap(cashInput + cardInput))
    } else if (mode === 'CARD') {
      setAmount(cardInput)
    } else if (mode === 'CASH') {
      setAmount(cashInput)
    }
  }, [mode, cashInput, cardInput])

  const filteredCards = useMemo(
    () => cards.filter(c => c.currency === currency),
    [cards, currency],
  )

  const amountDiffersFromDefault = useMemo(() => {
    if (!subscription) return false
    return Math.abs(amount - subscription.amount) > 0.001
  }, [amount, subscription])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subscription) return

    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return }
    if (mode === 'CARD' && !cardId) { setError(t('cmp.err.pickCardOrCash')); return }
    if (mode === 'BOTH') {
      if (!cardId) { setError(t('cmp.err.pickCardForPortion')); return }
      if (cashInput <= 0 || cardInput <= 0) { setError(t('cmp.err.bothPortionsPositive')); return }
    }

    const req: MonthlyPaymentPayRequest = {
      amount,
      paymentDate,
      mode,
      cardId: (mode === 'CARD' || mode === 'BOTH') ? cardId : undefined,
      cashAmount: mode === 'BOTH' ? cashInput : undefined,
      updateAmountForFuture: amountDiffersFromDefault ? updateForFuture : false,
    }

    setSaving(true); setError(null)
    try {
      await financeApi.payMonthlyPayment(subscription.id, req)
      onSaved(); onClose()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const markAlreadyPaid = async () => {
    if (!subscription) return
    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return }
    setSaving(true); setError(null)
    try {
      await financeApi.markPaid({
        kind: 'SUBSCRIPTION', refId: subscription.id,
        amount, currency, month: paymentDate.slice(0, 7),
      })
      onSaved(); onClose()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  if (!subscription) return null

  const cardOptions = (
    <>
      <option value="">{t('cmp.source.chooseCard')}</option>
      {filteredCards.map(c => (
        <option key={c.id} value={c.id}>
          {c.name} •••• {c.lastFourDigits} · {moneyFull(c.currentBalance, c.currency)}
        </option>
      ))}
    </>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cmp.paySubscription.title', { name: subscription.name })}
      maxWidth="max-w-lg"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button label={t('action.cancel')} onClick={onClose} className="sm:flex-1" />
          <Button label={t('cmp.action.alreadyPaid')} onClick={markAlreadyPaid} disabled={saving} className="sm:flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="sm:flex-1"
            label={saving ? t('cmp.state.recording') : t('cmp.action.recordPayment')} />
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        {/* White tile, hue on the icon chip only — violet is retired from the app. */}
        <div className="flex items-center gap-3 rounded-control border border-hairline px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-indigo-100 text-indigo-600">
            <Calendar className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{subscription.name}</p>
            <p className="text-xs text-slate-500">
              {t('cmp.paySubscription.default')}{' '}
              <span className="font-semibold tabular-nums text-slate-700">{moneyFull(subscription.amount, currency)}</span>
            </p>
          </div>
        </div>

        {/* Payment method */}
        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">{t('cmp.field.paymentMethod')}</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'CARD', label: t('tx.card'), Icon: CreditCard },
              { value: 'CASH', label: t('tx.cash'), Icon: Wallet },
              { value: 'BOTH', label: t('tx.both'), Icon: CreditCard },
            ] as { value: MonthlyPaymentMode; label: string; Icon: typeof CreditCard }[]).map(opt => (
              <Button
                key={opt.value}
                variant={mode === opt.value ? 'primary' : 'secondary'}
                icon={<opt.Icon className="w-4 h-4" />}
                label={opt.label}
                onClick={() => setMode(opt.value)}
                aria-pressed={mode === opt.value}
              />
            ))}
          </div>
        </div>

        {mode === 'CARD' && (
          <div className="space-y-3">
            <Field id="pay-sub-card" label={t('cmp.field.card')}>
              <select required value={cardId ?? ''} onChange={e => setCardId(e.target.value ? Number(e.target.value) : undefined)}
                className={INPUT}>{cardOptions}</select>
            </Field>
            <Field id="pay-sub-card-amount" label={t('cmp.field.amountRequired')}>
              <AmountInput required value={cardInput || 0} currency={currency}
                onChange={v => setCardInput(v)} className={MONEY_INPUT} suffix={currency} />
            </Field>
          </div>
        )}

        {mode === 'CASH' && (
          <Field id="pay-sub-cash-amount" label={t('cmp.field.amountRequired')}>
            <AmountInput required value={cashInput || 0} currency={currency}
              onChange={v => setCashInput(v)} className={MONEY_INPUT} suffix={currency} />
          </Field>
        )}

        {mode === 'BOTH' && (
          <div className="space-y-3">
            <Field id="pay-sub-both-card" label={t('cmp.field.card')}>
              <select required value={cardId ?? ''} onChange={e => setCardId(e.target.value ? Number(e.target.value) : undefined)}
                className={INPUT}>{cardOptions}</select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="pay-sub-both-cash-amount" label={t('cmp.field.cashRequired')}>
                <AmountInput required value={cashInput || 0} currency={currency}
                  onChange={v => setCashInput(v)} className={MONEY_INPUT} suffix={currency} />
              </Field>
              <Field id="pay-sub-both-card-amount" label={t('cmp.field.card')}>
                <AmountInput required value={cardInput || 0} currency={currency}
                  onChange={v => setCardInput(v)} className={MONEY_INPUT} suffix={currency} />
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              {t('cmp.paySubscription.total')}{' '}
              <span className="font-semibold tabular-nums text-slate-900">{moneyFull(amount, currency)}</span>
            </p>
          </div>
        )}

        <Field id="pay-sub-date" label={t('cmp.field.paymentDateRequired')}>
          <input required type="date" value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)} className={INPUT} />
        </Field>

        {/* The one tinted panel in this dialog: it is a genuine "are you sure?" moment, because
            ticking it changes the bill's saved amount for every future month. */}
        {amountDiffersFromDefault && (
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-control border border-amber-200 bg-amber-50 p-3">
            {/* focus-ring and a real accent-color: the native outline is removed app-wide, and
                ticking this rewrites the bill's saved amount for every future month, so a keyboard
                user must be able to see they are standing on it. ring-offset matches the amber panel. */}
            <input type="checkbox" checked={updateForFuture}
              onChange={e => setUpdateForFuture(e.target.checked)}
              className="focus-ring mt-0.5 h-4 w-4 rounded border-amber-300 accent-indigo-600 focus-visible:ring-offset-amber-50" />
            <span className="text-xs leading-relaxed text-amber-900">
              {t('cmp.paySubscription.amountDiffers', {
                saved: moneyFull(subscription.amount, currency),
                entered: moneyFull(amount, currency),
              })}{' '}
              {t('cmp.paySubscription.useAsDefaultPrefix')}{' '}
              <span className="font-semibold tabular-nums">{moneyFull(amount, currency)}</span>{' '}
              {t('cmp.paySubscription.useAsDefaultSuffix')}
            </span>
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-control border border-rose-200 px-3 py-2 text-sm text-expense">{error}</p>
        )}

        {/* Says what the second footer button does; a `title` never reaches a touch user. */}
        <p className="text-xs text-slate-500">{t('cmp.hint.markCoveredNoTx')}</p>
      </form>
    </Modal>
  )
}
