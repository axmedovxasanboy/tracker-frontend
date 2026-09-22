import { useState } from 'react'
import { CalendarCheck, Scale } from 'lucide-react'
import { CloseMonthModal } from './CloseMonthModal'
import { CheckInModal } from './CheckInModal'
import { Button } from '../ui/Button'
import { Tile } from '../ui/Tile'
import { useApi } from '../../hooks/useApi'
import { useLang } from '../../i18n/LanguageContext'
import { monthsApi } from '../../api/months'
import { formatMonth, monthLocal, shiftMonth, todayLocal } from '../../utils/format'
import type { Currency } from '../../types'

interface Props {
  currency: Currency
  /** A check-in books everyday-spend adjustments and a close freezes the month: both move balances. */
  onWrote: () => void
}

/**
 * The two things the owner is ever asked to type about their wallets, where the wallets are.
 *
 * Both reconcile the same gap — what the app computed against what is really there — and both used
 * to live only on Months, a screen with no other reason to be opened. So the month close is a
 * prompt here now (owner's call, 2026-09-22): it appears when last month can actually be closed,
 * and disappears the moment it is. The check-in sits beside it on the days it is due. When neither
 * is, this renders nothing at all.
 */
export function WalletUpkeepTile({ currency, onWrote }: Props) {
  const { t, lang } = useLang()
  const today = todayLocal()
  const lastMonth = shiftMonth(monthLocal(), -1)

  // `closeable` is the backend's own verdict, so this cannot offer a month the close would refuse:
  // months close in order, the newest closed one decides which is next, and an already-closed
  // month answers false.
  const close = useApi(() => monthsApi.getPreview(lastMonth, currency), [lastMonth, currency])
  const check = useApi(() => monthsApi.getCheckIn(today), [today])

  const [closeOpen, setCloseOpen] = useState(false)
  const [checkOpen, setCheckOpen] = useState(false)

  const canClose = !!close.data?.closeable
  const status = check.data
  const checkDue = !!status?.due
  const days = status?.daysSinceLastReconciled ?? null

  const saved = () => {
    close.refetch()
    check.refetch()
    onWrote()
  }

  if (!canClose && !checkDue) return null

  return (
    <>
      <Tile span={12} as="section" className="space-y-3">
        {canClose && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
              <CalendarCheck className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              {t('page.cards.closePrompt', { month: formatMonth(lastMonth, lang) })}
            </p>
            <Button
              variant="primary"
              size="sm"
              label={t('page.months.closeMonth', { month: formatMonth(lastMonth, lang) })}
              onClick={() => setCloseOpen(true)}
            />
          </div>
        )}
        {checkDue && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
              <Scale className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              {days == null
                ? t('page.months.checkIn.never')
                : t('page.months.checkIn.due', { days })}
            </p>
            <Button
              // One filled button per screen: the close is the one with a deadline.
              variant={canClose ? 'secondary' : 'primary'}
              size="sm"
              label={t('page.months.checkIn.action')}
              onClick={() => setCheckOpen(true)}
            />
          </div>
        )}
      </Tile>

      <CloseMonthModal
        open={closeOpen} month={lastMonth} currency={currency}
        onClose={() => setCloseOpen(false)} onSaved={saved}
      />
      <CheckInModal
        open={checkOpen} currency={currency}
        onClose={() => setCheckOpen(false)} onSaved={saved}
      />
    </>
  )
}
