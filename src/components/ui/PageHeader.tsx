import {
  createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef,
  useState, useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'
import { ActionMenu } from './ActionMenu'
import { InfoDot } from './InfoDot'
import { Button } from './Button'

// ────────────────────────────────────────────────────────────────────────────────
// The seam between the app shell and the page header
// ────────────────────────────────────────────────────────────────────────────────

export interface MobileNavValue {
  /** Opens the sidebar drawer. Supplied by App.tsx; without it the bar has no menu button. */
  onOpenMenu?: () => void
  /**
   * Drawer state. Kept on the seam for the shell's own use — the bar itself no longer reads it,
   * because the z-scale (bar 20 · scrim 30 · drawer 40) keeps the drawer above it at all times.
   */
  menuOpen?: boolean
  /** Set false when the shell renders its own app bar; PageHeader then stays in-page only. */
  appBar?: boolean
}

const MobileNavContext = createContext<MobileNavValue>({})

/**
 * Wraps the authenticated shell so every page's `PageHeader` can drive the one phone app bar.
 * The drawer toggle lives in App.tsx, but the bar that holds it belongs to the header — that is
 * the only place that knows the page's title and its single primary action.
 */
export function MobileNavProvider({ onOpenMenu, menuOpen = false, appBar = true, children }: {
  onOpenMenu?: () => void
  menuOpen?: boolean
  appBar?: boolean
  children: ReactNode
}) {
  const value = useMemo<MobileNavValue>(
    () => ({ onOpenMenu, menuOpen, appBar }), [onOpenMenu, menuOpen, appBar])
  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>
}

/** Defaults to an empty object, so a `PageHeader` outside the shell still renders. */
export function useMobileNav(): MobileNavValue {
  return useContext(MobileNavContext)
}

// ────────────────────────────────────────────────────────────────────────────────
// Overflow menu — the home of every action that is not THE primary one
// ────────────────────────────────────────────────────────────────────────────────

export interface OverflowAction {
  label: string
  onClick: () => void
  icon?: ReactNode
  danger?: boolean
}

/**
 * A 44px `⋯` button and its menu — the shared `ActionMenu`, under the name the header call sites
 * use. It is the same control a list row opens, minus the hover reveal: a header's actions are the
 * only affordance the bar has, so they are always painted.
 */
export function OverflowMenu({ actions, label, align = 'right', className = '' }: {
  actions: OverflowAction[]
  /** Overrides the trigger's accessible name. Defaults to "More options". */
  label?: string
  align?: 'left' | 'right'
  className?: string
}) {
  return <ActionMenu actions={actions} label={label} align={align} className={className} />
}

// ────────────────────────────────────────────────────────────────────────────────
// PageHeader
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Where the phone app bar is portalled.
 *
 * Not `document.body` directly: a portal appended to the body lands AFTER the whole app subtree,
 * and sequential focus follows DOM order rather than the `position: fixed` visual order — so the
 * menu button and the primary action painted across the top of the screen were the LAST tab stops
 * on the page. A phone user on an external keyboard had to walk every tile and row on the screen
 * before reaching the only drawer toggle the phone layout has. A host placed before `#root` puts
 * them where they look like they are.
 *
 * Created lazily and keyed by id, so React's double-invoked renders reuse the one node.
 */
function appBarHost(): HTMLElement {
  const existing = document.getElementById('app-bar-root')
  if (existing) return existing
  const host = document.createElement('div')
  host.id = 'app-bar-root'
  document.body.insertBefore(host, document.body.firstChild)
  return host
}

// Pages nest — Plan renders the bucket sub-pages, each with its own header — and two fixed app
// bars would stack. The first header to mount owns the bar; the rest render in-page only.
let appBarOwner: symbol | null = null

// The shell deleted its floating menu button on the promise that a PageHeader would always supply
// one on phones. A page that renders no header would therefore have no way to open the drawer at
// all, so the shell needs to know whether the bar is actually mounted. These let it subscribe.
const appBarListeners = new Set<() => void>()
function setAppBarOwner(next: symbol | null) {
  if (appBarOwner === next) return
  appBarOwner = next
  appBarListeners.forEach(fn => fn())
}

/**
 * True while some PageHeader is rendering the phone app bar.
 *
 * The shell uses this to decide whether it must draw a fallback menu button — without it, any page
 * that forgets a PageHeader is a navigation dead end on a phone.
 */
export function useAppBarMounted(): boolean {
  return useSyncExternalStore(
    useCallback((onChange: () => void) => {
      appBarListeners.add(onChange)
      return () => { appBarListeners.delete(onChange) }
    }, []),
    () => appBarOwner !== null,
    () => false,
  )
}

export function PageHeader({ title, subtitle, chip, monthStepper, primary, overflow, info }: {
  title: string
  subtitle?: string
  chip?: { text: string; tone?: 'neutral' | 'attention' }
  monthStepper?: { label: string; onPrev?: () => void; onNext?: () => void }
  /** EXACTLY ONE filled button per page. Everything else belongs in `overflow`. */
  primary?: { label: string; onClick: () => void; icon?: ReactNode }
  overflow?: OverflowAction[]
  info?: { label: string; onClick: () => void }
}) {
  const { t } = useLang()
  const { onOpenMenu, appBar = true } = useMobileNav()
  const [ownsAppBar, setOwnsAppBar] = useState(false)

  const idRef = useRef<symbol | null>(null)
  if (idRef.current === null) idRef.current = Symbol('page-header')

  useLayoutEffect(() => {
    if (!appBar) return
    const id = idRef.current!
    if (appBarOwner !== null) return
    setAppBarOwner(id)
    setOwnsAppBar(true)
    return () => {
      if (appBarOwner === id) setAppBarOwner(null)
      setOwnsAppBar(false)
    }
  }, [appBar])

  const actions = overflow ?? []
  // When the bar carries the title and the primary action, repeating them in the page body is
  // duplication a screen reader has to walk past — so each half only renders where it is used.
  const inBar = ownsAppBar && appBar

  const chipClass = chip?.tone === 'attention'
    ? 'bg-amber-50 text-amber-700'
    : 'bg-slate-100 text-slate-600'

  const primaryButton = primary && (
    <Button variant="primary" size="md" label={primary.label} icon={primary.icon}
      onClick={primary.onClick} />
  )

  return (
    <>
      {inBar && createPortal(
        <header
          // z-20 unconditionally, per the contract's z-scale: the drawer (z-40) and its scrim
          // (z-30) both sit above the bar for the whole of the drawer's open AND close
          // transition, so the bar never paints over a drawer that is still on screen.
          className="md:hidden fixed inset-x-0 top-0 h-14 z-20 flex items-center gap-1 px-2
                     bg-white/90 backdrop-blur border-b border-hairline"
        >
          {onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label={t('nav.openMenu')}
              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-control
                         text-slate-600 hover:bg-slate-100 active:scale-[.98] transition-colors focus-ring"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <h1 className="flex-1 min-w-0 px-1 truncate text-title text-slate-900">{title}</h1>
          {primary && (
            // max-w keeps a long label ("Add transaction") from pushing the page title out of
            // the 390px bar; the button truncates its own text instead.
            <Button variant="primary" size="sm" label={primary.label} icon={primary.icon}
              onClick={primary.onClick} className="shrink-0 max-w-[45%]" />
          )}
          <OverflowMenu actions={actions} className="shrink-0" />
        </header>,
        appBarHost(),
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* w-full below sm keeps the title on a line of its own — the action cluster wraps
              underneath it rather than squeezing a two-word heading into an ellipsis. */}
          <div className={`flex items-center gap-1.5 min-w-0 ${
            inBar ? 'hidden md:flex' : 'w-full sm:w-auto'
          }`}>
            <h1 className="min-w-0 truncate text-title text-slate-900">{title}</h1>
            {info && <InfoDot label={info.label} onClick={info.onClick} className="shrink-0 p-3 -m-3" />}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {monthStepper && (
              <div className="flex items-center rounded-control border border-hairline bg-white">
                <button
                  type="button"
                  onClick={monthStepper.onPrev}
                  disabled={!monthStepper.onPrev}
                  aria-label={t('cmp.pageHeader.prevMonth')}
                  title={t('cmp.pageHeader.prevMonth')}
                  className="w-11 h-11 flex items-center justify-center rounded-l-control text-slate-600
                             hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent
                             transition-colors focus-ring"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-1 text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                  {monthStepper.label}
                </span>
                <button
                  type="button"
                  onClick={monthStepper.onNext}
                  disabled={!monthStepper.onNext}
                  aria-label={t('cmp.pageHeader.nextMonth')}
                  title={t('cmp.pageHeader.nextMonth')}
                  className="w-11 h-11 flex items-center justify-center rounded-r-control text-slate-600
                             hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent
                             transition-colors focus-ring"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            {primaryButton && (inBar ? <div className="hidden md:block">{primaryButton}</div> : primaryButton)}
            {inBar
              ? <div className="hidden md:block"><OverflowMenu actions={actions} /></div>
              : <OverflowMenu actions={actions} />}
          </div>
        </div>

        {(subtitle || chip) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
            {chip && (
              <span className={`px-2 py-0.5 rounded-chip text-xs font-semibold ${chipClass}`}>
                {chip.text}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  )
}
