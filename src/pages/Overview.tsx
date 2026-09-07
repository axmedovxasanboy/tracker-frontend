import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Building2, Calendar, Check, ChevronDown, ChevronRight,
  HeartHandshake, History, Landmark, ListChecks, Lock, Plus, Settings as SettingsIcon,
  ShieldAlert, Wallet,
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { overviewApi } from '../api/overview'
import { financeApi } from '../api/finance'
import { formatMonth, money, moneyExact, monthLocal } from '../utils/format'
import { PageHeader } from '../components/ui/PageHeader'
import { Tile, TileGrid } from '../components/ui/Tile'
import { StatTile } from '../components/ui/StatTile'
import type { PillTone } from '../components/ui/StatTile'
import { Tabs } from '../components/ui/Tabs'
import { Button, DisabledHint } from '../components/ui/Button'
import { ErrorTile } from '../components/ui/ErrorTile'
import { Skeleton } from '../components/ui/Skeleton'
import { InfoDot } from '../components/ui/InfoDot'
import { ExplainModal } from '../components/ui/ExplainModal'
import { InvestmentsPage } from './InvestmentsPage'
import { DonationsPage } from './DonationsPage'
import { EmergenciesPage } from './EmergenciesPage'
import { PayBucketModal } from '../components/overview/PayBucketModal'
import { PayBankInstallmentModal } from '../components/overview/PayBankInstallmentModal'
import { PayPersonalLoanModal } from '../components/overview/PayPersonalLoanModal'
import { AllocationRulesModal } from '../components/overview/AllocationRulesModal'
import { BucketHistoryPanel } from '../components/overview/BucketHistoryPanel'
import { MarksPanel } from '../components/overview/MarksPanel'
import { PaySubscriptionModal } from '../components/finance/PaySubscriptionModal'
import { LevelExplainModal, levelWord } from '../components/overview/LevelExplainModal'
import { PlanHeaderSlotProvider, usePlanHeaderSlot } from '../components/overview/PlanHeaderAction'
import { useLang } from '../i18n/LanguageContext'
import type { Lang, TKey } from '../i18n/LanguageContext'
import { useToast } from '../context/ToastContext'
import type {
  ActionItem, AllocationLedgerBucket, AllocationLedgerResponse, AllocationLine, Bucket,
  Currency, MonthlyPaymentResponse, OverviewTierResponse, PendingSubscription,
} from '../types'

type OverviewTab = 'dashboard' | 'investments' | 'donations' | 'emergencies'

// `id` is the URL segment (/overview/:tab) — never rename it, only the label.
const TABS: { id: OverviewTab; labelKey: TKey }[] = [
  { id: 'dashboard',   labelKey: 'page.overview.tabThisMonth' },
  { id: 'investments', labelKey: 'page.investments' },
  { id: 'donations',   labelKey: 'page.donations' },
  { id: 'emergencies', labelKey: 'page.overview.tabEmergencies' },
]

/**
 * The two halves of "This month": the ritual the user performs, and the workings behind it.
 * `do` is the default, and the default is never written to the URL.
 */
type PlanSection = 'do' | 'how'

/** A query parameter, so `/overview/:tab` — the only shape any link in the app uses — is intact. */
const SECTION_PARAM = 'section'

const SECTIONS: { id: PlanSection; labelKey: TKey }[] = [
  { id: 'do',  labelKey: 'page.plan.sectionDo' },
  { id: 'how', labelKey: 'page.plan.sectionHow' },
]

interface Props {
  currency: Currency
}

/** Which of the five figures behind the hero the ⓘ is currently explaining. */
type TierInfoKey = 'income' | 'mandatory' | 'left' | 'debt' | 'base'

/** The level names, without the colour: a level is an ordinal, not an alarm. */
const LEVEL_NAME_KEYS: Record<number, TKey> = {
  1: 'page.overview.tier1Label',
  2: 'page.overview.tier2Label',
  3: 'page.overview.tier3Label',
  4: 'page.overview.tier4Label',
  5: 'page.overview.tier5Label',
  6: 'page.overview.tier6Label',
}

// The one place a bucket's identity colour survives: a 36px icon chip. Never a surface.
const BUCKET_ICONS: Record<Bucket, { Icon: typeof HeartHandshake; tone: 'pink' | 'amber' | 'teal' }> = {
  DONATION:    { Icon: HeartHandshake, tone: 'pink'  },
  EMERGENCY:   { Icon: ShieldAlert,    tone: 'amber' },
  INVESTMENTS: { Icon: Building2,      tone: 'teal'  },
}

const BUCKET_LABEL_KEYS: Record<string, TKey> = {
  DONATION:    'page.overview.bucketDonation',
  EMERGENCY:   'page.overview.bucketEmergency',
  INVESTMENTS: 'page.overview.bucketInvestments',
}

function bucketTitle(b: string, translate: (key: TKey) => string): string {
  const key = BUCKET_LABEL_KEYS[b]
  return key ? translate(key) : b.charAt(0) + b.slice(1).toLowerCase()
}

function fmtPct(n: number): string {
  return `${+n.toFixed(1)}`
}

function rangeLabel(start: string, end: string | null, lang: Lang): string {
  if (!end || end === start) return formatMonth(start, lang)
  return `${formatMonth(start, lang)} – ${formatMonth(end, lang)}`
}

/** A plain full-width child of the page grid — the tab strip, a sub-page, a redirect notice. */
const FULL_WIDTH = 'md:col-span-6 xl:col-span-12'

/**
 * `code` + `params` are the translatable form of `text`.
 *
 * Every action sentence is composed as English prose in `OverviewService`, so the language switch
 * could not reach the one list on this page that tells the user what to do next. The shared
 * `ActionItem` type has not caught up with the wire; widened here rather than in a file this page
 * does not own. When the backend starts sending a code it wins automatically — see `actionText`.
 */
export type TranslatableAction = ActionItem & {
  code?: string
  params?: Record<string, string | number>
}

/**
 * The sentence to print for an action item, in the viewer's language.
 *
 * Order of preference: the backend's translation key, then a sentence rebuilt from the structured
 * fields (`action` + `target` are on the wire and carry everything the actionable rows actually
 * say), then the server's English prose. Only the informational notes reach that last branch
 * today: they carry no structured data at all, and one of them is the user's own note from the
 * rules editor, which must be printed exactly as typed in either language.
 *
 * Exported because Home's `AllocationPanel` prints the same server prose and must not grow a
 * second, divergent copy of this decision.
 */
