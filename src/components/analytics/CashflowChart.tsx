import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useLang } from '../../i18n/LanguageContext'
import { formatMonth, formatNumber } from '../../utils/format'
import type { BreakdownMonth } from '../../types/analyticsBreakdown'
import { monthAxis } from './figures'
import { compact, SERIES_BG } from './shared'

/** The plot's height in px; the axis band under it is extra, so the tile never scrolls. */
const PLOT = 208

/** The smallest 1 / 2 / 5 × 10ⁿ at or above `v` — a clean top for an axis. */
function niceCeil(v: number): number {
  if (!(v > 0)) return 0
  const p = 10 ** Math.floor(Math.log10(v))
  const f = v / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}

/**
 * Month by month as cash flow (2026-10-13 restyle, after the reference dashboards): one column per
 * month on ONE axis around zero — In rises above it, Out and then Set aside hang below it — so a
 * month whose lower column is longer than its upper one spent and set aside more than came in.
 * Left over is the difference, said in the tooltip and the table.
 *
 * The month in progress is faded and says "so far"; a month without entries is an empty slot that
 * says so (untracked is not zero). Hover or focus a month — the chart takes focus once and the
 * arrow keys step through the months — for its four figures. The sr-only table is its text.
 */
export function CashflowChart({ months }: { months: BreakdownMonth[] }) {
  const { t, lang } = useLang()
  const [active, setActive] = useState<number | null>(null)

  const up = niceCeil(months.reduce((m, x) => Math.max(m, x.tracked ? x.earned : 0), 0))
  const down = niceCeil(months.reduce((m, x) => Math.max(m, x.tracked ? Math.max(0, x.out) + Math.max(0, x.saved) : 0), 0))
  const range = up + down
  const px = (v: number) => (range > 0 ? (Math.max(0, v) / range) * PLOT : 0)
  const baseline = px(up)
  const tracked = months.map((m, i) => (m.tracked ? i : -1)).filter(i => i >= 0)

  const step = (e: KeyboardEvent<HTMLDivElement>) => {
    if (tracked.length === 0) return
    const at = active == null ? tracked[tracked.length - 1] : active
    const pos = tracked.indexOf(at)
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(tracked[Math.max(0, pos - 1)]) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setActive(tracked[Math.min(tracked.length - 1, pos + 1)]) }
    else if (e.key === 'Escape') setActive(null)
  }

  const shown = active != null ? months[active] : null
  const rows = shown ? [
    { key: 'in', label: t('shell.history.in'), value: shown.earned, fill: SERIES_BG.bonus },
    { key: 'out', label: t('shell.history.out'), value: shown.out, fill: SERIES_BG.everyday },
    { key: 'saved', label: t('fix.setAside'), value: shown.saved, fill: SERIES_BG.saved },
    { key: 'left', label: t('analytics.group.leftOver'), value: shown.leftOver, fill: null },
  ] : []

  return (
    <figure>
      <div
        className="focus-ring relative rounded-control outline-none"
        role="group"
        tabIndex={0}
        aria-label={t('an.year.chartLabel')}
        onKeyDown={step}
        // The latest month only for a keyboard arrival; a tap has already picked its month.
        onFocus={e => {
          const keyboard = e.currentTarget.matches(':focus-visible')
          setActive(a => a ?? (keyboard ? tracked[tracked.length - 1] ?? null : null))
        }}
        onBlur={() => setActive(null)}
        // A finger lifting fires pointerleave right after the tap; only a mouse leaving clears.
        onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null) }}
      >
        <div className="flex">
          {/* The y axis: the clean top, zero, and the clean bottom. */}
          <div aria-hidden="true" className="relative w-11 shrink-0 text-right text-[11px] tabular-nums text-slate-500" style={{ height: PLOT }}>
            {up > 0 && <span className="absolute right-2 top-0 -translate-y-1/2">{compact(up)}</span>}
            <span className="absolute right-2 -translate-y-1/2" style={{ top: baseline }}>0</span>
            {down > 0 && <span className="absolute bottom-0 right-2 translate-y-1/2">−{compact(down)}</span>}
          </div>
          <div className="relative min-w-0 flex-1" style={{ height: PLOT }}>
            <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-slate-100" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 border-t border-slate-100" />
            <div aria-hidden="true" className="absolute inset-x-0 z-[1] border-t border-slate-300" style={{ top: baseline }} />
            <div className="absolute inset-0 flex">
              {months.map((m, i) => {
                const outPx = px(m.out)
                const savedPx = px(m.saved)
                return (
                  <div
                    key={m.month}
                    className={`relative flex-1 rounded-control transition-colors ${active === i ? 'bg-slate-50' : ''}`}
                    onPointerEnter={() => setActive(m.tracked ? i : null)}
                  >
                    {!m.tracked ? (
                      <span aria-hidden="true" className="absolute left-1/2 top-2 -translate-x-1/2 text-[10px] leading-none text-slate-400 [writing-mode:vertical-rl] rotate-180">
                        {t('an.year.noEntries')}
                      </span>
                    ) : (
                      <div aria-hidden="true" className={`absolute inset-0 ${m.complete ? '' : 'opacity-60'}`}>
                        {m.earned > 0 && (
                          <div
                            className={`absolute left-1/2 w-[min(24px,55%)] -translate-x-1/2 rounded-t-[4px] ${SERIES_BG.bonus}`}
                            style={{ top: baseline - px(m.earned), height: px(m.earned) }}
                          />
                        )}
                        {outPx > 0 && (
                          <div
                            className={`absolute left-1/2 w-[min(24px,55%)] -translate-x-1/2 ${SERIES_BG.everyday} ${savedPx > 0 ? '' : 'rounded-b-[4px]'}`}
                            style={{ top: baseline, height: outPx }}
                          />
                        )}
                        {savedPx > 0 && (
                          <div
                            className={`absolute left-1/2 w-[min(24px,55%)] -translate-x-1/2 rounded-b-[4px] ${SERIES_BG.saved}`}
                            // The 2px surface gap between Out and Set aside comes out of Set aside.
                            style={{ top: baseline + outPx + (outPx > 0 ? 2 : 0), height: Math.max(1, savedPx - (outPx > 0 ? 2 : 0)) }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {shown && active != null && (
              <div
                aria-live="polite"
                className="pointer-events-none absolute top-1 z-10 w-48 rounded-control border border-hairline bg-white p-3 shadow-tile-hover"
                // Beside the month, but never past the plot's edge on a narrow screen.
                style={active < months.length / 2
                  ? { left: `min(calc(${((active + 1) / months.length) * 100}% + 4px), calc(100% - 12rem))` }
                  : { right: `min(calc(${((months.length - active) / months.length) * 100}% + 4px), calc(100% - 12rem))` }}
              >
                <p className="text-xs font-semibold text-slate-900">
                  {formatMonth(shown.month, lang)}{shown.complete ? '' : ` · ${t('an.year.soFar')}`}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {rows.map(r => (
                    <li key={r.key} className="flex items-center gap-2 text-xs">
                      <span aria-hidden="true" className={`h-0.5 w-3 shrink-0 rounded-full ${r.fill ?? 'bg-slate-400'}`} />
                      <span className="min-w-0 flex-1 text-slate-500">{r.label}</span>
                      <span className={`font-semibold tabular-nums ${r.value < 0 && shown.complete ? 'text-expense' : 'text-slate-900'}`}>{compact(r.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div aria-hidden="true" className="ml-11 mt-1.5 flex">
          {months.map(m => (
            <div key={m.month} className="min-w-0 flex-1 text-center">
              <span className="block truncate text-[11px] leading-tight text-slate-600">{monthAxis(m.month, lang)}</span>
              {m.tracked && !m.complete && <span className="block truncate text-[10px] leading-tight text-slate-400">{t('an.year.soFar')}</span>}
            </div>
          ))}
        </div>
      </div>
      <ul aria-hidden="true" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <li className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-[3px] ${SERIES_BG.bonus}`} />{t('shell.history.in')}</li>
        <li className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-[3px] ${SERIES_BG.everyday}`} />{t('shell.history.out')}</li>
        <li className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-[3px] ${SERIES_BG.saved}`} />{t('fix.setAside')}</li>
      </ul>
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
