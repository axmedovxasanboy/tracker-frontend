import { useEffect, useState } from 'react'
import { PlusCircle, TrendingUp } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull } from '../../utils/format'
import { GrowthChip, growthOf } from '../savings/growth'
import type { InvestmentResponse } from '../../types'

const FORM_ID = 'update-value-form'
/** Matches the 44px control every standalone page uses; the bare padding this replaced came
 *  out 42px, so the same field differed between a dialog and a page. */
const CONTROL = 'focus-ring w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500'
const INPUT = `${CONTROL} h-11`
/** `AmountInput` overlays its `suffix` at `right-3`, which `px-3` leaves no room for. */
const MONEY_INPUT = `${INPUT} pr-14`
const CHOICE = 'focus-ring flex w-full items-start gap-3 rounded-control border border-slate-200 bg-white p-3 text-left hover:border-slate-300 hover:bg-slate-50'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  investment: InvestmentResponse | null
  /** "I added money" — the caller closes this and opens its Add money dialog. */
  onAddMoney: () => void
}

/**
 * "What changed?" first: money put in goes through Add money (it is a saving, from a wallet);
 * only a change in the value itself — shares growing or falling — is set here, and it shows the
 * growth against what was put in, in money and in percent.
 */
export function UpdateValueModal({ open, onClose, onSaved, investment, onAddMoney }: Props) {
  const { t } = useLang()
  const [step, setStep] = useState<'ask' | 'value'>('ask')
  const [value, setValue] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !investment) return
    setStep('ask')
    setValue(growthOf(investment).value)
    setError(null)
  }, [open, investment])

  if (!investment) return null
  const currency = investment.currency
  const g = growthOf(investment, value)

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

  const ask = step === 'ask'
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cmp.updateValue.title', { name: investment.name })}
      maxWidth="max-w-md"
      footer={ask ? (
        <Button label={t('action.cancel')} onClick={onClose} className="w-full" />
      ) : (
        <div className="flex gap-3">
          <Button label={t('action.back')} onClick={() => { setStep('ask'); setError(null) }} className="flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
            label={saving ? t('action.saving') : t('cmp.updateValue.submit')} />
        </div>
      )}
    >
      {ask ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-900">{t('cmp.updateValue.whatChanged')}</p>
          <button type="button" className={CHOICE} onClick={onAddMoney}>
            <PlusCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-slate-900">{t('cmp.updateValue.addedMoney')}</span>
              <span className="block text-xs text-slate-500">{t('cmp.updateValue.addedMoneyHint')}</span>
            </span>
          </button>
          <button type="button" className={CHOICE} onClick={() => setStep('value')}>
            <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-slate-900">{t('cmp.updateValue.valueMoved')}</span>
              <span className="block text-xs text-slate-500">{t('cmp.updateValue.valueMovedHint')}</span>
            </span>
          </button>
        </div>
      ) : (
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-slate-500">{t('cmp.updateValue.setCurrentValueHint')}</p>
          <Field id="update-value-amount" label={t('cmp.updateValue.currentValueLabel', { currency })}>
            <AmountInput required value={value} currency={currency}
              onChange={v => setValue(v)} className={MONEY_INPUT} suffix={currency} />
          </Field>
          <p aria-live="polite" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm tabular-nums text-slate-600">
            <span>{t('cmp.growth.line', { putIn: moneyFull(g.putIn, currency), value: moneyFull(g.value, currency) })}</span>
            <GrowthChip g={g} currency={currency} />
          </p>

          {error && (
            <p role="alert" className="rounded-control border border-rose-200 px-3 py-2 text-sm text-expense">{error}</p>
          )}
        </form>
      )}
    </Modal>
  )
}
