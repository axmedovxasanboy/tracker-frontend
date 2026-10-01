import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { CONTROL, CONTROL_INVALID, MONEY_INPUT, MONEY_INPUT_INVALID } from '../transactions/formParts'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { pctNumber } from './levelWords'
import type { LevelPercents } from '../../types/levels'

export type PercentKey = keyof LevelPercents
export type PercentDraft = Record<PercentKey, string>

const KEYS: PercentKey[] = ['donation', 'emergency', 'investments']
const LABEL: Record<PercentKey, TKey> = {
  donation: 'cmp.bucket.donation',
  emergency: 'cmp.bucket.emergency',
  investments: 'cmp.bucket.investments',
}

/** The text a field opens with: "5", "2,5" — the app's own way of writing a number. */
export const draftOf = (p: LevelPercents): PercentDraft => ({
  donation: pctNumber(p.donation),
  emergency: pctNumber(p.emergency),
  investments: pctNumber(p.investments),
})

/** "5", "2,5", "2.5", "" (= 0) → the number; null when it is not 0–100 with at most one decimal. */
export function parsePct(text: string): number | null {
  const s = text.trim().replace(',', '.')
  if (s === '') return 0
  if (!/^\d{1,3}(\.\d)?$/.test(s)) return null
  const n = Number(s)
  return n >= 0 && n <= 100 ? n : null
}

export interface PercentCheck {
  values: LevelPercents | null
  errors: Partial<Record<PercentKey, TKey>>
  totalError: TKey | null
}

/** Each field 0–100 with one decimal at most; the three together at most 100 (spec §2.3). */
export function checkDraft(d: PercentDraft): PercentCheck {
  const errors: Partial<Record<PercentKey, TKey>> = {}
  const out: Partial<LevelPercents> = {}
  for (const k of KEYS) {
    const raw = d[k].trim().replace(',', '.')
    const n = parsePct(d[k])
    if (n == null) errors[k] = /^\d+(\.\d+)?$/.test(raw) && Number(raw) > 100 ? 'lvl.err.each' : 'lvl.err.number'
    else out[k] = n
  }
  if (Object.keys(errors).length > 0) return { values: null, errors, totalError: null }
  const values = out as LevelPercents
  const total = values.donation + values.emergency + values.investments
  return total > 100 + 1e-9
    ? { values: null, errors: {}, totalError: 'lvl.err.total' }
    : { values, errors: {}, totalError: null }
}

export const sameDraft = (a: PercentDraft, b: PercentDraft): boolean =>
  KEYS.every(k => parsePct(a[k]) === parsePct(b[k]))

/** A percent box: the number on the left, "%" on the right, a decimal keypad on a phone. */
const PercentInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function PercentInput({ invalid, className, ...rest }, ref) {
    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className={`${invalid ? CONTROL_INVALID : CONTROL} pr-9 tabular-nums ${className ?? ''}`}
          {...rest}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">%</span>
      </div>
    )
  },
)

/**
 * The three percentages of one situation — and, for the four split ones, the level's "Split at"
 * line beside them, which saves in the same request (the owner's answer, spec §6). Stacked on a
 * phone, where "Favqulodda jamgʻarma" needs the width; three across from `sm`.
 */
export function PercentFields({ idPrefix, draft, onChange, check, showErrors, split, disabled = false }: {
  idPrefix: string
  draft: PercentDraft
  onChange: (next: PercentDraft) => void
  check: PercentCheck
  /** Errors appear once the owner has tried to save, or as soon as a field is wrong to type. */
  showErrors: boolean
  /** Present for a split situation: the line, in UZS, and its setter. */
  split?: { value: number; onChange: (v: number) => void; invalid: boolean }
  disabled?: boolean
}) {
  const { t } = useLang()
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {KEYS.map(k => {
          const err = showErrors && check.errors[k] ? t(check.errors[k]!) : undefined
          return (
            <Field key={k} id={`${idPrefix}-${k}`} label={t(LABEL[k])} error={err}>
              <PercentInput
                value={draft[k]}
                invalid={!!err}
                disabled={disabled}
                onChange={e => onChange({ ...draft, [k]: e.target.value })}
                aria-describedby={`${idPrefix}-hint`}
              />
            </Field>
          )
        })}
      </div>
      <p id={`${idPrefix}-hint`} className="text-xs text-slate-500">{t('lvl.edit.notAsked')}</p>
      {showErrors && check.totalError && (
        <p role="alert" className="text-sm font-medium text-expense">{t(check.totalError)}</p>
      )}
      {split && (
        <Field
          id={`${idPrefix}-split`}
          label={t('lvl.edit.splitAt')}
          help={t('lvl.edit.splitHelp')}
          error={showErrors && split.invalid ? t('lvl.err.split') : undefined}
        >
          <AmountInput
            value={split.value}
            onChange={split.onChange}
            currency="UZS"
            suffix="UZS"
            className={split.invalid && showErrors ? MONEY_INPUT_INVALID : MONEY_INPUT}
          />
        </Field>
      )}
    </div>
  )
}
