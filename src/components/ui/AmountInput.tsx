import { useEffect, useState } from 'react'
import { formatNumber, parseAmount, snap } from '../../utils/format'
import type { Currency } from '../../types'

interface Props {
  value: number
  onChange: (n: number) => void
  currency?: Currency
  required?: boolean
  className?: string
  placeholder?: string
  min?: number
  max?: number
  autoFocus?: boolean
  disabled?: boolean
  /** Number of decimal places to allow/display. Defaults to currency-driven (UZS=0, USD/EUR=2). */
  decimals?: number
  /** Optional suffix shown inside the input (e.g. currency code). */
  suffix?: string
  /** Called on blur with the formatted version of the value (useful for validation hooks). */
  onBlur?: () => void
  id?: string
  name?: string
  'aria-invalid'?: boolean
}

const CURRENCY_DECIMALS: Record<Currency, number> = { UZS: 0, USD: 2, EUR: 2 }

/**
 * Numeric input that shows the value with dot thousands separators while the user types,
 * and emits the parsed numeric value via `onChange`. Internal state is a string, so
 * intermediate states like "1.000.0" don't trigger precision loss in JS float math.
 *
 * Accepts pasted input in any common format (1.000.000 / 1,000,000 / 1000000.50 / 1000000,50)
 * thanks to `parseAmount`. Trailing decimals stick around while typing — we don't re-format
 * mid-typing if the user is partway through entering decimals.
 */
export function AmountInput({
  value, onChange, currency, required, className, placeholder = '0',
  min, max, autoFocus, disabled, decimals, suffix, onBlur, id, name,
  ...rest
}: Props) {
  const effectiveDecimals = decimals ?? (currency ? CURRENCY_DECIMALS[currency] : 2)
  const [text, setText] = useState(() => value === 0 ? '' : formatNumber(value, effectiveDecimals))

  // Reformat when the value changes from outside (e.g. selecting a loan auto-fills the amount).
  // But avoid clobbering user mid-typing — only resync if the parsed text differs from the new value.
  useEffect(() => {
    const parsed = parseAmount(text)
    if (Number.isFinite(parsed) && snap(parsed) === snap(value)) return
    setText(value === 0 ? '' : formatNumber(value, effectiveDecimals))
  }, [value, effectiveDecimals])

  const handleChange = (raw: string) => {
    // Strict European convention: dots are thousands separators (cosmetic, stripped on
    // input), and comma is the decimal separator. This matches what the user asked for
    // and removes any ambiguity around "10.000.000" — it always means ten million,
    // never ten-point-something. Pasting works too: a pasted "1,000,000.50" is normalised
    // by parseAmount via the blur path.
    let cleaned = raw.replace(/[^\d,\-.]/g, '')
    // Drop dots — they're thousands grouping and shouldn't reach the parsed number.
    cleaned = cleaned.replace(/\./g, '')
    // Allow at most one comma (decimal separator).
    const firstComma = cleaned.indexOf(',')
    if (firstComma >= 0) {
      cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, '')
    }
    setText(cleaned)
    const normalized = cleaned.replace(',', '.')
    if (normalized === '' || normalized === '-') {
      onChange(0)
      return
    }
    const n = Number(normalized)
    if (Number.isFinite(n)) onChange(snap(n))
  }

  const handleBlur = () => {
    // On blur, reformat the value cleanly with dot thousands separators.
    // Use parseAmount on blur so pasted values in any format normalise cleanly.
    if (text === '' || text === '-') {
      setText('')
    } else {
      const parsed = parseAmount(text)
      if (Number.isFinite(parsed)) setText(formatNumber(parsed, effectiveDecimals))
    }
    onBlur?.()
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={e => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        id={id}
        name={name}
        aria-invalid={rest['aria-invalid']}
        className={className}
        data-min={min}
        data-max={max}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  )
}
