import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'
import { formatNumber } from '../../utils/format'
import { monthWord } from './figures'
import { compact } from './shared'

/** Under this many percent a change is "about the same" — a grey chip, no arrow. */
const SAME_PCT = 1

const TONE = {
  good: 'bg-emerald-50 text-income',
  bad: 'bg-rose-50 text-expense',
  neutral: 'bg-slate-100 text-slate-600',
} as const

/**
 * A headline figure against the month before (owner, 2026-10-13: "vs last month", like the
 * reference dashboards, with "expected" kept in the caption under it).
 *
 * - A complete month: "▲ 12% vs September" — green when up is good for this figure, rose when it
 *   is not; a percentage only while both months are above zero, else the difference itself
 *   ("▲ 2 M vs September": Left over can change sign). Under 1% it is "≈ vs September", grey.
 * - A month in progress: "36% of September", grey and without an arrow — a month still running
 *   is never called down on its whole predecessor.
 *
 * The chip is the visible half; a screen reader hears the whole sentence. Null when there is no
 * month before to compare with.
 */
export function DeltaBadge({ value, previous, prevMonth, open, upIsGood = true }: {
  value: number
  /** The same figure for the month before; null when it has no entries or is before the start. */
  previous: number | null | undefined
  /** YYYY-MM of `previous`. */
  prevMonth: string
  /** The month on screen is still running. */
  open: boolean
  /** In, Set aside, Left over: true. Out: false. */
  upIsGood?: boolean
}) {
  const { t, lang } = useLang()
  if (previous == null) return null
  const month = monthWord(prevMonth, lang)

  if (open) {
    if (!(previous > 0) || value < 0) return null
    // A sliver of last month is "<1%", never "0%" — something has come in.
    const share = (value / previous) * 100
    const pct = value > 0 && share < 1 ? '<1' : formatNumber(Math.round(share))
    return (
      <Chip tone="neutral" sr={t('an.badge.sr.of', { pct, month })}>
        {t('an.badge.of', { pct, month })}
      </Chip>
    )
  }

  const diff = value - previous
  const asPct = previous > 0 && value >= 0
  const pct = asPct ? Math.round((Math.abs(diff) / previous) * 100) : null
  if (diff === 0 || (pct != null && pct < SAME_PCT)) {
    return (
      <Chip tone="neutral" icon={<Minus className="h-3.5 w-3.5" aria-hidden="true" />} sr={t('an.badge.sr.same', { month })}>
        {t('an.badge.vs', { month })}
      </Chip>
    )
  }
  const up = diff > 0
  const amount = pct != null ? `${formatNumber(pct)}%` : compact(Math.abs(diff))
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <Chip
      tone={up === upIsGood ? 'good' : 'bad'}
      icon={<Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      sr={t(up ? 'an.badge.sr.more' : 'an.badge.sr.less', { amount, month })}
    >
      {amount} {t('an.badge.vs', { month })}
    </Chip>
  )
}

function Chip({ tone, icon, sr, children }: {
  tone: keyof typeof TONE
  icon?: ReactNode
  /** The sentence a screen reader hears instead of the chip's shorthand. */
  sr: string
  children: ReactNode
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-chip px-1.5 py-0.5 text-xs font-semibold tabular-nums ${TONE[tone]}`}>
      {icon}
      <span aria-hidden="true">{children}</span>
      <span className="sr-only">{sr}</span>
    </span>
  )
}
