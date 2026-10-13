import { useId, useState } from 'react'
import { compact, shareOf } from './shared'

export interface DonutSegment {
  key: string
  label: string
  value: number
  /** A hex from `palette.ts`. */
  color: string
  /** "Not itemised": the muted grey hatched, never mistaken for "Other". */
  hatched?: boolean
}

/** The ring in the SVG's own 100×100 box. */
const R = 40
const STROKE = 12
const C = 2 * Math.PI * R
/** The 2px surface gap between segments, in the box's units at the default 168px size. */
const GAP = 1.2

/**
 * A part-to-whole ring (≤ 6 segments: five category slots and "Other" — `palette.ts`), with the
 * total in its centre. Hovering a segment puts that segment's name, amount and share in the centre
 * instead, and thickens it; nothing is only on hover — the list beside every donut carries the
 * same figures (and is the keyboard's way in), so the ring is one labelled image to a screen reader.
 * Shares are of `total`, the figure the list's chips divide by, so the two always agree.
 *
 * Segments are dashes of one circle, each shortened by the 2px gap and started at the top.
 */
export function Donut({ segments, total, totalLabel, ariaLabel, size = 168 }: {
  segments: DonutSegment[]
  /** The figure in the centre — usually the sum, but Out's donut is "Out" exactly. */
  total: number
  totalLabel: string
  /** What the ring shows, for a screen reader: "Out by category". */
  ariaLabel: string
  size?: number
}) {
  const hatchId = useId()
  const [active, setActive] = useState<string | null>(null)
  const drawn = segments.filter(s => s.value > 0)
  const sum = drawn.reduce((s, x) => s + x.value, 0)
  if (sum <= 0) return null

  // What a share is of: the centre figure (Out, In, Set aside), as on the list's chips.
  const base = total > 0 ? total : sum
  const gap = drawn.length > 1 ? GAP : 0
  let offset = 0
  const arcs = drawn.map(s => {
    const len = (s.value / sum) * C
    const arc = { ...s, dash: Math.max(0.6, len - gap), start: offset }
    offset += len
    return arc
  })
  const focused = arcs.find(a => a.key === active) ?? null

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={ariaLabel}>
        <defs>
          <pattern id={hatchId} patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
            <rect width="3" height="3" fill="#e2e8f0" />
            <rect width="1.2" height="3" fill="#94a3b8" />
          </pattern>
        </defs>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
        <g transform="rotate(-90 50 50)">
          {arcs.map(a => (
            <circle
              key={a.key}
              cx="50" cy="50" r={R}
              fill="none"
              stroke={a.hatched ? `url(#${hatchId})` : a.color}
              strokeWidth={active === a.key ? STROKE + 3 : STROKE}
              strokeDasharray={`${a.dash} ${C - a.dash}`}
              strokeDashoffset={-a.start}
              className="cursor-default transition-[stroke-width] duration-150 motion-reduce:transition-none"
              onPointerEnter={() => setActive(a.key)}
              onPointerLeave={() => setActive(k => (k === a.key ? null : k))}
            />
          ))}
        </g>
      </svg>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-7 text-center">
        {focused ? (
          <>
            <span className="text-lg font-semibold leading-tight text-slate-900">{compact(focused.value)}</span>
            <span className="mt-0.5 line-clamp-2 text-xs leading-tight text-slate-600">{focused.label}</span>
            <span className="mt-0.5 text-xs font-semibold tabular-nums text-slate-500">{shareOf(focused.value, base) ?? '0'}%</span>
          </>
        ) : (
          <>
            <span className="text-xs text-slate-500">{totalLabel}</span>
            <span className="text-lg font-semibold leading-tight text-slate-900">{compact(total)}</span>
          </>
        )}
      </div>
    </div>
  )
}
