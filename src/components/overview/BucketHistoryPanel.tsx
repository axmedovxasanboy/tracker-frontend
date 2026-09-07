import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { ErrorTile } from '../ui/ErrorTile'
import { Skeleton } from '../ui/Skeleton'
import { ListRow, ListTile } from '../ui/ListRow'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { useApi } from '../../hooks/useApi'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import { overviewApi } from '../../api/overview'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { formatDate, formatMonth, money, moneyFull, plural } from '../../utils/format'
import type { Bucket, BucketPayment, Currency } from '../../types'

interface Props {
  bucket: Bucket
  month: string         // YYYY-MM
  currency: Currency
  onClose: () => void
  /**
   * Bumped by the page whenever a write moves this bucket's figures. The panel sits directly
   * under the tile it explains, and neither `bucket`, `month` nor `currency` changes when a
   * payment is recorded — so without this the panel kept listing three rows and "Paid 200 k"
   * under a tile that had already moved to "Paid 250 k".
   */
  refreshKey?: number
  /** Called after the panel itself changes the data, so the tiles above it refetch too. */
  onChanged?: () => void
}

/**
 * `marked` rides on the wire — `OverviewService.getBucketPayments` folds the month's "already
 * paid" marks in so the rows add up to the figure on the tile that opened this panel — but the
 * shared `BucketPayment` type has not caught up. Read it here rather than edit a file this
 * component does not own; the three record tabs widen it the same way.
 *
 * For a marked row `id` is a MarkPaid id, not a Donation / Transaction id, which is what makes
 * `DELETE /finance/mark-paid/{id}` the right undo for it.
 */
type PaymentRow = BucketPayment & { marked?: boolean }

/**
 * A mark's `label` arrives from the backend as the English literal "Marked as already paid", so
 * the row names itself from the dictionary instead and reads as Uzbek in Uzbek.
 */
const MARKED_TITLE_KEYS: Record<Bucket, TKey> = {
  DONATION:    'page.donations.markedTitle',
  EMERGENCY:   'page.emergencies.markedTitle',
  INVESTMENTS: 'page.investments.markedTitle',
}

const MARKED_BADGE_KEYS: Record<Bucket, TKey> = {
  DONATION:    'page.donations.markedBadge',
  EMERGENCY:   'page.emergencies.markedBadge',
  INVESTMENTS: 'page.investments.markedBadge',
}

/**
 * What actually went into a bucket this month, listed underneath the bucket tile that opened it.
 *
 * It is a tile in the page grid, not a floating card: the rows share the tile's one surface via
 * `ListTile`, so a payment reads as a line in a list rather than as fourteen separate cards.
 */
export function BucketHistoryPanel({ bucket, month, currency, onClose, refreshKey = 0, onChanged }: Props) {
  const { t, lang } = useLang()
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()
  const [removing, setRemoving] = useState<number | null>(null)
  const BUCKET_LABELS: Record<Bucket, string> = {
    DONATION:    t('cmp.bucketHistory.donations'),
    EMERGENCY:   t('cmp.bucketHistory.emergencyContributions'),
    INVESTMENTS: t('cmp.bucket.investments'),
  }
  const payments = useApi(
    () => overviewApi.getBucketPayments(bucket, month, currency),
    [bucket, month, currency, refreshKey])
  const rows = (payments.data ?? []) as PaymentRow[]
  const total = rows.reduce((s, p) => s + p.amount, 0)
  const monthLabel = formatMonth(month, lang)

  /**
   * Undo a mark. A mark is the only "paid" figure with no transaction behind it, so this list is
   * the only place a mistyped one can be found — and until now it was also the only kind of paid
   * figure with no way to take it back.
   */
  const removeMark = async (id: number, amount: number) => {
    const ok = await confirm({
      destructive: true,
      title: t('cmp.marks.removeConfirmTitle'),
      message: t('cmp.marks.removeConfirmBody', { amount: moneyFull(amount, currency) }),
      confirmLabel: t('cmp.marks.removeAction'),
    })
    if (!ok) return
    setRemoving(id)
    try {
      await financeApi.deleteMark(id)
      showSuccess(t('cmp.marks.removedToast', { amount: moneyFull(amount, currency) }))
      payments.refetch()
      onChanged?.()
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally {
      setRemoving(null)
    }
  }

  const header = (
    <>
      <div className="min-w-0">
        <p className="text-title text-slate-900 truncate">{BUCKET_LABELS[bucket]} — {monthLabel}</p>
        <p className="mt-0.5 text-sm text-slate-600 tabular-nums">
          {plural(rows.length, t('cmp.bucketHistory.paymentCountOne', { count: rows.length }),
            t('cmp.bucketHistory.paymentCountMany', { count: rows.length }), lang)}
          {' · '}
          {/* The tile that opened this panel calls the identical figure "Paid", and the reader
              has to be able to see that it is the same number. */}
          {t('ui.scope.paid')} <span className="font-semibold text-slate-900">{money(total, currency)}</span>
        </p>
      </div>
      <Button iconOnly size="sm" variant="ghost" icon={<X className="w-4 h-4" />}
        label={t('ui.close')} onClick={onClose} className="shrink-0" />
    </>
  )

  if (payments.loading && !payments.data) {
    return (
      <ListTile span={12} header={header}>
        <Skeleton variant="row" count={3} bare />
      </ListTile>
    )
  }

  if (payments.error && !payments.data) {
    return (
      <ListTile span={12} header={header}>
        <div className="p-4">
          <ErrorTile message={payments.error} onRetry={payments.refetch} />
        </div>
      </ListTile>
    )
  }

  return (
    <ListTile
      span={12}
      header={header}
      empty={t('cmp.bucketHistory.noPayments', { month: monthLabel })}
      className={payments.refreshing ? 'opacity-60 transition-opacity' : undefined}
    >
      {payments.error && (
        <div className="p-3">
          <ErrorTile compact message={payments.error} onRetry={payments.refetch} />
        </div>
      )}
      {rows.map(p => (
        <ListRow
          // A mark and a real payment arrive with ids from two different tables, so `bucket-id`
          // alone collides as soon as MarkPaid #3 and Donation #3 both land in this month.
          key={`${p.bucket}-${p.marked ? 'mark' : 'row'}-${p.id}`}
          title={p.marked ? t(MARKED_TITLE_KEYS[bucket]) : p.label}
          badges={p.marked && (
            <span className="inline-flex items-center rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {t(MARKED_BADGE_KEYS[bucket])}
            </span>
          )}
          subtitle={p.description ?? undefined}
          amount={moneyFull(p.amount, currency)}
          // A mark moved no money, so it was never "set aside" — it only counts as paid.
          amountCaption={
            `${p.marked ? t('ui.scope.paid') : t('ui.scope.setAside')} · ${formatDate(p.date, lang)}`
          }
          // Only marks get a row action here: a real payment is a Donation or a Transaction that
          // belongs to its own tab, and deleting it from a read-only history would be a surprise.
          actions={p.marked ? [{
            label: t('cmp.marks.removeAction'),
            icon: <Trash2 className="w-4 h-4" />,
            danger: true,
            disabled: removing === p.id,
            onClick: () => { void removeMark(p.id, p.amount) },
          }] : undefined}
        />
      ))}
    </ListTile>
  )
}
