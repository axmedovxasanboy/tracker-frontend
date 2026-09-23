import type { ReactNode } from 'react'
import { Building2, CheckCircle2, HeartHandshake, ShieldAlert } from 'lucide-react'
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

/**
 * This month's savings, one line each: "Donation · 0 of 884.000 UZS · Pay", or "✓ Done" once it is
 * in. The same rows on Home and on Savings, so the two pages can never read differently.
 */
export function SavingsThisMonth({ rows, currency, onPay }: {
  rows: AdvisorSavingsRow[]
  currency: Currency
  onPay: (bucket: Bucket, amount: number) => void
}) {
  const { t } = useLang()

  return (
    <ul className="divide-y divide-hairline">
      {rows.map(r => {
        const done = r.remaining <= 0
        const name = t(SAVINGS_NAME_KEY[r.bucket])
        return (
          <li key={r.bucket} className="flex min-h-[56px] items-center gap-3 py-2">
            <IconChip tone={SAVINGS_ICON[r.bucket].tone}>{SAVINGS_ICON[r.bucket].icon}</IconChip>
            <div className="min-w-0 flex-1">
              <p id={`savings-row-${r.bucket}`} className="truncate text-sm font-medium text-slate-900">{name}</p>
              <p className="text-xs tabular-nums text-slate-500">
                {done
                  ? moneyFull(r.paid, currency)
                  : t('home.savings.ofTarget', { paid: formatNumber(r.paid), target: moneyFull(r.target, currency) })}
              </p>
            </div>
            {done ? (
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-income">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {t('ui.status.done')}
              </span>
            ) : (
              <Button
                size="sm"
                label={t('page.shared.payButton')}
                // Several "Pay" buttons share a page; the row name tells them apart when read out.
                aria-describedby={`savings-row-${r.bucket}`}
                onClick={() => onPay(r.bucket, r.remaining)}
                className="shrink-0"
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
