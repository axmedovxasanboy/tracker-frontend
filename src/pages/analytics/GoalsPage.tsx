import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Target } from 'lucide-react'
import { BulletRow, scaleOf } from '../../components/analytics/BulletRow'
import { GoalCard, goalPercent } from '../../components/analytics/GoalCard'
import { SlotStrip, slotValues } from '../../components/analytics/MiniColumns'
import { Meter } from '../../components/analytics/Meter'
import { compact, SERIES_BG } from '../../components/analytics/shared'
import { Button } from '../../components/ui/Button'
import { IconChip } from '../../components/ui/IconChip'
import { Tile } from '../../components/ui/Tile'
import { useLang } from '../../i18n/LanguageContext'
import { formatMonth } from '../../utils/format'
import type { BreakdownGoal } from '../../types/analyticsBreakdown'
import { amountOf, Block, MiniCard, PageGrid, useAnalytics } from './common'
import type { PageProps } from './common'

/** Cards before the rest fold behind "Show all (n)" — and goals a 12-months mini names (§3.5). */
const FOLD_AFTER = 4

/** Plans by deadline, soonest first and none last, then wishes; ties by name (§3.5). */
function byPlanOrder(a: BreakdownGoal, b: BreakdownGoal): number {
  if (a.kind !== b.kind) return a.kind === 'PLAN' ? -1 : 1
  if (a.kind === 'PLAN' && a.deadline !== b.deadline) {
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return a.deadline.localeCompare(b.deadline)
  }
  return a.name.localeCompare(b.name)
}

/**
 * Page 5, Goals (§3.5): am I putting money into my plans and wishes, and is each one moving?
 *
 * Measured against what each plan asks — the owner set the plan — not against an average. One
 * card per plan and wish: where it stands, the month's put-in against asked, the effort in words,
 * and a column per month so a month with nothing put in shows as a gap. After four cards the rest
 * fold behind one button, so the page never grows past that.
 */
