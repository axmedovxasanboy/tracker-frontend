import type { KeyboardEvent, ReactNode } from 'react'

/**
 * A tile's width, out of twelve columns. The set is deliberately short: a page built from
 * arbitrary widths stops reading as a grid, and every composition in the app fits one of these.
 */
export type TileSpan = 3 | 4 | 5 | 6 | 8 | 12

/**
 * Tailwind only ships class names it can find as literal text, so the spans are written out
 * instead of interpolated from the number. The md value is ceil(span/2) of a six-column grid —
 * a 3-of-12 tile is a 2-of-6 tile on a tablet, so quarters become thirds rather than disappearing.
 */
const SPAN: Record<TileSpan, string> = {
  3:  'md:col-span-2 xl:col-span-3',
  4:  'md:col-span-2 xl:col-span-4',
  5:  'md:col-span-3 xl:col-span-5',
  6:  'md:col-span-3 xl:col-span-6',
  8:  'md:col-span-4 xl:col-span-8',
  12: 'md:col-span-6 xl:col-span-12',
}

/**
 * Widths out of the six-column md grid, for the cases where ceil(span/2) is too tight.
 *
 * The default halving is right almost everywhere, but it breaks down for a *hero* in a row of
 * three: between md and xl the sidebar takes 240px, so three `span={4}` tiles get about 149px
 * each, and a 40px `whitespace-nowrap` figure like "29,5 M UZS" needs roughly 200px. Passing
 * `mdSpan` lets that row stack sensibly on a tablet and still be three-across on a desktop.
 */
export type TileMdSpan = 2 | 3 | 4 | 6

const MD_SPAN: Record<TileMdSpan, string> = {
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  6: 'md:col-span-6',
}

/** `mdSpan` overrides the md half of SPAN, so the two must not both emit an md class. */
function spanClass(span: TileSpan, mdSpan?: TileMdSpan): string {
  if (mdSpan === undefined) return SPAN[span]
  return `${MD_SPAN[mdSpan]} ${SPAN[span].split(' ').filter(c => !c.startsWith('md:')).join(' ')}`
}

const ROWS: Record<1 | 2, string> = {
  1: 'xl:row-span-1',
  2: 'xl:row-span-2',
}

const PADDING: Record<'normal' | 'hero' | 'none', string> = {
  normal: 'p-5',
  hero:   'p-6',
  none:   'p-0',
}

/** The one surface. Every tile, list, chart and dialog in the app is this. */
const SURFACE = 'bg-white border border-hairline rounded-tile shadow-tile'

/**
 * Lift and press. Applied *only* when the tile navigates or opens something — motion on a tile
 * that does nothing is a promise the tile cannot keep, which is why there is no hover variant
 * for the static case.
 */
const INTERACTIVE =
  'cursor-pointer transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-tile-hover ' +
  'active:scale-[.98] motion-reduce:transition-none motion-reduce:transform-none focus-ring'

/**
 * The page grid. One per screen — nesting grids is what produced the five different card widths
 * the audit found, and a tile's `span` is meaningless inside a container that is not this.
 */
export function TileGrid({ children, className = '' }: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-4 xl:gap-5 items-start ${className}`}>
      {children}
    </div>
  )
}

export function Tile({
  children, span = 12, mdSpan, rows = 1, padding = 'normal', onClick, className = '', as: Tag = 'div',
}: {
  children: ReactNode
  span?: TileSpan
  /** Override the md width when the default ceil(span/2) is too narrow. See TileMdSpan. */
  mdSpan?: TileMdSpan
  rows?: 1 | 2
  padding?: 'normal' | 'hero' | 'none'
  /** Setting this makes the whole tile a button: keyboard reachable, with lift and press. */
  onClick?: () => void
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  const clickable = !!onClick

  const activate = (e: KeyboardEvent<HTMLElement>) => {
    // Only when the tile itself has focus. A nested control (the ⓘ, a row action) stops the
    // click it dispatches from bubbling, but not the keydown that produced it — without this
    // guard, Enter on the ⓘ would open the explanation *and* follow the tile.
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault() // Space would otherwise scroll the page.
      onClick?.()
    }
  }

  return (
    <Tag
      className={`${SURFACE} ${spanClass(span, mdSpan)} ${ROWS[rows]} ${PADDING[padding]} ${clickable ? INTERACTIVE : ''} ${className}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? activate : undefined}
    >
      {children}
    </Tag>
  )
}
