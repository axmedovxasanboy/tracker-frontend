import { useCallback, useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { ErrorTile } from '../ui/ErrorTile'
import { Skeleton } from '../ui/Skeleton'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { monthsApi } from '../../api/months'
import { extractErrorMessage } from '../../api/client'
import { formatDate, moneyFull, todayLocal } from '../../utils/format'
import type { Currency, MonthPreviewWallet, MonthCloseWalletEntry, WalletCheckInStatus } from '../../types'

const INPUT = 'w-full border border-slate-200 rounded-control px-3 py-2.5 text-sm text-slate-900 focus-ring'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Display currency for the running total (per-wallet amounts are in each wallet's own). */
  currency: Currency
}

function walletKey(w: { walletType: string; cardId: number | null; currency: string }) {
  return w.walletType === 'CARD' ? `CARD:${w.cardId}` : `CASH:${w.currency}`
}

function walletFieldId(w: MonthPreviewWallet) {
  return `checkin-wallet-${walletKey(w).replace(':', '-')}`
}

/**
 * The mid-month sibling of CloseMonthModal: the same per-wallet form, prefilled with the app's
 * own figures so the owner only corrects what differs, and the same everyday-spending arithmetic
 * per wallet. What it leaves out is the consent gate — a check-in freezes nothing, and every
 * adjustment it books is an ordinary transaction that can be edited or deleted afterwards.
 */
export function CheckInModal({ open, onClose, onSaved, currency }: Props) {
  const { t, lang } = useLang()
  const { showSuccess } = useToast()
  const [status, setStatus] = useState<WalletCheckInStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [entered, setEntered] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Pinned when the dialog opens, so a dialog left open across midnight still books to the day
  // the balances were read on — and it is the owner's local day, not the server's UTC one.
  const [date, setDate] = useState(todayLocal)

  const load = useCallback(() => {
    const today = todayLocal()
    setDate(today)
    setStatus(null); setError(null); setEntered({}); setLoading(true)
    monthsApi.getCheckIn(today)
      .then(r => {
        setStatus(r.data)
        const init: Record<string, number> = {}
        r.data.wallets.forEach(w => { init[walletKey(w)] = w.computedBalance })
        setEntered(init)
      })
      .catch(e => setError(extractErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!open) return
    load()
  }, [open, load])

  const balanceOf = (w: MonthPreviewWallet) => entered[walletKey(w)] ?? w.computedBalance
  const everydayFor = (w: MonthPreviewWallet) => w.computedBalance - balanceOf(w)
  const total = status
    ? status.wallets.filter(w => w.currency === currency).reduce((sum, w) => sum + everydayFor(w), 0)
    : 0
  const dirty = !!status && status.wallets.some(w => balanceOf(w) !== w.computedBalance)

  const commit = async () => {
    if (!status) return
    setSaving(true); setError(null)
    try {
      const wallets: MonthCloseWalletEntry[] = status.wallets.map(w => ({
        walletType: w.walletType,
        cardId: w.cardId,
        currency: w.currency,
        enteredBalance: balanceOf(w),
      }))
      const res = await monthsApi.checkIn({ date, wallets })
      const recorded = res.data.everydayRecorded
      showSuccess(recorded > 0
        ? t('cmp.checkIn.savedSpent', { amount: moneyFull(recorded, currency) })
        : recorded < 0
          ? t('cmp.checkIn.savedSurplus', { amount: moneyFull(-recorded, currency) })
          : t('cmp.checkIn.savedMatched'))
      onSaved()
      onClose()
    } catch (e) {
      setError(extractErrorMessage(e))
    } finally { setSaving(false) }
  }

  // The server's verdict, not a guess: between opening the dialog and saving, the month may have
  // crossed into its last five days, and the save would be refused anyway.
  const refused = status && !status.allowed

  const footer = status && (
    <div className="flex gap-3">
      <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
      <Button
        variant="primary"
        label={saving ? t('action.saving') : t('cmp.checkIn.save')}
        onClick={commit}
        loading={saving}
        disabled={!!refused || status.wallets.length === 0}
        disabledReason={refused ? status.blockedReason ?? undefined : undefined}
        className="flex-1"
      />
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cmp.checkIn.title', { date: formatDate(date, lang) })}
      maxWidth="max-w-2xl"
      dirty={dirty && !saving}
      footer={footer ?? undefined}
    >
      {loading ? (
        <Skeleton variant="row" count={3} bare />
      ) : !status ? (
        <ErrorTile message={error ?? t('cmp.checkIn.loadFailed')} onRetry={load} />
      ) : (
        <div className="space-y-4">
          {refused && (
            <p role="alert" className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              {status.blockedReason}
            </p>
          )}

          <p className="text-sm text-slate-600">{t('cmp.checkIn.intro')}</p>
          {/* A check-in after the fact double-counts: whatever it books as "everyday" is exactly
              what a transaction recorded later for the same days would book again. Saying so up
              front is cheaper than untangling it — the next check-in would net it out, but only
              as a surplus nobody can explain. */}
          <p className="text-sm text-slate-500">{t('cmp.checkIn.recordFirst')}</p>

          <div className="space-y-2">
            {status.wallets.length === 0 && (
              <p className="text-sm text-slate-500">{t('cmp.closeMonth.noWallets')}</p>
            )}
            {status.wallets.map(w => {
              const ev = everydayFor(w)
              return (
                <div key={walletKey(w)} className="rounded-control border border-hairline p-3">
                  <Field
                    id={walletFieldId(w)}
                    label={t('cmp.checkIn.walletLabel', { name: w.label })}
                    help={`${t('cmp.closeMonth.appThinks')} ${moneyFull(w.computedBalance, w.currency)}`}
                  >
                    <AmountInput
                      value={balanceOf(w)}
                      currency={w.currency}
                      onChange={v => setEntered(p => ({ ...p, [walletKey(w)]: v }))}
                      className={INPUT}
                      suffix={w.currency}
                      disabled={!!refused}
                    />
                  </Field>
                  <p className={`mt-2 text-sm tabular-nums ${
                    ev > 0 ? 'text-expense' : ev < 0 ? 'text-income' : 'text-slate-500'
                  }`}>
                    {ev > 0 ? t('cmp.closeMonth.spent') : ev < 0 ? t('cmp.closeMonth.surplus') : ''}
                    {ev !== 0 ? moneyFull(Math.abs(ev), w.currency) : t('cmp.checkIn.matches')}
                  </p>
                </div>
              )
            })}
          </div>

          {status.wallets.length > 0 && (
            <p className="rounded-control border border-hairline px-3 py-2.5 text-sm font-medium text-slate-900">
              {total > 0
                ? t('cmp.checkIn.willRecord', { amount: moneyFull(total, currency) })
                : total < 0
                  ? t('cmp.checkIn.willRecordSurplus', { amount: moneyFull(-total, currency) })
                  : t('cmp.checkIn.willRecordNothing')}
            </p>
          )}

          {error && <p role="alert" className="text-sm text-expense">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
