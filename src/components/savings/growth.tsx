import { useLang } from '../../i18n/LanguageContext'
import { formatNumber, moneyFull } from '../../utils/format'
import type { InvestmentResponse } from '../../types'

export interface Growth {
  putIn: number
  value: number
  growth: number
  /** One decimal; null when nothing was put in. */
  percent: number | null
}

/** What went into a holding and what it is worth now — the server's figures, else worked out. */
export function growthOf(i: InvestmentResponse, value?: number): Growth {
  const putIn = i.putIn ?? i.investedAmount
  const now = value ?? i.value ?? i.currentValue ?? i.investedAmount
  const growth = value == null && i.growth != null ? i.growth : now - putIn
  const percent = value == null && i.growthPercent !== undefined
    ? i.growthPercent
    : putIn > 0 ? Math.round((growth / putIn) * 1000) / 10 : null
  return { putIn, value: now, growth, percent }
}

/** "+120.000 UZS (+2,4%)" — green when up, red when down. Nothing when it has not moved. */
export function GrowthChip({ g, currency }: { g: Growth; currency: InvestmentResponse['currency'] }) {
  if (Math.abs(g.growth) < 1) return null
  const up = g.growth > 0
  const sign = up ? '+' : '−'
  return (
    <span className={`inline-block rounded-chip px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
      up ? 'bg-emerald-50 text-income' : 'bg-rose-50 text-expense'
    }`}>
      {sign}{moneyFull(Math.abs(g.growth), currency)}
      {g.percent != null && ` (${sign}${formatNumber(Math.abs(g.percent), 1)}%)`}
    </span>
  )
}

/** "Put in 1.000.000 UZS · now 1.120.000 UZS" and the chip — money put in and growth, apart. */
export function GrowthLine({ i, className = '' }: { i: InvestmentResponse; className?: string }) {
  const { t } = useLang()
  const g = growthOf(i)
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs tabular-nums text-slate-500 ${className}`}>
      <span>{t('cmp.growth.line', { putIn: moneyFull(g.putIn, i.currency), value: moneyFull(g.value, i.currency) })}</span>
      <GrowthChip g={g} currency={i.currency} />
    </p>
  )
}
