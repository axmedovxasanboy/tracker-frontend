import { useEffect, useState } from 'react'
import { Equal, RotateCcw } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { formatNumber, moneyFull, snap } from '../../utils/format'
import { MONEY_INPUT } from '../transactions/formParts'
import { growthOf } from '../savings/growth'
import { investmentIcon } from './MoveInvestmentSheet'
import { groupByProvider } from './InvestmentGoalSheet'
import type { InvestmentResponse, InvestmentSplitResponse } from '../../types'

const FORM_ID = 'investment-split-form'
const UNIT = 1000

/**
 * The equal split, as the server makes it (INVEST-SPEC.md §8): whole 1.000s by the largest
 * remainder — the higher-value account first on a tie — and any leftover under 1.000 on the first.
 * {@code accounts} come in that tie order already.
 */
function equalAmounts(target: number, ids: number[]): Map<number, number> {
  const out = new Map<number, number>()
  if (ids.length === 0) return out
  const units = Math.floor(target / UNIT)
  const base = Math.floor(units / ids.length)
  let extra = units - base * ids.length
  ids.forEach(id => {
    out.set(id, (base + (extra > 0 ? 1 : 0)) * UNIT)
    if (extra > 0) extra--
  })
  const rest = target - units * UNIT
  if (rest > 0) out.set(ids[0], (out.get(ids[0]) ?? 0) + rest)
  return out
}

/** The equal split in percents, one decimal, adding up to exactly 100 (the rest on the first). */
function equalPercents(ids: number[]): Map<number, number> {
  const out = new Map<number, number>()
  if (ids.length === 0) return out
  const each = Math.floor(1000 / ids.length) / 10
  ids.forEach(id => out.set(id, each))
  out.set(ids[0], Math.round((100 - each * (ids.length - 1)) * 10) / 10)
  return out
}

/**
 * Change how the month's Investments money is split across the accounts (INVEST-SPEC.md §9).
 * With a figure for the month the owner types amounts, which must add up to it; with none, percents
 * that add up to 100. Either way the typed numbers are sent as weights, so the shares carry to the
 * next month and scale with its figure.
 */
