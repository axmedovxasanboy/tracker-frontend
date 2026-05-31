import { WifiOff, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { useBackendStatus } from '../../context/BackendStatusContext'

export function OfflineBanner() {
  const { isOnline, lastOnline, forceCheck } = useBackendStatus()

  if (isOnline) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-amber-800">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span className="font-medium">Backend is offline</span>
        {lastOnline && (
          <span className="text-amber-600">
            — showing data from {format(new Date(lastOnline), 'dd-MMM HH:mm')}
          </span>
        )}
        {!lastOnline && (
          <span className="text-amber-600">— no cached data available yet</span>
        )}
      </div>
      <button
        onClick={forceCheck}
        className="flex items-center gap-1.5 text-amber-700 hover:text-amber-900 font-medium transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </button>
    </div>
  )
}
