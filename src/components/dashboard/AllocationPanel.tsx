import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeartHandshake, ShieldAlert, Building2, ArrowUpRight, Check, Landmark, Lock, Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { ErrorTile } from '../ui/ErrorTile'
import { Skeleton } from '../ui/Skeleton'
import { Tile } from '../ui/Tile'
import type { TileSpan } from '../ui/Tile'
import type { IconTone } from '../ui/StatTile'
import { PayBucketModal } from '../overview/PayBucketModal'
import { PayBankInstallmentModal } from '../overview/PayBankInstallmentModal'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { money } from '../../utils/format'
import type {
  AllocationLine, Bucket, Currency, MonthSummaryResponse, OverviewTierResponse,
} from '../../types'

/**
 * The bucket's identity colour survives on the icon chip and nowhere else — a progress bar is a
 * progress bar on every screen, so it uses the same indigo/`bg-income` pair Plan's bucket tiles
 * use. Two colour systems for one figure made the colour stop meaning anything.
 */
const BUCKET_META: Record<Bucket, { Icon: typeof HeartHandshake; tone: IconTone; chip: string; labelKey: TKey }> = {
  DONATION:    { Icon: HeartHandshake, tone: 'pink',  chip: 'bg-pink-100 text-pink-600',   labelKey: 'cmp.bucket.donation' },
  EMERGENCY:   { Icon: ShieldAlert,    tone: 'amber', chip: 'bg-amber-100 text-amber-600', labelKey: 'cmp.bucket.emergency' },
  INVESTMENTS: { Icon: Building2,      tone: 'teal',  chip: 'bg-teal-100 text-teal-600',   labelKey: 'cmp.bucket.investments' },
}

/**
 * The slice of `useApi` this panel needs. Home owns the query so that the page and the panel can
 * never disagree about the same month, and so a write anywhere on Home can refresh it.
 */
export interface TierQuery {
  data: OverviewTierResponse | null
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * The month envelope — the very payload Months renders. Home reads "Set aside" from here and not
 * from its own lines, which is the whole reason this prop exists; see `setAside` below.
 */
export interface EnvelopeQuery {
  data: MonthSummaryResponse | null
  loading: boolean
  refreshing: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * This month's plan, as one idea: what you have set aside against what the month asked for.
 *
 * It used to carry seven — a bank strip, a headline, a locked banner, three expandable buckets
 * each with its own arithmetic table, an "other asks" box and a notes list. The arithmetic, the
 * notes and everything else now live on Plan, one tap away through the link in the header.
 *
 * The one thing that stays above the buckets is the bank loan payment, and that is the rule
 * rather than a layout preference: until the debt actions are met the backend sets
 * `allocationLocked` and refuses bucket writes, so putting the buckets above the thing that
 * unblocks them would invert the workflow.
 */
export function AllocationPanel({ month, currency, tier, envelope, onWrote, onSetUpIncome, span }: {
  month: string
  currency: Currency
  tier: TierQuery
  /** The same month's envelope. Owned by Home for the same reason `tier` is. */
  envelope: EnvelopeQuery
  /** A write happened here: the page's own figures (Spendable, expenses, recent) are now stale. */
  onWrote?: () => void
  /** No income set — send the reader to the one control that fixes it instead of stating a fact. */
  onSetUpIncome?: () => void
  span?: TileSpan
}) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [payTarget, setPayTarget] = useState<{ bucket: Bucket; suggested: number } | null>(null)
  const [payBankOpen, setPayBankOpen] = useState(false)

  const data = tier.data
  const env = envelope.data
  const lines = data?.allocation?.lines ?? []
  const recommended = lines.filter(l => l.recommended)
  /**
   * Money can sit in a bucket this level does not recommend — a bank loan plus a personal debt
   * leaves the emergency fund unrecommended, for one — and the backend keeps filling `paidAmount`
   * on those lines precisely so it can be shown. Summing only the recommended ones made Home the
   * one screen that could not see it while Plan, the bucket pages and Months all counted it.
   */
  const offPlan = lines.filter(l => !l.recommended && (l.paidAmount ?? 0) > 0)
  /** Exactly the buckets that get a chip below; the breakdown names only what the chips do not. */
  const chipLines = [...recommended, ...offPlan]
  const chipBuckets = new Set<string>(chipLines.map(l => l.bucket))

