import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle, ArrowDownToLine, Building2, HeartHandshake, Pencil, Plus, Repeat, ShieldAlert, Target, Trash2,
  TrendingUp,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Tile, TileGrid } from '../components/ui/Tile'
import type { TileMdSpan, TileSpan } from '../components/ui/Tile'
import { ActionMenu } from '../components/ui/ActionMenu'
import type { MenuAction } from '../components/ui/ActionMenu'
import { IconChip } from '../components/ui/IconChip'
import { ErrorTile } from '../components/ui/ErrorTile'
import { ExactAmount } from '../components/ui/ExactAmount'
import { Skeleton } from '../components/ui/Skeleton'
import { CacheBadge } from '../components/ui/CacheBadge'
import { IncomeRequiredNotice } from '../components/ui/IncomeRequiredNotice'
import { ContributeInvestmentModal } from '../components/finance/ContributeInvestmentModal'
import { UpdateValueModal } from '../components/finance/UpdateValueModal'
import { WithdrawInvestmentModal } from '../components/finance/WithdrawInvestmentModal'
import { PayBucketModal } from '../components/overview/PayBucketModal'
import { SavingsThisMonth } from '../components/savings/SavingsThisMonth'
import { AddGoalSheet, requestFrom } from '../components/savings/AddGoalSheet'
import { AddInvestmentSheet } from '../components/savings/AddInvestmentSheet'
import { TileHead } from '../components/home/HomeTiles'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useLang } from '../i18n/LanguageContext'
import { advisorApi } from '../api/advisor'
import { financeApi } from '../api/finance'
import { emergenciesApi } from '../api/emergencies'
import { extractErrorMessage } from '../api/client'
import { formatDate, money, moneyFull, snap, todayLocal } from '../utils/format'
import { goalKindOf, goalPlan } from '../components/savings/goalPlan'
import { meansLine } from '../components/savings/means'
import { GrowthLine, growthOf } from '../components/savings/growth'
import type { Bucket, Currency, InvestmentResponse } from '../types'
import type { GoalKind } from '../types/fixes'

/** A full-width row of the twelve-column page grid. */
const FULL = 'md:col-span-6 xl:col-span-12'
/** Half a row on a wide screen, the whole row on a tablet or phone — the rows carry buttons. */
const HALF = 'md:col-span-6 xl:col-span-6'
const LATEST = 5

type AddKind = 'goal' | 'investment'

/** A holding's worth: its market value when one was set, else what went in. */
const valueOf = (i: InvestmentResponse) => growthOf(i).value

/**
 * Savings: everything put by, on one page — what this month asks to set aside, goals (plans and
 * wishes), the emergency fund, investments and donations.
 *
 * One word per action (UX-FIXES-SPEC.md §1): "New" creates a goal or an investment, "Put in" moves
 * money into one, "Give" records a donation. "Pay" is not used here — that is for bills and loans.
 */
