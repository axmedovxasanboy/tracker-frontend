import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'

/**
 * The one month control for the whole of Analytics (§2.3): ‹ {Month YYYY} ›, the month in full.
 * The look of `PageHeader`'s stepper; on a phone it rides in the app bar (never scrolls away), on
 * a desktop at the right of the sticky tab strip. A missing `onPrev` / `onNext` disables that
 * arrow — at the history start, and at the current month.
 */
export function MonthPicker({ label, onPrev, onNext, className = '' }: {
  label: string
  onPrev?: () => void
  onNext?: () => void
  className?: string
}) {
  const { t } = useLang()
  const arrow = 'w-11 h-11 shrink-0 flex items-center justify-center text-slate-600 hover:bg-slate-50 ' +
    'disabled:text-slate-300 disabled:hover:bg-transparent transition-colors focus-ring'
  return (
    <div className={`flex items-center rounded-control border border-hairline bg-white ${className}`}>
      <button
        type="button"
        onClick={onPrev}
        disabled={!onPrev}
        aria-label={t('cmp.pageHeader.prevMonth')}
        title={t('cmp.pageHeader.prevMonth')}
        className={`${arrow} rounded-l-control`}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      {/* Polite, so a screen reader hears the month it stepped to. */}
      <span aria-live="polite" className="px-0.5 text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!onNext}
        aria-label={t('cmp.pageHeader.nextMonth')}
        title={t('cmp.pageHeader.nextMonth')}
        className={`${arrow} rounded-r-control`}
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/** On 12 months the picker gives way to the range actually covered: "September – October 2026". */
export function RangeLabel({ label, className = '' }: { label: string; className?: string }) {
  return (
    <span className={`flex min-h-[44px] items-center px-1 text-sm font-semibold text-slate-900 whitespace-nowrap ${className}`}>
      {label}
    </span>
  )
}
