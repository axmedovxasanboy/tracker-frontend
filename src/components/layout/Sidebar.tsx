import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight, History, House, LogOut, PiggyBank, Receipt, Settings as SettingsIcon, Wallet, WifiOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useBackendStatus } from '../../context/BackendStatusContext'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'

/**
 * The whole app, six places, one flat list (2026-09 rebuild). Nothing is folded away any more:
 * the old "Details" group hid seven screens the owner had to learn, and the rebuild merged them
 * into these. Developer stays out of the list — Settings › Advanced is its way in.
 */
const NAV: ReadonlyArray<{ to: string; labelKey: TKey; icon: LucideIcon; exact?: boolean }> = [
  { to: '/', labelKey: 'nav.home', icon: House, exact: true },
  { to: '/history', labelKey: 'shell.nav.history', icon: History },
  { to: '/wallets', labelKey: 'nav.wallets', icon: Wallet },
  { to: '/savings', labelKey: 'shell.nav.savings', icon: PiggyBank },
  { to: '/loans', labelKey: 'shell.nav.loans', icon: Receipt },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
]

function NavItem({ to, labelKey, icon: Icon, exact = false }: {
  to: string
  labelKey: TKey
  icon: LucideIcon
  exact?: boolean
}) {
  const { t } = useLang()
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        // 44px on touch, 40px with a mouse — the drawer is a phone target, the fixed sidebar
        // is a list that has to fit a short window.
        `flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-control text-sm font-medium
         transition-colors focus-ring focus-visible:ring-offset-slate-900 ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-slate-300 hover:text-white hover:bg-slate-800'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
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

  // On a very short window the list scrolls; keep the lit item in view. NavLink sets
  // aria-current itself.
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
            <ArrowLeftRight className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="text-white font-semibold text-base tracking-tight">Tracker</span>
        </div>
      </div>

      {/* Nav — tapping a link also closes the drawer on mobile. */}
      <div className="relative flex-1 min-h-0">
        <nav ref={navRef} onClick={onClose} className="h-full px-3 py-4 overflow-y-auto">
          <div className="space-y-0.5">
            {NAV.map(item => (
              <NavItem key={item.to} to={item.to} labelKey={item.labelKey} icon={item.icon} exact={item.exact} />
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
              {code === 'en' ? 'English' : 'Oʻzbek'}
            </button>
          ))}
        </div>
      </div>

      {/* Account. The connection only earns its line when something is actually wrong. */}
      <div className="shrink-0 px-5 py-4 border-t border-slate-800 space-y-3 mt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{t('nav.signedInAs')}</p>
            <p className="text-sm text-slate-200 font-medium truncate">{username ?? '—'}</p>
          </div>
          <button type="button" onClick={logout} title={t('nav.logout')}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] md:min-h-0 px-2.5 py-1.5 rounded-control text-xs
                       font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors
                       focus-ring focus-visible:ring-offset-slate-900">
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" /> {t('nav.logout')}
          </button>
        </div>

        {!isOnline && (
          <div className="flex items-center gap-2 text-xs">
            <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-400" aria-hidden="true" />
            <span className="text-amber-400 font-medium">{t('nav.offline')}</span>
          </div>
        )}
      </div>
    </aside>
  )
}
