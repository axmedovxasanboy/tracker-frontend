import { useEffect, useState } from 'react'
import { Target, CheckCircle2 } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'
import { overviewApi } from '../../api/overview'
import { formatCurrency } from '../../utils/format'
import type { AllocationPreviewResponse, Currency, TransactionSubType } from '../../types'

interface Props {
  subType?: TransactionSubType | ''
  amount: number
  transactionDate: string
  investmentId?: number
  currency: Currency
}

/**
 * Live "what will this do to my allocation?" panel. The sub-type → bucket routing is
 * resolved server-side (POST /overview/allocation-preview) so this can never promise a
 * bucket the real accounting wouldn't credit.
 */
export function AllocationPreviewPanel({ subType, amount, transactionDate, investmentId, currency }: Props) {
  const { t } = useLang()
  const [preview, setPreview] = useState<AllocationPreviewResponse | null>(null)

  useEffect(() => {
    if (!subType || !amount || amount <= 0 || !transactionDate) { setPreview(null); return }
    let cancelled = false
    // Debounced: the amount field fires on every keystroke.
    const timer = setTimeout(() => {
      overviewApi.previewAllocation({ subType, amount, transactionDate, investmentId }, currency)
        .then(r => { if (!cancelled) setPreview(r.data) })
        .catch(() => { if (!cancelled) setPreview(null) })
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [subType, amount, transactionDate, investmentId, currency])

  if (!preview || !preview.applicable) return null

  const pct = preview.recommended && Number(preview.recommended) > 0
    ? Math.min(100, (Number(preview.paidAfter ?? 0) / Number(preview.recommended)) * 100)
    : 0
  const beforePct = preview.recommended && Number(preview.recommended) > 0
    ? Math.min(100, (Number(preview.paidBefore ?? 0) / Number(preview.recommended)) * 100)
    : 0

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-3 space-y-2">
      <div className="flex items-center gap-2">
        {preview.completesBucket
          ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          : <Target className="w-4 h-4 text-indigo-500 shrink-0" />}
        <p className="text-xs font-semibold text-slate-700">
          {t('alloc.countsToward')} <span className="text-indigo-700">{preview.label}</span>
        </p>
      </div>

      {!preview.bucketNotRecommended && (
        <>
          {/* Filled portion = already paid; the lighter overlay is what this transaction adds. */}
          <div className="h-2 rounded-full bg-white overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 bg-indigo-300" style={{ width: `${pct}%` }} />
            <div className="absolute inset-y-0 left-0 bg-indigo-600" style={{ width: `${beforePct}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
            <div>
              <p className="text-slate-400">{t('alloc.target')}</p>
              <p className="font-semibold">{formatCurrency(Number(preview.recommended ?? 0), currency)}</p>
            </div>
            <div>
              <p className="text-slate-400">{t('alloc.paidSoFar')}</p>
              <p className="font-semibold">{formatCurrency(Number(preview.paidBefore ?? 0), currency)}</p>
            </div>
            <div>
              <p className="text-slate-400">{t('alloc.afterThis')}</p>
              <p className="font-semibold text-indigo-700">
                {formatCurrency(Number(preview.paidAfter ?? 0), currency)}
              </p>
            </div>
          </div>
        </>
      )}

      {preview.message && <p className="text-[11px] text-slate-500">{preview.message}</p>}
    </div>
  )
}
