import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'
import { formatNumber } from '../../utils/format'
import type { BreakdownLine, BreakdownMonth, LineHistory } from '../../types/analyticsBreakdown'
import { BulletRow, HATCH_MUTED, TextRow, vsExpected } from './BulletRow'
import type { BarPart } from './BulletRow'
import { OUT_ROWS_BEFORE_SMALLER } from './decisions'
import { dayWord, historyHref, lineDrawn, lineLabel, rankLines } from './figures'
import type { LineMode } from './figures'
import { SlotStrip, slotValues } from './MiniColumns'
import { compact, SERIES_BG } from './shared'

/** The fill of an Out line, by what kind of money it is (R14): everyday, bill, loan, or a check. */
export function outParts(line: BreakdownLine): BarPart[] {
  if (line.key === 'unitemised' || line.kind === 'NOT_ITEMISED' || line.kind === 'CHECK') {
    return [{ value: line.amount, className: HATCH_MUTED }]
  }
  if (line.key === 'loans' || line.kind === 'LOAN') return [{ value: line.amount, className: SERIES_BG.loans }]
  if (line.kind === 'BILL') return [{ value: line.amount, className: SERIES_BG.bills }]
  if (line.everyday != null || line.bills != null) {
    return [
      { value: Math.max(0, line.everyday ?? 0), className: SERIES_BG.everyday },
      { value: line.bills ?? 0, className: SERIES_BG.bills },
    ]
  }
  return [{ value: line.amount, className: SERIES_BG.everyday }]
}

/** The strip's colour in a range: the first segment's. */
const stripFill = (line: BreakdownLine) => outParts(line)[0]?.className ?? SERIES_BG.everyday

/**
 * The History filter a line's child opens (§3.3): exactly the one the server sent — category →
 * `categoryId`, bill → `flow=BILL&categoryId=`, loan → `flow=LOAN_PAYMENT`, wallet-check day →
 * `from=D&to=D&walletCheck=1` — and none where no filter selects exactly the child's rows (§4.3):
 * two loans paid in one month share `flow=LOAN_PAYMENT`, so neither links, and a loan paid off at 0
 * never opens another loan's payments. The group's "All in History" still lists them all. Null in
 * a range.
 */
function childFilter(child: BreakdownLine, mode: LineMode): LineHistory | null {
  return mode === 'month' ? child.history : null
}

/**
 * The Out page's list (§3.3) — and its 12-months sheet: one ranked row per line that adds up to
 * Out, each a disclosure. Opened, a row shows its exact amount, then its sub-categories, bills,
 * loans or check days, its three largest everyday entries, and "All in History" (hidden when no
 * History filter selects exactly its rows). Rows after the first eight fold into "Smaller (n)".
 *
 * Month mode: compact figures and the bullet bar against expected, ordered by expected when the
 * month has a base. Range mode: exact totals, "a month" and a month-by-month strip, by size.
 */
