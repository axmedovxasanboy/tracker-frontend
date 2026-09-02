import { useState } from 'react'
import { useParams, useNavigate, NavLink } from 'react-router-dom'
import {
  Calendar, TrendingUp, AlertTriangle, Settings as SettingsIcon,
  Gauge, Building2, HeartHandshake, ShieldAlert,
  Wallet, ListChecks, Scale, Landmark, Check, Minus, LineChart,
  Split, History, Plus, PiggyBank, ChevronDown, ChevronRight, Lock,
} from 'lucide-react'
import { format, parse } from 'date-fns'
import { useApi } from '../hooks/useApi'
import { overviewApi } from '../api/overview'
import { financeApi } from '../api/finance'
import { formatCurrency } from '../utils/format'
import { Spinner } from '../components/ui/Spinner'
import { InvestmentsPage } from './InvestmentsPage'
import { DonationsPage } from './DonationsPage'
import { EmergenciesPage } from './EmergenciesPage'
import { PayBucketModal } from '../components/overview/PayBucketModal'
import { PayBankInstallmentModal } from '../components/overview/PayBankInstallmentModal'
import { PayPersonalLoanModal } from '../components/overview/PayPersonalLoanModal'
import { AllocationRulesModal } from '../components/overview/AllocationRulesModal'
import { BucketHistoryPanel } from '../components/overview/BucketHistoryPanel'
import { PaySubscriptionModal } from '../components/finance/PaySubscriptionModal'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import type { ActionItem, AllocationLine, Bucket, Currency, MonthlyPaymentResponse, OverviewTierResponse, PendingSubscription } from '../types'

type OverviewTab = 'dashboard' | 'investments' | 'donations' | 'emergencies'

const TABS: { id: OverviewTab; labelKey: TKey; icon: typeof Gauge }[] = [
  { id: 'dashboard',    labelKey: 'nav.dashboard',            icon: Gauge },
  { id: 'investments',  labelKey: 'page.investments',         icon: Building2 },
  { id: 'donations',    labelKey: 'page.donations',           icon: HeartHandshake },
  { id: 'emergencies',  labelKey: 'page.overview.tabEmergencies', icon: ShieldAlert },
]

interface Props {
  currency: Currency
}

function currentMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

function formatMonthLabel(ym: string): string {
  try {
    return format(parse(ym, 'yyyy-MM', new Date()), 'MMMM yyyy')
  } catch {
    return ym
  }
}

