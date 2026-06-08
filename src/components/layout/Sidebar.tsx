import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Tag, Wifi, WifiOff,
  CreditCard, BarChart3, Settings as SettingsIcon, Gauge, LogOut, Terminal, CalendarCheck,
} from 'lucide-react'
import { useBackendStatus } from '../../context/BackendStatusContext'
import { useAuth } from '../../context/AuthContext'

const mainNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/overview', label: 'Overview', icon: Gauge },
  { to: '/months', label: 'Months', icon: CalendarCheck },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/cards', label: 'Cards', icon: CreditCard },
]

const financeNav = [
  { to: '/finance/debts', label: 'Finance', icon: BarChart3 },
]

const settingsNav = [
  { to: '/categories', label: 'Categories', icon: Tag },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/developer', label: 'Developer', icon: Terminal },
]

function NavItem({ to, label, icon: Icon, exact = false }: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </NavLink>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isOnline } = useBackendStatus()
  const { username, logout } = useAuth()

  return (
    <aside
      className={`fixed inset-y-0 left-0 w-60 bg-slate-900 flex flex-col z-40 transform transition-transform duration-200 md:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <ArrowLeftRight className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-base tracking-tight">Tracker</span>
        </div>
      </div>

      {/* Nav — tapping a link also closes the drawer on mobile */}
      <nav onClick={onClose} className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {/* Main */}
        <div className="space-y-0.5">
          {mainNav.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} exact={to === '/'} />
          ))}
        </div>

        {/* Finance */}
        <div>
          <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Finance</p>
          <div className="space-y-0.5">
            <NavLink
              to="/finance"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              Finance
            </NavLink>
          </div>
        </div>

        {/* Settings */}
        <div>
          <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Settings</p>
          <div className="space-y-0.5">
            {settingsNav.map(({ to, label, icon }) => (
              <NavItem key={to} to={to} label={label} icon={icon} />
            ))}
          </div>
        </div>
      </nav>

      {/* Account + status */}
      <div className="px-5 py-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Signed in</p>
            <p className="text-sm text-slate-300 font-medium truncate">{username ?? '—'}</p>
          </div>
          <button onClick={logout} title="Log out"
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Log out
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Backend online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 font-medium">Backend offline</span>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