export function LineList({ lines, mode, base, open, month, months, scale, paidOff = 0 }: {
  lines: BreakdownLine[]
  mode: LineMode
  /** The month has an expected block. */
  base: boolean
  /** The month is in progress. */
  open: boolean
  /** The month History links open (a range has none). */
  month: string
  /** A range: the months the strips align with. */
  months: BreakdownMonth[]
  /** The page's one scale. */
  scale: number
  /** `expected.paidOffLoans`, for the Loan payments row. */
  paidOff?: number
}) {
  const { t, lang, categoryName } = useLang()
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const toggle = (key: string) => setOpened(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const drawn = rankLines(lines.filter(l => lineDrawn(l, mode)), base, mode)
  // "Smaller (1)" would be a row standing in for one row: fold only two or more.
  const fold = drawn.length - OUT_ROWS_BEFORE_SMALLER >= 2
  const head = fold ? drawn.slice(0, OUT_ROWS_BEFORE_SMALLER) : drawn
  const rest = fold ? drawn.slice(OUT_ROWS_BEFORE_SMALLER) : []
  const stripMax = mode === 'range'
    ? drawn.reduce((max, l) => Math.max(max, ...l.byMonth), 0)
    : 0

  const label = (line: BreakdownLine) => {
    const name = lineLabel(line, t, categoryName, lang)
    if (line.key === 'unitemised' || line.kind === 'NOT_ITEMISED') return `${name} · ${t('analytics.b.notItemisedHint')}`
    // A category that is all bill says so after its name; one with both parts says it below.
    if (line.kind === 'CATEGORY' && (line.bills ?? 0) > 0 && (line.everyday ?? 0) <= 0) {
      return `${name} · ${t('analytics.d.kind.bill')}`
    }
    if (line.kind === 'BILL') return `${name} · ${t('analytics.d.kind.bill')}`
    return name
  }

  const captions = (line: BreakdownLine) => {
    const bills = line.kind === 'CATEGORY' && (line.bills ?? 0) > 0 && (line.everyday ?? 0) > 0
      ? t('an.inclBills', { amount: compact(line.bills ?? 0) })
      : null
    if (mode === 'range') {
      return [line.average != null ? t('an.year.aMonth', { amount: compact(line.average) }) : null, bills]
    }
    return [
      vsExpected(t, {
        soFar: line.amount,
        expected: line.expected,
        open,
        isNew: line.isNew,
        closed: line.closed,
        paidOff: line.key === 'loans' ? paidOff : 0,
      }),
      bills,
    ]
  }

  const panel = (line: BreakdownLine) => {
    const children = rankLines(line.children.filter(c => lineDrawn(c, mode)), base, mode)
    const filter = mode === 'month' ? line.history : null
    return (
      <div className="mb-2 ml-1 border-l-2 border-slate-100 pl-3">
        {children.map(c => {
          const f = childFilter(c, mode)
          return (
            <TextRow
              key={c.key}
              label={label(c)}
              amount={mode === 'range' ? formatNumber(c.amount) : compact(c.amount)}
              caption={mode === 'range'
                ? (c.average != null ? t('an.year.aMonth', { amount: compact(c.average) }) : null)
                : vsExpected(t, { soFar: c.amount, expected: c.expected, open, isNew: c.isNew, closed: c.closed })}
              to={f ? historyHref(month, f) : null}
            />
          )
        })}
        {/* The three largest itemised everyday entries; bills are already listed above them. */}
        {line.top.map(e => (
          <TextRow
            key={`top-${e.id}`}
            label={`${e.description || '—'} · ${dayWord(e.date, lang)}`}
            amount={mode === 'range' ? formatNumber(e.amount) : compact(e.amount)}
            to={e.date ? historyHref(e.date.slice(0, 7), { from: e.date, to: e.date, search: e.description }) : null}
          />
        ))}
        {filter && (
          <Link
            to={historyHref(month, filter)}
            className="focus-ring -ml-2 mt-0.5 inline-flex min-h-[44px] items-center gap-1 rounded-control px-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            {t('an.allInHistory')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    )
  }

  const row = (line: BreakdownLine) => {
    const isOpen = opened.has(line.key)
    return (
      <li key={line.key}>
        <BulletRow
          label={label(line)}
          // The exact figure appears once, on demand: in the opened row's own header.
          amount={mode === 'range' || isOpen ? formatNumber(line.amount) : compact(line.amount)}
          value={line.amount}
          parts={outParts(line)}
          expected={mode === 'month' && !line.isNew && !line.closed ? line.expected : null}
          scale={scale}
          captions={captions(line)}
          negative={open ? 'slate' : 'rose'}
          onToggle={() => toggle(line.key)}
          expanded={isOpen}
          strip={mode === 'range'
            ? <SlotStrip values={slotValues(line.byMonth, months)} max={stripMax} fillClass={stripFill(line)} />
            : undefined}
        />
        {isOpen && panel(line)}
      </li>
    )
  }

  const smallerOpen = opened.has('smaller')
  const smallerAmount = rest.reduce((s, l) => s + l.amount, 0)
  const smallerParts: BarPart[] = rest.flatMap(outParts)
  // Where its tick goes: the sum of its rows' own ticks. Not printed as a figure — a total on
  // screen comes from `expected.flow`, never from line expecteds added up (§1.2).
  const smallerTick = mode === 'month' && base
    ? rest.reduce((s, l) => s + (l.isNew || l.closed ? 0 : l.expected ?? 0), 0)
    : null

  return (
    <ul className="mt-2 space-y-0.5">
      {head.map(row)}
      {fold && (
        <li>
          <BulletRow
            label={t('an.smaller', { count: rest.length })}
            amount={mode === 'range' || smallerOpen ? formatNumber(smallerAmount) : compact(smallerAmount)}
            value={smallerAmount}
            parts={smallerParts}
            expected={smallerTick}
            scale={scale}
            captions={[rest.map(l => lineLabel(l, t, categoryName, lang)).join(', ')]}
            negative={open ? 'slate' : 'rose'}
            onToggle={() => toggle('smaller')}
            expanded={smallerOpen}
            strip={mode === 'range'
              ? <SlotStrip
                  values={slotValues(months.map((_, i) => rest.reduce((s, l) => s + (l.byMonth[i] ?? 0), 0)), months)}
                  max={stripMax}
                  fillClass={SERIES_BG.everyday}
                />
              : undefined}
          />
          {smallerOpen && <ul className="ml-1 space-y-0.5 border-l-2 border-slate-100 pl-3">{rest.map(row)}</ul>}
        </li>
      )}
    </ul>
  )
}