  /**
   * "Set aside" is the month envelope's figure, never this panel's own sum.
   *
   * The tier carries the three allocation buckets and nothing else, so adding its lines up printed
   * a smaller number than Months under the identical word the moment a savings goal or a stock
   * purchase was funded — one word, two numbers, which is the defect this whole design exists to
   * prevent. `taggedTotal` is the figure Months prints, so the two can no longer drift apart.
   */
  const setAside = env?.taggedTotal ?? 0

  /**
   * The parts of that total the chips below do not show. Stocks and savings goals are funded like
   * any other bucket but no level asks for them, so they reach no tier line and, before this,
   * appeared on no Home or Plan tile at all — real money visible only inside somebody else's
   * total. Listing every component the chips miss is what keeps the parts equal to the whole.
   */
  const otherParts = env
    ? [
        { key: 'DONATION',    label: t('page.months.donation'),     amount: env.donation },
        { key: 'EMERGENCY',   label: t('page.months.emergency'),    amount: env.emergency },
        { key: 'INVESTMENTS', label: t('page.months.investments'),  amount: env.investments },
        { key: 'stocks',      label: t('page.months.stocks'),       amount: env.stocks },
        { key: 'savings',     label: t('page.months.savingsGoals'), amount: env.savings },
      ].filter(p => p.amount > 0 && !chipBuckets.has(p.key))
    : []

  const targetTotal = recommended.reduce((sum, l) => sum + (l.minAmount ?? 0), 0)
  // Progress against the plan stays a recommended-only figure: a bucket with no target cannot be
  // behind on one, and letting an off-plan payment fill the bar would clear an ask nobody met.
  const planPaid = recommended.reduce((sum, l) => sum + (l.paidAmount ?? 0), 0)
  // Paying more than the month asked for is a good outcome, not a 142%-complete bar: the bar caps
  // and the surplus is stated as its own figure, so no part is ever drawn larger than its whole.
  const ahead = Math.max(0, planPaid - targetTotal)
  const behind = Math.max(0, targetTotal - planPaid)
  const donePct = targetTotal > 0 ? Math.min(100, (planPaid / targetTotal) * 100) : 0
  const locked = data?.allocation?.allocationLocked ?? false

  const bank = (data?.allocation?.actions ?? []).find(a => a.action === 'PAY_BANK')

  // A bucket payment moves both figures, and the panel owns neither query — so it refreshes both
  // itself and leaves `onWrote` to the rest of the page.
  const afterWrite = () => { tier.refetch(); envelope.refetch(); onWrote?.() }

  const status: { text: string; tone: 'ok' | 'attention' } =
    ahead > 0   ? { text: t('cmp.dashAlloc.aheadChip', { amount: money(ahead, currency) }), tone: 'ok' }
    : behind > 0 ? { text: t('cmp.dashAlloc.leftChip', { amount: money(behind, currency) }), tone: 'attention' }
    :              { text: t('cmp.dashAlloc.doneChip'), tone: 'ok' }

  return (
    <Tile span={span} as="section">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-title text-slate-900">{t('cmp.dashAlloc.title')}</h3>
          {/* Deliberately not `data.levelLabel`: the backend builds that string in English only,
              and the level itself belongs on Plan, where the ladder that explains it lives. */}
          <p className="text-sm text-slate-500 mt-0.5">{t('cmp.dashAlloc.subtitle')}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<ArrowUpRight className="w-4 h-4" aria-hidden="true" />}
          label={t('cmp.dashAlloc.openPlan')}
          onClick={() => navigate('/overview')}
          className="shrink-0"
        />
      </div>

