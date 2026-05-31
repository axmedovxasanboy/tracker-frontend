import type { LucideIcon } from 'lucide-react'
import { CacheBadge } from '../ui/CacheBadge'

interface Props {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  color: 'emerald' | 'rose' | 'indigo' | 'amber'
  isCached?: boolean
  cachedAt?: string | null
  onClick?: () => void
}

const colorMap = {
  emerald: { icon: 'bg-emerald-500', border: 'border-l-emerald-500', hover: 'hover:border-l-emerald-600 hover:shadow-md' },
  rose:    { icon: 'bg-rose-500',    border: 'border-l-rose-500',    hover: 'hover:border-l-rose-600 hover:shadow-md' },
  indigo:  { icon: 'bg-indigo-500',  border: 'border-l-indigo-500',  hover: 'hover:border-l-indigo-600 hover:shadow-md' },
  amber:   { icon: 'bg-amber-500',   border: 'border-l-amber-500',   hover: 'hover:border-l-amber-600 hover:shadow-md' },
}

export function SummaryCard({ title, value, subtitle, icon: Icon, color, isCached, cachedAt, onClick }: Props) {
  const c = colorMap[color]
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm border-l-4 ${c.border} p-5 transition-all ${
        onClick ? `cursor-pointer ${c.hover} active:scale-[0.98]` : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-800 truncate">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {isCached && cachedAt && (
            <div className="mt-2"><CacheBadge isCached={isCached} cachedAt={cachedAt} /></div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center shrink-0 ml-3`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  )
}
