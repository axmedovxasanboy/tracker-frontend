import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BackendStatusProvider } from './context/BackendStatusContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastContainer } from './components/ui/Toast'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { OfflineBanner } from './components/ui/OfflineBanner'
import { Spinner } from './components/ui/Spinner'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Categories } from './pages/Categories'
import { Cards } from './pages/Cards'
import { Finance } from './pages/Finance'
import { Overview } from './pages/Overview'
import { Settings } from './pages/Settings'
import { Developer } from './pages/Developer'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import type { Currency } from './types'

function AppRoutes() {
  const { status, needsSignup } = useAuth()
  const [currency, setCurrency] = useState<Currency>('USD')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={needsSignup ? <Signup /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={needsSignup ? '/signup' : '/login'} replace />} />
      </Routes>
    )
  }

  // Authenticated — the full app shell.
  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="flex-1 flex flex-col ml-0 md:ml-60 min-w-0 overflow-hidden">
        <OfflineBanner />
        <Header currency={currency} onCurrencyChange={setCurrency} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
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
            <Route path="/settings" element={<Settings />} />
            <Route path="/developer" element={<Developer />} />
            {/* Already signed in — bounce the auth screens back to the app. */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/signup" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <BackendStatusProvider>
          <ConfirmProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
            <ToastContainer />
          </ConfirmProvider>
        </BackendStatusProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
