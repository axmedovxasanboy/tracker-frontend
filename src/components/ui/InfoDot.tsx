import { Info } from 'lucide-react'

/**
 * The small ⓘ that sits in a card's top-right corner and opens its explanation.
 *
 * Most of the cards it lands on are themselves clickable (they navigate, or switch tab), so it
 * always stops propagation — without that it triggers the card instead of the explanation.
 */
export function InfoDot({ label, onClick, className = '' }: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick() }}
      aria-label={label}
      title={label}
      // slate-500, not slate-400: this glyph is the only thing that marks the control, so it is
      // a meaningful graphic and owes 3:1 — slate-400 measures 2.56:1 on white, slate-500 4.76:1.
      className={`text-slate-500 hover:text-slate-700 transition-colors rounded-full focus-ring ${className}`}
    >
      <Info className="w-4 h-4" aria-hidden="true" />
    </button>
  )
}
