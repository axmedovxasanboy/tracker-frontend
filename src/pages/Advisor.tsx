import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { GetStartedHero, INCOME_FIELD_ID } from '../components/dashboard/GetStartedHero'
import { PaySubscriptionModal } from '../components/finance/PaySubscriptionModal'
import { ContributeInvestmentModal } from '../components/finance/ContributeInvestmentModal'
import { RepaymentModal } from '../components/finance/RepaymentModal'
import type { RepayTarget } from '../components/finance/RepaymentModal'
import { PayBankInstallmentModal } from '../components/overview/PayBankInstallmentModal'
import { PayPersonalLoanModal } from '../components/overview/PayPersonalLoanModal'
import { PayBucketModal } from '../components/overview/PayBucketModal'
import { CheckInModal } from '../components/months/CheckInModal'
import { TransactionModal } from '../components/transactions/TransactionModal'
import { SpendHero } from '../components/home/SpendHero'
import {
  ComingUpTile, LinkButton, NextStepsTile, TileHead, YouHaveTile, canPayUpcoming, isBucket, visibleSteps,
} from '../components/home/HomeTiles'
import { SavingsThisMonth } from '../components/savings/SavingsThisMonth'
import { AddGoalSheet } from '../components/savings/AddGoalSheet'
import { ErrorTile } from '../components/ui/ErrorTile'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { Tile, TileGrid } from '../components/ui/Tile'
import { useApi } from '../hooks/useApi'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import { advisorApi } from '../api/advisor'
import { dashboardApi } from '../api/dashboard'
import { financeApi } from '../api/finance'
import { extractErrorMessage } from '../api/client'
import { formatDate, todayLocal } from '../utils/format'
import type {
  AdvisorSuggestion, AdvisorUpcoming, Bucket, Currency, InvestmentResponse, MonthlyPaymentResponse,
  TransactionType,
} from '../types'

interface Props { currency: Currency }

/** A full-width row of the twelve-column page grid. */
const FULL = 'md:col-span-6 xl:col-span-12'

/**
 * Home: how much can I safely spend until salary — and what is coming, what to save, what I have.
 *
 * Top to bottom: the daily figure (red when the money runs short), the bills and loan payments due
 * soon, this month's savings, the wallets, and at most three next steps that nothing above already
 * covers. Every "Pay" opens the dialog the rest of the app uses for that job. It all comes from
 * `GET /advisor` — the same answer the Telegram bot sends — so web and bot never disagree.
 */
