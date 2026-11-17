import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Banknote, ChevronRight } from 'lucide-react'
import { Tile } from '../ui/Tile'
import { useApi } from '../../hooks/useApi'
import { useLang } from '../../i18n/LanguageContext'
import { financeApi } from '../../api/finance'
import { formatDate, moneyFull, plural } from '../../utils/format'
import { NASIYA_SOON_DAYS, daysUntil, isOpenNasiya } from '../../utils/nasiya'

/**
 * One tile per nasiya still to be paid by its deadline (e.g. Uzum Nasiya, Batch 75): what is left,
 * by when, how many days remain — amber in the last five, red once the deadline has passed (then
 * the way on is to switch it to installments). Each leads to Loans & bills. Nothing when there is
 * no open nasiya, and nothing on a failed read — Home does not need it to work.
 *
 * `version` changes whenever Home refetches (a payment from Coming up), so the tile follows.
 */
export function NasiyaTiles({ today, version }: { today: string; version: number }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const q = useApi(() => financeApi.getLoansTaken(), [])
  useEffect(() => { if (version > 0) q.refetch() }, [version])

  const open = (q.data ?? []).filter(isOpenNasiya)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.id - b.id)
  if (open.length === 0) return null

  return (
    <>
      {open.map(l => {
        const days = daysUntil(l.dueDate as string, today)
        const overdue = days < 0
        const soon = !overdue && days <= NASIYA_SOON_DAYS
        const left = Math.max(0, l.remainingAmount)
        const when = days === 0 ? t('shell.nasiya.lastDay')
          : plural(days, t('shell.nasiya.daysLeftOne', { count: days }), t('shell.nasiya.daysLeftMany', { count: days }), lang)
        const tone = overdue ? 'border-l-4 border-l-rose-500' : soon ? 'border-l-4 border-l-amber-400' : ''
        return (
          <Tile key={l.id} span={open.length > 1 ? 6 : 12} mdSpan={6} as="section"
            className={tone} onClick={() => navigate('/loans')}>
            <div className="flex items-center gap-3" title={t('shell.nasiya.homeOpen')}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-chip ${
                overdue ? 'bg-rose-50 text-expense' : 'bg-pink-100 text-pink-600'
              }`}>
                {overdue
                  ? <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  : <Banknote className="h-4 w-4" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{l.lenderName}</p>
                <p className="text-sm tabular-nums text-slate-700">
                  {t('shell.nasiya.homeLine', {
                    amount: moneyFull(left, l.currency),
                    date: formatDate(l.dueDate as string, lang, 'dayShort'),
                  })}
                </p>
                <p className={`mt-0.5 text-xs font-semibold ${
                  overdue ? 'text-expense' : soon ? 'text-amber-700' : 'text-slate-500'
                }`}>
                  {overdue ? t('shell.nasiya.homeOverdue') : when}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </div>
          </Tile>
        )
      })}
    </>
  )
}
