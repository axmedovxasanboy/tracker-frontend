import { useEffect, useState } from 'react'
import { Check, Copy, Info, Save } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ErrorTile } from '../components/ui/ErrorTile'
import { Field } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { Tile, TileGrid } from '../components/ui/Tile'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import { settingsApi } from '../api/settings'
import { extractErrorMessage } from '../api/client'
import type { SettingsRequest } from '../types'

const INPUT = 'w-full h-11 rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus-ring'

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

/**
 * The Telegram plumbing, with no page chrome of its own.
 *
 * It renders bare — no surface, no header — because it has two homes: the /developer route
 * (kept for bookmarks and the bot's own web-view URL) and Settings › Advanced, which is where
 * the nav now leads. A tile of its own would double-frame the second one.
 *
 * It owns its read of the settings row rather than taking one as a prop: Settings mounts it
 * only once the disclosure is open, so the extra GET is paid by the handful of visits that
 * actually want it, and neither host can hand the other a stale row.
 */
export function DeveloperSettings() {
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

  // `compact` in both hosts: this component is always rendered inside a tile someone else has
  // already drawn, and the full ErrorTile paints its own white surface — a tile inside a tile.
  if (settings.loading) return <Skeleton variant="text" count={4} bare />
  if (settings.error && !settings.data) {
    return <ErrorTile compact message={settings.error} onRetry={settings.refetch} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {settings.error && (
        <ErrorTile compact message={settings.error} onRetry={settings.refetch} />
      )}

      <p className="flex gap-2 text-sm text-slate-600 leading-snug">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" aria-hidden="true" />
        <span>
          {t('page.developer.webhookInfoPre')}
          {' '}(<code className="rounded-chip bg-slate-100 px-1 py-0.5 text-xs">GET /api/v1/settings/telegram</code>).
          {' '}{t('page.developer.webhookInfoAfter')} <strong className="font-semibold text-slate-900">{t('page.developer.restartBot')}</strong> {t('page.developer.webhookInfoEnd')}
        </span>
      </p>

      <UrlField
        id="dev-webhook-url"
        label={t('page.developer.webhookUrlHeading')}
        help={`${t('page.developer.webhookDescPre')} setWebhook ${t('page.developer.webhookDescPost')} https://your-tunnel.example/webhook`}
        value={webhookUrl}
        onChange={setWebhookUrl}
        placeholder="https://your-tunnel.example/webhook"
        warning={webhookWarn}
        copied={copied === 'webhook'}
        onCopy={() => copy('webhook', webhookUrl)}
      />

      <UrlField
        id="dev-webview-url"
        label={t('page.developer.webViewUrlHeading')}
        help={t('page.developer.webViewDesc')}
        value={webViewUrl}
        onChange={setWebViewUrl}
        placeholder="https://your-frontend.example"
        warning={webViewWarn}
        copied={copied === 'webview'}
        onCopy={() => copy('webview', webViewUrl)}
      />

      {error && <p role="alert" className="text-sm text-expense leading-snug">{error}</p>}

      <div className="flex justify-end">
        <Button
          type="submit" variant="primary" loading={saving}
          icon={<Save className="w-4 h-4" aria-hidden="true" />}
          label={saving ? t('action.saving') : t('page.shared.saveChanges')}
        />
      </div>
    </form>
  )
}

/**
 * One labelled URL input with its copy button and its own warning line.
 *
 * The label is Field's — not a heading above one — because a heading and a label carrying the
 * same words print that word twice on the screen and read it twice to a screen reader.
 */
function UrlField({ id, label, help, value, onChange, placeholder, warning, copied, onCopy }: {
  id: string
  label: string
  help: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  warning: string | null
  copied: boolean
  onCopy: () => void
}) {
  const { t } = useLang()

  return (
    <div>
      <div className="flex items-end gap-2">
        <Field id={id} label={label} help={help} className="flex-1">
          <input
            type="url" inputMode="url" autoComplete="off" spellCheck={false}
            value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${INPUT} font-mono`}
          />
        </Field>
        <Button
          iconOnly
          label={t('page.developer.copyTitle')}
          icon={copied
            ? <Check className="w-4 h-4 text-income" aria-hidden="true" />
            : <Copy className="w-4 h-4" aria-hidden="true" />}
          onClick={onCopy}
          disabled={!value.trim()}
        />
      </div>
      {warning && <p className="mt-1 text-xs text-amber-700">{warning}</p>}
    </div>
  )
}

/**
 * The standalone /developer route. Out of the sidebar since the shell landed — Settings ›
 * Advanced is the way in — but the route stays so bookmarks and the Telegram web-view URL,
 * which may point straight at it, keep working.
 *
 * DELIBERATE EXCEPTION to the one-hero-per-page rule. Every other grid page ranks a money
 * figure at 40px; this one holds two URL text inputs and has no figure at all, and a hero
 * built out of a heading would rank the page title twice — PageHeader already names the
 * screen. Please do not "fix" this by inventing a StatTile with nothing to count.
 */
export function Developer() {
  const { t } = useLang()

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={t('page.developer')} subtitle={t('page.developer.subtitle')} />
      <div className="mt-4 xl:mt-5">
        <TileGrid>
          {/* One column of form, not a full-width band: a 12-span would stretch two URL inputs
              across a 1600px screen and make them harder to read, not easier. */}
          <Tile span={8} as="section">
            <DeveloperSettings />
          </Tile>
        </TileGrid>
      </div>
    </div>
  )
}
