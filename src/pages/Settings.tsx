import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Save, Banknote, ArrowLeftRight, CalendarClock, AlertTriangle, Trash2, Lock } from 'lucide-react'
import { AmountInput } from '../components/ui/AmountInput'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { settingsApi } from '../api/settings'
import { extractErrorMessage } from '../api/client'
import { formatCurrency } from '../utils/format'
import type { Currency, SettingsRequest } from '../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

export function Settings() {
  const settings = useApi(() => settingsApi.get(), [])
  const { showSuccess } = useToast()
  const confirm = useConfirm()
  const { logout } = useAuth()

  const [income, setIncome] = useState(0)
  const [incomeCurrency, setIncomeCurrency] = useState<Currency>('UZS')
  const [usdToUzs, setUsdToUzs] = useState(0)
  const [eurToUzs, setEurToUzs] = useState(0)
  const [trackStart, setTrackStart] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Danger Zone — factory reset
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const openReset = async () => {
    const ok = await confirm({
      title: 'Clear everything?',
      message:
        'This permanently deletes ALL your data — transactions, cards, finance records, ' +
        'categories, settings, and your account itself — and starts the app over from zero. ' +
        'This cannot be undone. You will be asked for your password next.',
      destructive: true,
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
    })
    if (!ok) return
    setResetPassword(''); setResetError(null); setResetOpen(true)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetting(true); setResetError(null)
    try {
      await settingsApi.reset(resetPassword)
      setResetOpen(false)
      showSuccess('Everything was cleared. Starting fresh — please sign up.', 'Reset complete')
      logout() // tokens are dead server-side; routes back to the first-run signup screen
    } catch (err: unknown) {
      setResetError(extractErrorMessage(err))
    } finally { setResetting(false) }
  }

  useEffect(() => {
    if (settings.data) {
      setIncome(settings.data.monthlyStableIncome ?? 0)
      setIncomeCurrency(settings.data.monthlyStableIncomeCurrency ?? 'UZS')
      setUsdToUzs(settings.data.usdToUzs ?? 0)
      setEurToUzs(settings.data.eurToUzs ?? 0)
      setTrackStart(settings.data.allocationTrackingStartMonth?.slice(0, 7) ?? '')
    }
  }, [settings.data])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const req: SettingsRequest = {
        monthlyStableIncome: income,
        monthlyStableIncomeCurrency: incomeCurrency,
        usdToUzs: usdToUzs > 0 ? usdToUzs : undefined,
        eurToUzs: eurToUzs > 0 ? eurToUzs : undefined,
        // Write-once on the backend: once set, omit it so saving OTHER settings never trips
        // the "locked" rejection.
        allocationTrackingStartMonth:
          trackStart && !settings.data?.allocationTrackingStartMonth ? `${trackStart}-01` : undefined,
      }
      await settingsApi.update(req)
      settings.refetch()
      showSuccess('Settings saved')
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Settings</h2>
          <p className="text-sm text-slate-400">Monthly income and currency conversion rates.</p>
        </div>
      </header>

      {settings.loading && !settings.data ? (
        <div className="h-32 flex items-center justify-center"><Spinner /></div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          {/* Monthly stable income */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-slate-700">Monthly Stable Income</h3>
            </div>
            <p className="text-xs text-slate-500 -mt-1">
              The income you reliably receive each month. Drives the tier dashboard
              (level + sub-level calculation).
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
                <AmountInput value={income} currency={incomeCurrency}
                  onChange={v => setIncome(v)}
                  className={INPUT} suffix={incomeCurrency} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Currency</label>
                <select value={incomeCurrency}
                  onChange={e => setIncomeCurrency(e.target.value as Currency)}
                  className={`${INPUT} bg-white`}>
                  <option value="UZS">UZS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          </section>

          {/* FX rates */}
          <section className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-slate-700">Currency Exchange Rates</h3>
            </div>
            <p className="text-xs text-slate-500 -mt-1">
              Used to normalise mandatory payments and debts into a single tier comparison
              and to convert dashboard values across currencies. Leave blank to use defaults
              (USD ≈ 12 500, EUR ≈ 13 500).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">1 USD =</label>
                <AmountInput value={usdToUzs} currency="UZS"
                  onChange={v => setUsdToUzs(v)}
                  className={INPUT} suffix="UZS" />
                {usdToUzs > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    100 USD = {formatCurrency(usdToUzs * 100, 'UZS')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">1 EUR =</label>
                <AmountInput value={eurToUzs} currency="UZS"
                  onChange={v => setEurToUzs(v)}
                  className={INPUT} suffix="UZS" />
                {eurToUzs > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    100 EUR = {formatCurrency(eurToUzs * 100, 'UZS')}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Allocation tracking start */}
          <section className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-700">Allocation Tracking Start</h3>
            </div>
            <p className="text-xs text-slate-500 -mt-1">
              The month allocation tracking begins. Before it, the Overview opens but stays paused —
              no action items or allocation are due, nothing to pay. <span className="font-medium text-slate-600">
              Once set, this can't be changed</span> (only a factory reset clears it). Leave blank to
              start from the current month.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Track from month</label>
                <input type="month" value={trackStart}
                  onChange={e => setTrackStart(e.target.value)}
                  disabled={!!settings.data?.allocationTrackingStartMonth}
                  className={`${INPUT} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`} />
              </div>
            </div>
            {settings.data?.allocationTrackingStartMonth && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Locked — set to {settings.data.allocationTrackingStartMonth.slice(0, 7)} and can't be changed.
              </p>
            )}
          </section>

          {error && (
            <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
              {saving ? <Spinner className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          {settings.data?.updatedAt && (
            <p className="text-[11px] text-slate-400 text-right -mt-3">
              Last updated {new Date(settings.data.updatedAt).toLocaleString()}
            </p>
          )}
        </form>
      )}

      {/* Danger Zone */}
      <section className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-semibold text-rose-700">Danger Zone</h3>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-slate-500 max-w-md">
            <span className="font-semibold text-slate-700">Clear everything.</span> Permanently
            deletes all transactions, cards, finance records, categories, settings, and your
            account — then starts the app over from zero, exactly like a fresh install. This
            cannot be undone.
          </p>
          <button type="button" onClick={openReset}
            className="flex items-center justify-center gap-2 shrink-0 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </section>

      <Modal open={resetOpen} onClose={() => !resetting && setResetOpen(false)}
        title="Confirm with your password" maxWidth="max-w-md">
        <form onSubmit={handleReset} className="space-y-4">
          <p className="text-sm text-slate-600">
            Enter your account password to permanently clear everything and start from zero.
          </p>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input autoFocus type="password" value={resetPassword}
              onChange={e => setResetPassword(e.target.value)}
              placeholder="Password" autoComplete="current-password"
              className={`${INPUT} pl-9`} />
          </div>
          {resetError && (
            <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{resetError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setResetOpen(false)} disabled={resetting}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={resetting || !resetPassword}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
              {resetting ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
              {resetting ? 'Clearing…' : 'Clear everything'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
