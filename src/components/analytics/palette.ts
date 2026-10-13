/**
 * The chart colours an SVG mark needs as values (a donut ring, a column): the same hexes as
 * `colors.chart.*` in `tailwind.config.js`, where HTML marks take them as classes. Marks only —
 * text never wears these.
 *
 * Every set below was run through the data-viz validator (colour-blind separation, the
 * normal-vision floor, 3:1 on white) in the order it is drawn — a donut's last segment touches its
 * first, so that pair was checked too (2026-10-13).
 */
export const HEX = {
  pay: '#064e3b',
  bonus: '#047857',
  other: '#10b981',
  everyday: '#2563eb',
  bills: '#d97706',
  loans: '#7c3aed',
  saved: '#db2777',
  given: '#0891b2',
  emergency: '#d97706',
  investments: '#0d9488',
  goals: '#4f46e5',
  muted: '#94a3b8',
} as const

/**
 * A donut of categories (Income's sources, Expense's categories): five slots in this order, then
 * "Other". Teal → amber → blue → pink → violet passes adjacent and wrap-around; a sixth hue fails,
 * so the rest fold into "Other" rather than take a generated colour.
 */
export const CATEGORY_HEX = ['#0d9488', '#d97706', '#2563eb', '#db2777', '#7c3aed'] as const
export const CATEGORY_SLOTS = CATEGORY_HEX.length

/** The rest of a donut, and "Not itemised" (drawn hatched so the two never read as one). */
export const OTHER_HEX = HEX.muted

/** What a ranked list's line wears: a slot colour, the hatched grey, or folded into "Other". */
export interface Slot {
  color: string
  hatched?: boolean
  /** Folded into the donut's "Other" segment (its row keeps its own place in the list). */
  other?: boolean
}

/**
 * Colours for a list in its own order (ranked by expected, so a category keeps its place — and its
 * colour — from day to day and month to month): the first five lines take the slots, whether or not
 * money has come yet (a salary still to come keeps its colour, and nothing below it shifts when it
 * arrives); `isHatched` lines take the hatched grey; everything after the fifth is "Other". A line
 * at nothing draws no segment — only its row's key shows the colour.
 */
export function assignSlots<T extends { key: string; amount: number }>(
  lines: T[], isHatched: (line: T) => boolean = () => false,
): Map<string, Slot> {
  const out = new Map<string, Slot>()
  let next = 0
  for (const l of lines) {
    if (isHatched(l)) out.set(l.key, { color: OTHER_HEX, hatched: true })
    else if (next < CATEGORY_SLOTS) out.set(l.key, { color: CATEGORY_HEX[next++] })
    else out.set(l.key, { color: OTHER_HEX, other: true })
  }
  return out
}

/**
 * A donut's segments from a list and its slots: each slotted line its own segment, hatched ones
 * theirs, the rest summed into one "Other" (at the end, so it sits between the last slot and the
 * first — both validated against grey). Only money above zero draws.
 */
export function segmentsOf<T extends { key: string; amount: number }>(
  lines: T[], slots: Map<string, Slot>, label: (line: T) => string, otherLabel: string,
): Array<{ key: string; label: string; value: number; color: string; hatched?: boolean }> {
  const segs: Array<{ key: string; label: string; value: number; color: string; hatched?: boolean }> = []
  let other = 0
  for (const l of lines) {
    if (!(l.amount > 0)) continue
    const slot = slots.get(l.key)
    if (!slot || slot.other) other += l.amount
    else segs.push({ key: l.key, label: label(l), value: l.amount, color: slot.color, hatched: slot.hatched })
  }
  if (other > 0) segs.push({ key: 'other', label: otherLabel, value: other, color: OTHER_HEX })
  return segs
}
