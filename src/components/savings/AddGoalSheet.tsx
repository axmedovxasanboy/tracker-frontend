import { useEffect, useRef, useState } from 'react'
import type { AxiosError } from 'axios'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { formatDate, moneyFull, monthLocal, shiftMonth, todayLocal } from '../../utils/format'
import { CONTROL, CONTROL_INVALID, MONEY_INPUT, MONEY_INPUT_INVALID, useOptional } from '../transactions/formParts'
import { goalPlan, lastDayOf } from './goalPlan'
import type { InvestmentRequest, InvestmentResponse } from '../../types'

const FORM_ID = 'add-goal-form'

/**
 * Rebuild the request for an edit. The endpoint overwrites every field, so everything the owner is
 * not editing here has to go back exactly as it is. `currentValue` comes back from the server as
 * "value, falling back to invested"; a value equal to invested is sent as null so the goal keeps
 * following its own total instead of freezing at today's figure.
 */
export function requestFrom(i: InvestmentResponse, patch: Partial<InvestmentRequest>): InvestmentRequest {
  return {
    name: i.name,
    type: i.type,
    investedAmount: i.investedAmount,
    currency: i.currency,
    purchaseDate: i.purchaseDate,
    broker: i.broker ?? undefined,
    description: i.description ?? undefined,
    emergencyFund: i.emergencyFund,
    savingsGoal: i.savingsGoal,
    targetAmount: i.targetAmount,
    currentValue: i.currentValue != null && Math.abs(i.currentValue - i.investedAmount) > 0.001
      ? i.currentValue : null,
    openingBalance: i.openingBalance,
    // A goal's plan rides along, so editing anything else never drops it.
    targetDate: i.targetDate ?? null,
    monthlyContribution: i.monthlyContribution ?? null,
    // Only when the server sent one: a key left out keeps the stored start month.
    ...(i.paymentStartDate !== undefined ? { paymentStartDate: i.paymentStartDate } : {}),
    ...patch,
  }
}

/**
 * The month a goal's payments start, as the form shows it (YYYY-MM): a new goal starts next month;
 * a saved one keeps its own, and one without (or from an older server) started in its purchase month.
 */
function startOf(goal: InvestmentResponse | null | undefined): string {
  if (!goal) return shiftMonth(monthLocal(), 1)
  return (goal.paymentStartDate ?? goal.purchaseDate ?? '').slice(0, 7)
}

/**
 * A savings goal: what for, how much, how much a month, by when — and, if any, how much is already
 * put by.
 *
 * Saved as a savings-goal holding. What the owner "already has" is an opening balance: it was put
 * by before, so no wallet is touched and nothing is recorded as spent today. Adding to the goal
 * later is "Add money", which does move money from a wallet. With a target and a deadline, the
 * monthly payment is suggested until the owner types one of their own.
 */
