import { useEffect, useState } from 'react'
import { Terminal, Save, Webhook, MonitorSmartphone, Copy, Check, Info } from 'lucide-react'
import { Spinner } from '../components/ui/Spinner'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import { settingsApi } from '../api/settings'
import { extractErrorMessage } from '../api/client'
import type { SettingsRequest } from '../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

/** Lenient client-side hint — saving isn't blocked (localhost dev), we just warn.
 *  Messages are pre-localized by the caller since this runs outside the component. */
function urlWarning(value: string, invalidMsg: string, httpsMsg: string): string | null {
  const v = value.trim()
  if (!v) return null
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:') return httpsMsg
    return null
  } catch {
    return invalidMsg
  }
}

export function Developer() {
  const { t } = useLang()
  const settings = useApi(() => settingsApi.get(), [])
  const { showSuccess } = useToast()

  const [webhookUrl, setWebhookUrl] = useState('')
  const [webViewUrl, setWebViewUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (settings.data) {
      setWebhookUrl(settings.data.telegramWebhookUrl ?? '')
      setWebViewUrl(settings.data.telegramWebViewUrl ?? '')
    }
  }, [settings.data])

  const copy = async (label: string, value: string) => {
    if (!value.trim()) return
    try {
      await navigator.clipboard.writeText(value.trim())
      setCopied(label)
      setTimeout(() => setCopied(c => (c === label ? null : c)), 1500)
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      // Always send both (empty string clears the stored value server-side).
      const req: SettingsRequest = {
        telegramWebhookUrl: webhookUrl.trim(),
        telegramWebViewUrl: webViewUrl.trim(),
      }
      await settingsApi.update(req)
      settings.refetch()
      showSuccess(t('page.developer.savedToast'))
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const webhookWarn = urlWarning(webhookUrl, t('page.developer.invalidUrlWarning'), t('page.developer.httpsWarning'))
  const webViewWarn = urlWarning(webViewUrl, t('page.developer.invalidUrlWarning'), t('page.developer.httpsWarning'))

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
          <Terminal className="w-5 h-5 text-emerald-300" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-800">{t('page.developer')}</h2>
          <p className="text-sm text-slate-400">{t('page.developer.subtitle')}</p>
        </div>
      </header>

      <div className="flex gap-2.5 text-xs text-slate-600 bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-3">
        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <p>
          {t('page.developer.webhookInfoPre')}
          {' '}(<code className="text-[11px] bg-white/70 px-1 py-0.5 rounded">GET /api/v1/settings/telegram</code>).
          {' '}{t('page.developer.webhookInfoAfter')} <strong>{t('page.developer.restartBot')}</strong> {t('page.developer.webhookInfoEnd')}
        </p>
      </div>

      {settings.loading && !settings.data ? (
        <div className="h-32 flex items-center justify-center"><Spinner /></div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-6">
          {/* Webhook URL */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-700">{t('page.developer.webhookUrlHeading')}</h3>
            </div>
            <p className="text-xs text-slate-500 -mt-1">
              {t('page.developer.webhookDescPre')}
              <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded mx-1">setWebhook</code>
              {t('page.developer.webhookDescPost')} <span className="text-slate-600">https://your-tunnel.example/webhook</span>.
            </p>
            <div className="flex gap-2">
              <input type="url" inputMode="url" autoComplete="off" spellCheck={false}
                value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://your-tunnel.example/webhook"
                className={`${INPUT} font-mono`} />
              <button type="button" onClick={() => copy('webhook', webhookUrl)}
                disabled={!webhookUrl.trim()} title={t('page.developer.copyTitle')}
                className="shrink-0 px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                {copied === 'webhook' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {webhookWarn && <p className="text-[11px] text-amber-600">{webhookWarn}</p>}
          </section>

          {/* Web-view URL */}
          <section className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold text-slate-700">{t('page.developer.webViewUrlHeading')}</h3>
            </div>
            <p className="text-xs text-slate-500 -mt-1">
              {t('page.developer.webViewDesc')}
            </p>
            <div className="flex gap-2">
              <input type="url" inputMode="url" autoComplete="off" spellCheck={false}
                value={webViewUrl} onChange={e => setWebViewUrl(e.target.value)}
                placeholder="https://your-frontend.example"
                className={`${INPUT} font-mono`} />
              <button type="button" onClick={() => copy('webview', webViewUrl)}
                disabled={!webViewUrl.trim()} title={t('page.developer.copyTitle')}
                className="shrink-0 px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                {copied === 'webview' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {webViewWarn && <p className="text-[11px] text-amber-600">{webViewWarn}</p>}
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
    </div>
  )
}
