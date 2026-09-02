import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Save, Banknote, CalendarClock, AlertTriangle, Trash2, Lock } from 'lucide-react'
import { AmountInput } from '../components/ui/AmountInput'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useLang } from '../i18n/LanguageContext'
import { settingsApi } from '../api/settings'
import { extractErrorMessage } from '../api/client'
import type { SettingsRequest } from '../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

export function Settings() {
  const { t } = useLang()
  const settings = useApi(() => settingsApi.get(), [])
  const { showSuccess } = useToast()
  const confirm = useConfirm()
  const { logout } = useAuth()
  // The shared settings context gates every Add button; saving here must refresh it,
  // otherwise the gate stays closed until a full page reload.
  const { refetch: refetchGate } = useSettings()

  const [income, setIncome] = useState(0)
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
      title: t('page.settings.clearConfirmTitle'),
      message: t('page.settings.clearConfirmMessage'),
      destructive: true,
      confirmLabel: t('page.settings.continueLabel'),
      cancelLabel: t('action.cancel'),
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
      showSuccess(t('page.settings.resetSuccessMessage'), t('page.settings.resetSuccessTitle'))
      logout() // tokens are dead server-side; routes back to the first-run signup screen
    } catch (err: unknown) {
      setResetError(extractErrorMessage(err))
    } finally { setResetting(false) }
  }

  useEffect(() => {
    if (settings.data) {
      setIncome(settings.data.monthlyStableIncome ?? 0)
      setTrackStart(settings.data.allocationTrackingStartMonth?.slice(0, 7) ?? '')
    }
  }, [settings.data])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const req: SettingsRequest = {
        monthlyStableIncome: income,
        monthlyStableIncomeCurrency: 'UZS',
        // Write-once on the backend: once set, omit it so saving OTHER settings never trips
        // the "locked" rejection.
        allocationTrackingStartMonth:
          trackStart && !settings.data?.allocationTrackingStartMonth ? `${trackStart}-01` : undefined,
      }
      await settingsApi.update(req)
      settings.refetch()
      refetchGate()
      showSuccess(t('page.settings.savedToast'))
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
          <h2 className="text-xl font-bold text-slate-800">{t('page.settings')}</h2>
          <p className="text-sm text-slate-400">{t('page.settings.subtitle')}</p>
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
              <h3 className="text-sm font-semibold text-slate-700">{t('page.settings.stableIncomeHeading')}</h3>
            </div>
            <p className="text-xs text-slate-500 -mt-1">
              {t('page.settings.stableIncomeDesc')}
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('page.settings.amountLabel')}</label>
              <AmountInput value={income} currency="UZS"
                onChange={v => setIncome(v)}
                className={INPUT} suffix="UZS" />
            </div>
          </section>

          {/* Allocation tracking start */}
          <section className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-700">{t('page.settings.trackingStartHeading')}</h3>
            </div>
            <p className="text-xs text-slate-500 -mt-1">
              {t('page.settings.trackingDescPre')} <span className="font-medium text-slate-600">
              {t('page.settings.trackingLockedNote')}</span> {t('page.settings.trackingDescPost')}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('page.settings.trackFromMonthLabel')}</label>
                <input type="month" value={trackStart}
                  onChange={e => setTrackStart(e.target.value)}
                  disabled={!!settings.data?.allocationTrackingStartMonth}
                  className={`${INPUT} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`} />
              </div>
            </div>
            {settings.data?.allocationTrackingStartMonth && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                {t('page.settings.lockedSetTo', { month: settings.data.allocationTrackingStartMonth.slice(0, 7) })}
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
              {saving ? t('action.saving') : t('page.shared.saveChanges')}
            </button>
          </div>

          {settings.data?.updatedAt && (
            <p className="text-[11px] text-slate-400 text-right -mt-3">
              {t('page.shared.lastUpdated', { date: new Date(settings.data.updatedAt).toLocaleString() })}
            </p>
          )}
        </form>
      )}

      {/* Danger Zone */}
      <section className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-semibold text-rose-700">{t('page.settings.dangerZone')}</h3>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-slate-500 max-w-md">
            <span className="font-semibold text-slate-700">{t('page.settings.dangerZoneBold')}</span> {t('page.settings.dangerZoneDesc')}
          </p>
          <button type="button" onClick={openReset}
            className="flex items-center justify-center gap-2 shrink-0 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Trash2 className="w-4 h-4" />
            {t('action.clear')}
          </button>
        </div>
      </section>

      <Modal open={resetOpen} onClose={() => !resetting && setResetOpen(false)}
        title={t('page.settings.confirmPasswordTitle')} maxWidth="max-w-md">
        <form onSubmit={handleReset} className="space-y-4">
          <p className="text-sm text-slate-600">
            {t('page.settings.confirmPasswordDesc')}
          </p>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input autoFocus type="password" value={resetPassword}
              onChange={e => setResetPassword(e.target.value)}
              placeholder={t('page.shared.password')} autoComplete="current-password"
              className={`${INPUT} pl-9`} />
          </div>
          {resetError && (
            <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{resetError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setResetOpen(false)} disabled={resetting}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60">
              {t('action.cancel')}
            </button>
            <button type="submit" disabled={resetting || !resetPassword}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
              {resetting ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
              {resetting ? t('page.settings.clearing') : t('page.settings.clearEverything')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
