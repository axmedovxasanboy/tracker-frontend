import type { BreakdownMonth } from '../../types/analyticsBreakdown'

/**
 * A row's months as small multiples (§3.6): one fixed 8px slot per `months[]` entry, left-aligned,
 * on the scale the caller shares across its card so the rows compare. A tracked month at nothing
 * is a 1px baseline; an untracked month is an empty slot with none — untracked is not zero (§1.2).
 * Decorative: the row's text and the Open sheet carry the numbers.
 */
export function SlotStrip({ values, max, fillClass }: {
  /** One per `months[]` entry; null for a month with no entries at all. */
  values: Array<number | null>
  max: number
  fillClass: string
}) {
  return (
    <span aria-hidden="true" className="flex h-4 items-end gap-0.5">
      {values.map((v, i) => (
        <span key={i} className="flex h-full w-2 shrink-0 items-end">
          {v == null ? null : v > 0 && max > 0 ? (
            <span className={`w-full rounded-t-[2px] ${fillClass}`} style={{ height: `${Math.max(12, Math.min(100, (v / max) * 100))}%` }} />
          ) : (
            <span className="h-px w-full bg-slate-300" />
          )}
        </span>
      ))}
    </span>
  )
}

/** A line's `byMonth`, with the months that have no entries at all as gaps. */
export function slotValues(byMonth: number[], months: BreakdownMonth[]): Array<number | null> {
  return months.map((m, i) => (m.tracked ? byMonth[i] ?? 0 : null))
}
