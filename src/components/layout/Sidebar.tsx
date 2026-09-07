import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Tag, WifiOff, CalendarCheck,
  CreditCard, BarChart3, Settings as SettingsIcon, Gauge, LogOut,
} from 'lucide-react'
import { useBackendStatus } from '../../context/BackendStatusContext'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { formatMonth, monthLocal, plural } from '../../utils/format'

// One name per destination, in the fixed order: Home · Plan · Months · Transactions ·
// Wallets · Finance · Categories · Settings. Finance used to be a hand-rolled NavLink under
// a section header of the same word; it is an ordinary item now, so the sidebar never prints
// one name twice. Developer is deliberately absent — Settings › Advanced is its entry point.
const primaryNav = [
  { to: '/', labelKey: 'nav.home', icon: LayoutDashboard },
  { to: '/overview', labelKey: 'nav.plan', icon: Gauge },
  { to: '/months', labelKey: 'nav.months', icon: CalendarCheck },
  { to: '/transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight },
  { to: '/cards', labelKey: 'nav.wallets', icon: CreditCard },
  { to: '/finance', labelKey: 'nav.finance', icon: BarChart3 },
] as const

// Set-up-once destinations, separated by a rule rather than a caps header: the header used to
// read "SETTINGS" directly above an item called "Settings", and it cost 20px the nav needed.
const setupNav = [
  { to: '/categories', labelKey: 'nav.categories', icon: Tag },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
] as const

/**
 * Days from today to the last day of the current month, on the VIEWER's clock.
 *
 * `new Date(y, m + 1, 0)` is the last day of month `m`. Deliberately not derived from a UTC
 * ISO string: in Tashkent (UTC+5) that names the previous day before 05:00 and would count
 * one day too many on the 1st.
 */
function daysLeftInMonth(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
}

function NavItem({ to, labelKey, icon: Icon, exact = false }: { to: string; labelKey: TKey; icon: typeof LayoutDashboard; exact?: boolean }) {
  const { t } = useLang()
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        // 44px on touch, 40px with a mouse — the drawer is a phone target, the fixed sidebar
        // is a list that has to fit a 700px-tall window.
        `flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-control text-sm font-medium
         transition-colors focus-ring focus-visible:ring-offset-slate-900 ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-slate-300 hover:text-white hover:bg-slate-800'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {t(labelKey)}
    </NavLink>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isOnline } = useBackendStatus()
  const { username, logout } = useAuth()
  const { t, lang, setLang } = useLang()
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const asideRef = useRef<HTMLElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  // Below ~700px tall the list scrolls; without this the active item can sit off-screen and
  // the sidebar looks like it has forgotten where you are. NavLink sets aria-current itself.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' })
  }, [pathname])

  // Phone drawer only — `open` never becomes true from md up, where the sidebar is always
  // visible. Moving focus in makes Tab walk the nav instead of the page behind it.
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    asideRef.current?.focus({ preventScroll: true })
    return () => restoreFocusRef.current?.focus?.({ preventScroll: true })
  }, [open])

  const daysLeft = daysLeftInMonth(new Date())

  return (
    <aside
      ref={asideRef}
      tabIndex={-1}
      // `invisible` (not just the translate) is what takes the closed drawer out of the tab
      // order and out of the accessibility tree on phones; transitioning visibility alongside
      // the transform delays the flip to hidden until the slide-out has finished.
      className={`fixed inset-y-0 left-0 w-60 bg-slate-900 flex flex-col z-40 outline-none
                  transform transition-[transform,visibility] duration-200
                  md:visible md:translate-x-0 ${
        open ? 'visible translate-x-0' : 'invisible -translate-x-full'
      }`}>
      {/* Logo */}
      <div className="shrink-0 px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-500 rounded-chip flex items-center justify-center">
            <ArrowLeftRight className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-base tracking-tight">Tracker</span>
        </div>
      </div>

      {/* Nav — tapping a link also closes the drawer on mobile. The wrapper is what the fade
          hangs off: an ::after inside the scroller would scroll away with the last item. */}
      <div className="relative flex-1 min-h-0">
        <nav ref={navRef} onClick={onClose} className="h-full px-3 py-4 overflow-y-auto">
          <div className="space-y-0.5">
            {primaryNav.map(({ to, labelKey, icon }) => (
              <NavItem key={to} to={to} labelKey={labelKey} icon={icon} exact={to === '/'} />
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-0.5">
            {setupNav.map(({ to, labelKey, icon }) => (
              <NavItem key={to} to={to} labelKey={labelKey} icon={icon} />
            ))}
          </div>
        </nav>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-slate-900 to-transparent"
        />
      </div>

      {/* Language */}
      <div className="shrink-0 px-5 pt-3">
        {/* This sidebar IS the phone navigation drawer, so these are touch controls: 44px, the
            same floor the nav rows above already meet. The shared LanguageToggle primitive is
            built for the light auth screens (bg-slate-100), hence the dark copy here. */}
        <div role="group" aria-label={t('nav.language')} className="flex items-center gap-1 bg-slate-800 rounded-control p-1">
          {(['en', 'uz'] as const).map(code => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={`flex-1 min-h-[44px] md:min-h-[38px] py-1.5 rounded-chip text-[11px] font-semibold uppercase tracking-wide
                          transition-colors focus-ring focus-visible:ring-offset-slate-900 ${
                lang === code ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              {code === 'en' ? 'English' : 'O‘zbek'}
            </button>
          ))}
        </div>
      </div>

      {/* Account, then the month. A permanent "Backend online" chip was reassurance nobody
          asked for; the countdown to month close is the one thing worth a standing slot, and
          the connection only earns its line when something is actually wrong. */}
      <div className="shrink-0 px-5 py-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{t('nav.signedInAs')}</p>
            <p className="text-sm text-slate-200 font-medium truncate">{username ?? '—'}</p>
          </div>
          <button type="button" onClick={logout} title={t('nav.logout')}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] md:min-h-0 px-2.5 py-1.5 rounded-control text-xs
                       font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors
                       focus-ring focus-visible:ring-offset-slate-900">
            <LogOut className="w-3.5 h-3.5" /> {t('nav.logout')}
          </button>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{t('nav.thisMonth')}</p>
          <p className="text-sm text-slate-200 font-medium truncate">{formatMonth(monthLocal(), lang)}</p>
          <p className="text-xs text-slate-400 tabular-nums">
            {daysLeft <= 0
              ? t('nav.monthClosesToday')
              : plural(daysLeft, t('nav.monthClosesInOne'), t('nav.monthClosesInMany'), lang)}
          </p>
        </div>

        {!isOnline && (
          <div className="flex items-center gap-2 text-xs">
            <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="text-amber-400 font-medium">{t('nav.offline')}</span>
          </div>
        )}
      </div>
    </aside>
  )
}