export function SplitSheet({ open, onClose, onSaved, split, accounts }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  split: InvestmentSplitResponse | null
  /** Every plain investment account. */
  accounts: InvestmentResponse[]
}) {
  const { t } = useLang()
  const confirm = useConfirm()
  const { showSuccess } = useToast()
  const [values, setValues] = useState<Map<number, number>>(new Map())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target = split?.target ?? 0
  const byAmount = target > 0
  const goal = byAmount ? target : 100
  const groups = groupByProvider(accounts, t('invest.otherProvider'))
  // The server's tie order: the higher value first, then the id.
  const tieOrder = [...accounts]
    .sort((a, b) => growthOf(b).value - growthOf(a).value || a.id - b.id)
    .map(a => a.id)

  const initial = (): Map<number, number> => {
    const rows = new Map((split?.rows ?? []).map(r => [r.investmentId, r]))
    return new Map(accounts.map(a => {
      const r = rows.get(a.id)
      return [a.id, r ? (byAmount ? r.amount : r.percent) : 0]
    }))
  }

  useEffect(() => {
    if (!open) return
    setValues(initial())
    setError(null)
    // Seeded once per open; a refresh behind the sheet must not reset what is typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const sum = byAmount
    ? snap([...values.values()].reduce((s, v) => s + v, 0))
    : Math.round([...values.values()].reduce((s, v) => s + v, 0) * 10) / 10
  const left = byAmount ? snap(goal - sum) : Math.round((goal - sum) * 10) / 10
  const exact = Math.abs(left) < (byAmount ? 0.5 : 0.05)
  const over = !exact && left < 0
  const start = initial()
  const dirty = !saving && accounts.some(a => (values.get(a.id) ?? 0) !== (start.get(a.id) ?? 0))

  const setOne = (id: number, v: number) => {
    setValues(prev => new Map(prev).set(id, v))
    setError(null)
  }

  const fillEqual = () => {
    setValues(byAmount ? equalAmounts(target, tieOrder) : equalPercents(tieOrder))
    setError(null)
  }

  const resetToEqual = async () => {
    if (!await confirm({ message: t('invest.split.resetConfirm') })) return
    setSaving(true); setError(null)
    try {
      await financeApi.resetInvestmentSplit()
      showSuccess(t('invest.split.resetToast'))
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sum <= 0) { setError(t('invest.split.err.none')); return }
    if (!exact) {
      setError(byAmount
        ? t('invest.split.err.amounts', { amount: moneyFull(target, 'UZS') })
        : t('invest.split.err.percents'))
      return
    }
    setSaving(true); setError(null)
    try {
      await financeApi.setInvestmentSplit({
        weights: accounts.map(a => ({ investmentId: a.id, weight: values.get(a.id) ?? 0 })),
      })
      showSuccess(t('invest.split.savedToast'))
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const fmt = (v: number) => byAmount ? moneyFull(v, 'UZS') : `${formatNumber(v, Number.isInteger(v) ? 0 : 1)}%`

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty}
      title={t('invest.split.editTitle')}
      maxWidth="max-w-lg"
      footer={
        <div className="space-y-2">
          <p aria-live="polite"
            className={`text-sm tabular-nums ${over ? 'font-semibold text-expense' : exact ? 'font-semibold text-emerald-700' : 'text-slate-700'}`}>
            {exact
              ? t('invest.split.allSplit')
              : over
                ? t('invest.split.over', { sum: fmt(sum), goal: fmt(goal), amount: fmt(-left) })
                : t('invest.split.progress', { sum: fmt(sum), goal: fmt(goal), amount: fmt(left) })}
          </p>
          <div className="flex gap-3">
            <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
            <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
              disabled={!exact || sum <= 0}
              disabledReason={!exact ? (byAmount ? t('invest.split.err.amounts', { amount: moneyFull(target, 'UZS') }) : t('invest.split.err.percents')) : undefined}
              label={saving ? t('action.saving') : t('action.save')} />
          </div>
        </div>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          {byAmount
            ? t('invest.split.helpAmounts', { amount: moneyFull(target, 'UZS') })
            : t('invest.split.helpPercents')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" label={t('invest.split.equal')} icon={<Equal className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={fillEqual} />
          {split?.custom && (
            <Button size="sm" label={t('invest.split.reset')} icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              disabled={saving} onClick={resetToEqual} />
          )}
        </div>

        <div className="space-y-3">
          {groups.map(gr => (
            <div key={gr.key || '—'}>
              <p className="mb-1 truncate text-xs font-semibold text-slate-700">{gr.label}</p>
              <ul className="space-y-1.5">
                {gr.accounts.map(a => {
                  const v = values.get(a.id) ?? 0
                  const pct = byAmount ? (target > 0 ? (v / target) * 100 : 0) : v
                  const inputId = `split-${a.id}`
                  return (
                    <li key={a.id} className="flex min-h-[44px] items-center gap-3">
                      <span className="shrink-0 text-slate-500">{investmentIcon(a.type)}</span>
                      <label htmlFor={inputId} className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{a.name}</span>
                        {byAmount && (
                          <span className="block text-xs tabular-nums text-slate-500">
                            {t('invest.split.pct', { pct: formatNumber(pct, 1) })}
                          </span>
                        )}
                      </label>
                      <div className="w-36 shrink-0 sm:w-44">
                        <AmountInput id={inputId} value={v} onChange={n => setOne(a.id, n)}
                          currency="UZS" decimals={byAmount ? 0 : 1} suffix={byAmount ? 'UZS' : '%'}
                          className={MONEY_INPUT} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {error && <p role="alert" className="text-sm text-expense">{error}</p>}
      </form>
    </Sheet>
  )
}
