import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, ChevronDown, ChevronUp, CreditCard,
  Hourglass, Landmark, Lightbulb, ListChecks, Plus, RefreshCw, Target, TrendingDown, Wallet,
} from 'lucide-react'
import { GetStartedHero, INCOME_FIELD_ID } from '../components/dashboard/GetStartedHero'
import { QuickIncomeModal } from '../components/dashboard/QuickIncomeModal'
import { PaySubscriptionModal } from '../components/finance/PaySubscriptionModal'
import { ContributeInvestmentModal } from '../components/finance/ContributeInvestmentModal'
import { PayBankInstallmentModal } from '../components/overview/PayBankInstallmentModal'
import { PayPersonalLoanModal } from '../components/overview/PayPersonalLoanModal'
import { PayBucketModal } from '../components/overview/PayBucketModal'
import { CheckInModal } from '../components/months/CheckInModal'
import { CloseMonthModal } from '../components/months/CloseMonthModal'
import { TransactionModal } from '../components/transactions/TransactionModal'
import { Button } from '../components/ui/Button'
import { CacheBadge } from '../components/ui/CacheBadge'
import { ErrorTile } from '../components/ui/ErrorTile'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { StatTile } from '../components/ui/StatTile'
import { Tile, TileGrid } from '../components/ui/Tile'
import { useApi } from '../hooks/useApi'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import { advisorApi } from '../api/advisor'
import { dashboardApi } from '../api/dashboard'
import { financeApi } from '../api/finance'
import { extractErrorMessage } from '../api/client'
import { formatDate, formatMonth, money, moneyFull, todayLocal } from '../utils/format'
import type {
  AdvisorBill, AdvisorResponse, AdvisorSuggestion, Bucket, Currency,
  InvestmentResponse, MonthlyPaymentResponse,
} from '../types'

interface Props { currency: Currency }

/** A full-width row of the twelve-column page grid. */
const FULL = 'md:col-span-6 xl:col-span-12'

/** `AdvisorResponse.Suggestion.code` → the sentence. An unknown code prints the server's English. */
const SUGGESTION_KEY: Record<string, TKey> = {
  'advisor.s.setIncome': 'page.advisor.s.setIncome',
  'advisor.s.paySubscription': 'page.advisor.s.paySubscription',
  'advisor.s.payBank': 'page.advisor.s.payBank',
  'advisor.s.payLoanPlan': 'page.advisor.s.payLoanPlan',
  'advisor.s.payDebts': 'page.advisor.s.payDebts',
  'advisor.s.closeMonth': 'page.advisor.s.closeMonth',
  'advisor.s.checkWallets': 'page.advisor.s.checkWallets',
  'advisor.s.checkWalletsFirst': 'page.advisor.s.checkWalletsFirst',
  'advisor.s.setAside': 'page.advisor.s.setAside',
  'advisor.s.startEmergency': 'page.advisor.s.startEmergency',
  'advisor.s.short': 'page.advisor.s.short',
  'advisor.s.addGoal': 'page.advisor.s.addGoal',
  'advisor.s.extraToGoal': 'page.advisor.s.extraToGoal',
  'advisor.s.extraToEmergency': 'page.advisor.s.extraToEmergency',
  'advisor.s.extraToInvestments': 'page.advisor.s.extraToInvestments',
}

const BUCKET_KEY: Record<string, TKey> = {
  DONATION: 'cmp.bucket.donation',
  EMERGENCY: 'cmp.bucket.emergency',
  INVESTMENTS: 'cmp.bucket.investments',
  SAVINGS: 'page.advisor.bucket.savings',
}

const BILL_KEY: Record<Exclude<AdvisorBill['kind'], 'SUBSCRIPTION'>, TKey> = {
  BANK: 'page.advisor.bill.bank',
  LOAN_PLAN: 'page.advisor.bill.loanPlan',
  DEBTS: 'page.advisor.bill.debts',
}

const isBucket = (b: string | null): b is Bucket =>
  b === 'DONATION' || b === 'EMERGENCY' || b === 'INVESTMENTS'

/**
 * Home: the advisor. What you have, what is coming, what this month still asks for, what is free
 * after that — and what to do next, one button each.
 *
 * The owner stopped opening Tracker because Home read like a ledger. Everything that page showed
 * is still one click away (Details below, and Summary / Plan in the sidebar's Details group); this
 * page answers only the questions they asked, from `GET /advisor` — the same response the Telegram
 * bot sends every evening, so the two never give different advice. Each step opens the dialog the
 * rest of the app already uses for that job, so no payment is recorded any differently from here.
 */