export function GoalsPage({ mode = 'month', size = 'full', onOpen }: PageProps) {
  const { t, lang } = useLang()
  const { d, month, thisMonth } = useAnalytics()
  const [showAll, setShowAll] = useState(false)
  // "Show all" goes away once pressed; focus moves on to the first card it revealed instead of
  // falling back to the top of the document (§5.7).
  const revealedRef = useRef<HTMLHeadingElement>(null)
  const [revealing, setRevealing] = useState(false)
  useEffect(() => {
    if (!revealing) return
    revealedRef.current?.focus()
    setRevealing(false)
  }, [revealing])

  const range = mode === 'range'
  // The month the cards speak of: the one on screen, or a range's last.
  const at = range ? d.to || month : month
  const inRange = new Set(d.months.map(m => m.month))
  const goals = [...d.goals].sort(byPlanOrder)
  // A goal is listed from its first month on; a month before it existed does not show it.
  const listed = goals.filter(g => g.months.some(m => (range ? inRange.has(m.month) : m.month === at)))
  const putInOf = (g: BreakdownGoal) => g.months
    .filter(m => (range ? inRange.has(m.month) : m.month === at))
    .reduce((s, m) => s + m.putIn, 0)

  if (size === 'mini') {
    const shown = listed.slice(0, FOLD_AFTER)
    return (
      <MiniCard section="goals" onOpen={listed.length > 0 ? onOpen : undefined}>
        {listed.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">{t('an.goals.empty')}</p>
        ) : (
          <ul className="mt-2">
            {shown.map(g => {
              const pct = goalPercent(g, g.months.find(m => m.month === at))
              return (
                <li key={g.refId} className="py-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-sm text-slate-700 [overflow-wrap:anywhere]">{g.name}</span>
                    <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">
                      {putInOf(g) > 0 ? t('an.goals.up', { amount: compact(putInOf(g)) }) : compact(0)}
                    </span>
                  </div>
                  {pct && (
                    <div className="mt-1 flex items-center gap-2">
                      <Meter value={pct.value} max={100} fillClass={SERIES_BG.goals} className="flex-1" />
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-600">{pct.text}</span>
                    </div>
                  )}
                </li>
              )
            })}
            {listed.length > shown.length && (
              <li className="pt-1 text-sm text-slate-600">{t('an.year.more', { count: listed.length - shown.length })}</li>
            )}
          </ul>
        )}
      </MiniCard>
    )
  }

  // A past month's answer only holds the goals that existed by then, so an empty list there means
  // "none yet in that month" — the owner may well have goals now (§3.5 states).
  if (d.goals.length === 0 && (range || month >= thisMonth)) {
    return (
      <PageGrid mode={mode}>
        <Block mode={mode}>
          <div className="flex items-start gap-3">
            <IconChip tone="indigo"><Target className="h-4 w-4" aria-hidden="true" /></IconChip>
            <div className="min-w-0 pt-1.5">
              <p className="text-sm text-slate-700">{t('an.goals.empty')}</p>
              <Link
                to="/savings"
                className="focus-ring -ml-2 mt-1 inline-flex min-h-[44px] items-center gap-1 rounded-control px-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                {t('an.goals.newOnSavings')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Block>
      </PageGrid>
    )
  }

  if (listed.length === 0) {
    return (
      <PageGrid mode={mode}>
        <Block mode={mode}>
          <p className="text-sm text-slate-700">{t('an.goals.noneInMonth', { month: formatMonth(at, lang) })}</p>
        </Block>
      </PageGrid>
    )
  }

  // The summary: money put into goals against what the plans asked. It equals the Goals group on
  // Set aside for the same month — the server counts both by the same rule.
  const putIn = listed.reduce((s, g) => s + putInOf(g), 0)
  // What the plans in force asked: the server's `asked` is already null for a wish and before a
  // plan's payments start, and a complete month's follows its snapshot — not today's kind (§4.3).
  const asked = listed.reduce((s, g) => s + g.months
    .filter(m => (range ? inRange.has(m.month) : m.month === at))
    .reduce((x, m) => x + (m.asked ?? 0), 0), 0)
  const byMonth = d.months.map(m => listed.reduce((s, g) => s + (g.months.find(x => x.month === m.month)?.putIn ?? 0), 0))
  // The 12-months sheet lists every goal — its mini already folded them (§3.6).
  const cards = range || showAll || listed.length <= FOLD_AFTER ? listed : listed.slice(0, FOLD_AFTER)

  return (
    <PageGrid mode={mode}>
      <Block mode={mode}>
        <BulletRow
          lead
          label={t('an.goals.putIn')}
          amount={amountOf(putIn, mode)}
          value={putIn}
          parts={[{ value: putIn, className: SERIES_BG.goals }]}
          expected={!range && asked > 0 ? asked : null}
          scale={scaleOf([putIn, asked])}
          captions={[asked > 0 ? t('an.goals.ofAsked', { amount: amountOf(asked, mode) }) : null]}
          strip={range
            ? <SlotStrip values={slotValues(byMonth, d.months)} max={Math.max(0, ...byMonth)} fillClass={SERIES_BG.goals} />
            : undefined}
        />
      </Block>

      {range ? (
        <div className="space-y-4">{cards.map(g => <GoalCard key={g.refId} goal={g} month={at} mode={mode} />)}</div>
      ) : (
        cards.map((g, i) => (
          <GoalCard
            key={g.refId}
            goal={g}
            month={at}
            mode={mode}
            headingRef={showAll && i === FOLD_AFTER ? revealedRef : undefined}
          />
        ))
      )}

      {cards.length < listed.length && (
        <Tile span={12} padding="none" className="p-1">
          <Button
            variant="ghost"
            className="w-full"
            label={t('an.goals.showAll', { count: listed.length })}
            onClick={() => { setShowAll(true); setRevealing(true) }}
          />
        </Tile>
      )}
    </PageGrid>
  )
}
