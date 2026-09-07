import { useEffect, useState } from 'react'
import { Target, CheckCircle2 } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'
import { overviewApi } from '../../api/overview'
import { moneyFull } from '../../utils/format'
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
 *
 * It sits directly under the amount field that drives it: the answer and the control that
 * produces it have to be on screen together, or the panel is just a footnote nobody scrolls to.
 */
export function AllocationPreviewPanel({ subType, amount, transactionDate, investmentId, currency }: Props) {
  const { t } = useLang()
  const [preview, setPreview] = useState<AllocationPreviewResponse | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!subType || !amount || amount <= 0 || !transactionDate) { setPreview(null); return }
    let cancelled = false
    setRefreshing(true)
    // Debounced: the amount field fires on every keystroke.
    const timer = setTimeout(() => {
      overviewApi.previewAllocation({ subType, amount, transactionDate, investmentId }, currency)
        .then(r => { if (!cancelled) setPreview(r.data) })
        // A preview that cannot be fetched stays silent: it is a hint, and an error tile here
        // would shout louder than the figure the user is actually entering.
        .catch(() => { if (!cancelled) setPreview(null) })
        .finally(() => { if (!cancelled) setRefreshing(false) })
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
    <div
      className={`rounded-control border border-slate-200 px-4 py-3.5 space-y-3 transition-opacity ${
        refreshing ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        {/* The one place a hue survives on this panel — a 28px chip, never the surface. */}
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-chip ${
            preview.completesBucket ? 'bg-emerald-50 text-income' : 'bg-indigo-50 text-indigo-600'
          }`}
        >
          {preview.completesBucket
            ? <CheckCircle2 className="w-4 h-4" />
            : <Target className="w-4 h-4" />}
        </span>
        <p className="min-w-0 text-sm text-slate-600">
          {t('alloc.countsToward')}{' '}
          <span className="font-semibold text-slate-900">{preview.label}</span>
        </p>
      </div>

      {!preview.bucketNotRecommended && (
        <>
          {/* Filled portion = already set aside; the lighter overlay is what this transaction adds. */}
          <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="absolute inset-y-0 left-0 bg-indigo-300" style={{ width: `${pct}%` }} />
            <div className="absolute inset-y-0 left-0 bg-indigo-600" style={{ width: `${beforePct}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <p className="text-label uppercase text-slate-500">{t('alloc.target')}</p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-slate-900">
                {moneyFull(Number(preview.recommended ?? 0), currency)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-label uppercase text-slate-500">{t('alloc.paidSoFar')}</p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-slate-900">
                {moneyFull(Number(preview.paidBefore ?? 0), currency)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-label uppercase text-slate-500">{t('alloc.afterThis')}</p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-indigo-700">
                {moneyFull(Number(preview.paidAfter ?? 0), currency)}
              </p>
            </div>
          </div>
        </>
      )}

      {preview.message && <p className="text-xs text-slate-500">{preview.message}</p>}
    </div>
  )
}
