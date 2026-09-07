import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MutableRefObject } from 'react'
import { formatNumber, parseAmount, snap } from '../../utils/format'
import type { Currency } from '../../types'

interface Props {
  value: number
  onChange: (n: number) => void
  currency?: Currency
  required?: boolean
  className?: string
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
  /**
   * A figure the user cannot type into because it is derived (the cash + card total).
   * Unlike `disabled` this stays focusable, so it can still be a dialog's initial focus target.
   */
  readOnly?: boolean
  /** Number of decimal places to allow/display. Defaults to currency-driven (UZS=0). */
  decimals?: number
  /** Optional suffix shown inside the input (e.g. currency code). */
  suffix?: string
  /** Type scale for the suffix, so it can sit beside a 28px figure without looking lost. */
  suffixClassName?: string
  /** Called on blur with the formatted version of the value (useful for validation hooks). */
  onBlur?: () => void
  id?: string
  name?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}

const CURRENCY_DECIMALS: Record<Currency, number> = { UZS: 0, USD: 2, EUR: 2 }

/** Everything that survives cleaning. The grouping dots are the only cosmetic characters. */
const SIGNIFICANT = /[\d,-]/

function countSignificant(s: string): number {
  let n = 0
  for (const ch of s) if (SIGNIFICANT.test(ch)) n++
  return n
}

/** The index in `display` that sits just after `count` significant characters. */
function caretAfter(display: string, count: number): number {
  let seen = 0
  for (let i = 0; i < display.length; i++) {
    if (seen === count) return i
    if (display[i] !== '.') seen++
  }
  return display.length
}

/**
 * Clean raw input and re-group the integer half, returning both what to show and what to parse.
 * "10000000" → { display: "10.000.000", numeric: "10000000" }
 */
function regroup(raw: string): { display: string; numeric: string } {
  // Dots are thousands grouping — cosmetic, so they never reach the parsed number.
  let cleaned = raw.replace(/[^\d,\-.]/g, '').replace(/\./g, '')
  // Allow at most one comma (the decimal separator).
  const firstComma = cleaned.indexOf(',')
  if (firstComma >= 0) {
    cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, '')
  }
  // A minus only means anything in front; one anywhere else used to make Number() return NaN,
  // which silently froze the emitted value while the text kept changing.
  const negative = cleaned.startsWith('-')
  cleaned = cleaned.replace(/-/g, '')
  const [intPart, decPart] = cleaned.split(',')
  const sign = negative ? '-' : ''
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return {
    display: decPart === undefined ? `${sign}${grouped}` : `${sign}${grouped},${decPart}`,
    numeric: decPart === undefined ? `${sign}${intPart}` : `${sign}${intPart}.${decPart}`,
  }
}

/**
 * Numeric input that shows the value with dot thousands separators **while the user types**,
 * and emits the parsed numeric value via `onChange`. Internal state is a string, so
 * intermediate states like "1.000,0" don't trigger precision loss in JS float math.
 *
 * Grouping used to be applied on blur only, which left the number unreadable exactly while it
 * was being entered — "10000000" is the shape a mis-typed ten million hides in. Regrouping on
 * every keystroke moves the caret, so the caret is re-anchored to the count of significant
 * characters to its left rather than to a raw index.
 *
 * Accepts pasted input in any common format (1.000.000 / 1,000,000 / 1000000.50 / 1000000,50)
 * thanks to `parseAmount`. Trailing decimals stick around while typing — we don't re-format
 * mid-typing if the user is partway through entering decimals.
 */
export const AmountInput = forwardRef<HTMLInputElement, Props>(function AmountInput({
  value, onChange, currency, required, className, placeholder = '0',
  autoFocus, disabled, readOnly, decimals, suffix, suffixClassName, onBlur, id, name,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-required': ariaRequired,
}, ref) {
  const effectiveDecimals = decimals ?? (currency ? CURRENCY_DECIMALS[currency] : 2)
  const [text, setText] = useState(() => value === 0 ? '' : formatNumber(value, effectiveDecimals))
  const inputRef = useRef<HTMLInputElement | null>(null)
  /**
   * Where the caret belongs after the next paint, together with the text it was computed for.
   * Null when this render did not regroup. Keeping the text means a position that never got
   * committed — a keystroke that cleaned away to the same string re-renders nothing — is
   * discarded rather than applied to some unrelated render later.
   */
  const caretRef = useRef<{ pos: number; text: string } | null>(null)

  const attachRef = (el: HTMLInputElement | null) => {
    inputRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as MutableRefObject<HTMLInputElement | null>).current = el
  }

  // Reformat when the value changes from outside (e.g. selecting a loan auto-fills the amount).
  // But avoid clobbering user mid-typing — only resync if the parsed text differs from the new value.
  useEffect(() => {
    const parsed = parseAmount(text)
    if (Number.isFinite(parsed) && snap(parsed) === snap(value)) return
    setText(value === 0 ? '' : formatNumber(value, effectiveDecimals))
  }, [value, effectiveDecimals])

  // Before the browser paints, or the caret is visibly seen jumping to the end and back.
  useLayoutEffect(() => {
    const el = inputRef.current
    const pending = caretRef.current
    caretRef.current = null
    if (!el || !pending || el.value !== pending.text || document.activeElement !== el) return
    el.setSelectionRange(pending.pos, pending.pos)
  })

  const applyRaw = (raw: string, caret: number) => {
    const { display, numeric } = regroup(raw)
    caretRef.current = { pos: caretAfter(display, countSignificant(raw.slice(0, caret))), text: display }
    setText(display)
    if (numeric === '' || numeric === '-') {
      onChange(0)
      return
    }
    const n = Number(numeric)
    if (Number.isFinite(n)) onChange(snap(n))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (readOnly || disabled) return
    const el = e.currentTarget
    const pos = el.selectionStart
    if (pos === null || pos !== el.selectionEnd) return
    // Deleting a grouping dot alone is a no-op — it comes straight back — so take the digit the
    // user was actually aiming at instead of eating the keystroke.
    if (e.key === 'Backspace' && pos >= 2 && el.value[pos - 1] === '.') {
      e.preventDefault()
      applyRaw(el.value.slice(0, pos - 2) + el.value.slice(pos), pos - 2)
    } else if (e.key === 'Delete' && el.value[pos] === '.') {
      e.preventDefault()
      applyRaw(el.value.slice(0, pos) + el.value.slice(pos + 2), pos)
    }
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
        ref={attachRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={e => applyRaw(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        readOnly={readOnly}
        id={id}
        name={name}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        className={className}
      />
      {suffix && (
        <span
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-medium text-slate-500 ${
            suffixClassName ?? 'text-xs'
          }`}
        >
          {suffix}
        </span>
      )}
    </div>
  )
})
