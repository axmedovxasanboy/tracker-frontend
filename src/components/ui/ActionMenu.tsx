import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'

/** One entry in a `⋯` menu. `icon` is optional so a header action can be text-only. */
export interface MenuAction {
  label: string
  onClick: () => void
  icon?: ReactNode
  danger?: boolean
  /** For an action that is mid-flight (a delete in progress), so the menu cannot fire it twice. */
  disabled?: boolean
}

const MENU_MIN_WIDTH = 208
const MENU_GAP = 6
const VIEWPORT_EDGE = 8
/** A 44px touch row — used only to guess the height before the menu has been measured. */
const MENU_ITEM_HEIGHT = 44

function menuItems(root: HTMLElement | null): HTMLButtonElement[] {
  return Array.from(root?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [])
}

/**
 * THE `⋯` menu. One implementation, because there used to be two: a page-header one that
 * positioned itself `absolute` inside its parent, and a list-row one that portalled itself to the
 * body. They drifted — only one of them flipped above the trigger near the bottom of the viewport,
 * so the identical control opened off-screen on one page and not on another.
 *
 * It is portalled to `document.body` because the surfaces it opens from clip their own corners
 * (`ListTile` uses `overflow-hidden`), and a menu rendered inside the row was cut off at the tile
 * edge. Being `fixed`, it is placed by measurement: right-aligned to the trigger by default,
 * clamped to the viewport, flipped above when there is no room below.
 *
 * Keyboard contract: Enter/Space/ArrowDown open with the first item focused, ArrowUp opens with
 * the last, arrows and Home/End move inside, Escape closes and returns focus to the trigger, Tab
 * closes and lets focus continue. A pointer press anywhere outside closes it. The document
 * listeners are capture-phase because the row and tile beneath stop propagation on their own
 * handlers, and because Escape must close the menu without also closing a host Sheet.
 */
export function ActionMenu({
  actions, label, align = 'right', revealOnHover = false, className = '',
}: {
  actions: MenuAction[]
  /** Overrides the trigger's accessible name. Defaults to "More options". */
  label?: string
  align?: 'left' | 'right'
  /**
   * List-row behaviour: the trigger fades in on hover where a pointer can hover, and is painted
   * at all times where it cannot. Keyed on `@media (hover: hover)`, a device query rather than a
   * viewport width, so a touchscreen laptop keeps its buttons. Off for headers and card tiles,
   * where the control is the only affordance the surface has.
   */
  revealOnHover?: boolean
  className?: string
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const focusEdge = useRef<'first' | 'last'>('first')

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    setPos(null)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = menuRef.current?.offsetWidth || MENU_MIN_WIDTH
    const height = menuRef.current?.offsetHeight || actions.length * MENU_ITEM_HEIGHT + 8
    const below = rect.bottom + MENU_GAP
    const flip = below + height > window.innerHeight - VIEWPORT_EDGE
      && rect.top - MENU_GAP - height > VIEWPORT_EDGE
    const wanted = align === 'left' ? rect.left : rect.right - width
    setPos({
      top: flip ? rect.top - MENU_GAP - height : below,
      left: Math.max(VIEWPORT_EDGE, Math.min(wanted, window.innerWidth - width - VIEWPORT_EDGE)),
    })
  }, [actions.length, align])

  // Layout effect, so the menu is measured and placed before the browser paints it.
  useLayoutEffect(() => { if (open) place() }, [open, place])

  useEffect(() => {
    if (!open) return
    const items = menuItems(menuRef.current)
    const target = focusEdge.current === 'last' ? items[items.length - 1] : items[0]
    target?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(true) } }
    const onPointer = (e: Event) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close(false)
    }
    document.addEventListener('keydown', onKey, true)
    // pointerdown, not click: the menu must be gone before whatever is underneath reacts to the
    // press, otherwise a tap on a tile behind the menu both closes the menu and opens the tile.
    document.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, close, place])

  if (actions.length === 0) return null

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') { close(false); return }
    const items = menuItems(menuRef.current)
    if (items.length === 0) return
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    let next = -1
    if (e.key === 'ArrowDown') next = at >= items.length - 1 ? 0 : at + 1
    else if (e.key === 'ArrowUp') next = at <= 0 ? items.length - 1 : at - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else return
    e.preventDefault()
    items[next]?.focus()
  }

  return (
    // The press never reaches the row or tile underneath, which would otherwise open its drawer.
    <div onClick={e => e.stopPropagation()} className={`shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label ?? t('ui.moreOptions')}
        title={label ?? t('ui.moreOptions')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { focusEdge.current = 'first'; if (open) close(true); else setOpen(true) }}
        onKeyDown={e => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          focusEdge.current = e.key === 'ArrowUp' ? 'last' : 'first'
          setOpen(true)
        }}
        className={`focus-ring inline-flex h-11 w-11 items-center justify-center rounded-control
                    text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900
                    active:scale-[.98] focus-visible:opacity-100 ${
                      open ? 'bg-slate-100 opacity-100' : ''
                    } ${
                      revealOnHover
                        // Pulled back into the row's padding so a 44px target cannot inflate a 56px row.
                        ? `-my-1.5 ${open ? '' : 'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-focus-within/row:opacity-100'}`
                        : ''
                    }`}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={t('ui.actions')}
          onKeyDown={onMenuKeyDown}
          // Opacity rather than visibility for the one pre-measurement frame: a hidden element
          // cannot take the focus that is handed to its first item on open.
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, opacity: pos ? 1 : 0 }}
          className="fixed z-50 w-max min-w-[13rem] max-w-[17rem] overflow-hidden rounded-control
                     border border-hairline bg-white py-1 shadow-tile-hover"
        >
          {actions.map(action => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => { close(true); action.onClick() }}
              // `focus:`, not `focus-visible:`: focus only ever arrives here from .focus() in
              // onMenuKeyDown, and a pointer that lands on an item also activates it. Inset, so
              // the indicator cannot be clipped by a menu that has to keep its own corners.
              // indigo-600 on indigo-50 is 5.62:1; the danger item keeps its red, which is
              // 5.62:1 on the same tint, so focus never disguises which entry deletes.
              className={`flex w-full min-h-[44px] items-center gap-2.5 px-3 text-left text-sm
                          font-medium transition-colors disabled:opacity-50 focus:bg-indigo-50
                          focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-600 ${
                            action.danger
                              ? 'text-expense hover:bg-rose-50'
                              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                          }`}
            >
              {/* No tint of its own: on the danger entry the icon has to stay red with the label. */}
              {action.icon && (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">{action.icon}</span>
              )}
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
