import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Slot } from './palette'

/** A legend key in a row: the mark's colour (or the hatch), round like a donut's. Decorative. */
export function SlotDot({ slot }: { slot: Slot | null | undefined }) {
  if (!slot) return <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0" />
  return (
    <span
      aria-hidden="true"
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={slot.hatched
        ? { background: `repeating-linear-gradient(135deg, ${slot.color} 0 2px, #e2e8f0 2px 4px)` }
        : { backgroundColor: slot.color }}
    />
  )
}

/**
 * One line of a donut's list (2026-10-13 restyle): its colour key, its name with the caption lines
 * under it (expected, to come, received on …), its share of the whole as a chip and its amount —
 * the donut's text equivalent. A row that leads somewhere is ONE link or ONE disclosure button with
 * a 44px floor. Over a range the month-by-month `strip` gets a line of its own under the name.
 */
export function ShareRow({
  slot, icon, label, amount, share, captions = [], to, onToggle, expanded, strip, tone = 'text-slate-900', child = false,
}: {
  slot?: Slot | null
  /** In place of the colour key, for a row that is no part of a ring (Borrowed, Lent …). */
  icon?: ReactNode
  label: ReactNode
  /** Already formatted. */
  amount: string
  /** "44" → a "44%" chip; null shows none. */
  share?: string | null
  captions?: ReactNode[]
  to?: string | null
  onToggle?: () => void
  expanded?: boolean
  strip?: ReactNode
  /** The amount's colour: rose for a negative figure in a complete month. */
  tone?: string
  /** A child under its root: smaller name, no colour key of its own. */
  child?: boolean
}) {
  const shown = captions.filter(c => c != null && c !== false && c !== '')
  const body = (
    <>
      <span className="flex items-center gap-2.5">
        {icon ? (
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-chip bg-slate-100 text-slate-500">{icon}</span>
        ) : !child && <SlotDot slot={slot} />}
        <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${child ? 'text-sm text-slate-700' : 'text-sm font-medium text-slate-800'}`}>
          {label}
        </span>
        {share !== undefined && (
          <span className={`w-11 shrink-0 rounded-chip py-0.5 text-center text-xs font-semibold tabular-nums ${share != null ? 'bg-slate-100 text-slate-700' : ''}`}>
            {share != null ? `${share}%` : ''}
          </span>
        )}
        <span className={`min-w-[4rem] shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums ${tone}`}>{amount}</span>
        {to && <ChevronRight className="-mr-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
        {onToggle && (
          <ChevronDown
            className={`-mr-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        )}
      </span>
      {/* Over a range the month strip has a line of its own, so a phone keeps room for the name. */}
      {strip && <span className={`mt-1 block ${child ? '' : 'pl-5'}`}>{strip}</span>}
      {shown.map((c, i) => (
        <span key={i} className={`mt-0.5 block text-xs leading-snug text-slate-500 tabular-nums [overflow-wrap:anywhere] ${icon ? 'pl-[2.625rem]' : child ? '' : 'pl-5'}`}>
          {c}
        </span>
      ))}
    </>
  )
  const box = 'block w-full py-2 text-left'
  const interactive = 'focus-ring -mx-2 min-h-[44px] w-[calc(100%+1rem)] rounded-control px-2 transition-colors hover:bg-slate-50'
  if (to) return <Link to={to} className={`${box} ${interactive}`}>{body}</Link>
  if (onToggle) {
    return (
      <button type="button" onClick={onToggle} aria-expanded={!!expanded} className={`${box} ${interactive}`}>
        {body}
      </button>
    )
  }
  return <div className={box}>{body}</div>
}
