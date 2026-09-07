import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CalendarClock, ChevronDown, CreditCard, Lock, Save, Sliders, Trash2,
} from 'lucide-react'
import { AmountInput } from '../components/ui/AmountInput'
import { Button, DisabledHint } from '../components/ui/Button'
import { ErrorTile } from '../components/ui/ErrorTile'
import { Field } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { Tile, TileGrid } from '../components/ui/Tile'
import { DeveloperSettings } from './Developer'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useLang } from '../i18n/LanguageContext'
import { settingsApi } from '../api/settings'
import { extractErrorMessage } from '../api/client'
import { formatDate, formatMonth, money, moneyExact } from '../utils/format'

const INPUT = 'w-full h-11 rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus-ring'

export function Settings() {
  const { t, lang } = useLang()
  const settings = useApi(() => settingsApi.get(), [])
  const { showSuccess } = useToast()
  const confirm = useConfirm()
  const { logout } = useAuth()
  const navigate = useNavigate()
  // The shared settings context gates every Add button; saving here must refresh it,
  // otherwise the gate stays closed until a full page reload.
  const { refetch: refetchGate } = useSettings()

  const [income, setIncome] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set on the first successful save of this visit, so the page can say what comes next
  // instead of leaving a toast as the only answer to "and now?".
  const [savedNow, setSavedNow] = useState(false)

  const [trackStart, setTrackStart] = useState('')
  const [savingTrack, setSavingTrack] = useState(false)
  const [trackError, setTrackError] = useState<string | null>(null)

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)

  // Danger Zone — factory reset
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  useEffect(() => {
    if (settings.data) {
      setIncome(settings.data.monthlyStableIncome ?? 0)
      setTrackStart(settings.data.allocationTrackingStartMonth?.slice(0, 7) ?? '')
    }
  }, [settings.data])

  const savedIncome = settings.data?.monthlyStableIncome ?? 0
  const incomeIsSet = savedIncome > 0
  const trackingLock = settings.data?.allocationTrackingStartMonth ?? null

  /**
   * Income only. The tracking start month has its own save under Advanced now — the backend
   * patches whatever it is given and leaves the rest alone (SettingsService.update), so
   * splitting the form changes nothing about what is stored, and it keeps a write-once,
   * irreversible field off the one screen a new user is required to visit.
   */
  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await settingsApi.update({ monthlyStableIncome: income, monthlyStableIncomeCurrency: 'UZS' })
      settings.refetch()
      refetchGate()
      setSavedNow(true)
      showSuccess(t('page.settings.savedToast'))
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trackStart || trackingLock) return
    setSavingTrack(true); setTrackError(null)
    try {
      // Write-once server-side: sent only while nothing is stored, so saving anything else
      // can never trip the "locked" rejection.
      await settingsApi.update({ allocationTrackingStartMonth: `${trackStart}-01` })
      settings.refetch()
      refetchGate()
      showSuccess(t('page.settings.savedToast'))
    } catch (err: unknown) {
      setTrackError(extractErrorMessage(err))
    } finally { setSavingTrack(false) }
  }

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

  const incomeMissing = income <= 0

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={t('page.settings')} subtitle={t('page.settings.subtitle')} />

      <div className="mt-4 xl:mt-5">
        <TileGrid>
          {settings.error && settings.data && (
            <ErrorTile
              compact
              className="md:col-span-6 xl:col-span-12"
              message={settings.error}
              onRetry={settings.refetch}
            />
          )}

          {settings.loading ? (
            <>
              <Skeleton variant="stat" className="md:col-span-3 xl:col-span-6" />
              <Skeleton variant="stat" className="md:col-span-3 xl:col-span-6" />
            </>
          ) : settings.error && !settings.data ? (
            <ErrorTile
              className="md:col-span-6 xl:col-span-12"
              message={settings.error}
              onRetry={settings.refetch}
            />
          ) : (
            <>
              {/* The page's one hero: the single figure everything else on it is derived from. */}
              <Tile span={6} rows={2} padding="hero" as="section">
                <form onSubmit={handleIncomeSubmit} className="flex h-full flex-col gap-4">
                  <div>
                    <p className="text-label uppercase text-slate-500">{t('page.settings.stableIncomeHeading')}</p>
                    {incomeIsSet ? (
                      <>
                        <p className="mt-2 text-hero text-slate-900 tabular-nums">{money(savedIncome)}</p>
                        <p className="mt-1 text-sm text-slate-600 tabular-nums">
                          {t('ui.exactValue', { value: moneyExact(savedIncome) })}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-title text-slate-900">{t('page.settings.firstRunHeading')}</p>
                    )}
                  </div>

                  <Field
                    id="settings-income"
                    label={t('page.settings.amountLabel')}
                    help={t('page.settings.stableIncomeDesc')}
                    error={error ?? undefined}
                  >
                    <AmountInput
                      value={income} onChange={setIncome} currency="UZS"
                      suffix="UZS" className={`${INPUT} pr-14`}
                    />
                  </Field>

                  <div className="mt-auto space-y-2">
                    <Button
                      type="submit" variant="primary" loading={saving}
                      disabled={incomeMissing}
                      disabledReason={incomeMissing ? t('page.settings.amountRequired') : undefined}
                      icon={<Save className="w-4 h-4" aria-hidden="true" />}
                      label={saving ? t('action.saving') : t('page.shared.saveChanges')}
                    />
                    {/* The visible half of the reason: a disabled button's tooltip never appears
                        on a touch screen, and a screen reader cannot focus it to hear it. */}
                    <DisabledHint reason={incomeMissing ? t('page.settings.amountRequired') : undefined} />

                    {savedNow && incomeIsSet && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <p className="text-sm text-slate-600">{t('page.settings.nextStep')}</p>
                        <Button
                          size="sm"
                          icon={<CreditCard className="w-4 h-4" aria-hidden="true" />}
                          label={t('page.settings.goToWallets')}
                          onClick={() => navigate('/cards')}
                        />
                      </div>
                    )}
                  </div>
                </form>
              </Tile>

              {/* Read-only twin of the write-once control below: the value is worth seeing at a
                  glance, the irreversible input is not. */}
              <Tile
                span={6} as="section"
                className={settings.refreshing ? 'opacity-60 transition-opacity' : ''}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-label uppercase text-slate-500">{t('page.settings.trackingStartHeading')}</p>
                  {trackingLock && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-chip bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      {t('page.settings.trackingLockedNote')}
                    </span>
                  )}
                </div>
                {trackingLock ? (
                  <p className="mt-2 text-stat text-slate-900 tabular-nums">
                    {formatMonth(trackingLock.slice(0, 7), lang)}
                  </p>
                ) : (
                  <p className="mt-2 text-title text-slate-900">{t('page.settings.notSetYet')}</p>
                )}
                <p className="mt-1 text-sm text-slate-600">
                  {trackingLock ? t('page.settings.trackingDescPre') : t('page.settings.trackingNotSet')}
                </p>
                {settings.data?.updatedAt && (
                  <p className="mt-3 text-xs text-slate-500 tabular-nums">
                    {t('page.shared.lastUpdated', { date: formatDate(settings.data.updatedAt, lang, 'time') })}
                  </p>
                )}
              </Tile>
            </>
          )}

          {/* Advanced — the irreversible control and the bot plumbing, one deliberate tap away.
              Developer left the sidebar when the shell landed; this is its entry point. */}
          <Tile span={6} as="section">
            <Disclosure
              id="settings-advanced"
              open={advancedOpen}
              onToggle={() => setAdvancedOpen(o => !o)}
              icon={<Sliders className="w-4 h-4 text-slate-400" aria-hidden="true" />}
              title={t('page.settings.advanced')}
              help={t('page.settings.advancedHelp')}
            >
              <div className="space-y-6">
                <section>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-slate-900">{t('page.settings.trackingStartHeading')}</h3>
                  </div>

                  {incomeIsSet ? (
                    <form onSubmit={handleTrackSubmit} className="mt-2 space-y-3">
                      <Field
                        id="settings-track-start"
                        label={t('page.settings.trackFromMonthLabel')}
                        help={`${t('page.settings.trackingDescPre')} ${t('page.settings.trackingLockedNote')} ${t('page.settings.trackingDescPost')}`}
                        error={trackError ?? undefined}
                      >
                        <input
                          type="month" value={trackStart}
                          onChange={e => setTrackStart(e.target.value)}
                          disabled={!!trackingLock}
                          className={`${INPUT} disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed`}
                        />
                      </Field>

                      {trackingLock ? (
                        <p className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Lock className="w-3 h-3" aria-hidden="true" />
                          {t('page.settings.lockedSetTo', { month: formatMonth(trackingLock.slice(0, 7), lang) })}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <Button
                            type="submit" loading={savingTrack}
                            disabled={!trackStart}
                            disabledReason={!trackStart ? t('page.settings.trackMonthRequired') : undefined}
                            icon={<Save className="w-4 h-4" aria-hidden="true" />}
                            label={savingTrack ? t('action.saving') : t('page.shared.saveChanges')}
                          />
                          <DisabledHint reason={!trackStart ? t('page.settings.trackMonthRequired') : undefined} />
                        </div>
                      )}
                    </form>
                  ) : (
                    // A write-once lock a brand-new account can trip before it has recorded
                    // anything is a trap, so the control appears only once step 1 is done.
                    <p className="mt-2 text-sm text-slate-600">{t('income.requiredTitle')}</p>
                  )}
                </section>

                <section className="border-t border-hairline pt-5">
                  <h3 className="text-sm font-semibold text-slate-900">{t('page.developer')}</h3>
                  <p className="mt-0.5 mb-4 text-sm text-slate-600">{t('page.developer.subtitle')}</p>
                  <DeveloperSettings />
                </section>
              </div>
            </Disclosure>
          </Tile>

          {/* Neutral surface and a quiet trigger — it used to be a rose-bordered card with a
              filled rose button sitting under Save. The button inside is the primitive's own
              `danger`, not a fifth appearance hand-mixed from !important overrides: it is
              collapsed behind this disclosure and behind a password prompt, so the one control
              that erases the account is allowed to look like what it is. */}
          <Tile span={12} as="section">
            <Disclosure
              id="settings-danger"
              open={dangerOpen}
              onToggle={() => setDangerOpen(o => !o)}
              icon={<AlertTriangle className="w-4 h-4 text-slate-400" aria-hidden="true" />}
              title={t('page.settings.dangerZone')}
              help={t('page.settings.dangerZoneBold')}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <p className="max-w-2xl text-sm text-slate-600">{t('page.settings.dangerZoneDesc')}</p>
                <Button
                  variant="danger"
                  onClick={openReset}
                  icon={<Trash2 className="w-4 h-4" aria-hidden="true" />}
                  label={t('page.settings.clearEverything')}
                  className="shrink-0"
                />
              </div>
            </Disclosure>
          </Tile>
        </TileGrid>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => !resetting && setResetOpen(false)}
        title={t('page.settings.confirmPasswordTitle')}
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              label={t('action.cancel')} disabled={resetting}
              onClick={() => setResetOpen(false)}
            />
            {/* Outside the <form> — the sheet renders its footer beside the scroll area — so it
                submits by id instead of by nesting. */}
            <Button
              type="submit" form="settings-reset-form" variant="danger"
              disabled={!resetPassword} loading={resetting}
              icon={<Trash2 className="w-4 h-4" aria-hidden="true" />}
              label={resetting ? t('page.settings.clearing') : t('page.settings.clearEverything')}
            />
          </div>
        }
      >
        <form id="settings-reset-form" onSubmit={handleReset} className="space-y-4">
          <p className="text-sm text-slate-600">{t('page.settings.confirmPasswordDesc')}</p>
          <Field id="settings-reset-password" label={t('page.shared.password')} error={resetError ?? undefined}>
            <input
              autoFocus type="password" value={resetPassword}
              onChange={e => setResetPassword(e.target.value)}
              autoComplete="current-password" className={INPUT}
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}

/**
 * One collapsed section. A real button with `aria-expanded` rather than `<details>`: the panel
 * is mounted only while it is open, which is what keeps the Telegram form's own fetch off the
 * page for everyone who never opens it.
 */
function Disclosure({ id, open, onToggle, icon, title, help, children }: {
  id: string
  open: boolean
  onToggle: () => void
  icon: ReactNode
  title: string
  help?: string
  children: ReactNode
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className="flex w-full min-h-[44px] items-center gap-2.5 rounded-control text-left focus-ring"
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          {help && <span className="block text-xs text-slate-500 leading-snug">{help}</span>}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && <div id={id} className="mt-4">{children}</div>}
    </>
  )
}