export function actionText(
  a: TranslatableAction,
  currency: Currency,
  translate: (key: TKey, vars?: Record<string, string | number>) => string,
): string {
  if (a.code) {
    // `t()` returns the key itself when the dictionaries have no entry for it — that is the
    // signal that this build predates the backend's code, and the English sentence beats a key.
    const translated = translate(a.code as TKey, a.params)
    if (translated !== a.code) return translated
  }
  if (a.action === 'PAY_BANK') return translate('page.plan.actionPayBank')
  if (a.action === 'PAY_PERSONAL_LOAN') {
    // Deliberately no percentage: the same action covers both the 34% rule and a repayment plan
    // the user set themselves, and naming the wrong one of those is worse than naming neither.
    // The amount is the item's own target, so two rows never read identically.
    return a.target != null && a.target > 0
      ? translate('page.plan.actionPayPersonal', { amount: money(a.target, currency) })
      : translate('page.plan.actionPayPersonalPlain')
  }
  return a.text
}

// ────────────────────────────────────────────────────────────────────────────────
// Plan
// ────────────────────────────────────────────────────────────────────────────────

export function Overview({ currency }: Props) {
  // Aliased: this component also uses `t` for the tier-data payload below.
  const { t: translate, lang } = useLang()
  const { showSuccess } = useToast()
  const { tab } = useParams<{ tab: string }>()
  const navigate = useNavigate()
  // Read through the router rather than window.location, so a month change re-renders.
  const [searchParams] = useSearchParams()
  const month = searchParams.get('month') || monthLocal()

  const isKnownTab = TABS.some(x => x.id === tab)
  const activeTab: OverviewTab = isKnownTab ? (tab as OverviewTab) : 'dashboard'
  // The sub-section of "This month", read from the query string rather than from a second path
  // segment: /overview/:tab is what the sidebar, the redirects in App.tsx and the Telegram deep
  // links all point at, and an absent or unrecognised value falls back to the ritual — so every
  // link that works today lands exactly where it lands today.
  const section: PlanSection = searchParams.get(SECTION_PARAM) === 'how' ? 'how' : 'do'

  const [explainOpen, setExplainOpen] = useState(false)

  const tier = useApi(() => overviewApi.getTier(month, currency), [month, currency])
  // The ledger lives beside the tier, not inside the allocation section: it feeds two tiles that
  // every payment moves, and a hook buried in a child cannot be refetched by the handler that
  // changed it — which is why "Still to set aside" used to sit stale after a payment.
  const ledger = useApi(() => overviewApi.getAllocationLedger(month, currency), [month, currency])
  const t = tier.data

  // A write inside a bucket tab (a donation added, an investment deleted) changes the figures the
  // plan prints, and those pages refetch only their own list. Coming back to the plan is the
  // moment the staleness would show, so refresh both queries then. `refreshing` keeps the
  // numbers on screen while it happens.
  const previousTab = useRef(activeTab)
  useEffect(() => {
    if (previousTab.current !== activeTab && activeTab === 'dashboard') {
      tier.refetch()
      ledger.refetch()
    }
    previousTab.current = activeTab
  }, [activeTab, tier.refetch, ledger.refetch])

  // Pay-first gate. Open while the tier is still loading so the strip does not flicker on first
  // paint. It no longer HIDES anything — it locks the three record tabs and says why.
  const gateOpen = !t || (!t.subscriptionsPending && !t.allocation?.allocationLocked)
  const lockedTabs = !gateOpen
  const lockReason = translate('page.overview.tabsLockedReason')

  // Only name a level once it is actually resolved: income set, tracking started, bills paid.
  const levelKnown = !!t && !t.missingStableIncome && !t.beforeTrackingStart
    && !t.subscriptionsPending && t.level != null
  const levelName = levelKnown && t.level != null ? LEVEL_NAME_KEYS[t.level] : null
  // Never `t.levelLabel`: the backend composes that in English, so the header chip and the info
  // button read "Level 1.2" even in Uzbek. See `levelWord`.
  const levelText = levelKnown && t ? levelWord(t, translate) : ''

  // The section belongs to "This month" alone, so leaving that tab drops it rather than trailing
  // it after the URL of a tab that has no sections.
  const onTabChange = (id: OverviewTab) => {
    const params = new URLSearchParams(searchParams)
    if (id !== 'dashboard') params.delete(SECTION_PARAM)
    const search = params.toString()
    navigate(`/overview/${id}${search ? `?${search}` : ''}`, { replace: true })
  }

  const onSectionChange = (id: PlanSection) => {
    const params = new URLSearchParams(searchParams)
    if (id === 'do') params.delete(SECTION_PARAM)
    else params.set(SECTION_PARAM, id)
    const search = params.toString()
    navigate(`/overview/dashboard${search ? `?${search}` : ''}`, { replace: true })
  }

  // The header slot the three embedded bucket tabs publish their Add into. Plan itself never
  // registers a primary action, so `PageHeader`'s "exactly one" holds by construction; see
  // PlanHeaderAction for why an action cannot outlive the tab that published it.
  const { actions: bucketActions, publish: publishHeaderActions } = usePlanHeaderSlot(activeTab)
  const headerPrimary = bucketActions && !bucketActions.primary.disabled
    ? bucketActions.primary
    : undefined

  // Every hook has run by here, so an early return is safe. An unknown :tab used to render the
  // strip with nothing selected and an empty panel below it; now the address bar is corrected.
  if (tab && !isKnownTab) {
    const search = searchParams.toString()
    return <Navigate to={`/overview/dashboard${search ? `?${search}` : ''}`} replace />
  }

  const activeTabLocked = lockedTabs && activeTab !== 'dashboard'

  // The record tabs are month-scoped pages, and the month lives in the URL the tab strip keeps.
  // Rendered without these, they fell back to the current month while the header above them still
  // named the month the plan is showing — August's target over September's payments, on one page.
  // `onWrote` closes the other half of that loop: a write inside a tab moves the plan's figures,
  // so the tier and the ledger refetch at the moment of the write rather than on the way back.
  // `embedded` is the nesting contract: this page already renders the PageHeader and the one
  // TileGrid, so the bucket pages must render neither. Without it each of them added a second
  // <h1> — two headers competing for the single phone app bar — and a grid inside a grid, which
  // is the case Tile.tsx warns about and the source of the audit's mismatched card widths.
  const tabProps = {
    month,
    currency,
    embedded: true,
    onWrote: () => { tier.refetch(); ledger.refetch() },
  }

  return (
    <TileGrid className="p-4 sm:p-6">
      <div className={FULL_WIDTH}>
        <PageHeader
          title={translate('page.plan.titleWithMonth', { month: formatMonth(month, lang) })}
          subtitle={translate('page.plan.subtitle')}
          chip={levelKnown && levelName
            ? { text: translate('page.plan.levelChip', { level: levelText, name: translate(levelName) }) }
            : undefined}
          info={levelKnown
            ? { label: translate('cmp.levelWhy.title', { level: levelText }), onClick: () => setExplainOpen(true) }
            : undefined}
          // The Add of whichever bucket tab is open — top right on a desktop, in the phone app
          // bar on a phone, which is where Home puts its own Add. A gated one is painted below
          // instead, because `primary` has no disabled state to honour.
          primary={headerPrimary
            ? { label: headerPrimary.label, onClick: headerPrimary.onClick, icon: headerPrimary.icon }
            : undefined}
          overflow={bucketActions?.overflow}
        />
      </div>

      {levelKnown && t && (
        <LevelExplainModal open={explainOpen} onClose={() => setExplainOpen(false)}
          tier={t} currency={currency} />
      )}

      <div className={FULL_WIDTH}>
        <Tabs
          tabs={TABS.map(({ id, labelKey }) => ({
            id,
            label: translate(labelKey),
            locked: lockedTabs && id !== 'dashboard',
            lockReason,
          }))}
          active={activeTab}
          onChange={onTabChange}
        />
        {/* The refresh cue. `loading` is first-load only now, so a refetch never blanks a tile —
            this line says the figures are moving. Its height is reserved so nothing shifts. */}
        <p role="status" className="h-4 mt-1 text-xs text-slate-500">
          {tier.refreshing || ledger.refreshing ? translate('ui.loading') : ''}
        </p>
      </div>

      {/* A gated Add is never painted in the header: `PageHeader.primary` has no disabled state,
          and a live-looking button that silently does nothing is worse than one that says why it
          is off. It sits at the top right of the panel instead, with the reason in text — a
          disabled control cannot take focus, so a tooltip alone would never reach a touch user. */}
      {bucketActions?.primary.disabled && (
        <div className={`${FULL_WIDTH} flex flex-wrap items-center justify-end gap-x-3 gap-y-1`}>
          <DisabledHint reason={bucketActions.primary.disabledReason} className="min-w-0" />
          <Button
            variant="primary"
            icon={bucketActions.primary.icon}
            label={bucketActions.primary.label}
            disabled
            disabledReason={bucketActions.primary.disabledReason}
          />
        </div>
      )}

      {/* The provider renders no DOM of its own, so every tile below stays a direct child of the
          page grid. */}
      <PlanHeaderSlotProvider owner={activeTab} publish={publishHeaderActions}>
        {activeTab === 'dashboard' ? (
          <PlanPanel currency={currency} month={month} tier={tier} ledger={ledger}
            section={section} onSectionChange={onSectionChange}
            onExplainLevel={levelKnown ? () => setExplainOpen(true) : undefined}
            onSubscriptionPaid={(name, amount) =>
              showSuccess(translate('page.plan.subPaidToast', { name, amount }))} />
        ) : activeTabLocked ? (
          // The URL is honoured: the tab stays selected and the panel says why it is empty, rather
          // than a silent redirect that leaves the address bar naming a page nobody is looking at.
          <Tile span={12}>
            <div role="tabpanel" className="flex items-start gap-3">
              <div className="w-9 h-9 shrink-0 rounded-chip bg-amber-100 text-amber-600 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-title text-slate-900">{translate('ui.locked')}</p>
                <p className="mt-1 text-sm text-slate-600">{lockReason}</p>
              </div>
            </div>
          </Tile>
        ) : (
          // `contents` keeps the panel's role in the accessibility tree while taking its box out
          // of the layout, so each bucket tile stays a direct child of the grid above and its span
          // resolves. A plain wrapper made every tile full-width and nested a grid inside a grid.
          <div role="tabpanel" className="contents">
            {activeTab === 'investments' && <InvestmentsPage {...tabProps} />}
            {activeTab === 'donations' && <DonationsPage {...tabProps} />}
            {activeTab === 'emergencies' && <EmergenciesPage {...tabProps} />}
          </div>
        )}
      </PlanHeaderSlotProvider>
    </TileGrid>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// The plan itself — a flat set of tiles, returned as a fragment so every one of them
// is a direct child of the page grid and keeps its span.
// ────────────────────────────────────────────────────────────────────────────────

function PlanPanel({
  currency, month, tier, ledger, section, onSectionChange, onExplainLevel, onSubscriptionPaid,
}: {
  currency: Currency
  month: string
  tier: ReturnType<typeof useApi<OverviewTierResponse>>
  ledger: ReturnType<typeof useApi<AllocationLedgerResponse>>
  /** Which half of "This month" is on screen. Lives in the URL; see `SECTION_PARAM`. */
  section: PlanSection
  onSectionChange: (id: PlanSection) => void
  /** Opens "Why this level?". Undefined until the level is actually resolved. */
  onExplainLevel?: () => void
  onSubscriptionPaid: (name: string, amount: string) => void
}) {
  // Aliased: this component also uses `t` for the tier-data payload below.
  const { t: translate, lang } = useLang()
  const navigate = useNavigate()
  const t = tier.data

  const [tierInfo, setTierInfo] = useState<TierInfoKey | null>(null)
  const [ledgerInfo, setLedgerInfo] = useState(false)
  const [payTarget, setPayTarget] = useState<{ bucket: Bucket; suggested?: number } | null>(null)
  const [historyBucket, setHistoryBucket] = useState<Bucket | null>(null)
  const [payBankOpen, setPayBankOpen] = useState(false)
  const [payPersonalOpen, setPayPersonalOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [showMonths, setShowMonths] = useState(false)
  const [paySub, setPaySub] = useState<MonthlyPaymentResponse | null>(null)
  // Bumped by `refetchPlan`. The two panels below the tiles own their own queries and are keyed on
  // arguments a payment does not change (bucket / month / currency), so nothing else would tell
  // them to re-read. Passing this as a dep rather than as a `key` refetches them in place: the
  // rows stay on screen with the refreshing cue instead of collapsing to a skeleton.
  const [panelNonce, setPanelNonce] = useState(0)

  const subs = useApi(() => financeApi.getMonthlyPayments(), [])

  // Every payment moves the tier AND the ledger; both are refetched from one place so a new
  // modal cannot be wired to only half of the screen it changes.
  const refetchFigures = () => { tier.refetch(); ledger.refetch() }
  // What a write from a MODAL calls: the figures plus the two panels, which are keyed on nothing
  // the write changes. Without the nonce, "History" kept listing 3 payments and "Paid 200 k"
  // under a tile that had already moved to "Paid 250 k" — two figures for the same money on one
  // screen. A panel that changed the data ITSELF refetches itself and only needs `refetchFigures`.
  const refetchPlan = () => { refetchFigures(); setPanelNonce(n => n + 1) }

  if (tier.loading && !t) {
    return (
      <div className={FULL_WIDTH}>
        <Skeleton variant="stat" count={3} />
      </div>
    )
  }

  if (tier.error && !t) {
    return (
      <div className={FULL_WIDTH}>
        <ErrorTile message={tier.error} onRetry={tier.refetch} />
      </div>
    )
  }

  if (!t) {
    return (
      <Tile span={12}>
        <p className="text-sm text-slate-600">{translate('page.overview.tierDataUnavailable')}</p>
      </Tile>
    )
  }

  const dormant = t.beforeTrackingStart
  const subsPending = t.subscriptionsPending
  const locked = t.allocation?.allocationLocked ?? false
  const lines = t.allocation?.lines ?? []
  const hasTier = t.level != null
  const sublevelConfigurable = t.level != null && t.level >= 2 && t.level <= 6

  // A withheld ledger returns dueThisMonth / totalDueNow as null, NOT as 0 — the backend agrees
  // with the tier on all three gates. Defaulting a null to zero here would print "Done" over a
  // figure the server deliberately refused to compute.
  const d = ledger.data
  const ledgerReady = !!d && !d.missingStableIncome && !d.beforeTrackingStart
    && d.dueThisMonth != null && d.totalDueNow != null
  const dueThis = d?.dueThisMonth ?? 0
  const totalDue = d?.totalDueNow ?? 0
  const carried = d?.carriedFromPrevious ?? 0
  const allClear = totalDue <= 0
  const ledgerBuckets = new Map<string, AllocationLedgerBucket>(
    (d?.buckets ?? []).map(b => [b.bucket, b]),
  )

  const openPaySub = (id: number) => {
    const full = subs.data?.find(s => s.id === id)
    if (full) setPaySub(full)
  }

  // One attention state at a time: missing income wins, because nothing below it is real until
  // it is answered. Both are white tiles with an amber icon chip — never a tinted surface.
  const showMissingIncome = t.missingStableIncome
  const showLockedNotice = !showMissingIncome && !subsPending && locked && lines.length > 0

  // Whether the explanatory section has anything to show at all. Its three tiles each have their
  // own gate and all three can be shut at once — a first month, or one whose bills are still
  // pending — so the section says so rather than rendering an empty grid.
  const hasWorkings = (hasTier && !subsPending) || t.debtPayments > 0
    || (ledgerReady && !!d && d.months.length > 0)

  // Before the tracking start month the plan is a preview: the figures are shown, but nothing can
  // be recorded against a month the engine is not yet counting. The old page enforced this by
  // greying the whole block out with `pointer-events-none`, which hid the reason as well as the
  // buttons; now every write control says why it is off.
  const writesBlocked = dormant
  const writesBlockedReason = translate('page.overview.trackingNotStarted')

  // The hero chain, as three steps with the arithmetic that produced each one.
  const chain: { key: TierInfoKey; label: string; value: number; formula: string }[] = [
    {
      key: 'income',
      label: translate('page.overview.stableIncomeLabel'),
      value: t.income,
      formula: translate('page.plan.stepIncomeFormula'),
    },
    {
      key: 'left',
      label: translate('page.overview.leftMoneyLabel'),
      value: t.leftMoney,
      formula: translate('page.plan.stepAfterBillsFormula', {
        bills: money(t.mandatorySubscriptions, currency),
      }),
    },
    {
      key: 'base',
      label: translate('page.overview.leftBalanceLabel'),
      value: t.allocationBase,
      formula: translate('page.plan.stepAfterDebtFormula', {
        debt: money(t.debtPayments, currency),
      }),
    },
  ]

  const ritual = (
    <>
      {/* Tracking has not started: guidance is paused, so say so once and keep the figures
          readable rather than greying the whole page out. */}
      {dormant && (
        <Tile span={12}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 shrink-0 rounded-chip bg-slate-100 text-slate-500 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-title text-slate-900">{translate('page.overview.trackingNotStarted')}</p>
              <p className="mt-1 text-sm text-slate-600">
                {translate('page.overview.trackingNotStartedPre')}{' '}
                <span className="font-semibold text-slate-900">
                  {t.trackingStartMonth ? formatMonth(t.trackingStartMonth, lang) : ''}
                </span>
                . {translate('page.overview.trackingNotStartedPost')}
              </p>
            </div>
          </div>
        </Tile>
      )}

      {showMissingIncome && (
        <Tile span={12}>
          <div className="flex flex-wrap items-start gap-3">
            <div className="w-9 h-9 shrink-0 rounded-chip bg-amber-100 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-title text-slate-900">{translate('page.overview.missingIncomeTitle')}</p>
              <p className="mt-1 text-sm text-slate-600">{translate('page.overview.missingIncomePre')}</p>
            </div>
            <Button label={translate('action.openSettings')} onClick={() => navigate('/settings')} />
          </div>
        </Tile>
      )}

      {/* ── Hero: what the bucket percentages actually multiply ─────────────────── */}
      <StatTile
        span={6}
        rows={2}
        hero
        label={translate('page.overview.leftBalanceLabel')}
        value={money(t.allocationBase, currency)}
        caption={translate('ui.exactValue', { value: moneyExact(t.allocationBase, currency) })}
        onInfo={() => setTierInfo('base')}
      >
        <div className="border-t border-hairline pt-3">
          <p className="text-label uppercase text-slate-500">{translate('page.plan.chainHeading')}</p>
          <ol className="mt-2 space-y-1">
            {chain.map((step, i) => (
              <li key={step.key}>
                <button
                  type="button"
                  onClick={() => setTierInfo(step.key)}
                  className="w-full text-left rounded-control px-2 py-2 -mx-2 cursor-pointer
                             hover:bg-slate-50 transition-colors focus-ring"
                >
                  <span className="flex items-baseline gap-2">
                    {/* The slot is always there, so the three labels share one left edge. */}
                    <span className="w-3.5 shrink-0 self-center" aria-hidden="true">
                      {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-slate-400" />}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{step.label}</span>
                    <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">
                      {money(step.value, currency)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{step.formula}</span>
                </button>
              </li>
            ))}
          </ol>
          {/* The header's ⓘ is a 16px glyph; this is the same explanation at a 44px target, and
              it sits under the arithmetic it explains. */}
          {onExplainLevel && (
            <Button variant="ghost" size="sm" className="mt-1 -ml-3"
              label={translate('page.plan.howItWorks')} onClick={onExplainLevel} />
          )}
        </div>
      </StatTile>

      {/* ── This month's ask and the running backlog ────────────────────────────── */}
      {ledger.loading && !d ? (
        <div className="md:col-span-3 xl:col-span-6"><Skeleton variant="stat" count={2} /></div>
      ) : ledger.error && !d ? (
        <div className="md:col-span-3 xl:col-span-6">
          <ErrorTile message={ledger.error} onRetry={ledger.refetch} />
        </div>
      ) : ledgerReady ? (
        <>
          <StatTile
            span={3}
            label={translate('page.overview.thisMonthLabel')}
            value={money(dueThis, currency)}
            caption={translate('ui.exactValue', { value: moneyExact(dueThis, currency) })}
            onInfo={() => setLedgerInfo(true)}
          />
          <StatTile
            span={3}
            label={translate('page.overview.allocationDueLabel')}
            value={money(totalDue, currency)}
            // No pill when there IS a backlog: this figure is cumulative since tracking began, so
            // any "this month" badge beside it would be the third different meaning of "due".
            pill={allClear ? { text: translate('ui.status.done'), tone: 'ok' } : undefined}
            caption={carried > 0 && d?.carriedStartMonth
              ? `${money(carried, currency)} ${translate('page.overview.carriedFromSuffix', {
                  range: rangeLabel(d.carriedStartMonth, d.carriedEndMonth ?? null, lang),
                })}`
              : translate('ui.exactValue', { value: moneyExact(totalDue, currency) })}
            onInfo={() => setLedgerInfo(true)}
          />
        </>
      ) : null}

      {/* ── Step 1 of the gate: the bills that hold everything else back ────────── */}
      {subsPending && (
        <SubscriptionsTile
          subscriptions={t.pendingSubscriptions}
          month={month}
          onPay={openPaySub}
          onInfo={() => setTierInfo('mandatory')}
          // Pay opens a modal built from the full monthly-payment record. Without that list the
          // button would open nothing at all, so it says why instead of failing silently.
          ready={!!subs.data && !writesBlocked}
          readyReason={writesBlocked ? writesBlockedReason : undefined}
          error={subs.error}
          onRetry={subs.refetch} />
      )}

      {/* ── Step 2: the debts to clear before anything is set aside ─────────────── */}
      {!subsPending && (
        <ActionItemsTile tier={t} currency={currency}
          disabled={writesBlocked}
          disabledReason={writesBlockedReason}
          onPayBank={() => setPayBankOpen(true)}
          onPayPersonal={() => setPayPersonalOpen(true)} />
      )}

      {showLockedNotice && (
        <Tile span={12}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 shrink-0 rounded-chip bg-amber-100 text-amber-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{translate('page.overview.lockedBold')}</span>{' '}
              {translate('page.overview.lockedRest')}
            </p>
          </div>
        </Tile>
      )}

      {/* ── Step 3: the buckets ─────────────────────────────────────────────────── */}
      {!subsPending && lines.length === 0 && (
        <Tile span={12}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">{translate('page.overview.guidanceUnavailable')}</p>
            {sublevelConfigurable && (
              <Button variant="primary" icon={<SettingsIcon className="w-4 h-4" />}
                label={translate('page.overview.setLevelAllocation', { level: t.subLevel ?? t.level ?? '' })}
                disabled={writesBlocked}
                disabledReason={writesBlocked ? writesBlockedReason : undefined}
                onClick={() => setRulesOpen(true)} />
            )}
          </div>
        </Tile>
      )}

      {!subsPending && lines.map(line => (
        <BucketTile
          key={line.bucket}
          line={line}
          currency={currency}
          carried={ledgerBuckets.get(line.bucket)?.carried ?? 0}
          disabled={locked || writesBlocked}
          disabledReason={writesBlocked
            ? writesBlockedReason
            : translate('page.overview.payActionItemsFirstTitle')}
          onPay={suggested => setPayTarget({ bucket: line.bucket, suggested })}
          onHistory={() => setHistoryBucket(line.bucket)}
        />
      ))}

      {historyBucket && (
        <BucketHistoryPanel
          bucket={historyBucket}
          month={month}
          currency={currency}
          refreshKey={panelNonce}
          onChanged={refetchFigures}
          onClose={() => setHistoryBucket(null)} />
      )}

      {/* The month's "already paid" marks. A mark is counted as Paid by every tile above but has
          no transaction behind it, so this is the only screen it can be found and undone on —
          and the only one at all for a subscription / bank / loan / debt mark. Renders nothing
          when the month has none. */}
      <MarksPanel
        month={month}
        currency={currency}
        refreshKey={panelNonce}
        onChanged={refetchFigures} />
    </>
  )

  // The workings: the percentages, the arithmetic they produced month by month, and where the
  // debt payment went. Reference material — no write verb in the whole section, which is why it
  // is worth lifting off the ritual rather than sitting between the buckets and the marks.
  const explain = (
    <>
      {/* The rules are a reference, not an action — a full-width tile with one secondary button. */}
      {hasTier && !subsPending && (
        <Tile span={6}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-label uppercase text-slate-500">{translate('page.overview.allocationHeading')}</p>
              <p className="mt-2 text-sm text-slate-600">
                {translate('page.overview.percentagesPre')}{' '}
                <span className="font-semibold text-slate-900">{translate('page.overview.leftBalanceBold')}</span>
                {' '}
                <span className="tabular-nums">({money(t.allocationBase, currency)})</span>
              </p>
            </div>
            <Button icon={<SettingsIcon className="w-4 h-4" />}
              label={translate('page.overview.allocationRulesButton')}
              disabled={writesBlocked}
              disabledReason={writesBlocked ? writesBlockedReason : undefined}
              onClick={() => setRulesOpen(true)} />
          </div>
        </Tile>
      )}

      {/* ── The month-by-month arithmetic behind "Still to set aside" ───────────── */}
      {ledgerReady && d && d.months.length > 0 && (
        <Tile span={6}>
          <button
            type="button"
            onClick={() => setShowMonths(v => !v)}
            aria-expanded={showMonths}
            className="w-full flex items-center justify-between gap-2 text-left cursor-pointer focus-ring rounded-control"
          >
            <span className="text-label uppercase text-slate-500">{translate('page.overview.howCalculated')}</span>
            {showMonths
              ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
              : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />}
          </button>
          {showMonths && (
            <div className="mt-3 divide-y divide-hairline">
              {d.months.map(mo => (
                <div key={mo.month} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatMonth(mo.month, lang)}
                      {mo.selected && (
                        <span className="ml-2 text-label uppercase text-indigo-600">
                          {translate('page.overview.thisMonthTag')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {translate('page.overview.levelBaseLabel', {
                        level: mo.subLevel ?? mo.level ?? '—',
                        amount: money(mo.allocationBase, currency),
                      })}
                    </p>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {mo.lines.map(l => (
                      <p key={l.bucket} className="text-xs text-slate-500 tabular-nums leading-relaxed">
                        <span className="font-semibold text-slate-600">{bucketTitle(l.bucket, translate)}</span>
                        {l.percent != null && (
                          <> · {translate('page.overview.pctOfBaseEquals', {
                            pct: fmtPct(l.percent),
                            base: money(mo.allocationBase, currency),
                            recommended: money(l.recommended, currency),
                          })}</>
                        )}
                        {' '}{translate('page.overview.minusPaidEquals', { paid: money(l.paid, currency) })}{' '}
                        <span className={l.net > 0 ? 'font-semibold text-slate-900' : 'font-semibold text-income'}>
                          {l.net > 0
                            ? translate('page.overview.behindAmount', { amount: money(l.net, currency) })
                            : l.net < 0
                              ? translate('page.overview.aheadAmount', { amount: money(-l.net, currency) })
                              : translate('page.overview.onTarget')}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tile>
      )}

      {/* ── Where the debt payment goes ─────────────────────────────────────────── */}
      {t.debtPayments > 0 && (
        <Tile span={6}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Landmark className="w-4 h-4 shrink-0 text-slate-400" />
              <p className="text-label uppercase text-slate-500 truncate">
                {translate('page.overview.debtBreakdownHeading')}
              </p>
            </div>
            <InfoDot
              label={translate('cmp.cardInfo.button', { title: translate('page.overview.debtBreakdownHeading') })}
              onClick={() => setTierInfo('debt')}
              className="p-3 -m-3 shrink-0" />
          </div>
          <dl className="mt-3 divide-y divide-hairline">
            <DebtRow label={translate('page.finance.tabBankLoans')}
              hint={translate('page.overview.monthlyInstallmentHint')}
              value={money(t.debtBreakdown.bankLoans, currency)} />
            <DebtRow label={translate('page.overview.borrowedPctLabel')}
              hint={translate('page.overview.cappedHint')}
              value={money(t.debtBreakdown.loansTaken, currency)} />
            <DebtRow label={translate('page.overview.debtsPctLabel')}
              hint={translate('page.overview.cappedHint')}
              value={money(t.debtBreakdown.debts, currency)} />
          </dl>
        </Tile>
      )}

      {!hasWorkings && (
        <Tile span={12}>
          <p className="text-sm text-slate-600">{translate('page.plan.sectionHowEmpty')}</p>
        </Tile>
      )}
    </>
  )

  return (
    <>
      {/* The second strip, deliberately not a peer of the tab strip above it: it carries its own
          caps label, and it stops at 22rem beside that label on a wide screen where the strip
          above spans the page. Two identically sized strips stacked on one another is exactly
          what the audit objected to on Finance. Below `sm` the strip claims the whole line and
          wraps under its label — a narrow segmented control would truncate its own tab names,
          and a clipped label is a worse sin than a wide one. */}
      <div className={`${FULL_WIDTH} flex flex-wrap items-center gap-x-3 gap-y-1.5`}>
        <span className="text-label uppercase text-slate-500 shrink-0">
          {translate('page.plan.sectionLabel')}
        </span>
        <Tabs
          className="w-full min-w-0 sm:w-[22rem] sm:flex-none"
          tabs={SECTIONS.map(({ id, labelKey }) => ({ id, label: translate(labelKey) }))}
          active={section}
          onChange={onSectionChange}
        />
      </div>

      {/* `contents` again: the panel keeps its role in the accessibility tree while its box
          leaves the layout, so each tile inside still spans against the page grid. */}
      <div role="tabpanel" aria-label={translate(SECTIONS[section === 'do' ? 0 : 1].labelKey)}
        className="contents">
        {section === 'do' ? ritual : explain}
      </div>

      {/* ── Explanations ───────────────────────────────────────────────────────── */}
      {tierInfo && (
        <ExplainModal
          open onClose={() => setTierInfo(null)}
          title={translate(`cmp.tierInfo.${tierInfo}.title`)}
          meaning={translate(`cmp.tierInfo.${tierInfo}.meaning`)}
          formula={translate(`cmp.tierInfo.${tierInfo}.formula`)}
          rows={
            tierInfo === 'left' ? [
              { label: translate('page.overview.stableIncomeLabel'), value: moneyExact(t.income, currency) },
              { label: translate('page.overview.mandatoryLabel'), value: `− ${moneyExact(t.mandatorySubscriptions, currency)}` },
              { label: translate('page.overview.leftMoneyLabel'), value: moneyExact(t.leftMoney, currency), strong: true },
            ] : tierInfo === 'debt' ? [
              { label: translate('page.finance.tabBankLoans'), value: moneyExact(t.debtBreakdown.bankLoans, currency) },
              { label: translate('page.overview.borrowedPctLabel'), value: moneyExact(t.debtBreakdown.loansTaken, currency) },
              { label: translate('page.overview.debtsPctLabel'), value: moneyExact(t.debtBreakdown.debts, currency) },
              { label: translate('page.overview.debtPaymentsLabel'), value: moneyExact(t.debtPayments, currency), strong: true },
            ] : tierInfo === 'base' ? [
              { label: translate('page.overview.stableIncomeLabel'), value: moneyExact(t.income, currency) },
              { label: translate('page.overview.mandatoryLabel'), value: `− ${moneyExact(t.mandatorySubscriptions, currency)}` },
              { label: translate('page.overview.debtPaymentsLabel'), value: `− ${moneyExact(t.debtPayments, currency)}` },
              { label: translate('page.overview.leftBalanceLabel'), value: moneyExact(t.allocationBase, currency), strong: true },
            ] : undefined
          }
          note={translate(`cmp.tierInfo.${tierInfo}.note`)}
        />
      )}

      {ledgerInfo && d && (
        <ExplainModal
          open onClose={() => setLedgerInfo(false)}
          title={translate('cmp.ledgerInfo.title')}
          meaning={translate('cmp.ledgerInfo.meaning')}
          formula={translate('cmp.ledgerInfo.formula')}
          rows={[
            { label: translate('page.overview.dueCol'), value: moneyExact(dueThis, currency) },
            { label: translate('page.overview.carriedCol'), value: moneyExact(carried, currency) },
            { label: translate('page.overview.outstandingCol'), value: moneyExact(totalDue, currency), strong: true },
          ]}
          note={translate('cmp.ledgerInfo.note')}
        />
      )}

      {/* ── Writes. Each one refetches both queries it moves and toasts from the modal. ── */}
      <PayBucketModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        onSaved={() => { refetchPlan(); setPayTarget(null) }}
        bucket={payTarget?.bucket ?? null}
        suggestedAmount={payTarget?.suggested}
        currency={currency}
        defaultMonth={month} />

      <PayBankInstallmentModal
        open={payBankOpen}
        onClose={() => setPayBankOpen(false)}
        onSaved={() => { refetchPlan(); setPayBankOpen(false) }}
        defaultMonth={month} />

      <PayPersonalLoanModal
        open={payPersonalOpen}
        onClose={() => setPayPersonalOpen(false)}
        onSaved={() => { refetchPlan(); setPayPersonalOpen(false) }}
        defaultMonth={month} />

      <AllocationRulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        onSaved={() => { refetchPlan(); setRulesOpen(false) }}
        allocationBase={t.allocationBase}
        currency={currency} />

      {/* PaySubscriptionModal belongs to Finance and does not toast for itself yet, so the
          confirmation is fired here — the one write on this page whose modal is not mine. */}
      <PaySubscriptionModal
        open={!!paySub}
        subscription={paySub}
        onClose={() => setPaySub(null)}
        onSaved={() => {
          if (paySub) onSubscriptionPaid(paySub.name, money(paySub.amount, paySub.currency))
          refetchPlan(); subs.refetch(); setPaySub(null)
        }} />
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Tiles
// ────────────────────────────────────────────────────────────────────────────────

function DebtRow({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <dt className="text-sm font-medium text-slate-900">{label}</dt>
        <dd className="text-xs text-slate-500">{hint}</dd>
      </div>
      <dd className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">{value}</dd>
    </div>
  )
}

function SubscriptionsTile({ subscriptions, month, onPay, onInfo, ready, readyReason, error, onRetry }: {
  subscriptions: PendingSubscription[]
  month: string
  onPay: (id: number) => void
  onInfo: () => void
  /** False while the monthly-payment list the pay modal needs is missing, or writes are blocked. */
  ready: boolean
  readyReason?: string
  error: string | null
  onRetry: () => void
}) {
  const { t, lang } = useLang()
  const heading = t('page.overview.paySubsFirstHeading')
  return (
    <Tile span={6}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ListChecks className="w-4 h-4 shrink-0 text-slate-400" />
          <p className="text-label uppercase text-slate-500 truncate">{heading}</p>
        </div>
        <InfoDot label={t('cmp.cardInfo.button', { title: heading })} onClick={onInfo}
          className="p-3 -m-3 shrink-0" />
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {t('page.overview.paySubsFirstDesc', { month: formatMonth(month, lang), count: subscriptions.length })}
      </p>
      {error && <ErrorTile compact message={error} onRetry={onRetry} className="mt-3" />}
      <div className="mt-3 divide-y divide-hairline">
        {subscriptions.map(s => {
          const remaining = Math.max(0, s.amount - s.paid)
          return (
            <div key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{s.name}</p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {s.paid > 0
                    ? t('page.overview.subPaidOfAmount', {
                        paid: money(s.paid, s.currency),
                        amount: money(s.amount, s.currency),
                        remaining: money(remaining, s.currency),
                      })
                    : t('page.overview.subAmountDue', { amount: money(s.amount, s.currency) })}
                </p>
              </div>
              <Button variant="primary" size="sm" icon={<Wallet className="w-3.5 h-3.5" />}
                label={t('page.shared.payButton')} onClick={() => onPay(s.id)}
                disabled={!ready}
                disabledReason={!ready ? (readyReason ?? t('ui.loading')) : undefined}
                className="shrink-0" />
            </div>
          )
        })}
      </div>
    </Tile>
  )
}

/**
 * The debts that must be paid before anything is set aside.
 *
 * When there is nothing to do this is one neutral line, not a green box: an all-clear that shouts
 * as loudly as a demand teaches the reader to stop reading the section. The scenario notes are
 * FYI rather than tasks, so they collapse behind a disclosure instead of sitting in an amber tray.
 */
function ActionItemsTile({ tier, currency, disabled, disabledReason, onPayBank, onPayPersonal }: {
  tier: OverviewTierResponse
  currency: Currency
  disabled?: boolean
  disabledReason?: string
  onPayBank: () => void
  onPayPersonal: () => void
}) {
  const { t } = useLang()
  const [notesOpen, setNotesOpen] = useState(false)

  // Only meaningful once a level is known; the banners above cover the other states.
  if (tier.missingStableIncome || tier.level == null) return null

  const actions = (tier.allocation?.actions ?? []) as TranslatableAction[]
  const actionable = actions.filter(a => a.action)   // PAY_BANK / PAY_PERSONAL_LOAN
  const infos = actions.filter(a => !a.action)       // text-only scenario notes
  const locked = tier.allocation?.allocationLocked ?? false

  return (
    <Tile span={6}>
      <div className="flex items-center gap-2">
        <ListChecks className="w-4 h-4 shrink-0 text-slate-400" />
        <p className="text-label uppercase text-slate-500">{t('page.overview.actionItemsHeading')}</p>
      </div>

      {actionable.length === 0 ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
          <Check className="w-4 h-4 shrink-0 mt-0.5 text-income" />
          {t('page.overview.noActionItemsClear')}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-600">
            {locked ? t('page.overview.payToUnlock') : t('page.overview.allocationUnlocked')}
          </p>
          <div className="mt-3 divide-y divide-hairline">
            {actionable.map((a, i) => (
              <ActionRow key={`a-${i}`} action={a} currency={currency}
                disabled={disabled} disabledReason={disabledReason}
                onPayBank={onPayBank} onPayPersonal={onPayPersonal} />
            ))}
          </div>
        </>
      )}

      {infos.length > 0 && (
        <div className="mt-3 border-t border-hairline pt-3">
          <button
            type="button"
            onClick={() => setNotesOpen(v => !v)}
            aria-expanded={notesOpen}
            className="w-full flex items-center justify-between gap-2 text-left cursor-pointer focus-ring rounded-control"
          >
            <span className="text-sm font-semibold text-slate-900">
              {t('page.plan.notesHeading')} <span className="tabular-nums text-slate-500">({infos.length})</span>
            </span>
            {notesOpen
              ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
              : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />}
          </button>
          {notesOpen && (
            <ul className="mt-2 space-y-1.5">
              {infos.map((a, i) => (
                <li key={`i-${i}`} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 w-1 h-1 shrink-0 rounded-full bg-slate-400" />
                  <span className="min-w-0">{actionText(a, currency, t)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Tile>
  )
}

function ActionRow({ action, currency, disabled, disabledReason, onPayBank, onPayPersonal }: {
  action: TranslatableAction
  currency: Currency
  disabled?: boolean
  disabledReason?: string
  onPayBank: () => void
  onPayPersonal: () => void
}) {
  const { t } = useLang()
  const hasProgress = action.target != null && action.target > 0 && action.paid != null
  const paid = action.paid ?? 0
  const target = action.target ?? 0
  // What counts as "met": bank = 90% of the average installment, personal = the full target.
  const threshold = action.unlockThreshold ?? target
  const paidPct = hasProgress ? Math.min(100, (paid / target) * 100) : 0
  const met = hasProgress && paid >= threshold
  const showsThreshold = hasProgress && threshold > 0 && threshold < target

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-sm text-slate-900">{actionText(action, currency, t)}</p>
        {action.action === 'PAY_BANK' && (
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
            label={t('page.overview.recordButton')} onClick={onPayBank}
            disabled={disabled} disabledReason={disabled ? disabledReason : undefined}
            className="shrink-0" />
        )}
        {action.action === 'PAY_PERSONAL_LOAN' && (
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
            label={t('page.overview.recordButton')} onClick={onPayPersonal}
            disabled={disabled} disabledReason={disabled ? disabledReason : undefined}
            className="shrink-0" />
        )}
      </div>
      {hasProgress && (
        <div className="mt-2 space-y-1">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${met ? 'bg-income' : 'bg-indigo-500'}`}
              style={{ width: `${paidPct}%` }} />
          </div>
          <p className="text-xs text-slate-500 tabular-nums">
            {t('page.overview.paidThisMonth', { paid: money(paid, currency), target: money(target, currency) })}
            {showsThreshold && <> · {t('page.overview.unlocksAt', { threshold: money(threshold, currency) })}</>}
            {met && <span className="ml-1 font-semibold text-income">· {t('page.overview.metLabel')}</span>}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * One bucket, one tile: the amount is the thing acted on, so it is the figure; the percentage is
 * the rule that produced it, so it is the caption. The backlog carried from earlier months rides
 * along as a badge rather than living in a second section that repeated all three buckets.
 */
function BucketTile({ line, currency, carried, disabled, disabledReason, onPay, onHistory }: {
  line: AllocationLine
  currency: Currency
  /** This bucket's share of the cross-month backlog, from the ledger. */
  carried: number
  disabled: boolean
  disabledReason: string
  onPay: (suggested?: number) => void
  onHistory: () => void
}) {
  const { t } = useLang()
  const meta = BUCKET_ICONS[line.bucket]
  const target = line.minAmount ?? 0
  const paid = line.paidAmount ?? 0
  const remaining = line.remainingAmount ?? Math.max(0, target - paid)
  const paidPct = target > 0 ? Math.min(100, (paid / target) * 100) : 0
  const complete = target > 0 && paid >= target
  const ahead = paid - target

  // No pill without a target: "0 UZS to go" in an attention tone is a demand that does not exist.
  let pill: { text: string; tone: PillTone } | undefined
  if (line.recommended && target > 0) {
    if (complete && ahead > 0) pill = { text: t('ui.status.ahead', { amount: money(ahead, currency) }), tone: 'ok' }
    else if (complete) pill = { text: t('ui.status.done'), tone: 'ok' }
    else pill = { text: t('ui.status.due', { amount: money(remaining, currency) }), tone: 'attention' }
  }

  return (
    <StatTile
      span={4}
      // `line.label` arrives from the backend as English ("Donation", "Emergency"), so the tile
      // names itself from the dictionary instead and reads as Uzbek in Uzbek.
      label={bucketTitle(line.bucket, t)}
      value={money(line.recommended ? target : paid, currency)}
      // The two branches print two different figures at the same size, so each has to name its
      // own: a recommended bucket shows its Target, an unrecommended one shows what was Paid into
      // it anyway. Without the scope word the second tile was a bare number beside "Not needed
      // this month", indistinguishable from the target on the tile next to it.
      caption={line.recommended
        ? `${t('ui.scope.target')} · ${t('page.plan.minPercentCaption', { pct: line.minPercent ?? 0 })}`
        : `${t('ui.scope.paid')} · ${t('page.overview.notNeededThisMonth')}`}
      icon={<meta.Icon className="w-4 h-4" />}
      iconTone={meta.tone}
      pill={pill}
    >
      {line.recommended && (
        <div className="space-y-1">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${complete ? 'bg-income' : 'bg-indigo-500'}`}
              style={{ width: `${paidPct}%` }} />
          </div>
          <p className="text-xs text-slate-500 tabular-nums">
            {t('ui.scope.paid')} <span className="font-semibold text-slate-900">{money(paid, currency)}</span>
            {' · '}
            {t('ui.scope.left')} <span className="font-semibold text-slate-900">{money(remaining, currency)}</span>
          </p>
        </div>
      )}

      {/* The cross-month backlog, on the tile that can clear it. */}
      {carried !== 0 && (
        <p className="mt-2">
          <span className={`inline-flex items-center rounded-chip px-2 py-0.5 text-xs font-semibold tabular-nums ${
            carried > 0 ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {carried > 0
              ? t('page.plan.carriedBadge', { amount: money(carried, currency) })
              : t('ui.status.ahead', { amount: money(-carried, currency) })}
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {line.recommended && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            label={t('page.overview.recordPaymentButton')}
            onClick={() => onPay(remaining > 0 ? remaining : target)}
            disabled={disabled}
            disabledReason={disabled ? disabledReason : undefined}
          />
        )}
        <Button
          size="sm"
          icon={<History className="w-3.5 h-3.5" />}
          label={t('page.plan.historyButton')}
          onClick={onHistory}
        />
      </div>
    </StatTile>
  )
}
