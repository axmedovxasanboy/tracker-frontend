import { BulletRow, scaleOf, TextRow, vsExpected } from '../../components/analytics/BulletRow'
import { capFirst, historyHref, isOpenMonth, lineDrawn, lineLabel, monthFrom, rankLines } from '../../components/analytics/figures'
import { SlotStrip, slotValues } from '../../components/analytics/MiniColumns'
import { compact, SERIES_BG } from '../../components/analytics/shared'
import { useLang } from '../../i18n/LanguageContext'
import type { BreakdownLine } from '../../types/analyticsBreakdown'
import { amountOf, Block, MiniCard, MiniRow, PageGrid, useAnalytics } from './common'
import type { PageProps } from './common'

/** The four destinations, always in this order (§3.4), each with its own colour (R14). */
const GROUPS = [
  { key: 'group:INVESTMENTS', fill: SERIES_BG.investments },
  { key: 'group:EMERGENCY', fill: SERIES_BG.emergency },
  { key: 'group:GOALS', fill: SERIES_BG.goals },
  { key: 'group:DONATIONS', fill: SERIES_BG.given },
] as const

/**
 * Page 4, Set aside (§3.4): how much went aside this month (donations included), where it went,
 * whether anything came back out — and, apart from the month, how much has gone aside since the
 * start and what the holdings are worth now.
 *
 * Two figures are kept apart on purpose: what was put in (a flow, since the start, never netted
 * against what came out) and what it is worth (a stock, which also holds money from before the
 * start and growth). "Asked" is not drawn here: one reference per bar.
 */
