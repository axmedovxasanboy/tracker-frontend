import type { ReactNode } from 'react'
import { ErrorTile } from './ErrorTile'
import { Skeleton } from './Skeleton'

/**
 * One tile's three async states, drawn in the cell the tile would have taken.
 *
 * Every figure on the bucket pages is a fetch that can fail, and a failed fetch used to be
 * pixel-identical to an empty account. The stale case (`error` with data still on screen) is
 * deliberately not handled here: the page keeps that data readable and offers one retry strip
 * above the grid instead of blanking a figure to report a refresh that failed.
 *
 * `span` is a className, not a `TileSpan`, because `Skeleton` and `ErrorTile` draw their own
 * surfaces and so take the grid cell themselves.
 */
export function StatSlot({ query, span, children }: {
  query: { loading: boolean; error: string | null; data: unknown; refetch: () => void }
  span: string
  children: ReactNode
}) {
  if (query.loading) return <Skeleton variant="stat" count={1} className={span} />
  if (query.error && !query.data) {
    return <ErrorTile message={query.error} onRetry={query.refetch} className={span} />
  }
  return <>{children}</>
}

/** A full-width label between two bands of tiles. Carries no surface — it is not a tile. */
export function GridHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 md:col-span-6 xl:col-span-12">
      <h2 className="text-title text-slate-900">{title}</h2>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
    </div>
  )
}
