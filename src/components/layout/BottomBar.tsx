import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChartColumn, History, House, Menu, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAddForm } from '../../context/AddFormContext'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'

const PLACES: ReadonlyArray<{ to: string; labelKey: TKey; icon: LucideIcon; exact?: boolean }> = [
  { to: '/', labelKey: 'nav.home', icon: House, exact: true },
  { to: '/history', labelKey: 'shell.nav.history', icon: History },
]
const PLACES_AFTER: ReadonlyArray<{ to: string; labelKey: TKey; icon: LucideIcon }> = [
  { to: '/analytics', labelKey: 'shell.nav.analytics', icon: ChartColumn },
]

/** One cell of the bar: an icon over a word, 56px tall — well over the 44px touch floor. */
const CELL =
  'focus-ring focus-visible:ring-inset focus-visible:ring-offset-0 relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium leading-tight transition-colors'

/**
 * True while an on-screen keyboard is up. The bar is fixed to the bottom of the screen, and on a
 * phone whose browser shrinks the visible area for the keyboard it would ride up on top of it and
 * sit over the field being typed in. The visual viewport is the only thing that knows; a browser
 * without it (or a desktop) simply never reports a keyboard.
 */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    // × scale: a pinch-zoom also shrinks the visual viewport, and that is not a keyboard.
    const check = () => setOpen(window.innerHeight - vv.height * vv.scale > 150)
    check()
    vv.addEventListener('resize', check)
    return () => vv.removeEventListener('resize', check)
  }, [])
  return open
}

/**
 * The phone's navigation bar: Home · History · ＋ · Analytics · More.
 *
 * Below `md` only — from there up the sidebar is always on screen. The drawer used to be the only
 * way around on a phone, two taps for every move, and recording money started with ☰ → Home → Add
 * from four of the pages. Here the three places the owner opens most are one tap away, ＋ opens
 * the Add form from anywhere, and "More" opens the same drawer as the ☰ button (which stays in the
 * top bar, so nothing that worked before stops working).
 *
 * Layers: z-20, the same as the top app bar — under the drawer (z-40), its scrim (z-30) and every
 * sheet (z-50), so none of them is ever covered by it. The bottom inset keeps it clear of the
 * phone's home indicator; the shell pads the scroller by the same amount so the last row of a page
 * is never underneath.
 */
export function BottomBar({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  const { t } = useLang()
  const addForm = useAddForm()
  const keyboardOpen = useKeyboardOpen()
  if (keyboardOpen) return null

  const place = ({ to, labelKey, icon: Icon, exact }: { to: string; labelKey: TKey; icon: LucideIcon; exact?: boolean }) => (
    <NavLink
      key={to}
      to={to}
      end={exact}
      className={({ isActive }) => `${CELL} ${isActive ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
    >
      {({ isActive }) => (
        <>
          {/* A bar as well as the colour, so the current place is not told by hue alone. */}
          {isActive && <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-indigo-600" />}
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={`max-w-full truncate ${isActive ? 'font-semibold' : ''}`}>{t(labelKey)}</span>
        </>
      )}
    </NavLink>
  )

  return (
    <nav
      aria-label={t('fix.nav.bar')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex items-stretch">
        {PLACES.map(place)}
        <div className="flex h-14 min-w-0 flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => addForm.open()}
            aria-label={t('action.add')}
            title={t('action.add')}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition-colors hover:bg-indigo-700 active:scale-[.98]"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {PLACES_AFTER.map(place)}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-expanded={menuOpen}
          className={`${CELL} text-slate-600 hover:text-slate-900`}
        >
          <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="max-w-full truncate">{t('fix.nav.more')}</span>
        </button>
      </div>
    </nav>
  )
}
