import { useLocation } from 'react-router-dom'
import { DollarSign, Euro, BadgeDollarSign, Menu } from 'lucide-react'
import type { Currency } from '../../types'

interface Props {
  currency: Currency
  onCurrencyChange: (c: Currency) => void
  onMenuClick?: () => void
}

const CURRENCIES: { value: Currency; label: string; icon: typeof DollarSign }[] = [
  { value: 'USD', label: 'USD', icon: DollarSign },
  { value: 'EUR', label: 'EUR', icon: Euro },
  { value: 'UZS', label: 'UZS', icon: BadgeDollarSign },
]

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Transactions',
  '/cards': 'Cards & Wallets',
  '/categories': 'Categories',
  '/finance': 'Finance',
}

function matchTitle(pathname: string): string {
  if (pathname.startsWith('/finance')) return 'Finance'
  return PAGE_TITLES[pathname] ?? 'Tracker'
}

export function Header({ currency, onCurrencyChange, onMenuClick }: Props) {
  const { pathname } = useLocation()
  const title = matchTitle(pathname)

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-2 min-w-0">
        <button onClick={onMenuClick} aria-label="Open menu"
          className="md:hidden w-9 h-9 -ml-1 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-slate-800 font-semibold text-base truncate">{title}</h1>
      </div>

      {/* Currency switcher */}
      <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
        {CURRENCIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onCurrencyChange(value)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              currency === value
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  )
}
