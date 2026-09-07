import type { ReactNode } from 'react'
import { useLang } from '../../i18n/LanguageContext'

/** The four things this app actually waits for. Anything else is one of these in a smaller box. */
export type SkeletonVariant = 'stat' | 'row' | 'chart' | 'text'

/** Same surface as `Tile`, written out rather than imported: a skeleton must not take a grid span. */
const SURFACE = 'bg-white border border-hairline rounded-tile shadow-tile'

/**
 * Plain `animate-pulse`, not `motion-safe:animate-pulse` — the unlayered reduced-motion block in
 * `index.css` already collapses every animation to .01ms, and pulse ends its cycle at full
 * opacity, so a reduced-motion user gets a static block rather than a frozen half-faded one.
 */
const BLOCK = 'animate-pulse bg-slate-200/70'

/** How many of a thing you get when the caller doesn't say. Enough to fill the box, never more. */
const DEFAULT_COUNT: Record<SkeletonVariant, number> = { stat: 1, row: 4, chart: 1, text: 3 }

/** Fixed, not random: a re-render must not reshuffle the placeholder under the user's eyes. */
const ROW_TITLE_WIDTHS = ['w-2/5', 'w-1/3', 'w-1/2', 'w-1/4', 'w-5/12']
const TEXT_WIDTHS = ['w-full', 'w-11/12', 'w-4/5', 'w-full', 'w-3/4']
const CHART_BARS = [45, 70, 35, 85, 55, 65, 40, 75, 50, 90, 60, 48]

function Bar({ className }: { className: string }) {
  return <div className={`${BLOCK} rounded-full ${className}`} />
}

/**
 * The shape of the thing that is coming, not a spinner in the middle of an empty box.
 *
 * The app had 67 spinners and no skeletons, and each page drew its own waiting box at its own
 * height — so the layout jumped twice on every load, once into the spinner and once out of it.
 * Each variant here is laid out like the real content it replaces, at the same height, so the
 * only thing that changes when data arrives is the pixels inside the shapes.
 *
 * Pair it with `useApi`'s `loading` (first load, nothing on screen). A *refresh* must never
 * render this — that is what `refreshing` is for, and the whole point of the hook change.
 *
 * `count` means rows for `row`, lines for `text`, and whole tiles for `stat` and `chart`. Several
 * `stat` tiles come in their own responsive grid, so place that outside `TileGrid` — inside one,
 * ask for `count={1}` per slot instead.
 */
export function Skeleton({ variant, count, className = '', bare = false }: {
  variant: SkeletonVariant
  count?: number
  className?: string
  /** Drop the white surface — for a skeleton that sits *inside* a tile that is already drawn. */
  bare?: boolean
}) {
  const { t } = useLang()
  const n = Math.max(1, count ?? DEFAULT_COUNT[variant])
  const items = Array.from({ length: n }, (_, i) => i)
  const shell = bare ? '' : SURFACE

  // One live region for the whole placeholder: `count` blocks are one wait, not four.
  const wrap = (wrapperClass: string, children: ReactNode) => (
    <div role="status" aria-busy="true" aria-label={t('ui.loading')} className={`${wrapperClass} ${className}`}>
      {children}
    </div>
  )

  if (variant === 'stat') {
    const tile = (i: number) => (
      <div key={i} className={`${shell} ${bare ? '' : 'p-5'}`}>
        <div className="flex items-start justify-between gap-3">
          <Bar className="h-3 w-20" />
          <div className={`${BLOCK} rounded-chip w-9 h-9 shrink-0`} />
        </div>
        <Bar className="h-7 w-32 mt-3" />
        <Bar className="h-3 w-24 mt-2.5" />
      </div>
    )
    return wrap(n > 1 ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-5' : '', items.map(tile))
  }

  if (variant === 'row') {
    // 56px a row, matching ListRow on desktop, and divided inside one surface rather than drawn
    // as n separate cards — so the list does not resize when the real rows land.
    return wrap(`${shell} divide-y divide-hairline`, items.map((i) => (
      <div key={i} className="flex items-center gap-3 px-4 h-14">
        <div className={`${BLOCK} rounded-chip w-9 h-9 shrink-0`} />
        <div className="flex-1 min-w-0 space-y-2">
          <Bar className={`h-3.5 ${ROW_TITLE_WIDTHS[i % ROW_TITLE_WIDTHS.length]}`} />
          <Bar className="h-2.5 w-1/5" />
        </div>
        <Bar className="h-4 w-20 shrink-0" />
      </div>
    )))
  }

  if (variant === 'chart') {
    const tile = (i: number) => (
      <div key={i} className={`${shell} ${bare ? '' : 'p-5'}`}>
        <Bar className="h-4 w-40" />
        <Bar className="h-3 w-24 mt-2" />
        {/* The bars carry the height so the box is the chart's real height, not a guess. */}
        <div className="mt-5 h-48 flex items-end gap-2">
          {CHART_BARS.map((h, j) => (
            <div key={j} className={`${BLOCK} rounded-t-chip flex-1`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    )
    return wrap(n > 1 ? 'grid gap-4 xl:gap-5' : '', items.map(tile))
  }

  return wrap(`${shell} ${bare ? '' : 'p-5'} space-y-2.5`, items.map((i) => (
    <Bar key={i} className={`h-3.5 ${i === n - 1 ? 'w-2/3' : TEXT_WIDTHS[i % TEXT_WIDTHS.length]}`} />
  )))
}
