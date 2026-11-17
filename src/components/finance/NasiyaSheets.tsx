import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AmountInput } from '../ui/AmountInput'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../i18n/LanguageContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, plural, shiftMonth, todayLocal } from '../../utils/format'
import type { LoanTakenResponse } from '../../types'

const INPUT = 'focus-ring h-11 w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500'
const MONEY_INPUT = `${INPUT} pr-14`

/** The same day next month (the month's last day when it has fewer) — a first installment's usual day. */
function sameDayNextMonth(today: string): string {
  const next = shiftMonth(today.slice(0, 7), 1)
  const [y, m] = next.split('-').map(Number)
  const day = Math.min(Number(today.slice(8, 10)), new Date(y, m, 0).getDate())
  return `${next}-${String(day).padStart(2, '0')}`
}

/**
 * "Switch to installments" — the owner's button once a nasiya's deadline has passed (or before it,
 * when they know they will not make it). Every figure comes from the lender's own app: Tracker never
 * works out the penalty. POST /finance/loans-taken/{id}/installments.
 */
export function NasiyaSwitchSheet({ loan, onClose, onSaved }: {
  loan: LoanTakenResponse | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t, lang } = useLang()
  const { showSuccess } = useToast()
  const [left, setLeft] = useState(0)
  const [monthly, setMonthly] = useState(0)
  const [first, setFirst] = useState('')
  const [errors, setErrors] = useState<{ left?: string; monthly?: string; first?: string }>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!loan) return
    setLeft(0); setMonthly(0); setFirst(sameDayNextMonth(todayLocal()))
    setErrors({}); setSaving(false); setFormError(null); setDirty(false)
  }, [loan?.id])

  const months = left > 0 && monthly > 0 ? Math.ceil(left / monthly - 1e-9) : 0
  // What the loan costs in all once switched: everything paid and still to pay, less what came in.
  const cost = loan?.principalAmount != null && left > 0
    ? Math.max(0, loan.paidAmount + left - loan.principalAmount) : null

  const save = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!loan) return
    const e: typeof errors = {}
    if (!(left > 0)) e.left = t('shell.nasiya.errLeft')
    if (!(monthly > 0)) e.monthly = t('shell.form.errAmount')
    else if (left > 0 && monthly > left) e.monthly = t('shell.form.errMonthlyTooBig')
    if (!first) e.first = t('shell.nasiya.errDate')
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true); setFormError(null)
    try {
      await financeApi.nasiyaInstallments(loan.id, { left, monthlyPayment: monthly, firstPaymentDate: first })
      showSuccess(t('shell.nasiya.switchedToast'))
      onSaved()
    } catch (err) {
      setFormError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const formId = 'nasiya-switch-form'
  return (
    <Sheet
      open={!!loan}
      onClose={onClose}
      title={loan ? t('shell.nasiya.switchTitle', { name: loan.lenderName }) : ''}
      maxWidth="max-w-md"
      dirty={dirty && !saving}
      footer={
        <div className="flex gap-3">
          <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
          <Button type="submit" form={formId} variant="primary" loading={saving}
            label={saving ? t('action.saving') : t('shell.nasiya.switch')} className="flex-1" />
        </div>
      }
    >
      <form id={formId} onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-600">{t('shell.nasiya.switchHint', { name: loan?.lenderName ?? '' })}</p>
        <Field id="nasiya-switch-left" label={t('shell.nasiya.leftNow')} required error={errors.left}>
          <AmountInput required value={left} currency="UZS" suffix="UZS" className={MONEY_INPUT}
            onChange={v => { setLeft(v); setDirty(true); setErrors({}) }} />
        </Field>
        <Field id="nasiya-switch-monthly" label={t('shell.form.monthlyPayment')} required error={errors.monthly}>
          <AmountInput required value={monthly} currency="UZS" suffix="UZS" className={MONEY_INPUT}
            onChange={v => { setMonthly(v); setDirty(true); setErrors({}) }} />
        </Field>
        <Field id="nasiya-switch-first" label={t('shell.nasiya.firstPayment')} required error={errors.first}>
          <input required type="date" value={first} className={INPUT}
            onChange={ev => { setFirst(ev.target.value); setDirty(true); setErrors({}) }} />
        </Field>
        {(months > 0 || cost != null) && (
          <div className="space-y-1 rounded-control bg-slate-50 px-3 py-2 text-xs tabular-nums text-slate-600">
            {months > 0 && (
              <p>{plural(months, t('shell.nasiya.monthsOne', { count: months }), t('shell.nasiya.monthsMany', { count: months }), lang)}</p>
            )}
            {cost != null && <p>{t('shell.nasiya.costAfter', { amount: moneyFull(cost) })}</p>}
          </div>
        )}
        {formError && <p role="alert" className="text-sm text-expense">{formError}</p>}
      </form>
    </Sheet>
  )
}

/**
 * "Update what's left" — the amount the lender's app shows (after paying early it may be less than
 * Tracker counts). 0 closes the loan. POST /finance/loans-taken/{id}/left.
 */
export function NasiyaLeftSheet({ loan, onClose, onSaved }: {
  loan: LoanTakenResponse | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useLang()
  const { showSuccess } = useToast()
  const [left, setLeft] = useState(0)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!loan) return
    setLeft(Math.max(0, loan.remainingAmount)); setSaving(false); setFormError(null); setDirty(false)
  }, [loan?.id])

  const save = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!loan) return
    if (!(left >= 0) || !Number.isFinite(left)) { setFormError(t('shell.nasiya.errLeft')); return }
    setSaving(true); setFormError(null)
    try {
      await financeApi.nasiyaLeft(loan.id, left)
      showSuccess(t('shell.nasiya.leftToast'))
      onSaved()
    } catch (err) {
      setFormError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const formId = 'nasiya-left-form'
  return (
    <Sheet
      open={!!loan}
      onClose={onClose}
      title={loan ? t('shell.nasiya.leftTitle', { name: loan.lenderName }) : ''}
      maxWidth="max-w-md"
      dirty={dirty && !saving}
      footer={
        <div className="flex gap-3">
          <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
          <Button type="submit" form={formId} variant="primary" loading={saving}
            label={saving ? t('action.saving') : t('action.save')} className="flex-1" />
        </div>
      }
    >
      <form id={formId} onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-600">{t('shell.nasiya.leftHint')}</p>
        <Field id="nasiya-left-amount" label={t('shell.nasiya.leftNow')} required
          help={loan ? t('shell.nasiya.leftTracker', { amount: moneyFull(Math.max(0, loan.remainingAmount)) }) : undefined}>
          {/* Not `required`: 0 (the field shown empty) is an answer — it closes the loan. */}
          <AmountInput value={left} currency="UZS" suffix="UZS" className={MONEY_INPUT}
            onChange={v => { setLeft(v); setDirty(true); setFormError(null) }} />
        </Field>
        {left === 0 && <p className="text-sm font-medium text-amber-700">{t('shell.nasiya.leftZero')}</p>}
        {formError && <p role="alert" className="text-sm text-expense">{formError}</p>}
      </form>
    </Sheet>
  )
}
