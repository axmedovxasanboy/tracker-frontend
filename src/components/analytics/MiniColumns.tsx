import { useLang } from '../../i18n/LanguageContext'
import { formatMonth, formatNumber } from '../../utils/format'
import type { BreakdownMonth } from '../../types/analyticsBreakdown'
import { monthAxis } from './figures'
import { HATCH, SERIES_BG } from './shared'

/**
 * A row's months as small multiples (§3.6): one fixed 8px slot per `months[]` entry, left-aligned,
 * on the scale the caller shares across its card so the rows compare. A tracked month at nothing
 * is a 1px baseline; an untracked month is an empty slot with none — untracked is not zero (§1.2).
 * Decorative: the row's text and the Open sheet carry the numbers.
 */
export function SlotStrip({ values, max, fillClass }: {
  /** One per `months[]` entry; null for a month with no entries at all. */
  values: Array<number | null>
  max: number
  fillClass: string
}) {
  return (
    <span aria-hidden="true" className="flex h-4 items-end gap-0.5">
      {values.map((v, i) => (
        <span key={i} className="flex h-full w-2 shrink-0 items-end">
          {v == null ? null : v > 0 && max > 0 ? (
            <span className={`w-full rounded-t-[2px] ${fillClass}`} style={{ height: `${Math.max(12, Math.min(100, (v / max) * 100))}%` }} />
          ) : (
            <span className="h-px w-full bg-slate-300" />
          )}
        </span>
      ))}
    </span>
  )
}

/** A line's `byMonth`, with the months that have no entries at all as gaps. */
export function slotValues(byMonth: number[], months: BreakdownMonth[]): Array<number | null> {
  return months.map((m, i) => (m.tracked ? byMonth[i] ?? 0 : null))
}

/**
 * Month by month (§3.6): one stacked column per month — Out, Set aside, then Left over hatched —
 * so a column's top is In. When Left over is negative the column outgrows In and an ink tick marks
 * where In stands. The month in progress is faded and says "so far"; a month without entries is an
 * empty slot that says so. Read-only: a slot is about 30px wide at twelve months, under the touch
 * floor, so a month is opened with the picker instead. The table after it is its text.
 */
export function MonthColumns({ months }: { months: BreakdownMonth[] }) {
  const { t, lang } = useLang()
  const scale = months.reduce((max, m) =>
    Math.max(max, m.earned, Math.max(0, m.out) + Math.max(0, m.saved) + Math.max(0, m.leftOver)), 0)
  const h = (v: number) => `${scale > 0 ? Math.max(0, (v / scale) * 100) : 0}%`

  return (
    <figure>
      <div aria-hidden="true">
        <div className="flex h-32 items-end gap-0.5 border-b border-slate-200">
          {months.map(m => (
            <div key={m.month} className="relative flex h-full max-w-[24px] flex-1 flex-col justify-end">
              {!m.tracked ? (
                <span className="mx-auto mb-1 text-[10px] leading-none text-slate-500 [writing-mode:vertical-rl] rotate-180">
                  {t('an.year.noEntries')}
                </span>
              ) : (
                <>
                  <div className={`flex flex-col-reverse ${m.complete ? '' : 'opacity-50'}`} style={{ height: h(Math.max(0, m.out) + Math.max(0, m.saved) + Math.max(0, m.leftOver)) }}>
                    <div className={SERIES_BG.everyday} style={{ flexGrow: Math.max(0, m.out) }} />
                    <div className={SERIES_BG.investments} style={{ flexGrow: Math.max(0, m.saved) }} />
                    <div className={`rounded-t-[2px] ${HATCH}`} style={{ flexGrow: Math.max(0, m.leftOver) }} />
                  </div>
                  {m.leftOver < 0 && (
                    <div className="absolute inset-x-0 h-0.5 bg-slate-900" style={{ bottom: h(m.earned) }} />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-0.5">
          {months.map(m => (
            <div key={m.month} className="relative max-w-[24px] flex-1 text-center">
              <span className="block text-[11px] leading-tight text-slate-600">{monthAxis(m.month, lang)}</span>
              {!m.complete && m.tracked && (
                <span className="absolute right-0 top-full whitespace-nowrap text-[10px] leading-tight text-slate-500">
                  {t('an.year.soFar')}
                </span>
              )}
            </div>
          ))}
        </div>
        {months.some(m => !m.complete && m.tracked) && <div className="h-3" />}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <li className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-[3px] ${SERIES_BG.everyday}`} />{t('shell.history.out')}</li>
          <li className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-[3px] ${SERIES_BG.investments}`} />{t('fix.setAside')}</li>
          <li className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-[3px] ${HATCH}`} />{t('analytics.group.leftOver')}</li>
        </ul>
      </div>
      <table className="sr-only">
        <caption>{t('an.year.monthByMonth')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('an.table.month')}</th>
            <th scope="col">{t('shell.history.in')}</th>
            <th scope="col">{t('shell.history.out')}</th>
            <th scope="col">{t('fix.setAside')}</th>
            <th scope="col">{t('analytics.group.leftOver')}</th>
          </tr>
        </thead>
        <tbody>
          {months.map(m => (
            <tr key={m.month}>
              <th scope="row">
                {formatMonth(m.month, lang)}
                {!m.tracked ? ` (${t('an.year.noEntries')})` : !m.complete ? ` (${t('an.year.soFar')})` : ''}
              </th>
              <td>{m.tracked ? formatNumber(m.earned) : ''}</td>
              <td>{m.tracked ? formatNumber(m.out) : ''}</td>
              <td>{m.tracked ? formatNumber(m.saved) : ''}</td>
              <td>{m.tracked ? formatNumber(m.leftOver) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
