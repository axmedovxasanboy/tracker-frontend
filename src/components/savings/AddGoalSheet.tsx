import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { todayLocal } from '../../utils/format'
import { CONTROL, CONTROL_INVALID, MONEY_INPUT, MONEY_INPUT_INVALID, useOptional } from '../transactions/formParts'
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
    ...patch,
  }
}

/**
 * A savings goal in three answers: what for, how much, and — if any — how much is already put by.
 *
 * Saved as a savings-goal holding. What the owner "already has" is an opening balance: it was put
 * by before, so no wallet is touched and nothing is recorded as spent today. Adding to the goal
 * later is "Add money", which does move money from a wallet.
 */
export function AddGoalSheet({ open, onClose, onSaved, goal }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Edit this goal instead of adding one: its name and target. */
  goal?: InvestmentResponse | null
}) {
  const { t } = useLang()
  const optional = useOptional()
  const { showSuccess } = useToast()
  const [name, setName] = useState('')
  const [target, setTarget] = useState(0)
  const [have, setHave] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'name' | 'target' | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(goal?.name ?? '')
    setTarget(goal?.targetAmount ?? 0)
    setHave(0)
    setError(null)
    setInvalid(null)
  }, [open, goal])

  const dirty = goal
    ? name !== goal.name || target !== (goal.targetAmount ?? 0)
    : !!name.trim() || target > 0 || have > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setInvalid('name'); setError(t('home.goal.err.name')); nameRef.current?.focus(); return }
    if (target <= 0) { setInvalid('target'); setError(t('home.goal.err.target')); return }
    setSaving(true); setError(null); setInvalid(null)
    try {
      if (goal) {
        await financeApi.updateInvestment(goal.id, requestFrom(goal, { name: name.trim(), targetAmount: target }))
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
        })
      }
      showSuccess(t(goal ? 'home.goal.savedToast' : 'home.goal.addedToast', { name: name.trim() }))
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

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
            onChange={e => { setName(e.target.value); if (invalid === 'name') { setInvalid(null); setError(null) } }}
            className={invalid === 'name' ? CONTROL_INVALID : CONTROL}
            placeholder={t('home.goal.namePlaceholder')} />
        </Field>
        <Field id="goal-target" label={t('home.goal.target')} required error={invalid === 'target' ? error ?? undefined : undefined}>
          <AmountInput value={target} currency="UZS" suffix="UZS"
            onChange={v => { setTarget(v); if (invalid === 'target') { setInvalid(null); setError(null) } }}
            className={invalid === 'target' ? MONEY_INPUT_INVALID : MONEY_INPUT} />
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
