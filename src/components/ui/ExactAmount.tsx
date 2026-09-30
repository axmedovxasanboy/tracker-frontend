import { compactHides, moneyFull } from '../../utils/format'
import type { Currency } from '../../types'

/**
 * The exact figure behind a shortened one, in small print under it: "13,6 M UZS" over
 * "13.614.000 UZS".
 *
 * A headline figure is shortened so it fits and reads at a glance, and its exact value used to
 * live only in a hover tooltip — which a phone never shows. This renders nothing when the short
 * form hides nothing ("8 M UZS" for exactly 8.000.000), so it never repeats a number.
 */
export function ExactAmount({ amount, currency = 'UZS', className = '' }: {
  amount: number
  currency?: Currency
  className?: string
}) {
  if (!compactHides(amount)) return null
  return (
    <span className={`block text-xs font-normal tabular-nums text-slate-500 ${className}`}>
      {moneyFull(amount, currency)}
    </span>
  )
}
