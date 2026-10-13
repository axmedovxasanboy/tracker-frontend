import type { ReactNode, RefObject } from 'react'
import { Link } from 'react-router-dom'
import { Target } from 'lucide-react'
import { Tile } from '../ui/Tile'
import { Badge, IconChip } from '../ui/IconChip'
import { useLang } from '../../i18n/LanguageContext'
import { formatMonth, formatNumber } from '../../utils/format'
import type { BreakdownGoal, GoalMonth } from '../../types/analyticsBreakdown'
import { capFirst, historyHref, monthAxis, monthFrom, monthWord } from './figures'
import { FigureInfo } from './Info'
import type { LineMode } from './figures'
import { Meter } from './Meter'
import { compact, SERIES_BG } from './shared'

/** At most this many months of put-in columns on a card. */
const COLUMNS = 12

/** A card's figures: compact on the Goals page, exact in the 12-months sheet (§3.0). */
const amountIn = (mode: LineMode) => (value: number) => (mode === 'range' ? formatNumber(value) : compact(value))

/**
 * Where a goal stands at the end of `month` — reached ÷ target, "≈" when the past cannot be
 * rebuilt exactly — as a whole-number percentage. Null without a target.
 */
export function goalPercent(goal: BreakdownGoal, gm: GoalMonth | undefined): { text: string; value: number } | null {
  if (!goal.target || goal.target <= 0) return null
  const reached = gm?.reachedEnd ?? goal.valueNow
  const value = (reached / goal.target) * 100
  const whole = Math.round(value)
  return { text: `${gm?.approximate ? '≈' : ''}${formatNumber(whole)}%`, value }
}

/**
 * The effort in `month`, in words and never a glyph (§3.5): "+1 M put in", "1 M from savings"
 * (both may show), else "Nothing put in since {month}" or "Nothing put in yet". It speaks of
 * money put in, not of the value: an addition with no entry has no date, so "unchanged" could not
 * be known.
 */
export function useGoalStatus() {
  const { t, lang } = useLang()
  return (goal: BreakdownGoal, month: string, mode: LineMode = 'month'): string => {
    const amount = amountIn(mode)
    const gm = goal.months.find(m => m.month === month)
    const said: string[] = []
    if (gm && gm.putIn > 0) said.push(t('an.goals.up', { amount: amount(gm.putIn) }))
    if (gm && gm.takenOut > 0) said.push(t('an.goals.fromSavings', { amount: amount(gm.takenOut) }))
    if (said.length > 0) return said.join(' · ')
    // The last month up to the one on screen with money put in — not a later one.
    const last = [...goal.months].reverse().find(m => m.month <= month && m.putIn > 0)?.month
      ?? (goal.lastPutIn && goal.lastPutIn <= month ? goal.lastPutIn : null)
    return last ? t('an.goals.since', { month: monthFrom(last, lang) }) : t('an.goals.nothingYet')
  }
}

/**
 * One plan or wish (§3.5): where it is (a progress bar of reached ÷ target), what the month asked
 * and got, the effort in words, and a small column per month of money put in against a dashed
 * "asked" — a gap is a month with nothing put in, visible without a word. Restyled 2026-10-13 as a
 * saving-plan card (the reference the owner picked): the icon, the reached figure large with its
 * target beside it, a thicker bar with its percentage. Three to a row on a wide screen.
 */
