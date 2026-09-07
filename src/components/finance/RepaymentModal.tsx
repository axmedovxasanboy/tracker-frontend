import { useState, useEffect } from 'react'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { cardsApi } from '../../api/cards'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, snap, todayLocal } from '../../utils/format'
import type { CardResponse, Currency, DebtResponse, LoanGivenResponse, LoanTakenResponse, RepaymentRequest } from '../../types'

type RepayTarget =
  | { kind: 'loan-taken'; record: LoanTakenResponse }
  | { kind: 'debt';       record: DebtResponse }
  | { kind: 'loan-given'; record: LoanGivenResponse }

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  target: RepayTarget | null
}

const FORM_ID = 'repayment-form'
/** Matches the 44px control every standalone page uses; the bare padding this replaced came
 *  out 42px, so the same field differed between a dialog and a page. */
const CONTROL = 'focus-ring w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500'
const INPUT = `${CONTROL} h-11`
/** `AmountInput` overlays its `suffix` at `right-3`, which `px-3` leaves no room for. */
const MONEY_INPUT = `${INPUT} pr-14`

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
    label: t('cmp.repay.title.loanGiven'),
    person: target.record.debtorName,
    remaining: target.record.pendingAmount,
    currency: target.record.currency,
    maxAmount: target.record.pendingAmount,
  }
}

export function RepaymentModal({ open, onClose, onSaved, target }: Props) {
  const { t } = useLang()
  const { showSuccess } = useToast()
  const info = getInfo(target, t)
  const [amount, setAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState(todayLocal())
  const [cardId, setCardId] = useState<number | undefined>()
  const [cards, setCards] = useState<CardResponse[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount(info.maxAmount)
      setPaymentDate(todayLocal())
      setCardId(undefined)
      setError(null)
      cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
    }
  }, [open, target])

  const filteredCards = cards.filter(c => c.currency === info.currency)

  const validate = () => {
    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return false }
    if (amount > info.maxAmount) {
      setError(t('cmp.err.cannotExceedRemaining', { amount: moneyFull(info.maxAmount, info.currency) }))
      return false
    }
    return true
  }

  /** The write confirms itself — the audit found nine payment flows that ended in silence. */
  const confirmed = () => {
    showSuccess(t('cmp.repay.recordedToast', { amount: moneyFull(amount, info.currency) }))
    onSaved()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target || !validate()) return

    setSaving(true); setError(null)
    const req: RepaymentRequest = { amount, paymentDate, cardId }
    try {
      if (target.kind === 'loan-taken') await financeApi.repayLoanTaken(target.record.id, req)
      else if (target.kind === 'debt')  await financeApi.repayDebt(target.record.id, req)
      else                              await financeApi.markLoanGivenReturned(target.record.id, req)
      confirmed()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  // "Already paid" — only for money you owe (borrowed loans + debts), not a loan returned TO you.
  const canMarkPaid = target?.kind === 'loan-taken' || target?.kind === 'debt'
  const markAlreadyPaid = async () => {
    if (!target || !canMarkPaid || !validate()) return
    setSaving(true); setError(null)
    try {
      await financeApi.markPaid({
        kind: target.kind === 'loan-taken' ? 'PERSONAL_LOAN' : 'DEBT',
        refId: target.record.id,
        amount, currency: info.currency,
        month: paymentDate.slice(0, 7),
      })
      confirmed()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const incoming = target?.kind === 'loan-given'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={info.label}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button label={t('action.cancel')} onClick={onClose} className="sm:flex-1" />
          {canMarkPaid && (
            <Button label={t('cmp.action.alreadyPaid')} onClick={markAlreadyPaid} disabled={saving}
              className="sm:flex-1" />
          )}
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="sm:flex-1"
            label={saving ? t('cmp.state.processing') : t('cmp.action.confirmPayment')} />
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        {/* White, with the direction of travel on the icon chip — a tinted panel made every
            repayment dialog look like an alert. */}
        <div className="flex items-center gap-3 rounded-control border border-hairline px-3 py-2.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-chip ${
            incoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            {incoming ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{info.person}</p>
            <p className="text-xs text-slate-500">
              {incoming ? t('cmp.repay.pendingReturn') : t('cmp.repay.remaining')}
              <span className="font-semibold tabular-nums text-slate-700">{moneyFull(info.remaining, info.currency)}</span>
            </p>
          </div>
        </div>

        <Field
          id="repay-amount"
          label={t('cmp.repay.paymentAmount')}
          help={t('cmp.repay.max', { amount: moneyFull(info.maxAmount, info.currency) })}
        >
          <AmountInput
            required
            value={amount || 0}
            currency={info.currency}
            onChange={v => setAmount(v)}
            className={MONEY_INPUT}
            placeholder="0"
            suffix={info.currency}
          />
        </Field>

        {/* Quick fill — the fastest way to settle a quarter, a half or the whole thing. */}
        <div className="flex gap-2">
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <Button
              key={pct}
              size="sm"
              variant="ghost"
              label={pct === 1 ? t('cmp.repay.full') : `${pct * 100}%`}
              onClick={() => setAmount(snap(info.maxAmount * pct))}
              className="flex-1 bg-slate-100"
            />
          ))}
        </div>

        <Field id="repay-date" label={t('cmp.field.paymentDateRequired')}>
          <input required type="date" value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)} className={INPUT} />
        </Field>

        <Field id="repay-card" label={`${t('cmp.field.payFromCard')} (${t('common.optional')})`}>
          <select value={cardId ?? ''} onChange={e => setCardId(e.target.value ? Number(e.target.value) : undefined)}
            className={INPUT}>
            <option value="">{t('cmp.source.cashNoCard')}</option>
            {filteredCards.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} •••• {c.lastFourDigits} · {moneyFull(c.currentBalance, c.currency)}
              </option>
            ))}
          </select>
        </Field>

        {error && (
          <p role="alert" className="rounded-control border border-rose-200 px-3 py-2 text-sm text-expense">{error}</p>
        )}

        {amount > 0 && (
          <div className="space-y-1 rounded-control border border-hairline px-3 py-2.5 text-xs text-slate-600">
            <div className="flex justify-between gap-3">
              <span>{t('cmp.repay.payingNow')}</span>
              <span className="font-semibold tabular-nums text-slate-900">{moneyFull(amount, info.currency)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>{t('cmp.repay.remainingAfter')}</span>
              <span className="font-semibold tabular-nums text-slate-900">{moneyFull(Math.max(0, info.remaining - amount), info.currency)}</span>
            </div>
            {Math.abs(amount - info.remaining) < 0.001 && (
              <p className="pt-0.5 text-center font-semibold text-emerald-700">{t('cmp.repay.fullPaymentNotice')}</p>
            )}
          </div>
        )}

        {/* The "Already paid" button used to explain itself only through a `title`, which a
            touch user never sees — and it is the one control here that moves no money. */}
        {canMarkPaid && <p className="text-xs text-slate-500">{t('cmp.hint.markPaidNoTx')}</p>}
      </form>
    </Modal>
  )
}
