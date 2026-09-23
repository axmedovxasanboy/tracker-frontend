import type { ReactNode } from 'react'
import { Building2, CheckCircle2, HeartHandshake, Plus, ShieldAlert, Target } from 'lucide-react'
import { Button } from '../ui/Button'
import { IconChip } from '../ui/IconChip'
import type { IconTone } from '../ui/StatTile'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { formatNumber, moneyFull } from '../../utils/format'
import type { AdvisorSavingsRow, Bucket, Currency } from '../../types'

export const SAVINGS_NAME_KEY: Record<Bucket, TKey> = {
  DONATION: 'cmp.bucket.donation',
  EMERGENCY: 'cmp.bucket.emergency',
  INVESTMENTS: 'cmp.bucket.investments',
}

export const SAVINGS_ICON: Record<Bucket, { icon: ReactNode; tone: IconTone }> = {
  DONATION: { icon: <HeartHandshake className="h-4 w-4" aria-hidden="true" />, tone: 'pink' },
  EMERGENCY: { icon: <ShieldAlert className="h-4 w-4" aria-hidden="true" />, tone: 'amber' },
  INVESTMENTS: { icon: <Building2 className="h-4 w-4" aria-hidden="true" />, tone: 'teal' },
}

const GOAL_ICON = { icon: <Target className="h-4 w-4" aria-hidden="true" />, tone: 'indigo' as IconTone }

const isBucketRow = (r: AdvisorSavingsRow): r is AdvisorSavingsRow & { bucket: Bucket } =>
  r.bucket in SAVINGS_NAME_KEY
/** A goal's row can only be paid through its goal, so one without an id is not shown. */
const isGoalRow = (r: AdvisorSavingsRow) => r.bucket === 'GOAL' && r.refId != null

/**
 * This month's savings, one line each: "Donation · 0 of 884.000 UZS · Pay", or "✓ Done" once it is
 * in — with "Add more" beside it, since the owner often puts in more than the month asks. Each
 * savings goal with a monthly payment follows the three, by its own name. The same rows on Home and
 * on Savings, so the two pages can never read differently.
 */
export function SavingsThisMonth({ rows, currency, onPay }: {
  rows: AdvisorSavingsRow[]
  currency: Currency
  /** `amount` is what is left for the month; 0 for "Add more", which starts on an empty amount. */
  onPay: (row: AdvisorSavingsRow, amount: number) => void
}) {
  const { t } = useLang()
  // Anything this client does not know how to pay is left out rather than shown half-working.
  const shown = [...rows.filter(isBucketRow), ...rows.filter(isGoalRow)]

  return (
    <ul className="divide-y divide-hairline">
      {shown.map(r => {
        const done = r.remaining <= 0
        const goal = r.bucket === 'GOAL'
        const key = goal ? `goal-${r.refId}` : r.bucket
        const name = isBucketRow(r) ? t(SAVINGS_NAME_KEY[r.bucket]) : r.name?.trim() || t('page.advisor.bucket.savings')
        const icon = isBucketRow(r) ? SAVINGS_ICON[r.bucket] : GOAL_ICON
        const nameId = `savings-row-${key}`
        return (
          <li key={key} className="flex min-h-[56px] items-center gap-3 py-2">
            <IconChip tone={icon.tone}>{icon.icon}</IconChip>
            <div className="min-w-0 flex-1">
              <p id={nameId} className="truncate text-sm font-medium text-slate-900">{name}</p>
              <p className="text-xs tabular-nums text-slate-500">
                {done
                  ? moneyFull(r.paid, currency)
                  : t('home.savings.ofTarget', { paid: formatNumber(r.paid), target: moneyFull(r.target, currency) })}
              </p>
            </div>
            {done ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-income">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {t('ui.status.done')}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  label={t('home.savings.addMore')}
                  aria-describedby={nameId}
                  onClick={() => onPay(r, 0)}
                />
              </div>
            ) : (
              <Button
                size="sm"
                label={t('page.shared.payButton')}
                // Several "Pay" buttons share a page; the row name tells them apart when read out.
                aria-describedby={nameId}
                onClick={() => onPay(r, r.remaining)}
                className="shrink-0"
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
