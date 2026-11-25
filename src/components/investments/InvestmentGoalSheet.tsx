import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, snap } from '../../utils/format'
import {
  CONTROL, CONTROL_INVALID, MONEY_INPUT, MONEY_INPUT_INVALID, TEXTAREA, useOptional,
} from '../transactions/formParts'
import { growthOf } from '../savings/growth'
import { investmentIcon } from './MoveInvestmentSheet'
import type { InvestmentGoalResponse, InvestmentResponse } from '../../types'

const FORM_ID = 'investment-goal-form'

/** The accounts grouped by where they are (broker / provider), the biggest group first. */
export function groupByProvider(accounts: InvestmentResponse[], otherLabel: string) {
  const groups = new Map<string, InvestmentResponse[]>()
  for (const a of accounts) {
    const key = a.broker?.trim() || ''
    groups.set(key, [...(groups.get(key) ?? []), a])
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => growthOf(b).value - growthOf(a).value)
      return {
        key,
        label: key || otherLabel,
        accounts: sorted,
        total: snap(sorted.reduce((s, a) => s + growthOf(a).value, 0)),
      }
    })
    // "Other" (no provider) last; the rest by total, biggest first.
    .sort((a, b) => (a.key === '' ? 1 : 0) - (b.key === '' ? 1 : 0) || b.total - a.total)
}

/**
 * An investment goal: a name, a rough target, and the investment accounts saving for it
 * (INVEST-SPEC.md §6). An account saves for one goal at most — ticking one that belongs to another
 * goal moves it here (the server does the move on save). Its saved figure is what the ticked
 * accounts are worth; no money moves.
 */
export function InvestmentGoalSheet({ open, onClose, onSaved, goal, accounts }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** The goal to edit; null makes a new one. */
  goal: InvestmentGoalResponse | null
  /** Every plain investment account. */
  accounts: InvestmentResponse[]
}) {
  const { t } = useLang()
  const optional = useOptional()
  const { showSuccess } = useToast()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState(0)
  const [note, setNote] = useState('')
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'name' | 'target' | null>(null)

  const initialIds = (g: InvestmentGoalResponse | null) => new Set((g?.investments ?? []).map(a => a.id))

  useEffect(() => {
    if (!open) return
    setName(goal?.name ?? '')
    setTarget(goal?.targetAmount ?? 0)
    setNote(goal?.note ?? '')
    setPicked(initialIds(goal))
    setError(null)
    setInvalid(null)
    // Seeded once per open; a refresh behind the sheet must not reset what is typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal?.id])

  const editing = !!goal
  const start = initialIds(goal)
  const sameSet = start.size === picked.size && [...picked].every(id => start.has(id))
  const dirty = !saving && (editing
    ? name !== goal!.name || target !== goal!.targetAmount || note !== (goal!.note ?? '') || !sameSet
    : !!name.trim() || target > 0 || !!note.trim() || picked.size > 0)

  const chosen = accounts.filter(a => picked.has(a.id))
  const chosenTotal = snap(chosen.reduce((s, a) => s + growthOf(a).value, 0))
  const groups = groupByProvider(accounts, t('invest.otherProvider'))

  const toggle = (id: number) => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setInvalid('name'); setError(t('invest.goalSheet.err.name')); nameRef.current?.focus(); return }
    if (!(target > 0)) { setInvalid('target'); setError(t('invest.goalSheet.err.target')); return }
    setSaving(true); setError(null); setInvalid(null)
    const body = {
      name: name.trim(), targetAmount: target, note: note.trim() || undefined,
      investmentIds: accounts.filter(a => picked.has(a.id)).map(a => a.id),
    }
    try {
      if (editing) await financeApi.updateInvestmentGoal(goal!.id, body)
      else await financeApi.createInvestmentGoal(body)
      showSuccess(t('invest.goals.savedToast'))
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      initialFocusRef={nameRef}
      title={editing ? t('invest.goalSheet.editTitle') : t('invest.goalSheet.newTitle')}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
            label={saving ? t('action.saving') : editing ? t('action.save') : t('action.add')} />
        </div>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        <Field id="ig-name" label={t('invest.goalSheet.name')} required
          error={invalid === 'name' ? error ?? undefined : undefined}>
          <input ref={nameRef} value={name}
            onChange={e => { setName(e.target.value); if (invalid === 'name') { setInvalid(null); setError(null) } }}
            className={invalid === 'name' ? CONTROL_INVALID : CONTROL}
            placeholder={t('invest.goalSheet.namePlaceholder')} />
        </Field>

        <Field id="ig-target" label={t('invest.goalSheet.target')} required
          error={invalid === 'target' ? error ?? undefined : undefined}>
          <AmountInput value={target} currency="UZS" suffix="UZS"
            onChange={v => { setTarget(v); if (invalid === 'target') { setInvalid(null); setError(null) } }}
            className={invalid === 'target' ? MONEY_INPUT_INVALID : MONEY_INPUT} />
        </Field>

        <fieldset className="min-w-0">
          <legend className="mb-1 text-xs font-medium text-slate-600">{t('invest.goalSheet.accounts')}</legend>
          {accounts.length === 0 ? (
            <p className="text-sm text-slate-500">{t('invest.goalSheet.noAccounts')}</p>
          ) : (
            <>
              <p className="mb-2 text-xs leading-snug text-slate-500">{t('invest.goalSheet.accountsHelp')}</p>
              <div className="space-y-3">
                {groups.map(gr => (
                  <div key={gr.key || '—'}>
                    <p className="mb-1 flex items-baseline justify-between gap-2 text-xs font-semibold text-slate-700">
                      <span className="truncate">{gr.label}</span>
                      <span className="shrink-0 tabular-nums font-normal text-slate-500">{moneyFull(gr.total, 'UZS')}</span>
                    </p>
                    <ul className="space-y-1.5">
                      {gr.accounts.map(a => {
                        const inOther = a.investmentGoalId != null && a.investmentGoalId !== goal?.id && a.investmentGoalName
                        const checked = picked.has(a.id)
                        return (
                          <li key={a.id}>
                            <label className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-control border px-3 py-2 transition-colors ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-hairline hover:bg-slate-50'}`}>
                              <input type="checkbox" checked={checked} onChange={() => toggle(a.id)}
                                className="focus-ring h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600" />
                              <span className="shrink-0 text-slate-500">{investmentIcon(a.type)}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-slate-900">{a.name}</span>
                                {inOther && (
                                  <span className="block truncate text-xs text-amber-700">
                                    {t('invest.goalSheet.inOther', { name: a.investmentGoalName! })}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-sm tabular-nums text-slate-700">{moneyFull(growthOf(a).value, a.currency)}</span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <p aria-live="polite" className="mt-2 text-sm tabular-nums text-slate-700">
                {chosen.length === 1
                  ? t('invest.goalSheet.selectedOne', { amount: moneyFull(chosenTotal, 'UZS') })
                  : t('invest.goalSheet.selected', { count: chosen.length, amount: moneyFull(chosenTotal, 'UZS') })}
              </p>
            </>
          )}
        </fieldset>

        <Field id="ig-note" label={optional(t('invest.goalSheet.note'))}>
          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} className={TEXTAREA} />
        </Field>

        {error && !invalid && <p role="alert" className="text-sm text-expense">{error}</p>}
      </form>
    </Sheet>
  )
}
