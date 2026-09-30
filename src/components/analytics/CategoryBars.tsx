import type { ReactNode } from 'react'
import { money, moneyExact } from '../../utils/format'

export interface CategoryBarItem {
  key: string
  label: string
  amount: number
  /** The bar's fill as a colour value — a category's own colour. */
  color?: string
  /** Or as a class, for the fixed rows ("Not itemised"). */
  colorClass?: string
  /** A muted line under the bar: a share, a change against last month. */
  note?: ReactNode
  /** Makes the whole row a button. */
  onClick?: () => void
}

/**
 * Ranked horizontal bars: a name and its amount, and beneath them a thin bar scaled to the
 * largest. Shared by History's "Where it went" and Analytics' "Everyday spending", so the two
 * pages draw a category the same way.
 *
 * The name and the amount are real text above every bar, so the bar's colour is never the only
 * thing telling one row from another.
 */
export function CategoryBars({ items, className = 'mt-4 space-y-3' }: {
  items: CategoryBarItem[]
  className?: string
}) {
  const peak = items.reduce((max, it) => Math.max(max, it.amount), 0)

  const content = (it: CategoryBarItem) => (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-slate-700">{it.label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900" title={moneyExact(it.amount)}>
          {money(it.amount)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div
          className={`h-full rounded-full ${it.colorClass ?? ''}`}
          style={{
            width: `${peak > 0 ? Math.max(3, (it.amount / peak) * 100) : 0}%`,
            backgroundColor: it.colorClass ? undefined : it.color,
          }}
        />
      </div>
      {it.note && <div className="mt-1 text-xs leading-snug text-slate-500">{it.note}</div>}
    </>
  )

  return (
    <ul className={className}>
      {items.map(it => (
        <li key={it.key}>
          {it.onClick ? (
            <button
              type="button"
              onClick={it.onClick}
              className="focus-ring -mx-2 block min-h-[44px] w-[calc(100%+1rem)] rounded-control px-2 py-1.5 text-left transition-colors hover:bg-slate-50"
            >
              {content(it)}
            </button>
          ) : content(it)}
        </li>
      ))}
    </ul>
  )
}
