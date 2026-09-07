import { Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useLang } from '../../i18n/LanguageContext'

interface Props {
  isCached: boolean
  cachedAt: string | null
}

export function CacheBadge({ isCached, cachedAt }: Props) {
  const { t } = useLang()
  if (!isCached || !cachedAt) return null
  // slate-500, not slate-400: this badge sits inside the hero tiles and is the only thing telling
  // the user the figure above it is cached rather than live, so it has to clear the 4.5:1 floor.
  return (
    <span className="inline-flex items-center gap-1 rounded-chip bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
      <Clock className="w-3 h-3" />
      {t('cmp.cache.cached', { time: format(new Date(cachedAt), 'HH:mm') })}
    </span>
  )
}
