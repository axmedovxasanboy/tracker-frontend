import type { ReactNode } from 'react'
import { useRadioGroupKeys } from '../../hooks/useRadioGroupKeys'
import { useLang } from '../../i18n/LanguageContext'
import { AmountInput } from '../ui/AmountInput'
import { Field } from '../ui/Field'
import { moneyFull } from '../../utils/format'
import type { Currency } from '../../types'

/**
 * The control skin the short forms share: 44px, the control radius, a visible edge and the
 * focus ring every control must carry (the global :focus-visible outline is off).
 */
export const CONTROL = 'focus-ring h-11 w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500'
export const CONTROL_INVALID = 'focus-ring h-11 w-full rounded-control border border-expense bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500'
/** `AmountInput` overlays its suffix at right-3, which plain px-3 leaves no room for. */
export const MONEY_INPUT = `${CONTROL} pr-14 tabular-nums`
export const MONEY_INPUT_INVALID = `${CONTROL_INVALID} pr-14 tabular-nums`
/** A textarea sizes from `rows`, so it takes vertical padding where an input takes a height. */
export const TEXTAREA = 'focus-ring w-full resize-none rounded-control border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500'
/** An inline text link that is really a button. */
export const LINK = 'focus-ring cursor-pointer rounded-chip text-xs font-semibold text-indigo-600 hover:underline'
/** The same link standing on its own line, with a full 44px touch target. */
export const LINK_BLOCK = 'focus-ring inline-flex min-h-[44px] cursor-pointer items-center rounded-control text-sm font-semibold text-indigo-600 hover:underline'

/** "Note (optional)" — the one way an optional field says so. */
export function useOptional() {
  const { t } = useLang()
  return (label: string) => `${label} (${t('common.optional')})`
}

export interface ChipOption<T extends string | number> {
  value: T
  label: string
  /** A second, smaller line — a balance. */
  sub?: string
  icon?: ReactNode
}

/**
 * A single choice shown as tappable chips rather than a select: every option is visible, one tap
 * picks it, and the chosen one is obvious. A real radiogroup — one tab stop, arrow keys move and
 * select — so it reads the same to a screen reader as it looks.
 */
export function ChipGroup<T extends string | number>({
  id, label, required, options, value, onChange, error, help, trailing, compact = false,
}: {
  id: string
  label: string
  required?: boolean
  options: ChipOption<T>[]
  value: T | null
  onChange: (v: T) => void
  error?: string
  help?: string
  /** Rendered after the chips, inside the same row — an "add" chip, for instance. */
  trailing?: ReactNode
  /** One-line chips, for short labels such as sub-categories. */
  compact?: boolean
}) {
  const values = options.map(o => o.value)
  const keys = useRadioGroupKeys<T>(values, value as T, onChange)
  const labelId = `${id}-label`
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="min-w-0">
      <p id={labelId} className="mb-1 text-xs font-medium text-slate-600">
        {label}
        {required && <span aria-hidden="true" className="text-expense"> *</span>}
      </p>
      {help && <p id={helpId} className="mb-1.5 text-xs leading-snug text-slate-500">{help}</p>}
      <div
        id={id}
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        className="flex flex-wrap gap-2"
      >
        {options.map((o, i) => {
          const checked = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={checked}
              {...keys(i)}
              onClick={() => onChange(o.value)}
              className={`focus-ring flex min-h-[44px] max-w-full items-center gap-2 rounded-control border px-3 text-left transition-colors ${
                compact ? 'py-1.5' : 'py-1'
              } ${
                checked
                  ? 'border-indigo-600 bg-indigo-50 text-slate-900'
                  : error
                    ? 'border-expense bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {o.icon && (
                <span aria-hidden="true" className={`shrink-0 ${checked ? 'text-indigo-600' : 'text-slate-500'}`}>
                  {o.icon}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{o.label}</span>
                {o.sub && <span className="block truncate text-xs tabular-nums text-slate-500">{o.sub}</span>}
              </span>
            </button>
          )
        })}
        {trailing}
      </div>
      {error && <p id={errorId} role="alert" className="mt-1 text-xs leading-snug text-expense">{error}</p>}
    </div>
  )
}

/**
 * The date, on one line: it is almost always today, so it should cost one glance, not a block.
 * The owner's local day comes in as `value`; this never computes "today" itself.
 */
export function CompactDate({ id, label, value, onChange, error }: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  const errorId = error ? `${id}-error` : undefined
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-slate-600">{label}</label>
        <input
          id={id}
          type="date"
          required
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={`focus-ring h-11 w-auto min-w-[10.5rem] rounded-control border bg-white px-3 text-sm text-slate-900 ${
            error ? 'border-expense' : 'border-slate-200'
          }`}
        />
      </div>
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-expense">{error}</p>}
    </div>
  )
}

/**
 * A split payment: the owner types how much went in cash, and the card carries the rest of the
 * amount already entered above — two numbers the owner knows, instead of two to re-add.
 */
export function CashPart({ id, total, cash, onCash, currency, error }: {
  id: string
  total: number
  cash: number
  onCash: (v: number) => void
  currency: Currency
  error?: string
}) {
  const { t } = useLang()
  const cardPart = Math.max(0, (total || 0) - (cash || 0))
  return (
    <div className="space-y-1.5">
      <Field id={id} label={t('home.form.cashPart')} required error={error}>
        <AmountInput
          value={cash || 0}
          onChange={onCash}
          currency={currency}
          suffix={currency}
          className={error ? MONEY_INPUT_INVALID : MONEY_INPUT}
        />
      </Field>
      <p className="text-xs tabular-nums text-slate-500">
        {t('home.form.cardPart', { amount: moneyFull(cardPart, currency) })}
      </p>
    </div>
  )
}