export function Overview({ currency }: Props) {
  // Aliased: this component also uses `t` for the tier-data payload below.
  const { t: translate } = useLang()
  const { tab } = useParams<{ tab: OverviewTab }>()
  const navigate = useNavigate()

  // Default to current month if the user hasn't picked one yet. The URL holds it
  // as ?month=YYYY-MM so a refresh / share preserves the selection.
  const searchParams = new URLSearchParams(window.location.search)
  const month = searchParams.get('month') || currentMonth()

  const setMonth = (m: string) => {
    const next = new URLSearchParams(window.location.search)
    next.set('month', m)
    navigate(`/overview/${tab ?? 'dashboard'}?${next.toString()}`, { replace: true })
  }

  const income = useApi(() => overviewApi.getIncome(month, currency), [month, currency])
  // Tier fetched here so the badge can sit ABOVE the tabs (always visible); the same result
  // is handed to the Dashboard tab so there's a single fetch + a single refetch after pays.
  const tier = useApi(() => overviewApi.getTier(month, currency), [month, currency])
  const t = tier.data
  // Only surface the badge once the tier is actually resolved (income set, tracking started,
  // subscriptions paid) — otherwise the Dashboard tab shows the relevant "locked" message.
  const showTierBadge = !!t && !t.missingStableIncome && !t.beforeTrackingStart
    && !t.subscriptionsPending && t.level != null

  const activeTab: OverviewTab = (tab as OverviewTab) ?? 'dashboard'

  // Pay-first gate: hide the Overview tabs (and keep the user on the dashboard) until mandatory
  // subscriptions AND the debt action items are paid. Open while the tier is still loading so the
  // tabs don't flicker away on first paint.
  const gateOpen = !t || (!t.subscriptionsPending && !t.allocation?.allocationLocked)

  return (
    <div className="p-6 space-y-6">
      {/* Earned card + tier badge — side by side */}
      <div className={`grid grid-cols-1 gap-4 items-stretch ${showTierBadge ? 'lg:grid-cols-2' : ''}`}>
      {/* Earned this month */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                {translate('page.overview.earnedIn', { month: formatMonthLabel(month) })}
              </p>
              {income.loading && !income.data ? (
                <div className="h-8 flex items-center"><Spinner className="w-4 h-4" /></div>
              ) : (
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(income.data?.actualIncome ?? 0, currency, true)}
                </p>
              )}
              {income.data?.stableIncome != null && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {translate('page.overview.stableIncomeSettingsLabel')} <span className="font-medium text-slate-600">
                    {formatCurrency(income.data.stableIncome, currency, true)}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Month picker */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input type="month" value={month}
              onChange={e => setMonth(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
      </section>

      {/* Tier badge — beside the earned card */}
      {showTierBadge && t && <LevelBadge tier={t} />}
      </div>

      {/* Tier breakdown cards — before the tabs */}
      {t && !t.missingStableIncome && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <BreakdownCard
            icon={TrendingUp} color="emerald"
            label={translate('page.overview.stableIncomeLabel')}
            value={formatCurrency(t.income, currency, true)}
            hint={translate('page.overview.fromSettingsHint')} />
          <BreakdownCard
            icon={ListChecks} color="violet"
            label={translate('page.overview.mandatoryLabel')}
            value={formatCurrency(t.mandatorySubscriptions, currency, true)}
            hint={translate('page.overview.activeMonthlySubsHint')} />
          <BreakdownCard
            icon={Wallet} color="indigo"
            label={translate('page.overview.leftMoneyLabel')}
            value={formatCurrency(t.leftMoney, currency, true)}
            hint={translate('page.overview.leftMoneyHint')} />
          <BreakdownCard
            icon={Scale}
            color={t.debtRatio != null && t.debtRatio > 0.7 ? 'rose' : 'amber'}
            label={translate('page.overview.debtPaymentsLabel')}
            value={formatCurrency(t.debtPayments, currency, true)}
            hint={t.debtRatio != null
              ? translate('page.overview.debtRatioHint', { pct: (t.debtRatio * 100).toFixed(1) })
              : translate('page.overview.debtMathHint')} />
        </div>
      )}

      {/* Overview tabs — hidden until subscriptions + debt action items are paid. The
          "Allocation Due" ledger now lives inside the dashboard tab, AFTER the action items. */}
      {gateOpen && (
        <nav className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <div className="flex">
            {TABS.map(({ id, labelKey, icon: Icon }) => (
              <NavLink key={id}
                to={`/overview/${id}${window.location.search}`}
                replace
                className={({ isActive }) =>
                  `flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive || id === activeTab
                      ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`
                }>
                <Icon className="w-4 h-4" />
                {translate(labelKey)}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {/* Tab content. While anything's unpaid (gate closed) we force the dashboard, so the
          pay-first sections are all the user sees. */}
      <div>
        {!gateOpen ? (
          <TierDashboard currency={currency} month={month} tier={tier} />
        ) : (
          <>
            {activeTab === 'dashboard' && <TierDashboard currency={currency} month={month} tier={tier} />}
            {activeTab === 'investments' && <InvestmentsPage />}
            {activeTab === 'donations' && <DonationsPage />}
            {activeTab === 'emergencies' && <EmergenciesPage />}
          </>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Allocation helpers — shared by the unified Allocation section (guidance + ledger)
// ────────────────────────────────────────────────────────────────────────────────

function fmtPct(n: number): string {
  return `${+n.toFixed(1)}`
}

const BUCKET_LABEL_KEYS: Record<string, TKey> = {
  DONATION:    'page.overview.bucketDonation',
  EMERGENCY:   'page.overview.bucketEmergency',
  INVESTMENTS: 'page.overview.bucketInvestments',
  STOCKS:      'page.overview.bucketStocks',
}

function bucketTitle(b: string, translate: (key: TKey) => string): string {
  const key = BUCKET_LABEL_KEYS[b]
  return key ? translate(key) : b.charAt(0) + b.slice(1).toLowerCase()
}

function rangeLabel(start: string, end: string | null): string {
  if (!end || end === start) return formatMonthLabel(start)
  return `${formatMonthLabel(start)} – ${formatMonthLabel(end)}`
}

// ────────────────────────────────────────────────────────────────────────────────
// Tier Dashboard
// ────────────────────────────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<number, { bg: string; ring: string; text: string; labelKey: TKey }> = {
  1: { bg: 'bg-rose-50',    ring: 'ring-rose-200',    text: 'text-rose-700',    labelKey: 'page.overview.tier1Label' },
  2: { bg: 'bg-amber-50',   ring: 'ring-amber-200',   text: 'text-amber-700',   labelKey: 'page.overview.tier2Label' },
  3: { bg: 'bg-yellow-50',  ring: 'ring-yellow-200',  text: 'text-yellow-700',  labelKey: 'page.overview.tier3Label' },
  4: { bg: 'bg-lime-50',    ring: 'ring-lime-200',    text: 'text-lime-700',    labelKey: 'page.overview.tier4Label' },
  5: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-700', labelKey: 'page.overview.tier5Label' },
  6: { bg: 'bg-indigo-50',  ring: 'ring-indigo-200',  text: 'text-indigo-700',  labelKey: 'page.overview.tier6Label' },
}

const SUB_STYLES: Record<string, { bg: string; text: string; labelKey: TKey }> = {
  '1.1': { bg: 'bg-emerald-100', text: 'text-emerald-700', labelKey: 'page.overview.subLevelNoDebt' },
  '1.2': { bg: 'bg-amber-100',   text: 'text-amber-700',   labelKey: 'page.overview.subLevel1_2' },
  '1.3': { bg: 'bg-rose-100',    text: 'text-rose-700',    labelKey: 'page.overview.subLevel1_3' },
}

function TierDashboard({ currency, month, tier }: {
  currency: Currency; month: string; tier: ReturnType<typeof useApi<OverviewTierResponse>>
}) {
  // Aliased: this component also uses `t` for the tier-data payload below.
  const { t: translate } = useLang()
  const t = tier.data

  // Pay flow + history state — both bucket-scoped, optional.
  const [payTarget, setPayTarget] = useState<{ bucket: Bucket; suggested?: number } | null>(null)
  const [historyBucket, setHistoryBucket] = useState<Bucket | null>(null)
  // Action-item pay modals
  const [payBankOpen, setPayBankOpen] = useState(false)
  const [payPersonalOpen, setPayPersonalOpen] = useState(false)
  // Levels 2–6 allocation-rules editor
  const [rulesOpen, setRulesOpen] = useState(false)
  // Subscription pay modal (mandatory subscriptions are the first gate)
  const subs = useApi(() => financeApi.getMonthlyPayments(), [])
  const [paySub, setPaySub] = useState<MonthlyPaymentResponse | null>(null)

  if (tier.loading && !t) {
    return <section className="h-48 flex items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm"><Spinner /></section>
  }

  if (!t) {
    return <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-sm text-slate-500">{translate('page.overview.tierDataUnavailable')}</section>
  }

  const dormant = t.beforeTrackingStart
  const startLabel = t.trackingStartMonth ? formatMonthLabel(t.trackingStartMonth) : null
  // Until mandatory subscriptions are paid, withhold the level / sub-level / action items / allocation.
  const subsPending = t.subscriptionsPending
  const openPaySub = (id: number) => {
    const full = subs.data?.find(s => s.id === id)
    if (full) setPaySub(full)
  }

  return (
    <div className="space-y-5">
      {/* Tracking-not-started banner — guidance is paused until the configured start month */}
      {dormant && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-100 border border-slate-300">
          <Calendar className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600">
            <p className="font-semibold text-slate-700">{translate('page.overview.trackingNotStarted')}</p>
            <p className="mt-0.5">
              {translate('page.overview.trackingNotStartedPre')}{' '}
              <span className="font-semibold">{startLabel}</span>. {translate('page.overview.trackingNotStartedPost')}
            </p>
          </div>
        </div>
      )}

      {/* Missing-income banner — highest priority */}
      {t.missingStableIncome && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">{translate('page.overview.missingIncomeTitle')}</p>
            <p className="mt-0.5">
              {translate('page.overview.missingIncomePre')}{' '}
              <NavLink to="/settings" className="font-semibold underline">{translate('action.openSettings')}</NavLink>.
            </p>
          </div>
        </div>
      )}

      {/* When tracking hasn't started, everything below is greyed + inert. */}
      <div className={dormant ? 'space-y-5 opacity-50 grayscale pointer-events-none select-none' : 'space-y-5'}>
        {/* Step 1 — pay mandatory subscriptions. While any is unpaid this month, the level,
            sub-level, action items and allocation stay hidden until they're covered. */}
        {subsPending && (
          <SubscriptionsToPaySection
            subscriptions={t.pendingSubscriptions}
            month={month}
            onPay={openPaySub} />
        )}

        {/* Action items — debts to pay first. Shown ABOVE the dashboard. Their recommended
            amounts gate the allocation section: until they're met, recording is locked.
            Hidden until mandatory subscriptions are paid. */}
        {!subsPending && (
          <ActionItemsSection tier={t}
            onPayBank={() => setPayBankOpen(true)}
            onPayPersonal={() => setPayPersonalOpen(true)} />
        )}

        {/* Allocation — the per-bucket guidance cards and the cross-month "due" ledger, unified
            into one card. Shown AFTER the action items so debts come first; recording is locked
            until each action item reaches its recommended amount. */}
        {!subsPending && (
          <AllocationSection tier={t} currency={currency} month={month}
            locked={t.allocation?.allocationLocked ?? false}
            onPay={(bucket, suggested) => setPayTarget({ bucket, suggested })}
            onHistory={(bucket) => setHistoryBucket(bucket)}
            onConfigure={() => setRulesOpen(true)} />
        )}


        {/* Debt breakdown */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-700">{translate('page.overview.debtBreakdownHeading')}</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DebtRow label={translate('page.finance.tabBankLoans')} hint={translate('page.overview.monthlyInstallmentHint')} value={formatCurrency(t.debtBreakdown.bankLoans, currency, true)} />
            <DebtRow label={translate('page.overview.borrowedPctLabel')} hint={translate('page.overview.cappedHint')} value={formatCurrency(t.debtBreakdown.loansTaken, currency, true)} />
            <DebtRow label={translate('page.overview.debtsPctLabel')} hint={translate('page.overview.cappedHint')} value={formatCurrency(t.debtBreakdown.debts, currency, true)} />
          </div>
        </section>

        {/* Bucket payment history panel — shown inline below */}
        {historyBucket && (
          <BucketHistoryPanel
            bucket={historyBucket}
            month={month}
            currency={currency}
            onClose={() => setHistoryBucket(null)} />
        )}
      </div>

      {/* Pay-bucket modal */}
      <PayBucketModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        onSaved={() => { tier.refetch(); setPayTarget(null) }}
        bucket={payTarget?.bucket ?? null}
        suggestedAmount={payTarget?.suggested}
        currency={currency}
        defaultMonth={month} />

      {/* Action-item modals */}
      <PayBankInstallmentModal
        open={payBankOpen}
        onClose={() => setPayBankOpen(false)}
        onSaved={() => { tier.refetch(); setPayBankOpen(false) }}
        defaultMonth={month} />
      <PayPersonalLoanModal
        open={payPersonalOpen}
        onClose={() => setPayPersonalOpen(false)}
        onSaved={() => { tier.refetch(); setPayPersonalOpen(false) }}
        defaultMonth={month} />

      {/* Allocation-rules editor — view all income tiers to compare; edit only your current level */}
      <AllocationRulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        onSaved={() => { tier.refetch(); setRulesOpen(false) }} />

      {/* Subscription pay modal — records a real transaction; refetch unlocks the tier once covered */}
      <PaySubscriptionModal
        open={!!paySub}
        subscription={paySub}
        onClose={() => setPaySub(null)}
        onSaved={() => { tier.refetch(); subs.refetch(); setPaySub(null) }} />
    </div>
  )
}

// Step-1 gate: the mandatory subscriptions still owed this month, each with a Pay button.
function SubscriptionsToPaySection({ subscriptions, month, onPay }: {
  subscriptions: PendingSubscription[]
  month: string
  onPay: (id: number) => void
}) {
  const { t } = useLang()
  return (
    <section className="bg-white rounded-2xl border border-violet-200 shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-violet-600" />
        <h4 className="text-sm font-semibold text-slate-700">{t('page.overview.paySubsFirstHeading')}</h4>
      </div>
      <p className="text-xs text-slate-500 -mt-1">
        {t('page.overview.paySubsFirstDesc', { month: formatMonthLabel(month), count: subscriptions.length })}
      </p>
      <div className="space-y-2">
        {subscriptions.map(s => {
          const remaining = Math.max(0, s.amount - s.paid)
          return (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.paid > 0
                    ? t('page.overview.subPaidOfAmount', { paid: formatCurrency(s.paid, s.currency), amount: formatCurrency(s.amount, s.currency), remaining: formatCurrency(remaining, s.currency) })
                    : t('page.overview.subAmountDue', { amount: formatCurrency(s.amount, s.currency) })}
                </p>
              </div>
              <button type="button" onClick={() => onPay(s.id)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors">
                <Wallet className="w-3.5 h-3.5" /> {t('page.shared.payButton')}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// Style a sub-level by exact key (Level 1) or fall back to the debt suffix (.1/.2/.3)
// so Levels 2–6 sub-levels (e.g. "3.2") render with the right colour + label.
function subLevelStyle(subLevel: string | null): { bg: string; text: string; labelKey: TKey } | null {
  if (!subLevel) return null
  if (SUB_STYLES[subLevel]) return SUB_STYLES[subLevel]
  if (subLevel.endsWith('.1')) return { bg: 'bg-emerald-100', text: 'text-emerald-700', labelKey: 'page.overview.subLevelNoDebt' }
  if (subLevel.endsWith('.2')) return { bg: 'bg-amber-100', text: 'text-amber-700', labelKey: 'page.overview.subLevelManageable' }
  if (subLevel.endsWith('.3')) return { bg: 'bg-rose-100', text: 'text-rose-700', labelKey: 'page.overview.subLevelHigh' }
  return null
}

function LevelBadge({ tier }: { tier: OverviewTierResponse }) {
  const { t } = useLang()
  // Level may be null (above tier 6 or missing income). Style accordingly.
  const style = tier.level != null ? LEVEL_STYLES[tier.level] : null
  const subStyle = subLevelStyle(tier.subLevel)

  return (
    <section className={`rounded-2xl border border-slate-100 shadow-sm p-6 ring-1 ${style?.ring ?? 'ring-slate-200'} ${style?.bg ?? 'bg-white'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('page.overview.tierThisMonth')}</p>
          <p className={`text-3xl font-bold mt-1 ${style?.text ?? 'text-slate-700'}`}>
            {tier.levelLabel}
          </p>
          {style && (
            <p className="text-sm text-slate-500 mt-1">{t(style.labelKey)}</p>
          )}
        </div>
        {subStyle && (
          <div className={`px-4 py-2 rounded-xl ${subStyle.bg}`}>
            <p className={`text-xs font-semibold ${subStyle.text}`}>{t('page.overview.subLevelLabel', { level: tier.subLevel ?? '' })}</p>
            <p className={`text-sm font-medium ${subStyle.text}`}>{t(subStyle.labelKey)}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function BreakdownCard({
  icon: Icon, color, label, value, hint,
}: {
  icon: typeof Wallet
  color: 'emerald' | 'violet' | 'indigo' | 'amber' | 'rose'
  label: string
  value: string
  hint?: string
}) {
  // Tailwind safelist note: these classes are static; JIT picks them up.
  const colorMap = {
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    violet:  { bg: 'bg-violet-100',  text: 'text-violet-600'  },
    indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-600'  },
    amber:   { bg: 'bg-amber-100',   text: 'text-amber-600'   },
    rose:    { bg: 'bg-rose-100',    text: 'text-rose-600'    },
  }[color]
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg ${colorMap.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${colorMap.text}`} />
        </div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="text-xl font-bold text-slate-800 mt-2">{value}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function DebtRow({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-800 mt-1">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>
    </div>
  )
}

const BUCKET_ICONS = {
  DONATION:    { Icon: HeartHandshake, bg: 'bg-pink-100',    text: 'text-pink-600'    },
  EMERGENCY:   { Icon: ShieldAlert,    bg: 'bg-amber-100',   text: 'text-amber-600'   },
  INVESTMENTS: { Icon: Building2,      bg: 'bg-cyan-100',    text: 'text-cyan-600'    },
  STOCKS:      { Icon: LineChart,      bg: 'bg-indigo-100',  text: 'text-indigo-600'  },
} as const

// Action items live in their own section ABOVE the allocation guidance. Their recommended
// amounts gate allocation recording — pay debts first, then allocate.
function ActionItemsSection({ tier, onPayBank, onPayPersonal }: {
  tier: OverviewTierResponse
  onPayBank: () => void
  onPayPersonal: () => void
}) {
  const { t } = useLang()
  // Only meaningful once a tier is known. Missing-income / above-ceiling states are
  // covered by their own banners and the allocation section's empty state.
  if (tier.missingStableIncome || tier.level == null) return null

  const actions = tier.allocation?.actions ?? []
  const actionable = actions.filter(a => a.action)         // PAY_BANK / PAY_PERSONAL_LOAN
  const infos = actions.filter(a => !a.action)             // text-only scenario notes
  const locked = tier.allocation?.allocationLocked ?? false

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-amber-500" />
        <div>
          <h4 className="text-sm font-semibold text-slate-700">{t('page.overview.actionItemsHeading')}</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            {actionable.length === 0
              ? t('page.overview.noRequiredDebtPayments')
              : locked
                ? t('page.overview.payToUnlock')
                : t('page.overview.allocationUnlocked')}
          </p>
        </div>
      </div>

      {actionable.length === 0 && infos.length === 0 ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex items-center gap-2 text-sm text-emerald-700">
          <Check className="w-4 h-4 shrink-0" />
          {t('page.overview.noActionItemsClear')}
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 space-y-2">
          {actionable.map((a, i) => (
            <ActionRow key={`a-${i}`} action={a} currency={tier.currency}
              onPayBank={onPayBank} onPayPersonal={onPayPersonal} />
          ))}
          {infos.map((a, i) => (
            <p key={`i-${i}`} className="flex items-start gap-2 text-sm text-amber-900/80">
              <span className="text-amber-700 mt-0.5">•</span>
              <span className="flex-1">{a.text}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Allocation section — unified card: a cross-month "due" summary, the per-bucket
// guidance cards, and the running ledger (formerly two separate cards).
// ────────────────────────────────────────────────────────────────────────────────

function AllocationSection({ tier, currency, month, locked, onPay, onHistory, onConfigure }: {
  tier: OverviewTierResponse
  currency: Currency
  month: string
  locked: boolean
  onPay: (bucket: Bucket, suggested?: number) => void
  onHistory: (bucket: Bucket) => void
  onConfigure: () => void
}) {
  const { t } = useLang()
  const ledger = useApi(() => overviewApi.getAllocationLedger(month, currency), [month, currency])
  const [showBreakdown, setShowBreakdown] = useState(false)

  const allocation = tier.allocation
  // The rules editor shows every income tier for comparison; you can edit only your current
  // level. Level 1's percentages are built-in (its minimum-leftover is still editable);
  // Levels 2–6 are fully user-configured.
  const hasTier = tier.level != null
  const sublevelConfigurable = tier.level != null && tier.level >= 2 && tier.level <= 6
  const empty = !allocation || allocation.lines.length === 0

  // Ledger data — only meaningful once income is set and tracking has started. The parent
  // (TierDashboard) already shows the missing-income / not-started banners, so here we just
  // suppress the due-summary + ledger detail in those states to avoid duplicate messaging.
  const d = ledger.data
  const ledgerReady = !!d && !d.missingStableIncome && !d.beforeTrackingStart
  const totalDue = d?.totalDueNow ?? 0
  const carried = d?.carriedFromPrevious ?? 0
  const dueThis = d?.dueThisMonth ?? 0
  const allClear = totalDue <= 0
  const hasBuckets = !!d && d.buckets.length > 0

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-indigo-500" />
          <div>
            <h4 className="text-sm font-semibold text-slate-700">{t('page.overview.allocationHeading')}</h4>
            {allocation?.scenarioLabel && (
              <p className="text-xs text-slate-400 mt-0.5">{allocation.scenarioLabel}</p>
            )}
          </div>
        </div>
        {hasTier && (
          <button onClick={onConfigure}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-semibold hover:bg-indigo-50 transition-colors">
            <SettingsIcon className="w-3.5 h-3.5" /> {t('page.overview.allocationRulesButton')}
          </button>
        )}
      </div>

      {/* Due summary strip — the headline number, carried backlog, and recommended-this-month */}
      {ledger.loading && !d ? (
        <div className="h-16 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
          <Spinner />
        </div>
      ) : ledgerReady && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50/40 p-4">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <PiggyBank className="w-5 h-5 text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{t('page.overview.allocationDueLabel')}</p>
            <p className={`text-2xl font-bold ${allClear ? 'text-emerald-600' : 'text-slate-800'}`}>
              {allClear ? t('page.overview.allCaughtUp') : formatCurrency(totalDue, currency, true)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {carried > 0 && d?.carriedStartMonth && (
                <>
                  <span className="text-amber-600 font-medium">{formatCurrency(carried, currency, true)}</span>
                  {' '}{t('page.overview.carriedFromSuffix', { range: rangeLabel(d.carriedStartMonth, d.carriedEndMonth ?? null) })}{' '}
                </>
              )}
              {t('page.overview.recommendedThisMonth', { amount: formatCurrency(dueThis, currency, true) })}
            </p>
          </div>
        </div>
      )}

      {/* Per-bucket guidance — the actionable cards */}
      {empty ? (
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-500 space-y-3">
          <p>{t('page.overview.guidanceUnavailable')}</p>
          {sublevelConfigurable && (
            <button onClick={onConfigure}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
              <SettingsIcon className="w-3.5 h-3.5" />
              {t('page.overview.setLevelAllocation', { level: tier.subLevel ?? tier.level ?? '' })}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Locked banner — recording is gated on the action items above */}
          {locked && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <p>
                <span className="font-semibold">{t('page.overview.lockedBold')}</span>{' '}
                {t('page.overview.lockedRest')}
              </p>
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            {t('page.overview.percentagesPre')} <span className="font-medium text-slate-500">{t('page.overview.leftBalanceBold')}</span>
            {' '}({formatCurrency(tier.allocationBase, tier.currency, true)}) {t('page.overview.percentagesPost')}
            {tier.level === 1 && ' ' + t('page.overview.tier1Cutoff')}
          </p>

          {/* Bucket allocation lines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allocation.lines.map(l => (
              <AllocationCard key={l.bucket} line={l} currency={tier.currency}
                disabled={locked}
                onPay={(suggested) => onPay(l.bucket, suggested)}
                onHistory={() => onHistory(l.bucket)} />
            ))}
          </div>
        </>
      )}

      {/* Cross-month ledger — outstanding-per-bucket table + a collapsible per-month breakdown */}
      {ledgerReady && hasBuckets && (
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-3.5 h-3.5 text-violet-500" />
              <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('page.overview.outstandingAcrossMonths')}</h5>
            </div>
            {d!.months.length > 0 && (
              <button type="button" onClick={() => setShowBreakdown(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">
                {showBreakdown ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {t('page.overview.howCalculated')}
              </button>
            )}
          </div>

          <div className={`grid grid-cols-1 gap-5 items-start ${showBreakdown && d!.months.length > 0 ? 'lg:grid-cols-2' : ''}`}>
            {/* Per-bucket ledger table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
                    <th className="py-1.5 pr-3 font-medium">{t('page.overview.bucketCol')}</th>
                    <th className="py-1.5 px-3 font-medium text-right">{t('page.overview.dueCol')}</th>
                    <th className="py-1.5 px-3 font-medium text-right">{t('page.overview.carriedCol')}</th>
                    <th className="py-1.5 pl-3 font-medium text-right">{t('page.overview.outstandingCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {d!.buckets.map(b => (
                    <tr key={b.bucket} className="border-t border-slate-50">
                      <td className="py-2 pr-2">
                        <span className="font-medium text-slate-700">{b.label}</span>
                        {b.percent != null
                          ? <span className="ml-2 text-[11px] text-slate-400">{fmtPct(b.percent)}%</span>
                          : <span className="ml-2 text-[11px] text-slate-300">{t('page.overview.notRecommended')}</span>}
                        {b.overAllocated && b.effectivePercent != null && (
                          <span className="ml-2 text-[11px] text-emerald-600 font-medium">
                            {t('page.overview.gavePct', { pct: fmtPct(b.effectivePercent) })}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right text-slate-600 whitespace-nowrap">{formatCurrency(b.recommended, currency)}</td>
                      <td className={`py-2 text-right whitespace-nowrap ${b.carried > 0 ? 'text-amber-600' : b.carried < 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {b.carried === 0
                          ? '—'
                          : b.carried > 0
                            ? formatCurrency(b.carried, currency)
                            : `+${formatCurrency(-b.carried, currency)}`}
                      </td>
                      <td className={`py-2 text-right font-semibold whitespace-nowrap ${b.outstanding > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                        {b.outstanding > 0 ? formatCurrency(b.outstanding, currency) : '✓'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Transparent per-month breakdown — to the right of the table when expanded */}
            {showBreakdown && d!.months.length > 0 && (
              <div className="lg:border-l lg:border-slate-100 lg:pl-5 space-y-2.5">
                {d!.months.map(mo => (
                  <div key={mo.month}
                    className={`rounded-xl border p-3 ${mo.selected ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-100 bg-slate-50/50'}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                      <p className="text-xs font-semibold text-slate-700">
                        {formatMonthLabel(mo.month)}
                        {mo.selected && <span className="ml-2 text-[10px] text-indigo-500 uppercase tracking-wider">{t('page.overview.thisMonthTag')}</span>}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {t('page.overview.levelBaseLabel', { level: mo.subLevel ?? mo.level ?? '—', amount: formatCurrency(mo.allocationBase, currency, true) })}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      {mo.lines.map(l => (
                        <p key={l.bucket} className="text-[11px] text-slate-500 leading-relaxed">
                          <span className="text-slate-600 font-medium">{bucketTitle(l.bucket, t)}</span>
                          {l.percent != null && (
                            <> · {t('page.overview.pctOfBaseEquals', { pct: fmtPct(l.percent), base: formatCurrency(mo.allocationBase, currency, true), recommended: formatCurrency(l.recommended, currency) })}</>
                          )}
                          {' '}{t('page.overview.minusPaidEquals', { paid: formatCurrency(l.paid, currency) })}{' '}
                          <span className={l.net > 0 ? 'text-rose-500 font-medium' : l.net < 0 ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                            {l.net > 0
                              ? t('page.overview.behindAmount', { amount: formatCurrency(l.net, currency) })
                              : l.net < 0
                                ? t('page.overview.aheadAmount', { amount: formatCurrency(-l.net, currency) })
                                : t('page.overview.onTarget')}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function ActionRow({ action, currency, onPayBank, onPayPersonal }: {
  action: ActionItem
  currency: Currency
  onPayBank: () => void
  onPayPersonal: () => void
}) {
  const { t } = useLang()
  const hasProgress = action.target != null && action.target > 0 && action.paid != null
  const paid = action.paid ?? 0
  const target = action.target ?? 0
  // Unlock amount that counts as "met": bank = 90% of the average, personal = full target.
  const threshold = action.unlockThreshold ?? target
  const paidPct = hasProgress ? Math.min(100, (paid / target) * 100) : 0
  const met = hasProgress && paid >= threshold
  const showsThreshold = hasProgress && threshold > 0 && threshold < target

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <span className="text-amber-700 mt-0.5">•</span>
        <p className="flex-1 text-sm text-amber-900">{action.text}</p>
        {action.action === 'PAY_BANK' && (
          <button onClick={onPayBank}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
            <Plus className="w-3 h-3" /> {t('page.overview.recordButton')}
          </button>
        )}
        {action.action === 'PAY_PERSONAL_LOAN' && (
          <button onClick={onPayPersonal}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
            <Plus className="w-3 h-3" /> {t('page.overview.recordButton')}
          </button>
        )}
      </div>
      {hasProgress && (
        <div className="pl-4 space-y-1">
          <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${met ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${paidPct}%` }} />
          </div>
          <p className="text-[11px] text-amber-900/80">
            {t('page.overview.paidThisMonth', { paid: formatCurrency(paid, currency, true), target: formatCurrency(target, currency, true) })}
            {showsThreshold && (
              <span className="text-amber-900/60"> · {t('page.overview.unlocksAt', { threshold: formatCurrency(threshold, currency, true) })}</span>
            )}
            {met && <span className="ml-1 text-emerald-700 font-semibold">· {t('page.overview.metLabel')}</span>}
          </p>
        </div>
      )}
    </div>
  )
}

function AllocationCard({ line, currency, disabled, onPay, onHistory }: {
  line: AllocationLine
  currency: Currency
  disabled?: boolean
  onPay: (suggested?: number) => void
  onHistory: () => void
}) {
  const { t } = useLang()
  const meta = BUCKET_ICONS[line.bucket]
  const recommended = line.recommended
  const target = line.minAmount ?? 0
  const paid = line.paidAmount ?? 0
  const remaining = line.remainingAmount ?? Math.max(0, target - paid)
  const paidPct = target > 0 ? Math.min(100, (paid / target) * 100) : 0
  const complete = recommended && paid >= target && target > 0

  // Splitter — useful for planning how to break the remaining amount into N parts
  // before recording payments (the actual "split" is now expressed by paying multiple times).
  const [splitInput, setSplitInput] = useState<string>('1')
  const splitN = Math.max(1, Math.floor(Number(splitInput) || 1))
  const splitBasis = remaining > 0 ? remaining : target
  const perShare = splitN > 0 ? splitBasis / splitN : splitBasis

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${
      recommended ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-80'
    } ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${recommended ? meta.bg : 'bg-slate-200'}`}>
          <meta.Icon className={`w-4 h-4 ${recommended ? meta.text : 'text-slate-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            {complete
              ? <Check className="w-3 h-3 text-emerald-500" />
              : recommended
                ? <Check className="w-3 h-3 text-emerald-500" />
                : <Minus className="w-3 h-3 text-slate-400" />}
            {line.label}
          </p>
          {recommended ? (
            <p className="text-base font-bold text-slate-800 mt-0.5">
              ≥ {line.minPercent}%
              <span className="ml-1.5 text-xs font-medium text-slate-500">
                ({formatCurrency(target, currency, true)})
              </span>
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5 font-medium">{t('page.overview.notNeededThisMonth')}</p>
          )}
        </div>
        <button onClick={onHistory} title={t('page.overview.paymentHistoryThisMonthTitle')}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 shrink-0">
          <History className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress + paid/remaining — recommended cards only */}
      {recommended && (
        <>
          <div className="space-y-1">
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${paidPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>
                {t('page.overview.paidWord')} <span className="font-semibold text-slate-700">{formatCurrency(paid, currency, true)}</span>
                {target > 0 && <span className="text-slate-400"> ({Math.round(paidPct)}%)</span>}
              </span>
              <span>
                {complete
                  ? <span className="text-emerald-600 font-semibold">{t('page.overview.targetMetLabel')}</span>
                  : <>{t('page.shared.remaining')} <span className="font-semibold text-slate-700">{formatCurrency(remaining, currency, true)}</span></>}
              </span>
            </div>
          </div>

          {/* Action row: Record + Splitter */}
          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100">
            <button onClick={() => onPay(remaining > 0 ? remaining : target)}
              disabled={disabled}
              title={disabled ? t('page.overview.payActionItemsFirstTitle') : undefined}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600">
              <Plus className="w-3.5 h-3.5" /> {t('page.overview.recordPaymentButton')}
            </button>
            <div className="flex items-center gap-1.5 ml-auto">
              <Split className="w-3.5 h-3.5 text-slate-400" />
              <input type="number" min={1} max={9999} value={splitInput}
                onChange={e => setSplitInput(e.target.value)}
                className="w-12 text-center text-xs border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                aria-label={t('page.overview.splitAriaLabel', { label: line.label })} />
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                {splitN > 1
                  ? <>= <span className="font-semibold text-slate-700">{formatCurrency(perShare, currency, true)}</span></>
                  : t('page.overview.perShare')}
              </span>
              {splitN > 1 && (
                <button onClick={() => onPay(perShare)}
                  disabled={disabled}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed">
                  {t('page.overview.recordShareButton')}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Not-recommended cards still show paid amount if any was recorded */}
      {!recommended && paid > 0 && (
        <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
          {t('page.overview.paidThisMonthOnly', { amount: formatCurrency(paid, currency, true) })}
        </p>
      )}
    </div>
  )
}

