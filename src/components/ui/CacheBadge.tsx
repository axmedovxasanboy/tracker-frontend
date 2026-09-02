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
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" />
      {t('cmp.cache.cached', { time: format(new Date(cachedAt), 'HH:mm') })}
    </span>
  )
}