      {/* Both queries feed the figures below, so either one refreshing dims the whole block. */}
      <div className={`mt-4 ${tier.refreshing || envelope.refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}`}>
        {tier.loading ? (
          <Skeleton variant="stat" bare />
        ) : tier.error && !data ? (
          <ErrorTile compact message={tier.error} onRetry={tier.refetch} />
        ) : !data ? (
          <p className="text-sm text-slate-500">{t('cmp.dashAlloc.unavailable')}</p>
        ) : (
          <div className="space-y-4">
            {tier.error && <ErrorTile compact message={tier.error} onRetry={tier.refetch} />}

            {/* Bank loan payment first — it is what unlocks everything below it. */}
            {bank && <BankStrip bank={bank} currency={currency} onPay={() => setPayBankOpen(true)} />}

            {/* Why there is no plan comes first — but it no longer hides the money, so a month
                with nothing recommended and something already set aside still shows both. */}
            {recommended.length === 0 && <WithheldReason data={data} onSetUpIncome={onSetUpIncome} />}

            {(setAside > 0 || chipLines.length > 0) && (
              <div>
                {/* "Set aside" here means what it means on Months: everything that went into a
                    bucket this month, marks included. One word, one number, both screens. */}
                <p className="text-label uppercase text-slate-500">{t('ui.scope.setAside')}</p>

                {envelope.loading ? (
                  // Sized to the figure it stands in for, so nothing under it moves on arrival.
                  <Skeleton variant="text" count={1} bare className="mt-1.5 flex h-8 items-center" />
                ) : !env ? (
                  // A wrong total under this word is the bug being fixed, so a failed envelope
                  // prints no number at all — the retry is the only thing offered.
                  <div className="mt-1.5">
                    <ErrorTile
                      compact
                      message={envelope.error ?? t('page.dashboard.alloc.setAsideUnavailable')}
                      onRetry={envelope.refetch}
                    />
                  </div>
                ) : (
                  <>
                    <p className="mt-1.5 text-stat tabular-nums text-slate-900">{money(setAside, currency)}</p>

                    {/* Same disclosure, same words as Months: naming the marked share is the only
                        way "Set aside" can stay one word for the whole figure without overstating
                        what left the wallets. */}
                    {env.markedNotMoved > 0 && (
                      <p className="mt-1 text-sm text-slate-500">
                        {t('page.months.markedNotMoved')}{' · '}
                        <span className="tabular-nums">{money(env.markedNotMoved, currency)}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {recommended.length > 0 && (
              <div>
                {/* The plan's own subtotal counts the buckets this level asks for and nothing
                    else. It is a different number from the total above, so it carries a different
                    name — the alternative is the same word meaning two things again. */}
                <p className="text-label uppercase text-slate-500">{t('page.dashboard.alloc.planScope')}</p>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-title tabular-nums text-slate-900">
                    {t('page.dashboard.alloc.planOf', {
                      paid: money(planPaid, currency),
                      target: money(targetTotal, currency),
                    })}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-chip px-2 py-0.5 text-xs font-semibold tabular-nums ${
                      status.tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {status.text}
                  </span>
                </div>

                {/* One segment per recommended bucket, each sized by its share of the target
                    and filled by its own progress, so the bar reads as "which buckets are
                    done". The segments are told apart by the hairline between them rather
                    than by an identity colour, which belongs on the icon chip only. */}
                <div
                  className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden flex"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(donePct)}
                  aria-label={t('page.dashboard.alloc.planScope')}
                >
                  {recommended.map(l => {
                    const target = l.minAmount ?? 0
                    const paid = Math.min(l.paidAmount ?? 0, target)
                    const share = targetTotal > 0 ? (target / targetTotal) * 100 : 0
                    const fill = target > 0 ? (paid / target) * 100 : 0
                    // The divider is a border, and box-sizing is border-box everywhere, so
                    // it comes out of the segment's own width instead of overflowing the bar.
                    return (
                      <div
                        key={l.bucket}
                        style={{ width: `${share}%` }}
                        className="h-full border-r border-white last:border-r-0"
                      >
                        <div
                          className={`h-full ${fill >= 100 ? 'bg-income' : 'bg-indigo-500'}`}
                          style={{ width: `${fill}%` }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {locked && chipLines.length > 0 && (
              <p className="flex items-start gap-2 text-sm text-amber-700">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                {t('cmp.dashAlloc.lockedHint')}
              </p>
            )}

            {(chipLines.length > 0 || otherParts.length > 0) && (
              <div>
                <p className="text-label uppercase text-slate-500 mb-2">{t('page.dashboard.alloc.bucketsHeading')}</p>

                {chipLines.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {chipLines.map(l => (
                      <BucketChip
                        key={l.bucket}
                        line={l}
                        currency={currency}
                        locked={locked}
                        onPay={suggested => setPayTarget({ bucket: l.bucket, suggested })}
                      />
                    ))}
                  </div>
                )}

                {/* Rows, not chips: nothing here is a bucket you can pay into from this panel.
                    They are listed all the same, because the total above counts them and until
                    now they appeared on no tile on Home or Plan at all. */}
                {otherParts.length > 0 && (
                  <dl className={`space-y-1 ${chipLines.length > 0 ? 'mt-3' : ''}`}>
                    {otherParts.map(p => (
                      <div key={p.key} className="flex items-baseline justify-between gap-4 text-sm">
                        <dt className="min-w-0 truncate text-slate-500">{p.label}</dt>
                        <dd className="shrink-0 tabular-nums text-slate-600">{money(p.amount, currency)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <PayBucketModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        onSaved={() => { afterWrite(); setPayTarget(null) }}
        bucket={payTarget?.bucket ?? null}
        suggestedAmount={payTarget?.suggested}
        currency={currency}
        defaultMonth={month} />

      <PayBankInstallmentModal
        open={payBankOpen}
        onClose={() => setPayBankOpen(false)}
        onSaved={() => { afterWrite(); setPayBankOpen(false) }}
        defaultMonth={month} />
    </Tile>
  )
}

/**
 * Why there is no plan this month. The backend's own prose is English-only, so every state it
 * also reports as a typed flag is rendered from the dictionary; anything else falls through to
 * the note, which is still the most specific thing anyone can say about it.
 *
 * The branches are in the backend's own order of precedence (`OverviewService.tier`): missing
 * income, then a month before tracking started, then unpaid mandatory bills.
 */
function WithheldReason({ data, onSetUpIncome }: {
  data: OverviewTierResponse
  onSetUpIncome?: () => void
}) {
  const { t } = useLang()
  const navigate = useNavigate()
  const notes = (data.allocation?.actions ?? []).filter(a => !a.action)

  if (data.missingStableIncome) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{t('cmp.dashAlloc.missingIncome')}</p>
        {onSetUpIncome && (
          <Button variant="primary" label={t('page.dashboard.getStarted.setItUp')} onClick={onSetUpIncome} />
        )}
      </div>
    )
  }

  if (data.beforeTrackingStart) {
    return <p className="text-sm text-slate-600">{t('cmp.dashAlloc.beforeTrackingStart')}</p>
  }

  /**
   * An unpaid mandatory bill withholds the level and the entire allocation. The bills themselves
   * are on the wire, so the reason and the amounts are built here — the note branch below would
   * otherwise print the server's English sentence verbatim to a reader who has chosen Uzbek.
   */
  if (data.subscriptionsPending) {
    const pending = data.pendingSubscriptions ?? []
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{t('page.dashboard.alloc.subscriptionsPending')}</p>

        {pending.length > 0 && (
          <div>
            <p className="text-label uppercase text-slate-500">{t('page.dashboard.alloc.billsLeftToPay')}</p>
            <dl className="mt-1.5 space-y-1">
              {pending.map(p => (
                <div key={p.id} className="flex items-baseline justify-between gap-4 text-sm">
                  <dt className="min-w-0 truncate text-slate-600">{p.name}</dt>
                  {/* Each subscription is quoted in its own currency, which is what the payload
                      carries and what the Pay modal expects. */}
                  <dd className="shrink-0 tabular-nums text-slate-900">
                    {money(Math.max(0, p.amount - p.paid), p.currency)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <Button
          variant="primary"
          icon={<ArrowUpRight className="w-4 h-4" aria-hidden="true" />}
          label={t('page.dashboard.alloc.payBills')}
          onClick={() => navigate('/finance/monthly-payments')}
        />
      </div>
    )
  }

  if (notes.length === 0) {
    return <p className="text-sm text-slate-600">{t('cmp.dashAlloc.nothingThisMonth')}</p>
  }

  return (
    <div className="space-y-1.5">
      {notes.map((n, i) => (
        <p key={i} className="text-sm text-slate-600 leading-relaxed">{n.text}</p>
      ))}
    </div>
  )
}

/** What is owed on the bank loan this month, what has been paid, and the way to pay it. */
function BankStrip({ bank, currency, onPay }: {
  bank: { paid: number | null; target: number | null }
  currency: Currency
  onPay: () => void
}) {
  const { t } = useLang()
  const target = bank.target ?? 0
  const paid = bank.paid ?? 0
  const pct = target > 0 ? Math.min(100, (paid / target) * 100) : 0
  const done = target > 0 && paid >= target

  return (
    <div className="rounded-control border border-hairline p-3">
      <div className="flex items-center gap-3">
        <span className={`w-9 h-9 rounded-chip flex items-center justify-center shrink-0 ${
          done ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
        }`}>
          <Landmark className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            {done && <Check className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />}
            {t('cmp.dashAlloc.bankTitle')}
          </p>
          <p className="text-sm text-slate-600 tabular-nums">
            {t('cmp.dashAlloc.paidOf', { paid: money(paid, currency), target: money(target, currency) })}
          </p>
        </div>
        {!done && (
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-4 h-4" aria-hidden="true" />}
            label={t('page.shared.payButton')}
            onClick={onPay}
            className="shrink-0"
          />
        )}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${done ? 'bg-income' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/**
 * One bucket: what it asked for, what has gone in, and a single tap to add to it.
 *
 * A bucket this level does not recommend has no target, so it gets no bar and no arithmetic —
 * just the amount that is in it and Plan's own words for why nothing is being asked of it.
 */
function BucketChip({ line, currency, locked, onPay }: {
  line: AllocationLine
  currency: Currency
  locked: boolean
  onPay: (suggested: number) => void
}) {
  const { t } = useLang()
  const meta = BUCKET_META[line.bucket]
  const label = t(meta.labelKey)
  const target = line.minAmount ?? 0
  const paid = line.paidAmount ?? 0
  const remaining = line.remainingAmount ?? Math.max(0, target - paid)
  const pct = target > 0 ? Math.min(100, (paid / target) * 100) : 0
  const done = target > 0 && paid >= target

  return (
    <button
      type="button"
      onClick={() => onPay(remaining > 0 ? remaining : target)}
      disabled={locked}
      title={locked ? t('cmp.dashAlloc.lockedHint') : undefined}
      aria-label={t('cmp.dashAlloc.addTo', { bucket: label })}
      className="focus-ring min-h-[44px] cursor-pointer rounded-control border border-hairline p-3 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-chip flex items-center justify-center shrink-0 ${meta.chip}`}>
          <meta.Icon className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{label}</span>
        {done && <Check className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />}
      </div>
      <p className="mt-2 text-sm text-slate-600 tabular-nums">
        {t('cmp.dashAlloc.paidChip', { amount: money(paid, currency) })}
      </p>
      <p className="text-xs text-slate-500 tabular-nums">
        {line.recommended
          ? t('cmp.dashAlloc.targetChip', { amount: money(target, currency) })
          : t('page.overview.notNeededThisMonth')}
      </p>
      {line.recommended && (
        <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${done ? 'bg-income' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </button>
  )
}
