import { HATCH, SERIES_BG } from './shared'
import type { Series } from './shared'

export interface SplitSegment {
  key: string
  value: number
  series?: Series
  /** Drawn as the hatch pattern instead of a colour ("Left over"). */
  hatched?: boolean
}

/**
 * One horizontal bar split into labelled parts, drawn against a scale it may share with another
 * bar — the page's one graphic idiom ("In" against "Where it went", "You own" against "Left to
 * repay"). Two of them on the same `scale` answer "which is longer" with no axis to read.
 *
 * Purely a picture: it is hidden from assistive tech, and the legend list beside it carries every
 * name and value in text.
 *
 * Marks follow the chart rules: 24px tall, a 2px surface gap between parts, the data end rounded
 * and the baseline square.
 */
export function SplitBar({ segments, scale, marker }: {
  segments: SplitSegment[]
  /** The value the full width stands for. */
  scale: number
  /** A tick across the bar at this value — where "In" ends on a bar that runs past it. */
  marker?: number
}) {
  const drawn = segments.filter(s => s.value > 0)
  const total = drawn.reduce((sum, s) => sum + s.value, 0)
  const rest = Math.max(0, scale - total)

  return (
    <div className="relative" aria-hidden="true">
      {drawn.length === 0 || !(scale > 0) ? (
        // Nothing to draw: an empty track, so the row keeps its height and reads as "none".
        <div className="h-6 w-full rounded-r bg-slate-100" />
      ) : (
        <div className="flex h-6 w-full gap-0.5">
          {drawn.map((s, i) => (
            <div
              key={s.key}
              // flex-grow carries the proportion, so the gaps never push the bar past its box.
              style={{ flexGrow: s.value, flexBasis: 0 }}
              className={`h-full min-w-[3px] ${i === drawn.length - 1 ? 'rounded-r' : ''} ${
                s.hatched ? HATCH : s.series ? SERIES_BG[s.series] : 'bg-slate-300'
              }`}
            />
          ))}
          {rest > 0 && <div style={{ flexGrow: rest, flexBasis: 0 }} />}
        </div>
      )}
      {marker != null && scale > 0 && marker > 0 && marker < scale && (
        <div
          className="absolute -bottom-1 -top-1 w-0.5 rounded-full bg-slate-900"
          style={{ left: `${(marker / scale) * 100}%` }}
        />
      )}
    </div>
  )
}
