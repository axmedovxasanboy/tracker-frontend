import { useEffect, useState } from 'react'
import { BadgeCheck, Trash2 } from 'lucide-react'
import { ErrorTile } from '../ui/ErrorTile'
import { ListRow, ListTile } from '../ui/ListRow'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { useApi } from '../../hooks/useApi'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { formatMonth, moneyFull } from '../../utils/format'
import type { Bucket, Currency, MarkPaidKind, MarkPaidResponse } from '../../types'

interface Props {
  /** YYYY-MM — the month the plan is showing. */
  month: string
  currency: Currency
  /** Bumped by the page after any write that can add or remove a mark. */
  refreshKey?: number
  /** Called after a mark is removed, so the tiles that counted it refetch. */
  onChanged?: () => void
}

/**
 * `note` is on the wire (`MarkPaidResponse.note` — the user's own reason for the mark) but the
 * shared type has not caught up. Widened here rather than in a file this component does not own.
 */
type MarkRow = MarkPaidResponse & { note?: string | null }

const KIND_KEYS: Record<MarkPaidKind, TKey> = {
  SUBSCRIPTION:  'cmp.marks.kindSubscription',
  BANK:          'cmp.marks.kindBank',
  PERSONAL_LOAN: 'cmp.marks.kindPersonalLoan',
  DEBT:          'cmp.marks.kindDebt',
  BUCKET:        'cmp.marks.kindBucket',
}

const BUCKET_KEYS: Record<Bucket, TKey> = {
  DONATION:    'page.overview.bucketDonation',
  EMERGENCY:   'page.overview.bucketEmergency',
  INVESTMENTS: 'page.overview.bucketInvestments',
}

/** The referenced record's own name, keyed the way `nameFor` looks it up. */
function refKey(kind: string, refId: number): string {
  return `${kind}:${refId}`
}

/**
 * The month's "already paid" marks, with an undo on each.
 *
 * A mark is the only "paid" figure in the app with no transaction behind it: it is counted by the
 * tier, the ledger and the bucket tiles, but it appears in no transaction list, no wallet and no
 * month-close snapshot. That is exactly how a mistyped 2.342.000 silently inflates Paid on Home
 * and Plan forever. Bucket marks at least surfaced in the bucket history; a subscription, bank,
 * personal-loan or debt mark was reachable from nowhere at all. This tile is that place.
 *
 * It renders nothing at all when the month has no marks — the common case, and a permanently
 * empty tile explaining a feature nobody used would be noise on the page the app is built around.
 */