export function Advisor({ currency }: Props) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { showError, showSuccess } = useToast()
  const { hasStableIncome, ready: settingsReady, error: settingsError, loading: settingsLoading } = useSettings()
  const today = todayLocal()
  const month = today.slice(0, 7)

  const adv = useApi(() => advisorApi.get(today), [today])
  // Only for the first-run checklist, which needs to know whether anything was ever recorded.
  const summary = useApi(() => dashboardApi.getSummary(currency), [currency])

  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState<TransactionType | undefined>()
  // A bill opens on what is still to pay for it this month — never its full price a second time.
  const [subscription, setSubscription] = useState<{ record: MonthlyPaymentResponse; amount?: number } | null>(null)
  const [bank, setBank] = useState<{ id?: number; amount?: number } | null>(null)
  const [debtPickerOpen, setDebtPickerOpen] = useState(false)
  const [repay, setRepay] = useState<{ target: RepayTarget; amount?: number } | null>(null)
  const [bucket, setBucket] = useState<{ bucket: Bucket; amount: number } | null>(null)
  const [goal, setGoal] = useState<{ investment: InvestmentResponse; amount?: number } | null>(null)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [goalFormOpen, setGoalFormOpen] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const comingUpRef = useRef<HTMLHeadingElement>(null)

  const d = adv.data
  const refetch = () => { adv.refetch(); summary.refetch() }

  const focusIncomeSetup = () => {
    const el = document.getElementById(INCOME_FIELD_ID)
    if (!el) { navigate('/settings'); return }
    el.scrollIntoView({ block: 'center' })
    ;(el as HTMLInputElement).focus({ preventScroll: true })
  }

  // The income gate, without a dead button: until a monthly income exists the server refuses every
  // write, so "Add" takes the owner to the one field that unblocks it. Only once the answer is
  // known — a settings read still in flight, or one that failed, is not "no income".
  const incomeGated = settingsReady && !settingsError && !hasStableIncome
  const openAdd = (type?: TransactionType) => {
    if (incomeGated) { focusIncomeSetup(); return }
    setAddType(type)
    setAddOpen(true)
  }

  const seeDue = () => {
    const el = comingUpRef.current
    if (!el) return
    // Centred, not top-aligned: on a phone the top of the scroller sits under the fixed app bar.
    el.scrollIntoView({ block: 'center' })
    el.focus({ preventScroll: true })
  }

  /** "Pay" on a Coming up row: the dialog for that exact bill or loan, already on its amount. */
  const payUpcoming = async (u: AdvisorUpcoming, key: string) => {
    setBusyKey(key)
    try {
      if (u.kind === 'BILL') {
        const sub = (await financeApi.getMonthlyPayments()).data.find(m => m.id === u.refId)
        if (sub) setSubscription({ record: sub, amount: u.amount })
        else refetch()
      } else if (u.kind === 'BANK') {
        setBank({ id: u.refId ?? undefined, amount: u.amount })
      } else if (u.kind === 'LOAN') {
        const rec = (await financeApi.getLoansTaken()).data.find(l => l.id === u.refId)
        if (rec) setRepay({ target: { kind: 'loan-taken', record: rec }, amount: u.amount })
        else setDebtPickerOpen(true)
      } else {
        const rec = (await financeApi.getDebts()).data.find(x => x.id === u.refId)
        if (rec) setRepay({ target: { kind: 'debt', record: rec }, amount: u.amount })
        else setDebtPickerOpen(true)
      }
    } catch (err: unknown) {
      showError(extractErrorMessage(err))
    } finally {
      setBusyKey(null)
    }
  }

  /** One step's button: open the dialog that already does this job elsewhere in the app. */
  const act = async (s: AdvisorSuggestion) => {
    try {
      switch (s.action) {
        case 'SET_INCOME': focusIncomeSetup(); return
        case 'PAY_SUBSCRIPTION': {
          const sub = (await financeApi.getMonthlyPayments()).data.find(m => m.id === s.refId)
          if (sub) setSubscription({ record: sub, amount: s.amount ?? undefined })
          else refetch()
          return
        }
        case 'PAY_BANK': setBank({}); return
        case 'PAY_DEBT': setDebtPickerOpen(true); return
        case 'CHECK_IN': setCheckInOpen(true); return
        // The short goal form, right here — no trip to another page.
        case 'ADD_GOAL': setGoalFormOpen(true); return
        case 'SET_ASIDE': {
          if (s.bucket === 'SAVINGS' && s.refId != null) {
            const g = (await financeApi.getInvestments()).data.find(i => i.id === s.refId)
            if (g) setGoal({ investment: g, amount: s.amount ?? undefined })
            else refetch()
          } else if (isBucket(s.bucket)) {
            setBucket({ bucket: s.bucket, amount: s.amount ?? 0 })
          }
          return
        }
        default: return
      }
    } catch (err: unknown) {
      showError(extractErrorMessage(err))
    }
  }

  const walletCount = d?.wallets.length ?? 0
  const showGetStarted = !settingsLoading && !!d && summary.hasLoaded && !summary.error
    && (!hasStableIncome || walletCount === 0 || (summary.data?.transactionCount ?? 0) === 0)

  const daily = d?.daily ?? null
  const upcoming = daily ? (daily.upcoming ?? []) : null
  // An older backend sends no savings rows; this month's set-aside lines are the same shape and
  // carry the unmet ones, so they stand in until it does.
  const savingsRows = d ? (d.savingsThisMonth ?? d.setAside ?? []) : []
  const steps = d ? visibleSteps(d, {
    firstRunShowsIncome: showGetStarted && !hasStableIncome,
    upcoming: upcoming ? upcoming.filter(u => canPayUpcoming(u, month)) : null,
    savings: savingsRows.map(r => r.bucket),
  }) : []

  // Two tiles share a row on a wide screen; one alone takes the row. On a tablet each takes the
  // full width — the rows carry a Pay button, and half of a tablet is too narrow for them.
  const pairSpan = (a: boolean, b: boolean) => (a && b ? 6 : 12) as 6 | 12

  const youHave = d && (
    <YouHaveTile
      d={d}
      currency={currency}
      span={daily ? pairSpan(true, steps.length > 0) : 12}
      mdSpan={6}
      hero={!daily}
      onCheck={() => setCheckInOpen(true)}
      extra={!daily && d.missingStableIncome ? (
        <p className="mt-2 text-sm text-slate-600">{t('home.hero.noIncome')}</p>
      ) : undefined}
    />
  )

  return (
    <div className="p-4 sm:p-6">
      <TileGrid>
        <div className={FULL}>
          <PageHeader
            title={t('nav.home')}
            subtitle={formatDate(today, lang, 'long')}
            primary={{ label: t('action.add'), onClick: () => openAdd(), icon: <Plus className="w-4 h-4" aria-hidden="true" /> }}
            overflow={[
              { label: t('page.advisor.refresh'), onClick: refetch, icon: <RefreshCw className="w-4 h-4" aria-hidden="true" /> },
            ]}
          />
        </div>

        {showGetStarted && (
          <GetStartedHero
            span={12}
            currency={currency}
            walletCount={walletCount}
            transactionCount={summary.data?.transactionCount ?? 0}
            onStepDone={refetch}
            onAddExpense={() => openAdd('EXPENSE')}
          />
        )}

        {adv.loading ? (
          <>
            <Tile span={12} padding="none"><Skeleton variant="stat" bare className="p-6" /></Tile>
            <Skeleton variant="row" count={3} className="md:col-span-6 xl:col-span-6" />
            <Skeleton variant="row" count={3} className="md:col-span-6 xl:col-span-6" />
          </>
        ) : adv.error && !d ? (
          <ErrorTile className={FULL} message={adv.error} onRetry={adv.refetch} />
        ) : d ? (
          <>
            {adv.error && <ErrorTile compact className={FULL} message={adv.error} onRetry={adv.refetch} />}

            <SpendHero
              d={d}
              currency={currency}
              cached={{ isCached: adv.isCached, cachedAt: adv.cachedAt }}
              onSeeDue={seeDue}
              fallback={youHave}
            />

            {upcoming && (
              <ComingUpTile
                ref={comingUpRef}
                rows={upcoming}
                currency={currency}
                month={month}
                span={pairSpan(true, savingsRows.length > 0)}
                mdSpan={6}
                busyKey={busyKey}
                onPay={payUpcoming}
                onAll={() => navigate('/loans')}
              />
            )}

            {savingsRows.length > 0 && (
              <Tile span={pairSpan(!!upcoming, true)} mdSpan={6} as="section">
                <TileHead
                  title={t('home.savings.title')}
                  action={<LinkButton label={t('home.savings.open')} onClick={() => navigate('/savings')} />}
                />
                <div className="mt-1">
                  <SavingsThisMonth
                    rows={savingsRows}
                    currency={currency}
                    onPay={(b, amount) => setBucket({ bucket: b, amount })}
                  />
                </div>
              </Tile>
            )}

            {daily && youHave}

            {steps.length > 0 && (
              <NextStepsTile
                steps={steps}
                currency={currency}
                span={daily ? pairSpan(true, true) : 12}
                mdSpan={6}
                onAct={act}
              />
            )}
          </>
        ) : null}
      </TileGrid>

      <TransactionModal
        open={addOpen} onClose={() => setAddOpen(false)}
        onSaved={refetch} defaultCurrency={currency} transaction={null}
        presetType={addType}
      />
      {/* These two dialogs leave the confirmation to their caller. */}
      <PaySubscriptionModal
        open={!!subscription} subscription={subscription?.record ?? null}
        defaultAmount={subscription?.amount}
        onClose={() => setSubscription(null)}
        onSaved={() => { refetch(); showSuccess(t('page.finance.paymentRecordedToast')) }}
      />
      <PayBankInstallmentModal
        open={!!bank} onClose={() => setBank(null)} onSaved={refetch} defaultMonth={month}
        bankLoanId={bank?.id} defaultAmount={bank?.amount}
      />
      <PayPersonalLoanModal open={debtPickerOpen} onClose={() => setDebtPickerOpen(false)} onSaved={refetch} defaultMonth={month} />
      <RepaymentModal
        open={!!repay} target={repay?.target ?? null} defaultAmount={repay?.amount}
        onClose={() => setRepay(null)} onSaved={refetch}
      />
      <PayBucketModal
        open={!!bucket} bucket={bucket?.bucket ?? null} suggestedAmount={bucket?.amount}
        currency={currency} defaultMonth={month}
        onClose={() => setBucket(null)} onSaved={refetch}
      />
      <ContributeInvestmentModal
        open={!!goal} investment={goal?.investment ?? null} defaultAmount={goal?.amount}
        onClose={() => setGoal(null)}
        onSaved={() => { refetch(); showSuccess(t('page.investments.savedToast')) }}
      />
      <CheckInModal open={checkInOpen} onClose={() => setCheckInOpen(false)} onSaved={refetch} currency={currency} />
      <AddGoalSheet open={goalFormOpen} onClose={() => setGoalFormOpen(false)} onSaved={refetch} />
    </div>
  )
}
