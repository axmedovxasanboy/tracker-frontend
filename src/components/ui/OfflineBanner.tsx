import { WifiOff, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { useBackendStatus } from '../../context/BackendStatusContext'
import { useLang } from '../../i18n/LanguageContext'
import { Button } from './Button'

export function OfflineBanner() {
  const { isOnline, lastOnline, forceCheck } = useBackendStatus()
  const { t } = useLang()

  if (isOnline) return null

  return (
    // flex-wrap and a gap: at 390px the status text needs three or four lines, and without them
    // the row squeezed Retry into a sliver against the right edge.
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2 text-amber-800">
        <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">{t('cmp.offline.backendOffline')}</span>
        {/* amber-700, not amber-600: 4.84:1 on the amber-50 banner rather than 3.07:1. */}
        {lastOnline && (
          <span className="text-amber-700">
            {t('cmp.offline.showingDataFrom', { time: format(new Date(lastOnline), 'dd-MMM HH:mm') })}
          </span>
        )}
        {!lastOnline && (
          <span className="text-amber-700">{t('cmp.offline.noCachedData')}</span>
        )}
      </div>
      {/* Was a bare 20px-tall line of amber text with no padding and — since the app resets the
          UA focus ring — no focus indicator at all, which is the worst possible combination for
          the one control offered at the moment the backend is unreachable. `secondary` rather
          than `ghost` on purpose: on a tinted banner a ghost button reads as more banner text,
          and the point of this fix is that the control looks like a control. `size="sm"` ships
          the 44px hit area and `.focus-ring` with it.

          `forceCheck` no longer only hides this banner: recovering publishes an online-recovery
          tick that every mounted `useApi` re-runs on, so the cached figures the outage left on
          screen are replaced rather than silently kept. */}
      <Button
        size="sm"
        variant="secondary"
        icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
        label={t('cmp.offline.retry')}
        onClick={forceCheck}
        className="shrink-0"
      />
    </div>
  )
}
