import { useEffect, useState } from 'react'
import { Briefcase, Building2, Landmark } from 'lucide-react'
import type { ReactNode } from 'react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, snap, todayLocal } from '../../utils/format'
import {
  ChipGroup, CompactDate, CONTROL, LINK_BLOCK, MONEY_INPUT, MONEY_INPUT_INVALID, useOptional,
} from '../transactions/formParts'
import { growthOf } from '../savings/growth'
import type { InvestmentResponse, InvestmentType } from '../../types'

const FORM_ID = 'move-investment-form'

/** The icon an investment's type is drawn with — on the page and in this sheet. */
export function investmentIcon(type: InvestmentType, className = 'h-4 w-4'): ReactNode {
  if (type === 'BUSINESS') return <Briefcase className={className} aria-hidden="true" />
  if (type === 'ISLAMIC_BANK') return <Landmark className={className} aria-hidden="true" />
  return <Building2 className={className} aria-hidden="true" />
}

/**
 * Move money from one investment to another — a business to an Islamic bank, one bank to the next —
 * the way Wallets moves money between cards (INVEST-SPEC.md §2). No wallet is touched and no
 * transaction is written: it is neither spending nor income, and the month's savings do not move.
 * The server refuses more than the source is worth; the sheet says so before it is asked.
 */
export function MoveInvestmentSheet({ open, onClose, onSaved, holdings, fromId }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** The plain investments money can move between. */
  holdings: InvestmentResponse[]
  /** Start with this one as the source — its own "Move" button. */
  fromId?: number | null
}) {
  const { t } = useLang()
  const optional = useOptional()
  const { showSuccess } = useToast()
  const today = todayLocal()
  const [from, setFrom] = useState<number | null>(null)
  const [to, setTo] = useState<number | null>(null)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'pick' | 'amount' | 'date' | null>(null)

  useEffect(() => {
    if (!open) return
    // The source: the one asked for, else the one holding the most. The target: the next one.
    const byValue = [...holdings].sort((a, b) => growthOf(b).value - growthOf(a).value)
    const start = fromId ?? byValue[0]?.id ?? null
    setFrom(start)
    setTo(byValue.find(i => i.id !== start)?.id ?? null)
    setAmount(0)
    setDate(todayLocal())
    setNote('')
    setError(null)
    setInvalid(null)
    // Seeded once per open; the list refreshing behind the sheet must not reset what is typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fromId])

  const source = holdings.find(i => i.id === from) ?? null
  const target = holdings.find(i => i.id === to) ?? null
  const sourceValue = source ? growthOf(source).value : 0
  const targetValue = target ? growthOf(target).value : 0
  const currency = source?.currency ?? 'UZS'
  const tooMuch = !!source && amount > 0 && snap(amount) > snap(sourceValue)

  const option = (i: InvestmentResponse) => ({
    value: i.id,
    label: i.name,
    sub: moneyFull(growthOf(i).value, i.currency),
    icon: investmentIcon(i.type),
  })

  const clearError = () => { setInvalid(null); setError(null) }

  const pickFrom = (id: number) => {
    setFrom(id)
    if (to === id) setTo(holdings.find(i => i.id !== id)?.id ?? null)
    if (invalid === 'pick' || invalid === 'amount') clearError()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!source || !target) { setInvalid('pick'); setError(t('invest.moveSheet.err.pick')); return }
    if (source.id === target.id) { setInvalid('pick'); setError(t('invest.moveSheet.err.differ')); return }
    if (!(amount > 0)) { setInvalid('amount'); setError(t('invest.moveSheet.err.amount')); return }
    if (tooMuch) {
      setInvalid('amount')
      setError(t('invest.moveSheet.err.tooMuch', { name: source.name, amount: moneyFull(sourceValue, currency) }))
      return
    }
    if (date > today) { setInvalid('date'); setError(t('invest.moveSheet.err.future')); return }
    setSaving(true); clearError()
    try {
      await financeApi.transferInvestment({
        fromId: source.id, toId: target.id, amount, date, note: note.trim() || undefined,
      })
      showSuccess(t('invest.moveSheet.doneToast', { amount: moneyFull(amount, currency), name: target.name }))
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const amountError = invalid === 'amount'
    ? error ?? undefined
    : tooMuch && source
      ? t('invest.moveSheet.err.tooMuch', { name: source.name, amount: moneyFull(sourceValue, currency) })
      : undefined

  const showPreview = !!source && !!target && source.id !== target.id && amount > 0 && !tooMuch

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={(amount > 0 || !!note.trim()) && !saving}
      title={t('invest.moveSheet.title')}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
            disabled={saving || tooMuch}
            disabledReason={tooMuch ? amountError : undefined}
            label={saving ? t('invest.moveSheet.saving') : t('invest.moveSheet.submit')} />
        </div>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">{t('invest.moveSheet.hint')}</p>

        <ChipGroup
          id="move-from"
          label={t('invest.moveSheet.from')}
          required
          options={holdings.map(option)}
          value={from}
          onChange={pickFrom}
          error={invalid === 'pick' && !source ? error ?? undefined : undefined}
        />
        <ChipGroup
          id="move-to"
          label={t('invest.moveSheet.to')}
          required
          options={holdings.filter(i => i.id !== from).map(option)}
          value={to}
          onChange={id => { setTo(id); if (invalid === 'pick') clearError() }}
          error={invalid === 'pick' && source ? error ?? undefined : undefined}
        />

        <div>
          <Field id="move-amount" label={t('tx.amount')} required error={amountError}>
            <AmountInput value={amount} currency={currency} suffix={currency}
              onChange={v => { setAmount(v); if (invalid === 'amount') clearError() }}
              className={amountError ? MONEY_INPUT_INVALID : MONEY_INPUT} />
          </Field>
          {/* "All of it" — the whole of the source, one tap. */}
          {source && sourceValue > 0 && (
            <button type="button" className={`${LINK_BLOCK} tabular-nums`}
              onClick={() => { setAmount(snap(sourceValue)); if (invalid === 'amount') clearError() }}>
              {t('invest.moveSheet.all', { amount: moneyFull(sourceValue, currency) })}
            </button>
          )}
        </div>

        {showPreview && (
          <div aria-live="polite" className="space-y-1 rounded-control border border-hairline px-3 py-2.5 text-sm tabular-nums text-slate-700">
            <p>{t('invest.moveSheet.preview', {
              name: source!.name,
              before: moneyFull(sourceValue, currency),
              after: moneyFull(snap(sourceValue - amount), currency),
            })}</p>
            <p>{t('invest.moveSheet.preview', {
              name: target!.name,
              before: moneyFull(targetValue, currency),
              after: moneyFull(snap(targetValue + amount), currency),
            })}</p>
          </div>
        )}

        <CompactDate id="move-date" label={t('tx.date')} value={date} max={today}
          onChange={v => { setDate(v); if (invalid === 'date') clearError() }}
          error={invalid === 'date' ? error ?? undefined : undefined} />

        <Field id="move-note" label={optional(t('invest.moveSheet.note'))}>
          <input value={note} onChange={e => setNote(e.target.value)} className={CONTROL}
            placeholder={t('invest.moveSheet.notePlaceholder')} />
        </Field>

        {error && !invalid && <p role="alert" className="text-sm text-expense">{error}</p>}
      </form>
    </Sheet>
  )
}