export function SetAsidePage({ mode = 'month', size = 'full', onOpen }: PageProps) {
  const { t, lang, categoryName } = useLang()
  const { d, month } = useAnalytics()

  const range = mode === 'range'
  const f = range ? d.total : d.months[d.months.length - 1] ?? d.total
  const open = !range && isOpenMonth(d)
  const base = !range && d.expected != null
  const groups = GROUPS
    .map(g => ({ ...g, line: d.setAside.find(l => l.key === g.key) }))
    .filter((g): g is typeof g & { line: BreakdownLine } => !!g.line)
  // Drawn when it has money in it, or money is expected of it (§4.3) — a range: when it had any.
  const drawn = groups.filter(g => range
    ? g.line.amount !== 0
    : g.line.amount !== 0 || (g.line.expected ?? 0) > 0)

  if (size === 'mini') {
    const max = Math.max(0, ...groups.flatMap(g => g.line.byMonth))
    return (
      <MiniCard section="set-aside" total={d.total.saved} onOpen={onOpen}>
        <ul className="mt-2">
          {groups.map(g => (
            <MiniRow
              key={g.key}
              label={lineLabel(g.line, t, categoryName, lang)}
              amount={g.line.amount}
              months={d.months.length}
              strip={<SlotStrip values={slotValues(g.line.byMonth, d.months)} max={max} fillClass={g.fill} />}
            />
          ))}
        </ul>
      </MiniCard>
    )
  }

  const e = range ? null : d.expected?.flow ?? null
  const scale = scaleOf([f.saved, e?.saved, ...drawn.flatMap(g => [g.line.amount, g.line.expected])])
  const stripMax = Math.max(0, ...groups.flatMap(g => g.line.byMonth))

  // Taken back out of savings: per holding, never netted against what went in.
  const fromSavings = d.moved.find(l => l.flow === 'FROM_SAVINGS' || l.key === 'moved:FROM_SAVINGS')

  const childLabel = (c: BreakdownLine) => lineLabel(c, t, categoryName, lang)

  return (
    <PageGrid mode={mode}>
      <Block mode={mode}>
        <BulletRow
          lead
          label={t('fix.setAside')}
          amount={amountOf(f.saved, mode)}
          value={f.saved}
          parts={groups.map(g => ({ value: g.line.amount, className: g.fill }))}
          expected={e?.saved ?? null}
          scale={scale}
          captions={range
            ? [d.average ? t('an.year.aMonth', { amount: compact(d.average.flow.saved) }) : null]
            : [vsExpected(t, { soFar: f.saved, expected: e?.saved ?? null, open })]}
          strip={range
            ? <SlotStrip values={slotValues(d.months.map(x => x.saved), d.months)} max={Math.max(0, ...d.months.map(x => x.saved))} fillClass={SERIES_BG.investments} />
            : undefined}
        />
      </Block>

      <Block mode={mode} span={7} mdSpan={6} title={t('shell.history.whereItWent')}>
        <ul className="mt-2 space-y-0.5">
          {drawn.map(g => (
            <li key={g.key}>
              <BulletRow
                label={lineLabel(g.line, t, categoryName, lang)}
                amount={amountOf(g.line.amount, mode)}
                value={g.line.amount}
                parts={[{ value: g.line.amount, className: g.fill }]}
                expected={!range && !g.line.isNew ? g.line.expected : null}
                scale={scale}
                captions={[range
                  ? (g.line.average != null ? t('an.year.aMonth', { amount: compact(g.line.average) }) : null)
                  : vsExpected(t, { soFar: g.line.amount, expected: g.line.expected, open, isNew: g.line.isNew })]}
                strip={range
                  ? <SlotStrip values={slotValues(g.line.byMonth, d.months)} max={stripMax} fillClass={g.fill} />
                  : undefined}
              />
              {/* Where in the group it went: a text row each — the group's bar is the picture. */}
              <div className="ml-1 border-l-2 border-slate-100 pl-3">
                {rankLines(g.line.children.filter(c => lineDrawn(c, mode)), base, mode).map(c => (
                  <TextRow
                    key={c.key}
                    label={childLabel(c)}
                    amount={amountOf(c.amount, mode)}
                    caption={!range && c.isNew ? t('an.new') : null}
                    to={!range && c.history ? historyHref(month, c.history) : null}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
        {fromSavings && fromSavings.amount !== 0 ? (
          <div className="mt-3 border-t border-hairline pt-3">
            <TextRow
              label={<span className="font-medium">{t('an.fromSavings')}</span>}
              amount={amountOf(fromSavings.amount, mode)}
              to={!range ? historyHref(month, fromSavings.history ?? { flow: 'FROM_SAVINGS' }) : null}
            />
            <div className="ml-1 border-l-2 border-slate-100 pl-3">
              {fromSavings.children.filter(c => c.amount !== 0).map(c => (
                <TextRow
                  key={c.key}
                  // Per holding; money taken out with no holding behind it is just "Savings".
                  label={c.key.startsWith('holding:') && c.name ? childLabel(c) : t('shell.nav.savings')}
                  amount={amountOf(c.amount, mode)}
                  to={!range && c.history ? historyHref(month, c.history) : null}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">{t('an.nothingFromSavings')}</p>
        )}
      </Block>

      <SinceStartBlock mode={mode} monthSaved={f.saved} />
    </PageGrid>
  )
}

/**
 * The same on every month's page (§3.4): Set aside since the history start, to TODAY — gross, its
 * four parts, and "From savings since …" beside it only when something came back out — then what
 * the holdings are worth now, with the note that the worth also holds older money and growth.
 * Compact on a month page, exact in the 12-months sheet (§3.0), like every other figure there.
 */
function SinceStartBlock({ mode, monthSaved }: { mode: 'month' | 'range'; monthSaved: number }) {
  const { t, lang } = useLang()
  const { d } = useAnalytics()
  const since = d.sinceStart
  const parts = GROUPS
    .map(g => d.setAside.find(l => l.key === g.key))
    .filter((l): l is BreakdownLine => !!l && (l.sinceStart ?? 0) !== 0)
  const worth = d.holdingsNow.reduce((s, h) => s + h.value, 0)
  // Holdings worth nothing (a goal just created) are left out of the list, so a list of only those
  // is no Worth now at all (§5.6).
  const holdings = d.holdingsNow.filter(h => h.value !== 0)
  if (!since && holdings.length === 0) return null

  const from = since ? monthFrom(since.from, lang) : null
  // Inside a sheet the sheet's own title is the h2.
  const Heading = mode === 'range' ? 'h3' : 'h2'
  // The first month, viewed while it runs: the total would be this month's figure again.
  const sameAsMonth = since != null && mode === 'month' && since.setAside === monthSaved && since.fromSavings === 0

  return (
    <Block mode={mode} span={5} mdSpan={6}>
      {since && from && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <Heading className="min-w-0 text-title text-slate-900 [overflow-wrap:anywhere]">{capFirst(t('an.sinceStart', { month: from }))}</Heading>
            {!sameAsMonth && (
              <span className="shrink-0 whitespace-nowrap text-stat tabular-nums text-slate-900">{amountOf(since.setAside, mode)}</span>
            )}
          </div>
          {parts.length > 0 && (
            <p className="mt-1 text-sm leading-snug text-slate-600 tabular-nums [overflow-wrap:anywhere]">
              {parts.map(l => `${t(GROUP_NAME[l.key] ?? 'fix.setAside')} ${amountOf(l.sinceStart ?? 0, mode)}`).join(' · ')}
            </p>
          )}
          {since.fromSavings !== 0 && (
            <p className="mt-1 text-sm text-slate-600 tabular-nums">
              {capFirst(t('an.sinceStartOut', { month: from, amount: amountOf(since.fromSavings, mode) }))}
            </p>
          )}
        </>
      )}
      {holdings.length > 0 && (
        <div className={since ? 'mt-4 border-t border-hairline pt-4' : ''}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">{t('an.worthNow')}</h3>
            <span className="shrink-0 whitespace-nowrap text-title tabular-nums text-slate-900">{amountOf(worth, mode)}</span>
          </div>
          <p className="mt-1 text-sm leading-snug text-slate-600 tabular-nums [overflow-wrap:anywhere]">
            {holdings
              .map(h => `${h.refId == null ? t('an.emergencyNoAccount') : h.name} ${amountOf(h.value, mode)}`)
              .join(' · ')}
          </p>
          {from && <p className="mt-1 text-xs text-slate-500">{capFirst(t('an.worthNote', { month: from }))}</p>}
        </div>
      )}
    </Block>
  )
}

const GROUP_NAME: Partial<Record<string, 'an.group.INVESTMENTS' | 'an.group.EMERGENCY' | 'an.group.GOALS' | 'an.group.DONATIONS'>> = {
  'group:INVESTMENTS': 'an.group.INVESTMENTS',
  'group:EMERGENCY': 'an.group.EMERGENCY',
  'group:GOALS': 'an.group.GOALS',
  'group:DONATIONS': 'an.group.DONATIONS',
}
