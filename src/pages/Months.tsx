import { useState } from 'react'
import {
  Calendar, CalendarCheck, Lock, PiggyBank, TrendingUp, Wallet, Coins,
  AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { monthsApi } from '../api/months'
import { formatCurrency } from '../utils/format'
import { Spinner } from '../components/ui/Spinner'
import { CloseMonthModal } from '../components/months/CloseMonthModal'
import type { Currency } from '../types'

interface Props { currency: Currency }

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

type BreakdownColor = 'indigo' | 'emerald' | 'rose' | 'amber'
const COLOR: Record<BreakdownColor, { bg: string; text: string }> = {
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-600' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
}

export function Months({ currency }: Props) {
  const [month, setMonth] = useState(currentMonth())
  const [closeOpen, setCloseOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const summary = useApi(() => monthsApi.getSummary(month, currency), [month, currency])
  const history = useApi(() => monthsApi.getClosed(), [])

  const s = summary.data
  const refetchAll = () => { summary.refetch(); history.refetch() }

  return (
    <div className="p-6 space-y-6">
      {/* Header + month picker */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Monthly Summary</h2>
            <p className="text-sm text-slate-400">{monthLabel(month)} · {currency}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
      </div>

      {summary.loading && !s ? (
        <div className="h-48 flex items-center justify-center"><Spinner /></div>
      ) : !s ? (
        <p className="text-sm text-slate-400">No data for this month.</p>
      ) : (
        <>
          {/* FX defaults warning */}
          {s.fxRatesUsingDefaults && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>FX rates are using built-in defaults — set them in Settings for accurate cross-currency math.</span>
            </div>
          )}

          {/* The envelope: Start + Earned − Spent = Left */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <BreakdownCard icon={Wallet} color="indigo" label="Started with"
              value={formatCurrency(s.startBalance, currency, true)} hint="Carried from last month" />
            <BreakdownCard icon={TrendingUp} color="emerald" label="Earned"
              value={formatCurrency(s.income, currency, true)} hint="Income this month" />
            <BreakdownCard icon={Coins} color="rose" label="Spent"
              value={s.totalSpent != null ? formatCurrency(s.totalSpent, currency, true) : '—'}
              hint={s.closed ? 'Tagged + everyday' : 'Known once closed'} />
            <BreakdownCard icon={PiggyBank} color="amber" label="Left"
              value={s.leftover != null ? formatCurrency(s.leftover, currency, true) : '—'}
              hint={s.closed ? 'Entered at close → next start' : 'Known once closed'} />
          </div>

          {/* Where the money went */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Where it went</h3>
            <div className="space-y-1.5">
              <Line label="Donation" value={formatCurrency(s.donation, currency)} />
              <Line label="Emergency" value={formatCurrency(s.emergency, currency)} />
              <Line label="Investments" value={formatCurrency(s.investments, currency)} />
              <Line label="Stocks" value={formatCurrency(s.stocks, currency)} />
              <Line label="Savings goals" value={formatCurrency(s.savings, currency)} />
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-sm font-semibold">
                <span className="text-slate-600">Tagged total</span>
                <span className="text-slate-800">{formatCurrency(s.taggedTotal, currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Everyday spending</span>
                <span className={s.everydaySpend != null ? 'font-semibold text-slate-800' : 'text-slate-400'}>
                  {s.everydaySpend != null ? formatCurrency(s.everydaySpend, currency) : 'Known once closed'}
                </span>
              </div>
            </div>
          </div>

          {/* Status + close action */}
          {s.closed ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl">
              <Lock className="w-4 h-4 shrink-0" />
              <span><span className="font-semibold">{monthLabel(month)}</span> is closed and locked.</span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div>
                <p className="text-sm font-semibold text-slate-700">Close this month</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your real wallet balances; the gap becomes everyday spending and carries forward.
                </p>
              </div>
              <button onClick={() => setCloseOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
                <CalendarCheck className="w-4 h-4" /> Close {monthLabel(month)}
              </button>
            </div>
          )}
        </>
      )}

      {/* Closed-month history */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <button onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left">
          <span className="text-sm font-semibold text-slate-700">Closed months ({history.data?.length ?? 0})</span>
          {showHistory ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>
        {showHistory && (
          <div className="border-t border-slate-100">
            {(history.data?.length ?? 0) === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">No months closed yet.</p>
            ) : (
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Month', 'Earned', 'Spent', 'Everyday', 'Left'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.data?.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-medium text-slate-700">{monthLabel(m.month)}</td>
                      <td className="px-5 py-3 text-emerald-600">{formatCurrency(m.income, 'UZS')}</td>
                      <td className="px-5 py-3 text-slate-700">{formatCurrency(m.totalSpent, 'UZS')}</td>
                      <td className="px-5 py-3 text-slate-500">{formatCurrency(m.everydaySpend, 'UZS')}</td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{formatCurrency(m.leftover, 'UZS')}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        )}
      </div>

      <CloseMonthModal open={closeOpen} onClose={() => setCloseOpen(false)}
        onSaved={refetchAll} month={month} currency={currency} />
    </div>
  )
}

function BreakdownCard({ icon: Icon, color, label, value, hint }: {
  icon: typeof Wallet; color: BreakdownColor; label: string; value: string; hint?: string
}) {
  const c = COLOR[color]
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-800 truncate">{value}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  )
}
