import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Lock } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button, DisabledHint } from '../ui/Button'
import { Field } from '../ui/Field'
import { ErrorTile } from '../ui/ErrorTile'
import { Skeleton } from '../ui/Skeleton'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { monthsApi } from '../../api/months'
import { extractErrorMessage } from '../../api/client'
import { formatMonth, money, moneyFull } from '../../utils/format'
import type {
  Currency, MonthClosePreviewResponse, MonthPreviewWallet, MonthCloseWalletEntry,
} from '../../types'

const INPUT = 'w-full border border-slate-200 rounded-control px-3 py-2.5 text-sm text-slate-900 focus-ring'

/**
 * The marks-only delta the preview now reports. Not in `src/types/index.ts` yet — that file
 * belongs to another owner this batch — so the dialog widens the response locally. Optional, so
 * an older backend simply reports nothing and the line does not render.
 */
type PreviewWithMarks = MonthClosePreviewResponse & { markedNotMoved?: number }

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  month: string
  /** Display currency for the month figures (per-wallet amounts are in each wallet's own currency). */
  currency: Currency
}

function walletKey(w: { walletType: string; cardId: number | null; currency: string }) {
  return w.walletType === 'CARD' ? `CARD:${w.cardId}` : `CASH:${w.currency}`
}

/** A colon is legal in an id but awkward in every selector that might later look for one. */
function walletFieldId(w: MonthPreviewWallet) {
  return `close-wallet-${walletKey(w).replace(':', '-')}`
}