export function AddGoalSheet({ open, onClose, onSaved, goal }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Edit this goal instead of adding one. */
  goal?: InvestmentResponse | null
}) {
  const { t, lang } = useLang()
  const optional = useOptional()
  const { showSuccess } = useToast()
  const [name, setName] = useState('')
  const [target, setTarget] = useState(0)
  const [monthly, setMonthly] = useState(0)
  /** The monthly figure is the form's suggestion, not the owner's — so it may follow the inputs. */
  const [monthlySuggested, setMonthlySuggested] = useState(false)
  /** YYYY-MM, or '' for none. */
  const [deadline, setDeadline] = useState('')
  /** YYYY-MM: the month the first payment is due. */
  const [start, setStart] = useState('')
  const [have, setHave] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'name' | 'target' | 'monthly' | 'start' | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  /** Set by a reset: the suggestion below must not act on the values the reset just replaced. */
  const reset = useRef(false)

  useEffect(() => {
    if (!open) return
    reset.current = true
    setName(goal?.name ?? '')
    setTarget(goal?.targetAmount ?? 0)
    setMonthly(goal?.monthlyContribution ?? 0)
    setMonthlySuggested(false)
    setDeadline(goal?.targetDate ? goal.targetDate.slice(0, 7) : '')
    setStart(startOf(goal))
    setHave(0)
    setError(null)
    setInvalid(null)
  }, [open, goal])

  const month = monthLocal()
  // What is still missing: an edited goal counts what it already holds.
  const already = goal ? goal.currentValue ?? goal.investedAmount : have
  const remaining = Math.max(0, target - already)
  // Counted from the month payments start, when that is later than this one.
  const plan = goalPlan(remaining, monthly, deadline || null, month, start || null)

  // Target and deadline known, no monthly figure of the owner's yet: suggest one — and keep it in
  // step with the inputs for as long as it is still only a suggestion.
  const suggestion = target > 0 && deadline ? plan.needed : null
  useEffect(() => {
    if (reset.current) { reset.current = false; return }
    if (!open || (monthly > 0 && !monthlySuggested)) return
    if (suggestion != null && suggestion !== monthly) {
      setMonthly(suggestion)
      setMonthlySuggested(true)
    } else if (suggestion == null && monthlySuggested) {
      setMonthly(0)
      setMonthlySuggested(false)
    }
  }, [open, suggestion, monthly, monthlySuggested])

  const clear = (field: 'name' | 'target' | 'monthly' | 'start') => {
    if (invalid === field) { setInvalid(null); setError(null) }
  }

  const dirty = goal
    ? name !== goal.name || target !== (goal.targetAmount ?? 0)
      || monthly !== (goal.monthlyContribution ?? 0) || deadline !== (goal.targetDate?.slice(0, 7) ?? '')
      || start !== startOf(goal)
    : !!name.trim() || target > 0 || have > 0 || !!deadline || (monthly > 0 && !monthlySuggested)
      || start !== startOf(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setInvalid('name'); setError(t('home.goal.err.name')); nameRef.current?.focus(); return }
    if (target <= 0) { setInvalid('target'); setError(t('home.goal.err.target')); return }
    if (!(monthly > 0)) { setInvalid('monthly'); setError(t('home.goal.err.monthly')); return }
    if (!start) { setInvalid('start'); setError(t('home.goal.err.start')); return }
    setSaving(true); setError(null); setInvalid(null)
    const targetDate = deadline ? lastDayOf(deadline) : null
    const paymentStartDate = `${start}-01`
    try {
      if (goal) {
        await financeApi.updateInvestment(goal.id, requestFrom(goal, {
          // targetDate is always sent: an explicit null is how the server removes a deadline.
          name: name.trim(), targetAmount: target, monthlyContribution: monthly, targetDate, paymentStartDate,
        }))
      } else {
        await financeApi.createInvestment({
          name: name.trim(),
          type: 'OTHER',
          // A goal started from nothing opens at 0; the server accepts that for an opening balance.
          investedAmount: have > 0 ? have : 0,
          currency: 'UZS',
          purchaseDate: todayLocal(),
          savingsGoal: true,
          emergencyFund: false,
          targetAmount: target,
          currentValue: null,
          openingBalance: true,
          monthlyContribution: monthly,
          targetDate,
          paymentStartDate,
        })
      }
      showSuccess(t(goal ? 'home.goal.savedToast' : 'home.goal.addedToast', { name: name.trim() }))
      onSaved(); onClose()
    } catch (err) {
      // An older server refuses a goal that starts from nothing; say that in words, not its field error.
      const res = (err as AxiosError<{ errors?: Record<string, string> }>)?.response
      const zeroRefused = !goal && !(have > 0) && res?.status === 400 && !!res.data?.errors?.investedAmount
      setError(zeroRefused ? t('home.goal.err.zeroStart') : extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  // "At 1.000.000 UZS a month you'll reach it around Mar 2027" — amber when that is after the deadline.
  const planLine = plan.reach && monthly > 0
    ? t(plan.late ? 'home.goal.reachLate' : 'home.goal.reachBy', {
      monthly: moneyFull(monthly),
      month: formatDate(plan.reach, lang, 'monthShort'),
      needed: plan.needed != null ? moneyFull(plan.needed) : '',
    })
    : null

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty && !saving}
      title={t(goal ? 'home.goal.editTitle' : 'home.goal.addTitle')}
      initialFocusRef={nameRef}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
            label={saving ? t('action.saving') : goal ? t('action.save') : t('action.add')} />
        </div>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        <Field id="goal-name" label={t('home.goal.name')} required error={invalid === 'name' ? error ?? undefined : undefined}>
          <input ref={nameRef} value={name}
            onChange={e => { setName(e.target.value); clear('name') }}
            className={invalid === 'name' ? CONTROL_INVALID : CONTROL}
            placeholder={t('home.goal.namePlaceholder')} />
        </Field>
        <Field id="goal-target" label={t('home.goal.target')} required error={invalid === 'target' ? error ?? undefined : undefined}>
          <AmountInput value={target} currency="UZS" suffix="UZS"
            onChange={v => { setTarget(v); clear('target') }}
            className={invalid === 'target' ? MONEY_INPUT_INVALID : MONEY_INPUT} />
        </Field>
        <Field id="goal-monthly" label={t('home.goal.monthly')} required error={invalid === 'monthly' ? error ?? undefined : undefined}>
          <AmountInput value={monthly} currency="UZS" suffix="UZS"
            aria-describedby={planLine || monthlySuggested ? 'goal-monthly-plan' : undefined}
            onChange={v => { setMonthly(v); setMonthlySuggested(false); clear('monthly') }}
            className={invalid === 'monthly' ? MONEY_INPUT_INVALID : MONEY_INPUT} />
        </Field>
        {(planLine || monthlySuggested) && (
          <div id="goal-monthly-plan" className="-mt-2 space-y-0.5 text-xs leading-snug tabular-nums">
            {monthlySuggested && <p className="text-slate-500">{t('home.goal.monthlySuggested')}</p>}
            {planLine && <p className={plan.late ? 'font-medium text-amber-700' : 'text-slate-600'}>{planLine}</p>}
          </div>
        )}
        <Field id="goal-start" label={t('home.goal.start')} required error={invalid === 'start' ? error ?? undefined : undefined}>
          <input type="month" required value={start}
            onChange={e => { setStart(e.target.value); clear('start') }}
            className={invalid === 'start' ? CONTROL_INVALID : CONTROL} />
        </Field>
        <Field id="goal-deadline" label={optional(t('home.goal.deadline'))}>
          <input type="month" value={deadline} min={month}
            onChange={e => setDeadline(e.target.value)} className={CONTROL} />
        </Field>
        {!goal && (
          <Field id="goal-have" label={optional(t('home.goal.have'))} help={t('home.goal.haveHelp')}>
            <AmountInput value={have} currency="UZS" suffix="UZS" onChange={setHave} className={MONEY_INPUT} />
          </Field>
        )}
        {error && !invalid && <p role="alert" className="text-sm text-expense">{error}</p>}
      </form>
    </Sheet>
  )
}