export function MarksPanel({ month, currency, refreshKey = 0, onChanged }: Props) {
  const { t, lang } = useLang()
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()
  const marks = useApi(() => financeApi.listMarks(month), [month, refreshKey])
  const [removing, setRemoving] = useState<number | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})

  const rows = (marks.data ?? []) as MarkRow[]
  const monthLabel = formatMonth(month, lang)

  // A mark carries only the id of what it satisfied, and "PERSONAL_LOAN #4" is not something a
  // user can recognise well enough to decide whether to undo it. Resolve the names — but only for
  // the kinds actually present, so a month with no marks (or only bucket marks) costs no request.
  const kindsWithRef = [...new Set(rows.filter(m => m.refId != null).map(m => m.kind))].sort().join(',')
  useEffect(() => {
    if (!kindsWithRef) { setNames({}); return }
    const kinds = new Set(kindsWithRef.split(','))
    const jobs: Promise<[string, string][]>[] = []
    if (kinds.has('SUBSCRIPTION')) {
      jobs.push(financeApi.getMonthlyPayments()
        .then(r => r.data.map(s => [refKey('SUBSCRIPTION', s.id), s.name] as [string, string])))
    }
    if (kinds.has('BANK')) {
      jobs.push(financeApi.getBankLoans()
        .then(r => r.data.map(b => [refKey('BANK', b.id), `${b.bankName} · ${b.loanName}`] as [string, string])))
    }
    if (kinds.has('PERSONAL_LOAN')) {
      jobs.push(financeApi.getLoansTaken()
        .then(r => r.data.map(l => [refKey('PERSONAL_LOAN', l.id), l.lenderName] as [string, string])))
    }
    if (kinds.has('DEBT')) {
      jobs.push(financeApi.getDebts()
        .then(r => r.data.map(d => [refKey('DEBT', d.id), d.creditorName] as [string, string])))
    }
    let cancelled = false
    // A failed name lookup must not blank the list: the row falls back to its kind, which is
    // still enough to find a mark by its amount.
    Promise.all(jobs)
      .then(res => { if (!cancelled) setNames(Object.fromEntries(res.flat())) })
      .catch(() => { if (!cancelled) setNames({}) })
    return () => { cancelled = true }
  }, [kindsWithRef])

  const nameFor = (m: MarkRow): string => {
    if (m.kind === 'BUCKET') {
      const key = m.bucket ? BUCKET_KEYS[m.bucket] : null
      return key ? t(key) : t(KIND_KEYS.BUCKET)
    }
    return (m.refId != null ? names[refKey(m.kind, m.refId)] : undefined) ?? t(KIND_KEYS[m.kind])
  }

  const remove = async (m: MarkRow) => {
    const amount = moneyFull(m.amount, m.currency)
    const ok = await confirm({
      destructive: true,
      title: t('cmp.marks.removeConfirmTitle'),
      // Personal-loan and debt marks moved the record's paid total when they were created, so
      // undoing one puts that balance back — the user has to be told before, not after. The
      // lender's name is deliberately not interpolated: it may still be resolving when the dialog
      // opens, and the fallback would name the mark's kind as if it were a person.
      message: m.kind === 'PERSONAL_LOAN' || m.kind === 'DEBT'
        ? t('cmp.marks.removeConfirmBodyBalance', { amount })
        : t('cmp.marks.removeConfirmBody', { amount }),
      confirmLabel: t('cmp.marks.removeAction'),
    })
    if (!ok) return
    setRemoving(m.id)
    try {
      await financeApi.deleteMark(m.id)
      showSuccess(t('cmp.marks.removedToast', { amount }))
      marks.refetch()
      onChanged?.()
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally {
      setRemoving(null)
    }
  }

  // Nothing to show and nothing failed: stay off the page entirely. No skeleton either — most
  // months have no marks, and reserving space for a tile that will not appear is a phantom row on
  // every load of the page.
  if (rows.length === 0 && !marks.error) return null

  if (marks.error && rows.length === 0) {
    return (
      <ErrorTile message={marks.error} onRetry={marks.refetch}
        className="md:col-span-6 xl:col-span-12" />
    )
  }

  const total = rows.reduce((s, m) => s + m.amount, 0)

  return (
    <ListTile
      span={12}
      className={marks.refreshing ? 'opacity-60 transition-opacity' : undefined}
      header={
        <div className="min-w-0">
          <h2 className="text-title text-slate-900">{t('cmp.marks.heading', { month: monthLabel })}</h2>
          <p className="mt-0.5 text-sm text-slate-600 tabular-nums">
            {t('cmp.marks.subheading', { amount: moneyFull(total, currency) })}
          </p>
        </div>
      }
    >
      {marks.error && (
        <div className="p-3">
          <ErrorTile compact message={marks.error} onRetry={marks.refetch} />
        </div>
      )}
      {rows.map(m => (
        <ListRow
          key={m.id}
          leading={
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-slate-100 text-slate-500">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            </span>
          }
          title={nameFor(m)}
          badges={
            <span className="inline-flex items-center rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {t(KIND_KEYS[m.kind])}
            </span>
          }
          subtitle={m.note ?? undefined}
          amount={moneyFull(m.amount, m.currency)}
          // A mark moved no money — it only counts as paid. Saying "Set aside" here would claim
          // a wallet movement that never happened.
          amountCaption={`${t('ui.scope.paid')} · ${monthLabel}`}
          actions={[{
            label: t('cmp.marks.removeAction'),
            icon: <Trash2 className="w-4 h-4" />,
            danger: true,
            disabled: removing === m.id,
            onClick: () => { void remove(m) },
          }]}
        />
      ))}
    </ListTile>
  )
}
