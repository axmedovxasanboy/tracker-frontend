import type { ReactNode } from 'react'
import { ICON_TONE } from './StatTile'
import type { IconTone } from './StatTile'

/**
 * The 36px icon square that leads a row — the one place a bucket's identity colour survives.
 *
 * It reads its palette from `StatTile`'s `ICON_TONE` rather than restating it, because the three
 * bucket pages each used to carry their own copy: one of them had a `rose` tone that is not in the
 * sanctioned palette and read as the expense red used for money out, directly under a StatTile
 * using teal from the real one. Two sources of truth for one hue is one too many.
 */
export function IconChip({ tone = 'neutral', children }: {
  tone?: IconTone
  children: ReactNode
}) {
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-chip ${ICON_TONE[tone]}`}>
      {children}
    </span>
  )
}

/** A neutral marker beside a row's title — "Marked", "Anonymous", a type name. */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      {children}
    </span>
  )
}
