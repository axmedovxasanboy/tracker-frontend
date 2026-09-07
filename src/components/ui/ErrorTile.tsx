import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './Button'
import { useLang } from '../../i18n/LanguageContext'

/**
 * A failed fetch, said out loud.
 *
 * Before this, every `useApi` consumer rendered `loading ? spinner : empty ? "Nothing yet" : data`,
 * so a 500 from the server was pixel-identical to an empty account — and 4xx GETs are not even
 * toasted (`src/api/client.ts` only auto-toasts 5xx). This is the third branch every list needs.
 *
 * Two shapes, one component:
 * - default — the tile stands in for the whole block that failed. `min-h-48` matches the spinner
 *   boxes it replaces, so nothing jumps when the retry succeeds.
 * - `compact` — a slim strip for the case where stale data is still on screen (`error && data`):
 *   the list stays, the strip sits above it and offers the retry. Blanking a list the user can
 *   still read would be a regression, which is why the hook keeps the previous payload.
 *
 * Not built on `Tile`: this drops into tab panels, modals and half-width columns, none of which
 * are the twelve-column page grid `Tile`'s spans assume.
 */
export function ErrorTile({ message, onRetry, compact = false, className = '' }: {
  /** The failure itself — `useApi`'s `error`, already run through `extractErrorMessage`. */
  message: string
  /** `useApi`'s `refetch`. Omitted only where a retry cannot help. */
  onRetry?: () => void
  /** Slim inline strip instead of a full tile — for when stale data is still rendered below. */
  compact?: boolean
  className?: string
}) {
  const { t } = useLang()
  const body = t('ui.error.body', { message })

  if (compact) {
    return (
      <div
        role="alert"
        className={`flex items-center gap-3 px-3 py-2 bg-white border border-amber-200 rounded-control ${className}`}
      >
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" aria-hidden="true" />
        {/* `title` because a server message can be long and the strip is one line. */}
        <p className="flex-1 min-w-0 text-sm text-slate-600 truncate" title={body}>{body}</p>
        {onRetry && (
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
            label={t('ui.error.retry')}
            onClick={onRetry}
            className="shrink-0"
          />
        )}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={`bg-white border border-hairline rounded-tile shadow-tile p-6 min-h-48 flex flex-col items-center justify-center text-center gap-3 ${className}`}
    >
      {/* Amber on the icon chip only — a tinted surface would make one failed panel shout louder
          than the page it sits on. */}
      <div className="w-10 h-10 rounded-chip bg-amber-100 text-amber-600 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-title text-slate-900">{t('ui.error.title')}</p>
        <p className="mt-1 max-w-sm text-sm text-slate-600 break-words">{body}</p>
      </div>
      {onRetry && (
        <Button
          icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
          label={t('ui.error.retry')}
          onClick={onRetry}
        />
      )}
    </div>
  )
}
