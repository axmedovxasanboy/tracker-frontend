import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull } from '../../utils/format'
import type { InvestmentResponse } from '../../types'

const FORM_ID = 'update-value-form'
/** Matches the 44px control every standalone page uses; the bare padding this replaced came
 *  out 42px, so the same field differed between a dialog and a page. */
const CONTROL = 'focus-ring w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500'
const INPUT = `${CONTROL} h-11`
/** `AmountInput` overlays its `suffix` at `right-3`, which `px-3` leaves no room for. */
const MONEY_INPUT = `${INPUT} pr-14`

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  investment: InvestmentResponse | null
}

/** Update an investment / savings goal's current (market) value to reflect platform growth. */
export function UpdateValueModal({ open, onClose, onSaved, investment }: Props) {
  const { t } = useLang()
  const [value, setValue] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !investment) return
    setValue(investment.currentValue ?? investment.investedAmount)
    setError(null)
  }, [open, investment])

  if (!investment) return null
  const currency = investment.currency

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (value < 0) { setError(t('cmp.err.valueNegative')); return }
    setSaving(true); setError(null)
    try {
      await financeApi.setInvestmentValue(investment.id, { currentValue: value })
      // No toast here — see the note in ContributeInvestmentModal: the caller already toasts.
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cmp.updateValue.title', { name: investment.name })}
      maxWidth="max-w-md"
      footer={
        <div className="flex gap-3">
          <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
            label={saving ? t('action.saving') : t('cmp.updateValue.submit')} />
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-slate-500">
          {t('cmp.updateValue.contributedSoFar')}{' '}
          <span className="font-medium tabular-nums text-slate-700">{moneyFull(investment.investedAmount, currency)}</span>.
          {' '}{t('cmp.updateValue.setCurrentValueHint')}
        </p>
        <Field id="update-value-amount" label={t('cmp.updateValue.currentValueLabel', { currency })}>
          <AmountInput required value={value} currency={currency}
            onChange={v => setValue(v)} className={MONEY_INPUT} suffix={currency} />
        </Field>

        {error && (
          <p role="alert" className="rounded-control border border-rose-200 px-3 py-2 text-sm text-expense">{error}</p>
        )}
      </form>
    </Modal>
  )
}
