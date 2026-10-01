import { X } from 'lucide-react'
import { useRadioGroupKeys } from '../../hooks/useRadioGroupKeys'
import { useLang } from '../../i18n/LanguageContext'
import { formatDate, moneyFull, shiftMonth } from '../../utils/format'
import type { StableIncomeEntry } from '../../types'

/**
 * The months a changed income can apply from: the earliest the server accepts, up to two months
 * after this one. Without a first month from the server, this month is the earliest offered.
 */
export function incomeMonths(firstMonth: string | null | undefined, thisMonth: string): string[] {
  const start = firstMonth && /^\d{4}-\d{2}$/.test(firstMonth) ? firstMonth : thisMonth
  const end = shiftMonth(thisMonth, 2)
  const months: string[] = []
  // 36 is a guard against a nonsense first month, not a limit anyone meets.
  for (let m = start; m <= end && months.length < 36; m = shiftMonth(m, 1)) months.push(m)
  return months.length > 0 ? months : [thisMonth]
}

/**
 * "From which month?" — asked inline, under the amount, only while a changed income is about to be
 * saved. The current month is chosen already, so the usual change is still just Save; picking
 * another month is one tap on the same screen, never a second dialog.
 */
export function IncomeFromChips({ months, value, onChange, disabled = false }: {
  months: string[]
  value: string
  onChange: (month: string) => void
  disabled?: boolean
}) {
  const { t, lang } = useLang()
  const keys = useRadioGroupKeys(months, value, onChange)
  return (
    <div>
      <p id="income-from-label" className="text-sm font-medium text-slate-900">{t('fix.income.from')}</p>
      <div
        role="radiogroup"
        aria-labelledby="income-from-label"
        aria-describedby="income-from-note"
        className="mt-2 flex flex-wrap gap-2"
      >
        {months.map((m, i) => {
          const on = m === value
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              {...keys(i)}
              onClick={() => onChange(m)}
              className={`focus-ring min-h-[44px] rounded-chip border px-3 text-sm font-medium tabular-nums transition-colors disabled:opacity-60 ${
                on
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {formatDate(m, lang, 'monthShort')}
            </button>
          )
        })}
      </div>
      <p id="income-from-note" className="mt-2 text-xs text-slate-500">{t('fix.income.fromNote')}</p>
    </div>
  )
}

/**
 * The income's changes, newest first, as one quiet line — "8.000.000 UZS from Oct 2026 ·
 * 7.000.000 UZS from Sep 2026" — each with a small remove, except when it is the only one left.
 * Nothing at all while there has been only one amount.
 */
export function IncomeHistoryLine({ history, onRemove, busyMonth }: {
  history: StableIncomeEntry[]
  onRemove: (entry: StableIncomeEntry) => void
  /** The entry being removed right now, so its × cannot be pressed twice. */
  busyMonth: string | null
}) {
  const { t, lang } = useLang()
  if (history.length < 2) return null
  const newestFirst = [...history].sort((a, b) => b.month.localeCompare(a.month))
  return (
    <ul className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs tabular-nums text-slate-500">
      {newestFirst.map((e, i) => {
        const text = t('fix.income.entry', { amount: moneyFull(e.amount), month: formatDate(e.month, lang, 'monthShort') })
        return (
          <li key={e.month} className="flex items-center gap-0.5">
            {i > 0 && <span aria-hidden="true" className="mr-1">·</span>}
            <span>{text}</span>
            <button
              type="button"
              onClick={() => onRemove(e)}
              disabled={busyMonth != null}
              aria-label={t('fix.income.remove', { amount: moneyFull(e.amount), month: formatDate(e.month, lang, 'monthShort') })}
              // 24px to look at; the pseudo-element makes the target 44px without growing the line.
              className="focus-ring relative inline-flex h-6 w-6 items-center justify-center rounded-chip text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 after:absolute after:-inset-2.5 after:content-['']"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
