import { X } from 'lucide-react'
import { format, parse } from 'date-fns'
import { Spinner } from '../ui/Spinner'
import { useLang } from '../../i18n/LanguageContext'
import { useApi } from '../../hooks/useApi'
import { overviewApi } from '../../api/overview'
import { formatCurrency } from '../../utils/format'
import type { Bucket, Currency } from '../../types'

interface Props {
  bucket: Bucket
  month: string         // YYYY-MM
  currency: Currency
  onClose: () => void
}

function formatMonthLabel(ym: string): string {
  try { return format(parse(ym, 'yyyy-MM', new Date()), 'MMMM yyyy') }
  catch { return ym }
}

export function BucketHistoryPanel({ bucket, month, currency, onClose }: Props) {
  const { t } = useLang()
  const BUCKET_LABELS: Record<Bucket, string> = {
    DONATION:    t('cmp.bucketHistory.donations'),
    EMERGENCY:   t('cmp.bucketHistory.emergencyContributions'),
    INVESTMENTS: t('cmp.bucket.investments'),
    STOCKS:      t('cmp.bucket.stocks'),
  }
  const payments = useApi(() => overviewApi.getBucketPayments(bucket, month, currency), [bucket, month, currency])
  const rows = payments.data ?? []
  const total = rows.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="font-semibold text-slate-800">
            {BUCKET_LABELS[bucket]} — {formatMonthLabel(month)}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {t(rows.length === 1 ? 'cmp.bucketHistory.paymentCountOne' : 'cmp.bucketHistory.paymentCountMany', { count: rows.length })} ·{' '}
            <span className="font-semibold text-slate-600">{formatCurrency(total, currency, true)}</span> {t('cmp.bucketHistory.totalSuffix')}
          </p>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {payments.loading && !payments.data ? (
        <div className="h-32 flex items-center justify-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-sm text-slate-400">
          {t('cmp.bucketHistory.noPayments', { month: formatMonthLabel(month) })}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {[t('tx.date'), t('cmp.bucketHistory.label'), t('tx.amount'), t('tx.note')].map(h => (
                <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(p => (
              <tr key={`${p.bucket}-${p.id}`} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {format(new Date(p.date), 'dd-MMM-yyyy')}
                </td>
                <td className="px-5 py-3 text-slate-700">{p.label}</td>
                <td className="px-5 py-3 font-semibold text-slate-700 whitespace-nowrap">
                  {formatCurrency(p.amount, currency)}
                  {p.nativeCurrency !== currency && (
                    <span className="ml-1.5 text-[11px] text-slate-400 font-normal">
                      ({formatCurrency(p.nativeAmount, p.nativeCurrency)})
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-400 text-xs max-w-64 truncate">{p.description ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