export function Savings({ currency = 'UZS' }: { currency?: Currency } = {}) {
  const { t, lang } = useLang()
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()
  const today = todayLocal()
  const month = today.slice(0, 7)
  const year = today.slice(0, 4)

  const adv = useApi(() => advisorApi.get(today), [today])
  const investments = useApi(() => financeApi.getInvestments(), [])
  const donations = useApi(() => financeApi.getDonations(), [])
  const emergencies = useApi(() => emergenciesApi.getAll(), [])

  const [chooserOpen, setChooserOpen] = useState(false)
  const [goalForm, setGoalForm] = useState<{ goal: InvestmentResponse | null; startAs?: GoalKind } | null>(null)
  const [investmentForm, setInvestmentForm] = useState<{ investment: InvestmentResponse | null } | null>(null)
  const [bucket, setBucket] = useState<{ bucket: Bucket; amount?: number } | null>(null)
  // Add money on one holding — from a goal's row in "This month", starting on what it still asks.
  const [contributeFor, setContributeFor] = useState<{ investment: InvestmentResponse; amount?: number } | null>(null)
  const [valueFor, setValueFor] = useState<InvestmentResponse | null>(null)
  const [withdrawFor, setWithdrawFor] = useState<InvestmentResponse | null>(null)
  const [showAllEmergency, setShowAllEmergency] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const refetchAll = () => { adv.refetch(); investments.refetch(); donations.refetch(); emergencies.refetch() }
  const savedToast = () => { refetchAll(); showSuccess(t('page.investments.savedToast')) }

  /** The chooser closes first, so the form it opens hands focus back to the page's Add. */
  const startAdd = (kind: AddKind) => {
    setChooserOpen(false)
    setTimeout(() => {
      if (kind === 'goal') setGoalForm({ goal: null })
      else setInvestmentForm({ investment: null })
    }, 0)
  }

  /** A goal's row in "This month" pays through the goal's own Add money. */
  const payGoal = async (goalId: number | null | undefined, amount: number) => {
    try {
      const g = (investments.data ?? []).find(i => i.id === goalId)
        ?? (await financeApi.getInvestments()).data.find(i => i.id === goalId)
      if (g) setContributeFor({ investment: g, amount: amount > 0 ? amount : undefined })
      else refetchAll()
    } catch (err) {
      showError(extractErrorMessage(err))
    }
  }

  const remove = async (key: string, message: string, run: () => Promise<unknown>, done: string) => {
    if (!await confirm({ message, destructive: true })) return
    setDeleting(key)
    try {
      await run()
      refetchAll()
      showSuccess(done)
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setDeleting(null) }
  }

  const all = investments.data ?? []
  const goals = all.filter(i => i.savingsGoal)
  // A goal is a plan (it has a monthly payment and is set aside for) or a wish (it asks for nothing).
  const plans = goals.filter(g => goalKindOf(g) === 'PLAN')
  const wishes = goals.filter(g => goalKindOf(g) === 'WISH')
  const emergencyHoldings = all.filter(i => i.emergencyFund && !i.savingsGoal)
  const holdings = all.filter(i => !i.savingsGoal && !i.emergencyFund)
  const holdingsTotal = snap(holdings.reduce((sum, i) => sum + valueOf(i), 0))

  // The emergency fund is kept in two places — contributions, and holdings flagged as the fund.
  // One total, for reading only; each entry is still edited where it lives.
  const contributions = emergencies.data ?? []
  const emergencyTotal = snap(
    contributions.reduce((sum, e) => sum + e.amount, 0)
    + emergencyHoldings.reduce((sum, i) => sum + valueOf(i), 0))
  const emergencyEntries = [
    ...emergencyHoldings.map(i => ({ kind: 'holding' as const, date: i.purchaseDate, holding: i })),
    ...contributions.map(e => ({ kind: 'contribution' as const, date: e.date, contribution: e })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const donationList = [...(donations.data ?? [])].sort((a, b) => b.donationDate.localeCompare(a.donationDate))
  const donationsThisYear = snap(donationList
    .filter(d => d.donationDate.startsWith(year))
    .reduce((sum, d) => sum + d.amount, 0))

  // The fund reads from two lists, so it waits for — and retries — both.
  const emergencyQuery = {
    loading: emergencies.loading || investments.loading,
    error: (emergencies.error && !emergencies.data ? emergencies.error : null)
      ?? (investments.error && !investments.data ? investments.error : null),
    data: emergencies.data && investments.data,
    refetch: () => { emergencies.refetch(); investments.refetch() },
  }

  // Stale but readable: the lists stay on screen and one strip offers the retry.
  const staleError = [adv, investments, donations, emergencies].find(q => q.error && q.data)?.error ?? null

  const d = adv.data
  // Whether the server stores wishes. It says so either way it can: the advisor's goal list, or
  // the flag on a goal. Without it nothing here offers a wish — the field would be ignored, and a
  // toast saying "it is a wish now" would be untrue.
  const wishSupported = d?.goals !== undefined || goals.some(g => g.wish !== undefined)
  const means = d?.means ?? null
  // Whether a normal month has room for the plans. A month can be short before any plan, so the
  // sentence is chosen in one place (means.ts) and never prints a negative amount as "left".
  const fits = meansLine(means)
  const fitsText = fits
    ? t(fits.key, Object.fromEntries(Object.entries(fits.amounts).map(([k, v]) => [k, money(v, currency)])))
    : null
  const savingsRows = d ? (d.savingsThisMonth ?? d.setAside ?? []) : []
  const leftThisMonth = snap(savingsRows.reduce((sum, r) => sum + Math.max(0, r.remaining), 0))

  /**
   * "Make it a wish" / "Make it a plan": one tap, nothing else changes. The monthly payment, the
   * start month and the deadline stay stored, so a wish made a plan again is the plan it was. A
   * wish that never had a monthly payment has nothing to go back to, and opens the form instead.
   */
  const setWish = async (g: InvestmentResponse, wish: boolean) => {
    if (!wish && !((g.monthlyContribution ?? 0) > 0)) { setGoalForm({ goal: g, startAs: 'PLAN' }); return }
    try {
      await financeApi.updateInvestment(g.id, requestFrom(g, { wish }))
      refetchAll()
      showSuccess(wish
        ? t('fix.goal.nowWish', { name: g.name })
        : t('fix.goal.nowPlan', { name: g.name, amount: moneyFull(g.monthlyContribution ?? 0, g.currency) }))
    } catch (err) {
      showError(extractErrorMessage(err))
    }
  }

  const goalActions = (g: InvestmentResponse): MenuAction[] => [
    ...(wishSupported ? [{
      label: t(goalKindOf(g) === 'PLAN' ? 'fix.goal.makeWish' : 'fix.goal.makePlan'),
      icon: <Repeat className="h-4 w-4" aria-hidden="true" />,
      onClick: () => setWish(g, goalKindOf(g) === 'PLAN'),
    }] : []),
    ...holdingActions(g, true),
  ]

  /** One goal's row: a plan says what it asks each month and whether that works; a wish does not. */
  const goalRow = (g: InvestmentResponse) => {
    // On a server without wishes every goal is a plan, as it always was.
    const plan = !wishSupported || goalKindOf(g) === 'PLAN'
    const value = valueOf(g)
    const target = g.targetAmount
    const pct = target && target > 0 ? Math.min(100, (value / target) * 100) : null
    const nameId = `goal-${g.id}`
    const monthly = g.monthlyContribution ?? 0
    // Payments start in their own month; without one (or on an older server), the goal's.
    const start = (g.paymentStartDate ?? g.purchaseDate ?? '').slice(0, 7)
    const own = goalPlan(Math.max(0, (target ?? 0) - value), monthly, g.targetDate ?? null, month, start)
    const planLine = [
      plan && monthly > 0
        ? start > month
          ? t('home.goals.perMonthFrom', {
            amount: moneyFull(monthly, g.currency), month: formatDate(start, lang, 'monthShort'),
          })
          : t('home.goals.perMonth', { amount: moneyFull(monthly, g.currency) })
        : null,
      plan && own.deadlineMonth ? t('home.goals.by', { month: formatDate(own.deadlineMonth, lang, 'monthShort') }) : null,
    ].filter(Boolean).join(' · ')

    // The status is the server's when it sends one — it also knows whether the plans fit a normal
    // month. Without it (an older server) the row says what it always said: whether the monthly
    // payment reaches the target by the deadline.
    const advised = d?.goals?.find(x => x.id === g.id)
    const status: { text: string; good: boolean } | null = !plan ? null
      : advised
        ? advised.status === 'ON_TRACK' ? { text: t('home.goals.onTrack'), good: true }
          : advised.status === 'BEHIND'
            ? { text: t('home.goals.behind', { amount: moneyFull(advised.neededMonthly ?? own.needed ?? 0, g.currency) }), good: false }
            : advised.status === 'DOES_NOT_FIT' ? { text: t('fix.goal.status.doesNotFit'), good: false }
              : null
        : own.deadlineMonth && target != null && target > 0 && value < target
          ? monthly > 0 && !own.late
            ? { text: t('home.goals.onTrack'), good: true }
            : { text: t('home.goals.behind', { amount: moneyFull(own.needed ?? 0, g.currency) }), good: false }
          : null

    return (
      <li key={g.id} className="py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p id={nameId} className="text-sm font-medium text-slate-900 max-sm:line-clamp-2 max-sm:[overflow-wrap:anywhere] sm:truncate">{g.name}</p>
            <p className="text-xs tabular-nums text-slate-500">
              {target != null
                ? t('home.goals.ofTarget', { value: moneyFull(value, g.currency), target: moneyFull(target, g.currency) })
                : moneyFull(value, g.currency)}
            </p>
            {planLine && <p className="text-xs tabular-nums text-slate-500">{planLine}</p>}
            {/* Only once the goal tracks a value of its own — otherwise put in = now. */}
            {g.currentValue != null && Math.abs(growthOf(g).growth) >= 1 && <GrowthLine i={g} />}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" label={t('cmp.action.topUp')} aria-describedby={nameId}
              icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => setContributeFor({ investment: g })} />
            <ActionMenu actions={goalActions(g)} />
          </div>
        </div>
        {pct != null && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-income transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className={`w-12 shrink-0 text-right text-xs tabular-nums ${pct >= 100 ? 'font-semibold text-income' : 'text-slate-500'}`}>
              {pct >= 100 ? t('ui.status.done') : `${Math.floor(pct)}%`}
            </span>
          </div>
        )}
        {status && (
          <p className={`mt-1 text-xs font-medium tabular-nums ${status.good ? 'text-income' : 'text-amber-700'}`}>
            {status.text}
          </p>
        )}
      </li>
    )
  }

  const holdingActions = (i: InvestmentResponse, withEdit: boolean): MenuAction[] => [
    ...(withEdit ? [{
      label: t('action.edit'),
      icon: <Pencil className="h-4 w-4" aria-hidden="true" />,
      onClick: () => (i.savingsGoal ? setGoalForm({ goal: i }) : setInvestmentForm({ investment: i })),
    }] : []),
    {
      label: t('action.delete'),
      icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
      danger: true,
      disabled: deleting === `inv-${i.id}`,
      onClick: () => remove(
        `inv-${i.id}`,
        t(i.savingsGoal ? 'home.goal.confirmDelete' : 'page.investments.confirmDelete'),
        () => financeApi.deleteInvestment(i.id),
        t(i.savingsGoal ? 'home.goal.deletedToast' : 'page.investments.deletedToast'),
      ),
    },
  ]

  return (
    <div className="p-4 sm:p-6">
      <TileGrid>
        <div className={FULL}>
          <PageHeader
            title={t('home.savings.page')}
            primary={{ label: t('action.new'), onClick: () => setChooserOpen(true), icon: <Plus className="w-4 h-4" aria-hidden="true" /> }}
          />
        </div>

        <IncomeRequiredNotice className={FULL} />
        {staleError && <ErrorTile compact className={FULL} message={staleError} onRetry={refetchAll} />}

        {/* ── This month ── the page's one big number. */}
        {adv.loading ? (
          <Skeleton variant="stat" className={HALF} />
        ) : adv.error && !d ? (
          <ErrorTile className={HALF} message={adv.error} onRetry={adv.refetch} />
        ) : (
          <Tile span={6} mdSpan={6} padding="hero" as="section">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-label uppercase text-slate-500">{t('home.savings.thisMonth')}</h2>
              <CacheBadge isCached={adv.isCached} cachedAt={adv.cachedAt} />
            </div>
            {savingsRows.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">{t('home.savings.nothing')}</p>
            ) : (
              <>
                <p className={`mt-3 text-hero tabular-nums whitespace-nowrap ${leftThisMonth > 0 ? 'text-slate-900' : 'text-income'}`}>
                  {leftThisMonth > 0 ? money(leftThisMonth, currency) : t('ui.status.done')}
                </p>
                {leftThisMonth > 0 && <ExactAmount amount={leftThisMonth} currency={currency} className="mt-0.5" />}
                <p className="mt-2 text-sm text-slate-600">
                  {leftThisMonth > 0 ? t('home.savings.leftCaption') : t('home.savings.allDone')}
                </p>
                <div className="mt-3">
                  <SavingsThisMonth
                    rows={savingsRows}
                    currency={currency}
                    month={d?.month}
                    onPay={(row, amount) => row.bucket === 'GOAL'
                      ? payGoal(row.refId, amount)
                      : setBucket({ bucket: row.bucket, amount })}
                  />
                </div>
              </>
            )}
          </Tile>
        )}

        {/* ── Goals ── plans, then wishes. Beside "This month", so the two tall tiles share a row;
            investments and the emergency fund share the next. */}
        <QuerySlot query={investments} className={HALF}>
          <Section
            span={6} mdSpan={6}
            title={t('home.goals.title')}
            action={<SmallAdd label={t('page.advisor.btn.addGoal')} onClick={() => setGoalForm({ goal: null })} />}
          >
            {goals.length === 0 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-600">{t('home.goals.empty')}</p>
              </div>
            ) : !wishSupported ? (
              // A server from before wishes: one list, exactly as it was.
              <ul className="mt-1 divide-y divide-hairline">{goals.map(goalRow)}</ul>
            ) : (
              <>
                <h3 className="mt-3 text-label uppercase text-slate-500">{t('fix.goals.plans')}</h3>
                {/* Whether a normal month has room for the plans — the server's verdict. */}
                {plans.length > 0 && fits && (fits.warn ? (
                  <p className="mt-2 flex items-start gap-2 text-sm font-medium text-amber-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="tabular-nums">{fitsText}</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm tabular-nums text-slate-600">{fitsText}</p>
                ))}
                {plans.length > 0 ? (
                  <ul className="mt-1 divide-y divide-hairline">{plans.map(goalRow)}</ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">{t('fix.goals.noPlans')}</p>
                )}
                {wishes.length > 0 && (
                  <>
                    <h3 className="mt-4 border-t border-hairline pt-3 text-label uppercase text-slate-500">{t('fix.goals.wishes')}</h3>
                    <ul className="mt-1 divide-y divide-hairline">{wishes.map(goalRow)}</ul>
                  </>
                )}
              </>
            )}
          </Section>
        </QuerySlot>

        {/* ── Investments ── */}
        <QuerySlot query={investments} className={HALF}>
          <Section
            span={6} mdSpan={6}
            title={t('cmp.bucket.investments')}
            action={<SmallAdd label={t('action.new')} onClick={() => setInvestmentForm({ investment: null })} />}
          >
            {holdings.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{t('page.investments.empty')}</p>
            ) : (
              <>
                <p className="mt-2 text-stat tabular-nums text-slate-900">{money(holdingsTotal, currency)}</p>
                <ExactAmount amount={holdingsTotal} currency={currency} />
                <ul className="mt-2 divide-y divide-hairline">
                  {holdings.map(i => {
                    const nameId = `inv-${i.id}`
                    return (
                      <li key={i.id} className="py-3">
                        <div className="flex items-start gap-3">
                          <IconChip tone="teal"><Building2 className="h-4 w-4" aria-hidden="true" /></IconChip>
                          <div className="min-w-0 flex-1">
                            <p id={nameId} className="truncate text-sm font-medium text-slate-900">{i.name}</p>
                            {i.broker && <p className="truncate text-xs text-slate-500">{i.broker}</p>}
                            <GrowthLine i={i} className="mt-0.5" />
                          </div>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{moneyFull(valueOf(i), i.currency)}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 sm:pl-12">
                          <Button size="sm" label={t('cmp.action.topUp')} aria-describedby={nameId}
                            icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                            onClick={() => setContributeFor({ investment: i })} />
                          {/* One button for the everyday action; the rare ones live in the menu. */}
                          <div className="ml-auto">
                            <ActionMenu actions={[
                              { label: t('page.investments.updateValue'), icon: <TrendingUp className="h-4 w-4" aria-hidden="true" />, onClick: () => setValueFor(i) },
                              { label: t('cmp.withdraw.action'), icon: <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />, disabled: valueOf(i) <= 0, onClick: () => setWithdrawFor(i) },
                              ...holdingActions(i, true),
                            ]} />
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </Section>
        </QuerySlot>

        {/* ── Emergency fund ── one total over both places it is kept. */}
        <QuerySlot query={emergencyQuery} className={HALF}>
          <Section
            span={6} mdSpan={6}
            title={t('cmp.bucket.emergency')}
            action={<SmallAdd label={t('cmp.action.topUp')} onClick={() => setBucket({ bucket: 'EMERGENCY' })} />}
          >
            <p className="mt-2 text-stat tabular-nums text-slate-900">{money(emergencyTotal, currency)}</p>
            <ExactAmount amount={emergencyTotal} currency={currency} />
            {emergencyEntries.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">{t('home.emergency.empty')}</p>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-hairline">
                  {(showAllEmergency ? emergencyEntries : emergencyEntries.slice(0, LATEST)).map(e => e.kind === 'holding' ? (
                    <EntryRow
                      key={`h-${e.holding.id}`}
                      icon={<IconChip tone="amber"><ShieldAlert className="h-4 w-4" aria-hidden="true" /></IconChip>}
                      title={e.holding.name}
                      sub={formatDate(e.date, lang)}
                      extra={<GrowthLine i={e.holding} />}
                      amount={moneyFull(valueOf(e.holding), e.holding.currency)}
                      actions={[
                        { label: t('cmp.action.topUp'), icon: <Plus className="h-4 w-4" aria-hidden="true" />, onClick: () => setContributeFor({ investment: e.holding }) },
                        { label: t('page.investments.updateValue'), icon: <TrendingUp className="h-4 w-4" aria-hidden="true" />, onClick: () => setValueFor(e.holding) },
                        { label: t('cmp.withdraw.action'), icon: <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />, disabled: valueOf(e.holding) <= 0, onClick: () => setWithdrawFor(e.holding) },
                        ...holdingActions(e.holding, false),
                      ]}
                    />
                  ) : (
                    <EntryRow
                      key={`c-${e.contribution.id}`}
                      icon={<IconChip tone="amber"><ShieldAlert className="h-4 w-4" aria-hidden="true" /></IconChip>}
                      title={formatDate(e.date, lang)}
                      sub={e.contribution.description ?? undefined}
                      amount={moneyFull(e.contribution.amount, e.contribution.currency)}
                      actions={[{
                        label: t('action.delete'),
                        icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
                        danger: true,
                        disabled: deleting === `em-${e.contribution.id}`,
                        onClick: () => remove(
                          `em-${e.contribution.id}`,
                          t('page.emergencies.confirmDelete'),
                          () => emergenciesApi.delete(e.contribution.id),
                          t('page.emergencies.deletedToast'),
                        ),
                      }]}
                    />
                  ))}
                </ul>
                {emergencyEntries.length > LATEST && (
                  <button type="button" onClick={() => setShowAllEmergency(v => !v)}
                    className="focus-ring mt-1 inline-flex min-h-[44px] items-center rounded-control text-sm font-semibold text-indigo-600 hover:underline">
                    {showAllEmergency ? t('home.list.showLess') : t('home.list.showAll', { count: emergencyEntries.length })}
                  </button>
                )}
              </>
            )}
          </Section>
        </QuerySlot>

        {/* ── Donations ── */}
        <QuerySlot query={donations} className={HALF}>
          <Section
            span={6} mdSpan={6}
            title={t('page.donations')}
            action={<SmallAdd label={t('page.donations.addDonation')} onClick={() => setBucket({ bucket: 'DONATION' })} />}
          >
            <p className="mt-2 text-stat tabular-nums text-slate-900">{money(donationsThisYear, currency)}</p>
            <p className="text-sm text-slate-500">{t('home.donations.thisYear', { year })}</p>
            {donationList.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{t('page.donations.empty')}</p>
            ) : (
              <ul className="mt-2 divide-y divide-hairline">
                {donationList.slice(0, LATEST).map(dn => (
                  <EntryRow
                    key={dn.id}
                    icon={<IconChip tone="pink"><HeartHandshake className="h-4 w-4" aria-hidden="true" /></IconChip>}
                    title={dn.anonymous ? t('cmp.payBucket.anonymous') : dn.displayName}
                    sub={[formatDate(dn.donationDate, lang), dn.description].filter(Boolean).join(' · ')}
                    amount={moneyFull(dn.amount, dn.currency)}
                    actions={[{
                      label: t('action.delete'),
                      icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
                      danger: true,
                      disabled: deleting === `don-${dn.id}`,
                      onClick: () => remove(
                        `don-${dn.id}`,
                        t('page.donations.confirmDelete'),
                        () => financeApi.deleteDonation(dn.id),
                        t('page.donations.deletedToast'),
                      ),
                    }]}
                  />
                ))}
              </ul>
            )}
          </Section>
        </QuerySlot>
      </TileGrid>

      {/* "Add" — what kind of saving, one tap each. */}
      <Sheet open={chooserOpen} onClose={() => setChooserOpen(false)} title={t('action.new')} maxWidth="max-w-md">
        <div className="space-y-2">
          {([
            { kind: 'goal', label: t('page.advisor.btn.addGoal'), icon: <Target className="h-4 w-4" aria-hidden="true" />, tone: 'indigo' },
            { kind: 'investment', label: t('page.investments.addInvestment'), icon: <Building2 className="h-4 w-4" aria-hidden="true" />, tone: 'teal' },
          ] as const).map(o => (
            <button
              key={o.kind}
              type="button"
              onClick={() => startAdd(o.kind)}
              className="focus-ring flex min-h-[56px] w-full items-center gap-3 rounded-control border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            >
              <IconChip tone={o.tone}>{o.icon}</IconChip>
              {o.label}
            </button>
          ))}
        </div>
      </Sheet>

      <AddGoalSheet
        open={!!goalForm} goal={goalForm?.goal ?? null}
        wishSupported={wishSupported} means={means} startAs={goalForm?.startAs}
        onClose={() => setGoalForm(null)} onSaved={refetchAll}
      />
      <AddInvestmentSheet
        open={!!investmentForm} investment={investmentForm?.investment ?? null}
        onClose={() => setInvestmentForm(null)} onSaved={refetchAll}
      />
      <PayBucketModal
        open={!!bucket} bucket={bucket?.bucket ?? null} suggestedAmount={bucket?.amount}
        currency={currency} defaultMonth={month}
        onClose={() => setBucket(null)} onSaved={refetchAll}
      />
      <ContributeInvestmentModal
        open={!!contributeFor} investment={contributeFor?.investment ?? null}
        defaultAmount={contributeFor?.amount}
        onClose={() => setContributeFor(null)} onSaved={savedToast}
      />
      <UpdateValueModal
        open={!!valueFor} investment={valueFor}
        onClose={() => setValueFor(null)} onSaved={savedToast}
        onAddMoney={() => {
          // "I added money" is a saving from a wallet — hand over to Add money once this closes.
          const inv = valueFor
          setValueFor(null)
          if (inv) setTimeout(() => setContributeFor({ investment: inv }), 0)
        }}
      />
      <WithdrawInvestmentModal
        open={!!withdrawFor} investment={withdrawFor}
        onClose={() => setWithdrawFor(null)} onSaved={refetchAll}
      />
    </div>
  )
}

/** A titled tile on the Savings grid. */
function Section({ title, action, span, mdSpan, children }: {
  title: string
  action?: ReactNode
  span: TileSpan
  mdSpan?: TileMdSpan
  children: ReactNode
}) {
  return (
    <Tile span={span} mdSpan={mdSpan} as="section">
      <TileHead title={title} action={action} />
      {children}
    </Tile>
  )
}

/** A tile's add button, top right. */
function SmallAdd({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" label={label} icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
      onClick={onClick} className="shrink-0" />
  )
}

/** One entry in a tile's list: what, when, how much, and its ⋯ menu. */
function EntryRow({ icon, title, sub, extra, amount, actions }: {
  icon: ReactNode
  title: string
  sub?: string
  /** A further line under `sub` — a holding's growth. */
  extra?: ReactNode
  amount: string
  actions: MenuAction[]
}) {
  return (
    <li className="flex min-h-[56px] items-center gap-3 py-2">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{title}</p>
        {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
        {extra}
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{amount}</p>
      <ActionMenu actions={actions} />
    </li>
  )
}

/** A tile's three async states in the cell the tile would take. */
function QuerySlot({ query, className, children }: {
  query: { loading: boolean; error: string | null; data: unknown; refetch: () => void }
  className: string
  children: ReactNode
}) {
  if (query.loading) return <Skeleton variant="row" count={3} className={className} />
  if (query.error && !query.data) return <ErrorTile message={query.error} onRetry={query.refetch} className={className} />
  return <>{children}</>
}
