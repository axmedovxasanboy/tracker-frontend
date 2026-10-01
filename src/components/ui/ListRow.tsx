import { Children } from 'react'
import type { ReactNode } from 'react'
import { ActionMenu } from './ActionMenu'
import { Tile } from './Tile'
import type { TileSpan } from './Tile'

export type ListRowTone = 'neutral' | 'in' | 'out'

/** A row action always carries an icon — a row's menu is scanned, not read. */
export interface ListRowAction {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
  /** For a row action that is mid-flight (a delete in progress), so the menu can't fire twice. */
  disabled?: boolean
}

const TONE: Record<ListRowTone, string> = {
  neutral: 'text-slate-900',
  in: 'text-income',
  out: 'text-expense',
}

/**
 * One record, as a row in a list — not as a card.
 *
 * The card layout it replaces spent ~110px on ~45px of content, because the actions had a row of
 * their own at the foot and every secondary field wrapped onto its own line. Here the row is a
 * single line on a pointer screen (title · detail … amount) and two or three on a phone, where the
 * 72px height is also the touch target. Rows carry no background, no border and no radius of
 * their own: `ListTile` frames the whole list once and separates them with one hairline.
 *
 * On a phone the title is what a row is read by, so it has a line to itself beside the amount and
 * may wrap to a second; the badges and the detail sit on the line under it, which runs the full
 * width — under the amount too. (Sharing one line, title and badge were left ~84px at 390px and
 * "Kartoshka puli" read "K.".) The amount never wraps. The two layouts are separate blocks, one
 * hidden at each width, so the pointer layout is exactly what it was.
 *
 * `actions` are collapsed into the shared `ActionMenu` so they cost width, never height. Its
 * `revealOnHover` mode is scoped to this row's own `group/row`, never to a `group` an ancestor may
 * or may not carry: an earlier version was invisible on every screen ≥640px wherever the caller
 * forgot it.
 */
export function ListRow({
  leading, title, subtitle, badges, amount, amountTone = 'neutral', amountCaption,
  actions, onClick, selected, className = '',
}: {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  amount?: ReactNode
  amountTone?: ListRowTone
  amountCaption?: ReactNode
  actions?: ListRowAction[]
  onClick?: () => void
  selected?: boolean
  className?: string
}) {
  const clickable = !!onClick
  const hasSubtitle = subtitle != null && subtitle !== ''
  const hasCaption = amountCaption != null && amountCaption !== ''
  // A phone stacks the detail under the title, so only a row that HAS a second line pays for one.
  const height = hasSubtitle || hasCaption ? 'min-h-[72px]' : 'min-h-[56px]'
  const amountBlock = (
    <>
      <p className={`whitespace-nowrap text-sm font-semibold tabular-nums ${TONE[amountTone]}`}>{amount}</p>
      {hasCaption && <p className="text-[11px] tabular-nums text-slate-500">{amountCaption}</p>}
    </>
  )

  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={clickable && selected !== undefined ? selected : undefined}
      onKeyDown={clickable ? e => {
        // Only the row itself: Space on a nested action button bubbles up here too.
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!() }
      } : undefined}
      className={`group group/row relative flex ${height} items-center gap-3 px-4 py-2.5 transition-colors sm:min-h-[56px] sm:py-2 ${
        selected ? 'bg-indigo-50/60' : ''
      } ${
        // ListTile clips its 20px corners with overflow-hidden, which also clips a box-shadow
        // ring painted outside the row's border box — the left and right edges of the ring were
        // never drawn. ring-inset moves the whole indicator inside the row, where nothing can
        // clip it; ring-offset-0 drops the second, white band that inset would otherwise paint
        // white-on-white over the row's own surface.
        clickable
          ? 'focus-ring focus-visible:ring-inset focus-visible:ring-offset-0 cursor-pointer hover:bg-slate-50'
          : ''
      } ${className}`}
    >
      {leading && <div className="shrink-0">{leading}</div>}

      {/* Below sm: title (up to two lines) beside the amount, then badges and detail under both. */}
      <div className="min-w-0 flex-1 sm:hidden">
        <div className="flex items-start gap-3">
          <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium tabular-nums text-slate-900 [overflow-wrap:anywhere]">{title}</span>
          {amount != null && <div className="shrink-0 text-right">{amountBlock}</div>}
        </div>
        {(badges || hasSubtitle) && (
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            {badges}
            {hasSubtitle && <p className="min-w-0 truncate text-xs tabular-nums text-slate-500">{subtitle}</p>}
          </div>
        )}
      </div>

      {/* From sm up: one baseline-aligned line, and the amount in a column of its own. */}
      <div className="hidden min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium tabular-nums text-slate-900">{title}</span>
          {badges && <span className="flex shrink-0 items-center gap-1.5">{badges}</span>}
        </div>
        {hasSubtitle && (
          <p className="min-w-0 truncate text-xs tabular-nums text-slate-500 sm:shrink-[3]">{subtitle}</p>
        )}
      </div>

      {amount != null && <div className="hidden shrink-0 text-right sm:block">{amountBlock}</div>}

      {actions && actions.length > 0 && (
        // On a phone the 44px target leans into the row's own padding, which hands the title 12px.
        <div className="shrink-0 max-sm:-ml-1 max-sm:-mr-2">
          <ActionMenu actions={actions} revealOnHover />
        </div>
      )}
    </div>
  )
}

/**
 * The tile a list of `ListRow`s lives in — one frame around the whole list, one hairline between
 * rows, rather than a grid of individually-framed cards.
 */
export function ListTile({ children, header, empty, span = 12, className = '' }: {
  children: ReactNode
  header?: ReactNode
  empty?: ReactNode
  span?: TileSpan
  className?: string
}) {
  const rows = Children.toArray(children)

  return (
    // `overflow-hidden` so a row's hover tint cannot square off the tile's 20px corners. The `⋯`
    // menu escapes that clip by being portalled to the body rather than rendered in the row.
    <Tile as="section" span={span} padding="none" className={`overflow-hidden ${className}`}>
      {header && (
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          {header}
        </div>
      )}
      {rows.length > 0 ? (
        <div className="divide-y divide-hairline">{rows}</div>
      ) : empty ? (
        <div className="px-4 py-12 text-center text-sm text-slate-500">{empty}</div>
      ) : null}
    </Tile>
  )
}