export function Advisor({ currency }: Props) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { showError } = useToast()
  const { hasStableIncome, loading: settingsLoading } = useSettings()
  const today = todayLocal()
  const month = today.slice(0, 7)

  const adv = useApi(() => advisorApi.get(today), [today])
  // Only for the first-run checklist, which needs to know whether anything was ever recorded.
  const summary = useApi(() => dashboardApi.getSummary(currency), [currency])

  const [showDetails, setShowDetails] = useState(false)
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [subscription, setSubscription] = useState<MonthlyPaymentResponse | null>(null)
  const [bankOpen, setBankOpen] = useState(false)
  const [debtOpen, setDebtOpen] = useState(false)
  const [bucket, setBucket] = useState<{ bucket: Bucket; amount: number } | null>(null)
  const [goal, setGoal] = useState<InvestmentResponse | null>(null)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [closeMonth, setCloseMonth] = useState<string | null>(null)

  const d = adv.data
  const refetch = () => { adv.refetch(); summary.refetch() }

  const focusIncomeSetup = () => {
    const el = document.getElementById(INCOME_FIELD_ID)
    if (!el) { navigate('/settings'); return }
    el.scrollIntoView({ block: 'center' })
    ;(el as HTMLInputElement).focus({ preventScroll: true })
  }

  /** One step's button: open the dialog that already does this job elsewhere in the app. */
  const act = async (s: AdvisorSuggestion) => {
    try {
      switch (s.action) {
        case 'SET_INCOME': focusIncomeSetup(); return
        case 'PAY_SUBSCRIPTION': {
          const all = (await financeApi.getMonthlyPayments()).data
          const sub = all.find(m => m.id === s.refId)
          if (sub) setSubscription(sub)
          else refetch()
          return
        }
        case 'PAY_BANK': setBankOpen(true); return
        case 'PAY_DEBT': setDebtOpen(true); return
        case 'CLOSE_MONTH': setCloseMonth(s.params.month ?? null); return
        case 'CHECK_IN': setCheckInOpen(true); return
        case 'ADD_GOAL': navigate('/overview/investments?new=goal'); return
        case 'SET_ASIDE': {
          if (s.bucket === 'SAVINGS' && s.refId != null) {
            const all = (await financeApi.getInvestments()).data
            const g = all.find(i => i.id === s.refId)
            if (g) setGoal(g)
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

  const sentence = (s: AdvisorSuggestion) => {
    const key = SUGGESTION_KEY[s.code]
    if (!key) return s.text
    const b = s.params.bucket ?? s.bucket
    return t(key, {
      name: s.params.name ?? '',
      month: s.params.month ? formatMonth(s.params.month, lang) : '',
      days: s.params.days ?? '',
      bucket: b && BUCKET_KEY[b] ? t(BUCKET_KEY[b]) : (b ?? ''),
      amount: s.amount != null ? moneyFull(s.amount, currency) : '',
    })
  }

  const buttonLabel = (s: AdvisorSuggestion): string | null => {
    switch (s.action) {
      case 'PAY_SUBSCRIPTION':
      case 'PAY_BANK':
      case 'PAY_DEBT': return t('page.advisor.btn.pay')
      case 'CHECK_IN': return t('page.advisor.btn.checkIn')
      case 'CLOSE_MONTH': return t('page.advisor.btn.close')
      case 'SET_ASIDE': return t('page.advisor.btn.setAside')
      case 'ADD_GOAL': return t('page.advisor.btn.addGoal')
      case 'SET_INCOME': return t('page.advisor.btn.setIncome')
      default: return null
    }
  }

  const stepIcon = (s: AdvisorSuggestion): { icon: ReactNode; tone: string } => {
    if (s.kind === 'WARN') return { icon: <AlertTriangle className="w-4 h-4" />, tone: 'bg-amber-100 text-amber-700' }
    if (s.kind === 'IDEA') return { icon: <Lightbulb className="w-4 h-4" />, tone: 'bg-teal-100 text-teal-700' }
    switch (s.action) {
      case 'PAY_SUBSCRIPTION': return { icon: <CreditCard className="w-4 h-4" />, tone: 'bg-indigo-100 text-indigo-600' }
      case 'PAY_BANK':
      case 'PAY_DEBT': return { icon: <Landmark className="w-4 h-4" />, tone: 'bg-indigo-100 text-indigo-600' }
      case 'CHECK_IN': return { icon: <Wallet className="w-4 h-4" />, tone: 'bg-slate-100 text-slate-600' }
      case 'CLOSE_MONTH': return { icon: <CalendarCheck className="w-4 h-4" />, tone: 'bg-slate-100 text-slate-600' }
      default: return { icon: <Target className="w-4 h-4" />, tone: 'bg-pink-100 text-pink-600' }
    }
  }

  const walletCount = d?.wallets.length ?? 0
  const showGetStarted = !settingsLoading && !!d && summary.hasLoaded && !summary.error
    && (!hasStableIncome || walletCount === 0 || (summary.data?.transactionCount ?? 0) === 0)

  return (
    <div className="p-4 sm:p-6">
      <TileGrid>
        <div className={FULL}>
          <PageHeader
            title={t('nav.home')}
            subtitle={formatDate(today, lang, 'long')}
            primary={{ label: t('page.advisor.addIncome'), onClick: () => setIncomeOpen(true), icon: <Plus className="w-4 h-4" aria-hidden="true" /> }}
            overflow={[
              { label: t('page.advisor.addExpense'), onClick: () => setExpenseOpen(true), icon: <TrendingDown className="w-4 h-4" aria-hidden="true" /> },
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
            onAddExpense={() => setExpenseOpen(true)}
          />
        )}

        {adv.loading ? (
          <>
            {[0, 1, 2, 3].map(i => (
              <Tile key={i} span={3} padding="none"><Skeleton variant="stat" bare className="p-5" /></Tile>
            ))}
          </>
        ) : adv.error && !d ? (
          <ErrorTile className={FULL} message={adv.error} onRetry={adv.refetch} />
        ) : d ? (
          <>
            {adv.error && <ErrorTile compact className={FULL} message={adv.error} onRetry={adv.refetch} />}
            <FourFigures d={d} currency={currency} onCheck={() => setCheckInOpen(true)} />

            <Tile span={12} as="section">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-label uppercase text-slate-500">{t('page.advisor.next')}</h2>
                <CacheBadge isCached={adv.isCached} cachedAt={adv.cachedAt} />
              </div>
              {d.missingStableIncome && d.suggestions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">{t('page.advisor.noIncome')}</p>
              ) : d.suggestions.length === 0 ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-income" aria-hidden="true" />
                  {t('page.advisor.allDone')}
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-hairline">
                  {d.suggestions.map((s, i) => {
                    const { icon, tone } = stepIcon(s)
                    const label = buttonLabel(s)
                    return (
                      <li key={`${s.code}-${s.refId ?? s.bucket ?? i}`} className="flex items-center gap-3 py-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-chip ${tone}`} aria-hidden="true">
                          {icon}
                        </span>
                        <p className={`min-w-0 flex-1 text-sm ${s.kind === 'IDEA' ? 'text-slate-600' : 'text-slate-900'}`}>
                          {sentence(s)}
                        </p>
                        {label && (
                          <Button size="sm" variant="secondary" label={label} onClick={() => act(s)} className="shrink-0" />
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Tile>

            <Tile span={12} as="section">
              <button
                type="button"
                onClick={() => setShowDetails(v => !v)}
                aria-expanded={showDetails}
                className="flex w-full min-h-[44px] items-center justify-between gap-3 rounded-control text-left focus-ring"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ListChecks className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  {t('page.advisor.details')}
                </span>
                {showDetails
                  ? <ChevronUp className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  : <ChevronDown className="w-4 h-4 text-slate-500" aria-hidden="true" />}
              </button>
              {showDetails && <Details d={d} currency={currency} />}
            </Tile>
          </>
        ) : null}
      </TileGrid>

      <QuickIncomeModal open={incomeOpen} onClose={() => setIncomeOpen(false)} onSaved={refetch} />
      <TransactionModal
        open={expenseOpen} onClose={() => setExpenseOpen(false)}
        onSaved={refetch} defaultCurrency={currency} transaction={null} presetType="EXPENSE"
      />
      <PaySubscriptionModal
        open={!!subscription} subscription={subscription}
        onClose={() => setSubscription(null)} onSaved={refetch}
      />
      <PayBankInstallmentModal open={bankOpen} onClose={() => setBankOpen(false)} onSaved={refetch} defaultMonth={month} />
      <PayPersonalLoanModal open={debtOpen} onClose={() => setDebtOpen(false)} onSaved={refetch} defaultMonth={month} />
      <PayBucketModal
        open={!!bucket} bucket={bucket?.bucket ?? null} suggestedAmount={bucket?.amount}
        currency={currency} defaultMonth={month}
        onClose={() => setBucket(null)} onSaved={refetch}
      />
      <ContributeInvestmentModal open={!!goal} investment={goal} onClose={() => setGoal(null)} onSaved={refetch} />
      <CheckInModal open={checkInOpen} onClose={() => setCheckInOpen(false)} onSaved={refetch} currency={currency} />
      {closeMonth && (
        <CloseMonthModal
          open month={closeMonth} currency={currency}
          onClose={() => setCloseMonth(null)} onSaved={refetch}
        />
      )}
    </div>
  )
}

/** You have · Coming · Still this month · Free — the four answers, one tile each. */
function FourFigures({ d, currency, onCheck }: { d: AdvisorResponse; currency: Currency; onCheck: () => void }) {
  const { t } = useLang()
  const ago = d.balanceCheckedDaysAgo
  const checked = ago == null ? t('page.advisor.notChecked')
    : ago === 0 ? t('page.advisor.checkedToday')
    : t('page.advisor.checkedAgo', { days: ago })

  const still = d.billsLeft + d.setAsideLeft
  const stillCaption = d.billsLeft > 0 && d.setAsideLeft > 0
    ? t('page.advisor.stillBoth', { bills: moneyFull(d.billsLeft, currency), aside: moneyFull(d.setAsideLeft, currency) })
    : d.billsLeft > 0 ? t('page.advisor.stillBills', { bills: moneyFull(d.billsLeft, currency) })
    : d.setAsideLeft > 0 ? t('page.advisor.stillAside', { aside: moneyFull(d.setAsideLeft, currency) })
    : t('page.advisor.stillNone')

  const free = d.free ?? 0
  const short = d.free != null && d.free < 0

  return (
    <>
      <StatTile
        span={3} mdSpan={3}
        label={t('page.advisor.have')}
        value={money(d.have, currency)}
        caption={checked}
        icon={<Wallet className="w-4 h-4" aria-hidden="true" />}
        onClick={onCheck}
      />
      <StatTile
        span={3} mdSpan={3}
        label={t('page.advisor.coming')}
        value={money(d.salaryComing, currency)}
        caption={d.missingStableIncome ? t('page.advisor.noIncomeShort')
          : d.salaryComing > 0 ? t('page.advisor.comingSalary') : t('page.advisor.salaryIn')}
        icon={<Hourglass className="w-4 h-4" aria-hidden="true" />}
      >
        {d.owedToYou.length > 0 && (
          <ul className="space-y-0.5 text-xs text-slate-500">
            {d.owedToYou.slice(0, 2).map(o => (
              <li key={o.id} className="truncate">{t('page.advisor.owed', { name: o.name, amount: moneyFull(o.amount, currency) })}</li>
            ))}
          </ul>
        )}
      </StatTile>
      <StatTile
        span={3} mdSpan={3}
        label={t('page.advisor.still')}
        value={money(still, currency)}
        caption={stillCaption + (d.setAsideLeft > 0 && d.setAsideAfterBills ? ` ${t('page.advisor.afterBills')}` : '')}
        icon={<ListChecks className="w-4 h-4" aria-hidden="true" />}
      />
      <StatTile
        span={3} mdSpan={3}
        tone={short ? 'out' : 'in'}
        label={short ? t('page.advisor.short') : t('page.advisor.free')}
        value={d.free == null ? '—' : money(Math.abs(free), currency)}
        caption={d.free == null ? t('page.advisor.noIncomeShort')
          : short ? t('page.advisor.shortCaption') : t('page.advisor.freeCaption')}
        icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
      />
    </>
  )
}

/** Everything behind the four figures, for when the owner wants to see the arithmetic. */
function Details({ d, currency }: { d: AdvisorResponse; currency: Currency }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const heading = 'mt-5 text-label uppercase text-slate-500'
  const row = 'flex items-baseline justify-between gap-3 py-1.5 text-sm'
  const none = <p className="py-1.5 text-sm text-slate-500">{t('page.advisor.d.none')}</p>

  return (
    <div className="mt-2">
      <h3 className={heading}>{t('page.advisor.d.wallets')}</h3>
      {d.wallets.length === 0 ? none : d.wallets.map(w => (
        <div key={`${w.type}-${w.cardId ?? 'cash'}`} className={row}>
          <span className="min-w-0 truncate text-slate-700">{w.type === 'CASH' ? t('tx.cash') : w.label}</span>
          <span className="tabular-nums text-slate-900">{moneyFull(w.balance, currency)}</span>
        </div>
      ))}

      {!d.missingStableIncome && (
        <>
          <h3 className={heading}>{t('page.advisor.d.income')}</h3>
          <div className={row}>
            <span className="text-slate-700">{t('page.advisor.d.salary')}</span>
            <span className="tabular-nums text-slate-900">
              {t('page.advisor.d.ofRecorded', { received: moneyFull(d.salaryReceived, currency), expected: moneyFull(d.salaryExpected, currency) })}
            </span>
          </div>
          {d.bonusReceived > 0 && (
            <div className={row}>
              <span className="text-slate-700">{t('page.advisor.d.bonus')}</span>
              <span className="tabular-nums text-slate-900">{moneyFull(d.bonusReceived, currency)}</span>
            </div>
          )}
          {d.owedToYou.map(o => (
            <div key={o.id} className={row}>
              <span className="min-w-0 truncate text-slate-700">
                {o.expectedOn
                  ? t('page.advisor.d.owedOn', { name: o.name, date: formatDate(o.expectedOn, lang) })
                  : t('page.advisor.d.owed', { name: o.name })}
              </span>
              <span className="tabular-nums text-slate-900">{moneyFull(o.amount, currency)}</span>
            </div>
          ))}

          <h3 className={heading}>{t('page.advisor.d.bills')}</h3>
          {d.bills.length === 0 ? none : d.bills.map(b => (
            <div key={`${b.kind}-${b.refId ?? ''}`} className={row}>
              <span className="min-w-0 truncate text-slate-700">
                {b.kind === 'SUBSCRIPTION' ? b.name : t(BILL_KEY[b.kind])}
                {b.paid > 0 && (
                  <span className="text-slate-500"> · {t('page.advisor.d.paidOf', { paid: moneyFull(b.paid, currency), target: moneyFull(b.target, currency) })}</span>
                )}
              </span>
              <span className="tabular-nums text-slate-900">{moneyFull(b.amount, currency)}</span>
            </div>
          ))}

          <h3 className={heading}>
            {t('page.advisor.d.aside')}{d.setAsideAfterBills && d.setAside.length > 0 ? ` ${t('page.advisor.afterBills')}` : ''}
          </h3>
          {d.setAside.length === 0 ? none : d.setAside.map(a => (
            <div key={a.bucket} className={row}>
              <span className="min-w-0 truncate text-slate-700">
                {t(BUCKET_KEY[a.bucket])}{a.percent != null ? ` · ${a.percent}%` : ''}
                {a.paid > 0 && (
                  <span className="text-slate-500"> · {t('page.advisor.d.paidOf', { paid: moneyFull(a.paid, currency), target: moneyFull(a.target, currency) })}</span>
                )}
              </span>
              <span className="tabular-nums text-slate-900">{moneyFull(a.remaining, currency)}</span>
            </div>
          ))}

          <p className="mt-5 rounded-control bg-slate-50 px-3 py-2.5 text-sm text-slate-700 tabular-nums">
            {t('page.advisor.d.freeMath', {
              have: moneyFull(d.have, currency), coming: moneyFull(d.salaryComing, currency),
              bills: moneyFull(d.billsLeft, currency), aside: moneyFull(d.setAsideLeft, currency),
              free: d.free == null ? '—' : moneyFull(d.free, currency),
            })}
          </p>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" label={t('page.advisor.d.planLink')} onClick={() => navigate('/overview')}
          icon={<ArrowRight className="w-4 h-4" aria-hidden="true" />} />
        <Button size="sm" variant="ghost" label={t('page.advisor.d.summaryLink')} onClick={() => navigate('/summary')}
          icon={<ArrowRight className="w-4 h-4" aria-hidden="true" />} />
      </div>
    </div>
  )
}
