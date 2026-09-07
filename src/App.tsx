import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BackendStatusProvider } from './context/BackendStatusContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { LanguageProvider, useLang } from './i18n/LanguageContext'
import { Menu } from 'lucide-react'
import { ToastContainer } from './components/ui/Toast'
import { MobileNavProvider, useAppBarMounted } from './components/ui/PageHeader'
import { Sidebar } from './components/layout/Sidebar'
import { OfflineBanner } from './components/ui/OfflineBanner'
import { Spinner } from './components/ui/Spinner'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Categories } from './pages/Categories'
import { Cards } from './pages/Cards'
import { Finance } from './pages/Finance'
import { Overview } from './pages/Overview'
import { Months } from './pages/Months'
import { Settings } from './pages/Settings'
import { Developer } from './pages/Developer'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import type { Currency } from './types'

// Multi-currency support was removed — the app is UZS-only. Kept as a constant (rather than
// inlining 'UZS' at every call site) so prop names below stay simple and unchanged.
const currency: Currency = 'UZS'

/**
 * The phone menu button of last resort.
 *
 * Renders only while no `PageHeader` is mounting the app bar. Every page is meant to render one —
 * but a page that forgets, or that throws before its header mounts, would leave a phone user with
 * no way to reach the drawer and therefore no navigation at all. This keeps that from ever being
 * possible, and stays out of the way (and out of the a11y tree) the moment a real bar appears.
 */
function FallbackMenuButton({ onOpenMenu, hidden }: { onOpenMenu: () => void; hidden: boolean }) {
  const { t } = useLang()
  const barMounted = useAppBarMounted()
  if (barMounted || hidden) return null
  return (
    <button
      type="button"
      onClick={onOpenMenu}
      aria-label={t('nav.openMenu')}
      title={t('nav.openMenu')}
      className="md:hidden fixed top-2 left-2 z-20 w-11 h-11 flex items-center justify-center
                 rounded-control bg-white/90 backdrop-blur border border-hairline shadow-tile
                 text-slate-600 hover:bg-white active:scale-[.98] transition-colors focus-ring"
    >
      <Menu className="w-5 h-5" />
    </button>
  )
}

function AppRoutes() {
  const { status, needsSignup } = useAuth()
  const { t } = useLang()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // MobileNavProvider memoises its context value on these, so a fresh closure on every render
  // would re-render every PageHeader in the tree.
  const openMenu = useCallback(() => setSidebarOpen(true), [])
  const closeMenu = useCallback(() => setSidebarOpen(false), [])

  // On a phone the sidebar is a dialog over the page; without this the only way out is the
  // scrim, which a keyboard user cannot reach.
  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  if (status === 'loading') {
    return (
      <div className="h-dvh flex items-center justify-center bg-ground">
        <Spinner />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <Routes>
        {/* /login is guarded the way /signup is: after a factory reset the account is gone,
            and an unguarded /login strands the user on "Welcome back" with nowhere to go. */}
        <Route path="/login" element={needsSignup ? <Navigate to="/signup" replace /> : <Login />} />
        <Route path="/signup" element={needsSignup ? <Signup /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={needsSignup ? '/signup' : '/login'} replace />} />
      </Routes>
    )
  }

  // Authenticated — the full app shell. MobileNavProvider is the seam PageHeader reaches
  // through for the phone app bar: it owns the bar, the shell owns the drawer behind it.
  //
  // The drawer is the ONLY navigation on a phone, so the button that opens it can never be
  // allowed to disappear. PageHeader's app bar normally carries it; FallbackMenuButton covers
  // the case where the current page renders no header at all, which would otherwise be a dead end.
  return (
    <MobileNavProvider onOpenMenu={openMenu} menuOpen={sidebarOpen}>
      <div className="flex h-dvh bg-ground font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60]
                     focus:rounded-control focus:bg-white focus:px-4 focus:py-2 focus:shadow-tile focus-ring"
        >
          {t('nav.skipToContent')}
        </a>
        <Sidebar open={sidebarOpen} onClose={closeMenu} />
        {sidebarOpen && (
          // Decorative: Escape and the drawer's own links are the keyboard routes out, so the
          // scrim is hidden from assistive tech rather than announced as an unnamed control.
          <div aria-hidden="true" className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={closeMenu} />
        )}
        <FallbackMenuButton onOpenMenu={openMenu} hidden={sidebarOpen} />
        <div className="flex-1 flex flex-col ml-0 md:ml-60 min-w-0 overflow-hidden">
          {/* pt-14 reserves the phone app bar, which is fixed to the viewport — so anything
              rendered above <main> would be painted over. The offline banner rides inside the
              scroller instead, pinned just under the bar. */}
          <main id="main" tabIndex={-1} className="app-scroll flex-1 overflow-y-auto pt-14 md:pt-0">
            <div className="sticky top-14 md:top-0 z-10">
              <OfflineBanner />
            </div>
            <Routes>
              <Route path="/" element={<Dashboard currency={currency} />} />
              <Route path="/transactions" element={<Transactions currency={currency} />} />
              <Route path="/cards" element={<Cards />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/finance" element={<Navigate to="/finance/overview" replace />} />
              <Route path="/finance/investments" element={<Navigate to="/overview/investments" replace />} />
              <Route path="/finance/donations" element={<Navigate to="/overview/donations" replace />} />
              <Route path="/finance/:tab" element={<Finance />} />
              <Route path="/overview" element={<Navigate to="/overview/dashboard" replace />} />
              <Route path="/overview/:tab" element={<Overview currency={currency} />} />
              <Route path="/months" element={<Months currency={currency} />} />
              <Route path="/settings" element={<Settings />} />
              {/* Developer is out of the nav — Settings › Advanced is the way in — but the
                  route stays so bookmarks and the Telegram web-view URL keep working. */}
              <Route path="/developer" element={<Developer />} />
              {/* Already signed in — bounce the auth screens back to the app. */}
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/signup" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </MobileNavProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
      <ToastProvider>
        <BackendStatusProvider>
          <ConfirmProvider>
            <AuthProvider>
              <SettingsProvider>
                <AppRoutes />
              </SettingsProvider>
            </AuthProvider>
            <ToastContainer />
          </ConfirmProvider>
        </BackendStatusProvider>
      </ToastProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}
