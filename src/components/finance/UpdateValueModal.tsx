import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency } from '../../utils/format'
import type { InvestmentResponse } from '../../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

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
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('cmp.updateValue.title', { name: investment.name })} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-slate-500">
          {t('cmp.updateValue.contributedSoFar')} <span className="font-medium text-slate-700">{formatCurrency(investment.investedAmount, currency)}</span>.
          {' '}{t('cmp.updateValue.setCurrentValueHint')}
        </p>
        <Field label={t('cmp.updateValue.currentValueLabel', { currency })}>
          <AmountInput required value={value} currency={currency}
            onChange={v => setValue(v)} className={INPUT} suffix={currency} />
        </Field>

        {error && (
          <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
            {t('action.cancel')}
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? t('action.saving') : t('cmp.updateValue.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