export function GoalCard({ goal, month, mode = 'month', headingRef, info }: {
  goal: BreakdownGoal
  /** The month the card speaks of (the last month of a range). */
  month: string
  mode?: LineMode
  /**
   * Makes the heading focusable from script (tabIndex -1): "Show all" hands focus to the first card
   * it reveals, since the button itself goes away.
   */
  headingRef?: RefObject<HTMLHeadingElement>
  /**
   * A month page's "!" (2026-10-13): given the card's details, returns the button that shows them.
   * With it the card keeps to its name, figure and bar; without it (the 12-months sheet) the month
   * line stays on the card.
   */
  info?: (content: ReactNode) => ReactNode
}) {
  const { t, lang } = useLang()
  const status = useGoalStatus()
  const amount = amountIn(mode)
  const gm = goal.months.find(m => m.month === month)
  const pct = goalPercent(goal, gm)
  const reached = gm?.reachedEnd ?? goal.valueNow
  const href = gm?.history ? historyHref(month, gm.history) : null
  const kind = goal.kind === 'WISH' ? t('fix.goal.kind.wish') : t('fix.goal.kind.plan')
  const badge = goal.kind === 'PLAN' && goal.deadline
    ? `${kind} · ${t('an.goals.by', { month: formatMonth(goal.deadline, lang) })}`
    : kind
  // The server's `asked` is the plan in force THAT month — a complete month's comes from its
  // snapshot, so a goal that is a wish today may still have asked something then (§4.3). Null is
  // a wish then, or a month before the plan's payments start.
  const asked = gm?.asked != null
    ? t('an.goals.putOfAsked', { putIn: amount(gm.putIn), asked: amount(gm.asked) })
    : `${amount(gm?.putIn ?? 0)} · ${t('an.goals.asksNothing')}`

  const shown = goal.months.filter(m => m.month <= month).slice(-COLUMNS)
  const peak = shown.reduce((max, m) => Math.max(max, m.putIn, m.asked ?? 0), 0)

  const monthLine = `${capFirst(t('an.goals.month', { month: monthWord(month, lang), amount: asked }))} · ${status(goal, month, mode)}`
  const details = info?.(
    <FigureInfo amount={reached} lines={[
      badge,
      goal.target ? t('an.goals.of', { value: amount(reached), target: amount(goal.target) }) : null,
      monthLine,
      // Month by month: what went in against what was asked.
      ...shown.filter(m => m.month !== month).reverse().map(m => capFirst(t('an.goals.month', {
        month: monthWord(m.month, lang),
        amount: m.asked != null
          ? t('an.goals.putOfAsked', { putIn: amount(m.putIn), asked: amount(m.asked) })
          : amount(m.putIn),
      }))),
    ]} />,
  )

  return (
    <Tile span={4} mdSpan={3} as="article" className="self-stretch">
      <div className="flex items-start gap-3">
        <IconChip tone="indigo"><Target className="h-4 w-4" aria-hidden="true" /></IconChip>
        <div className="min-w-0 flex-1">
          <h3
            ref={headingRef}
            tabIndex={headingRef ? -1 : undefined}
            className={`min-w-0 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere] ${headingRef ? 'focus-ring rounded-chip' : ''}`}
          >
            {href ? (
              <Link to={href} className="focus-ring -mx-1 -my-2.5 inline-flex min-h-[44px] items-center rounded-chip px-1 hover:underline">
                {goal.name}
              </Link>
            ) : goal.name}
          </h3>
          <div className="mt-1"><Badge>{badge}</Badge></div>
        </div>
        {details}
      </div>

      <p className="mt-4">
        <span aria-hidden="true" className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-title text-slate-900">{amount(reached)}</span>
          {goal.target != null && goal.target > 0 && (
            <span className="text-sm tabular-nums text-slate-500">/ {amount(goal.target)}</span>
          )}
        </span>
        <span className="sr-only">
          {goal.target ? t('an.goals.of', { value: amount(reached), target: amount(goal.target) }) : amount(reached)}
        </span>
      </p>
      {pct && (
        <div className="mt-2 flex items-center gap-3">
          <Meter value={reached} max={goal.target ?? 0} fillClass={SERIES_BG.goals} className="flex-1" />
          <span className="shrink-0 rounded-chip bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-indigo-700">{pct.text}</span>
        </div>
      )}
      {!details && (
        <p className="mt-1 text-xs leading-snug text-slate-600 tabular-nums [overflow-wrap:anywhere]">{monthLine}</p>
      )}

      {shown.length > 0 && peak > 0 && (
        <div className="mt-3">
          <div aria-hidden="true" className="flex h-10 items-end gap-1 border-b border-slate-200">
            {shown.map(m => (
              <div key={m.month} className="relative h-full w-4 shrink-0">
                {m.putIn > 0 && (
                  <div
                    className={`absolute inset-x-0 bottom-0 rounded-t-[2px] ${SERIES_BG.goals}`}
                    style={{ height: `${Math.max(8, (m.putIn / peak) * 100)}%` }}
                  />
                )}
                {m.asked != null && m.asked > 0 && (
                  <div
                    className="absolute -inset-x-0.5 border-t border-dashed border-slate-500"
                    style={{ bottom: `${(m.asked / peak) * 100}%` }}
                  />
                )}
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="mt-0.5 flex justify-between text-[10px] text-slate-500" style={{ width: `${shown.length * 20 - 4}px`, minWidth: '2.5rem' }}>
            <span>{monthAxis(shown[0].month, lang)}</span>
            {shown.length > 1 && <span>{monthAxis(shown[shown.length - 1].month, lang)}</span>}
          </div>
          <ul className="sr-only">
            {shown.map(m => (
              <li key={m.month}>
                {t('an.goals.month', {
                  month: formatMonth(m.month, lang),
                  amount: m.asked != null
                    ? t('an.goals.putOfAsked', { putIn: formatNumber(m.putIn), asked: formatNumber(m.asked) })
                    : formatNumber(m.putIn),
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Tile>
  )
}