export function CloseMonthModal({ open, onClose, onSaved, month, currency }: Props) {
  const { t, lang } = useLang()
  const { showSuccess } = useToast()
  const [preview, setPreview] = useState<PreviewWithMarks | null>(null)
  const [loading, setLoading] = useState(false)
  const [entered, setEntered] = useState<Record<string, number>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setPreview(null); setError(null); setConfirmed(false); setEntered({}); setLoading(true)
    monthsApi.getPreview(month, currency)
      .then(r => {
        setPreview(r.data)
        // The prefill is the app's own arithmetic — the user only has to correct it where their
        // real wallet disagrees, which is the whole point of the reconciliation.
        const init: Record<string, number> = {}
        r.data.wallets.forEach(w => { init[walletKey(w)] = w.computedBalance })
        setEntered(init)
      })
      .catch(e => setError(extractErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [month, currency])

  useEffect(() => {
    if (!open) return
    load()
  }, [open, load])

  const balanceOf = (w: MonthPreviewWallet) => entered[walletKey(w)] ?? w.computedBalance
  const everydayFor = (w: MonthPreviewWallet) => w.computedBalance - balanceOf(w)

  const marked = preview?.markedNotMoved ?? 0
  // An "already paid" mark raises the bucket figures but moves no money, so the close books only
  // the recorded half — everyday spending has to be measured against that half, not the total.
  const recordedSetAside = preview ? preview.taggedTotal - marked : 0
  const leftover = preview ? preview.wallets.reduce((sum, w) => sum + balanceOf(w), 0) : 0
  // Exactly the arithmetic the backend runs on commit, so the figure shown before the button is
  // pressed is the figure that gets frozen.
  const everydayTotal = preview
    ? preview.startBalance + preview.income - leftover - recordedSetAside
    : 0

  /** True once the user has moved any wallet off the app's own figure. */
  const dirty = !!preview && preview.wallets.some(w => balanceOf(w) !== w.computedBalance)

  const commit = async () => {
    if (!preview) return
    setSaving(true); setError(null)
    try {
      const wallets: MonthCloseWalletEntry[] = preview.wallets.map(w => ({
        walletType: w.walletType,
        cardId: w.cardId,
        currency: w.currency,
        enteredBalance: balanceOf(w),
      }))
      const res = await monthsApi.close({ month, wallets })
      // Only after the request resolves, and quoting the carry-forward: closing is irreversible,
      // so the confirmation has to state what the next month now starts with.
      showSuccess(t('cmp.closeMonth.closedToast', {
        month: formatMonth(month, lang),
        amount: moneyFull(res.data.leftover, res.data.currency),
      }))
      onSaved()
      onClose()
    } catch (e) {
      setError(extractErrorMessage(e))
    } finally { setSaving(false) }
  }

  // Why the close button is off. A disabled button suppresses its own tooltip in Chrome and
  // Safari and cannot be focused, so the reason is also printed above the row — on a phone the
  // footer is sticky and the amber banner explaining the same thing has scrolled away.
  const blockedReason = !preview
    ? undefined
    : !preview.closeable ? preview.blockedReason ?? t('cmp.closeMonth.cannotCloseNow')
    : !confirmed ? t('cmp.closeMonth.confirmFirst')
    : undefined

  const footer = preview && (
    <div className="space-y-2">
      <DisabledHint reason={saving ? undefined : blockedReason} />
      <div className="flex gap-3">
        <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
        <Button
          variant="primary"
          label={saving ? t('cmp.state.closing') : t('cmp.closeMonth.closeMonth')}
          onClick={commit}
          loading={saving}
          disabled={!preview.closeable || !confirmed}
          disabledReason={blockedReason}
          className="flex-1"
        />
      </div>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cmp.closeMonth.title', { month: formatMonth(month, lang) })}
      maxWidth="max-w-2xl"
      dirty={dirty && !saving}
      footer={footer ?? undefined}
    >
      {loading ? (
        <Skeleton variant="row" count={3} bare />
      ) : !preview ? (
        <ErrorTile message={error ?? t('cmp.closeMonth.previewLoadFailed')} onRetry={load} />
      ) : (
        <div className="space-y-4">
          {/* The page's one tinted alert: closing out of order is the only thing that can make
              this dialog refuse, and the reason has to be readable before anything is typed. */}
          {!preview.closeable && (
            <div role="alert" className="flex items-start gap-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{preview.blockedReason ?? t('cmp.closeMonth.cannotCloseNow')}</span>
            </div>
          )}

          <p className="text-sm text-slate-600">
            {t('cmp.closeMonth.introPrefix')} <span className="font-medium text-slate-900">{t('cmp.closeMonth.realBalance')}</span> {t('cmp.closeMonth.introMid')}
            {' '}<span className="font-medium">{t('cmp.closeMonth.everydaySpending')}</span>{t('cmp.closeMonth.introSuffix')}
          </p>

          {/* Month figures */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('cmp.closeMonth.start')} value={money(preview.startBalance, currency)} />
            <Stat label={t('cmp.closeMonth.earned')} value={money(preview.income, currency)} />
            <Stat label={t('cmp.closeMonth.taggedOut')} value={money(preview.taggedTotal, currency)} />
          </div>

          {/* A mark is money the plan counts but no wallet moved, so the close will not book it.
              Saying so here is the difference between a surprise and an explained drop. */}
          {marked > 0 && (
            <p className="text-sm text-slate-500">
              {t('page.months.markedNotMoved')} · <span className="tabular-nums">{moneyFull(marked, currency)}</span>
            </p>
          )}

          {/* Per-wallet reconciliation */}
          <div className="space-y-2">
            {preview.wallets.length === 0 && (
              <p className="text-sm text-slate-500">{t('cmp.closeMonth.noWallets')}</p>
            )}
            {preview.wallets.map(w => {
              const ev = everydayFor(w)
              return (
                <div key={walletKey(w)} className="rounded-control border border-hairline p-3">
                  <Field
                    id={walletFieldId(w)}
                    label={t('cmp.closeMonth.walletLabel', { name: w.label })}
                    help={`${t('cmp.closeMonth.appThinks')} ${moneyFull(w.computedBalance, w.currency)}`}
                  >
                    <AmountInput
                      value={balanceOf(w)}
                      currency={w.currency}
                      onChange={v => setEntered(p => ({ ...p, [walletKey(w)]: v }))}
                      className={INPUT}
                      suffix={w.currency}
                      disabled={!preview.closeable}
                    />
                  </Field>
                  <p className={`mt-2 text-sm tabular-nums ${
                    ev > 0 ? 'text-expense' : ev < 0 ? 'text-income' : 'text-slate-500'
                  }`}>
                    {ev > 0 ? t('cmp.closeMonth.spent') : ev < 0 ? t('cmp.closeMonth.surplus') : ''}
                    {moneyFull(Math.abs(ev), w.currency)}
                  </p>
                </div>
              )
            })}
          </div>

          {/* What the numbers above add up to, live, before anything is committed. */}
          {preview.wallets.length > 0 && (
            <p className="rounded-control border border-hairline px-3 py-2.5 text-sm font-medium text-slate-900">
              {t('cmp.closeMonth.everydayWillBe', { amount: moneyFull(everydayTotal, currency) })}
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-expense">{error}</p>
          )}

          {/* The consent gate, unchanged: the close button stays disabled until this is ticked. */}
          {preview.closeable && (
            <label className="flex cursor-pointer items-start gap-2 rounded-control border border-slate-200 p-3">
              <input type="checkbox" checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus-ring" />
              <span className="flex items-center gap-1 text-sm leading-relaxed text-slate-600">
                <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {t('cmp.closeMonth.confirmPrefix')} <span className="font-semibold">{formatMonth(month, lang)}</span> {t('cmp.closeMonth.confirmSuffix')}
              </span>
            </label>
          )}
        </div>
      )}
    </Modal>
  )
}

/** One of the three month figures above the wallet list — a label and a figure, nothing else. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-hairline px-3 py-2">
      <p className="text-label uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  )
}
