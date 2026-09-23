import { forwardRef } from 'react'
import type { ReactNode, Ref } from 'react'
import {
  AlertTriangle, ArrowRight, CreditCard, Landmark, Lightbulb, Target, Wallet,
} from 'lucide-react'
import { Tile } from '../ui/Tile'
import type { TileMdSpan, TileSpan } from '../ui/Tile'
import { Button } from '../ui/Button'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { formatDate, formatMonth, money, moneyFull, plural } from '../../utils/format'
import type {
  AdvisorResponse, AdvisorSavingsRow, AdvisorSuggestion, AdvisorUpcoming, Bucket, Currency,
} from '../../types'

// ── Suggestions ────────────────────────────────────────────────────────────────────────────────

/** `AdvisorResponse.Suggestion.code` → the sentence. An unknown code prints the server's English. */
const SUGGESTION_KEY: Record<string, TKey> = {
  'advisor.s.setIncome': 'page.advisor.s.setIncome',
  'advisor.s.paySubscription': 'page.advisor.s.paySubscription',
  'advisor.s.payBank': 'page.advisor.s.payBank',
  'advisor.s.payLoanPlan': 'page.advisor.s.payLoanPlan',
  'advisor.s.payDebts': 'page.advisor.s.payDebts',
  'advisor.s.checkWallets': 'page.advisor.s.checkWallets',
  'advisor.s.checkWalletsFirst': 'page.advisor.s.checkWalletsFirst',
  'advisor.s.setAside': 'page.advisor.s.setAside',
  'advisor.s.startEmergency': 'page.advisor.s.startEmergency',
  'advisor.s.short': 'page.advisor.s.short',
  'advisor.s.addGoal': 'page.advisor.s.addGoal',
  'advisor.s.extraToGoal': 'page.advisor.s.extraToGoal',
  'advisor.s.extraToEmergency': 'page.advisor.s.extraToEmergency',
  'advisor.s.extraToInvestments': 'page.advisor.s.extraToInvestments',
  'advisor.s.paceWarning': 'home.s.paceWarning',
}

const BUCKET_KEY: Record<string, TKey> = {
  DONATION: 'cmp.bucket.donation',
  EMERGENCY: 'cmp.bucket.emergency',
  INVESTMENTS: 'cmp.bucket.investments',
  SAVINGS: 'page.advisor.bucket.savings',
}

export const isBucket = (b: string | null): b is Bucket =>
  b === 'DONATION' || b === 'EMERGENCY' || b === 'INVESTMENTS'

/**
 * Whether a "Coming up" row can be paid from Home: it is still to pay, this month (`month` is
 * YYYY-MM). A payment already recorded for a later day leaves the wallet on that day by itself,
 * and a later month's row is a date to know, not a bill to pay now — Pay on either would pay twice.
 * An overdue row is dated today, so it qualifies.
 */
export const canPayUpcoming = (u: AdvisorUpcoming, month: string): boolean =>
  !u.recorded && u.date.slice(0, 7) === month

/** A numeric param, when the server sends one as a string. */
function num(v: string | undefined): number | null {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * The steps worth showing under "What to do next": the server's list, most urgent first, minus
 * whatever a tile above already puts in front of the owner — a bill that is in "Coming up", a
 * saving shown in "Savings this month", the wallet check the "You have" tile carries, a warning
 * the big number already states. The month close is no longer something the owner is asked to do.
 * At most three.
 */
export function visibleSteps(d: AdvisorResponse, opts: {
  /** The first-run tile is asking for the monthly income right now. */
  firstRunShowsIncome: boolean
  /** The rows "Coming up" offers Pay on; null when that tile is not on the page. */
  upcoming: AdvisorUpcoming[] | null
  /** The rows "Savings this month" shows. */
  savings: AdvisorSavingsRow[]
}): AdvisorSuggestion[] {
  const daily = d.daily ?? null
  const upcoming = opts.upcoming
  const savedBuckets = new Set<string>(opts.savings.map(r => r.bucket))
  const savedGoals = new Set(opts.savings.filter(r => r.bucket === 'GOAL').map(r => r.refId))

  const covered = (s: AdvisorSuggestion): boolean => {
    if (s.code === 'advisor.s.short' && daily?.shortBy) return true
    if (s.code === 'advisor.s.paceWarning' && daily?.runsOutOn) return true
    switch (s.action) {
      case 'CLOSE_MONTH': return true
      case 'CHECK_IN': return true
      case 'SET_INCOME': return opts.firstRunShowsIncome
      case 'PAY_SUBSCRIPTION':
        return !!upcoming && upcoming.some(u => u.kind === 'BILL' && u.refId === s.refId)
      case 'PAY_BANK':
        return !!upcoming && upcoming.some(u => u.kind === 'BANK')
      case 'PAY_DEBT':
        return !!upcoming && upcoming.some(u => u.kind === 'LOAN' || u.kind === 'DEBT')
      // Only the "due" kind: an idea to put spare money somewhere stays, even for a shown saving.
      case 'SET_ASIDE':
        if (s.kind !== 'DO') return false
        // A goal's own row covers its monthly payment.
        if (s.bucket === 'SAVINGS') return s.refId != null && savedGoals.has(s.refId)
        return isBucket(s.bucket) && savedBuckets.has(s.bucket)
      default:
        return false
    }
  }
  return d.suggestions.filter(s => !covered(s)).slice(0, 3)
}

// ── Coming up ──────────────────────────────────────────────────────────────────────────────────

/**
 * Bills and loan payments due soon, soonest first. Pay sits only on what is still to pay this month
 * (see `canPayUpcoming`); a payment already recorded for its day says so instead.
 */
export const ComingUpTile = forwardRef<HTMLHeadingElement, {
  rows: AdvisorUpcoming[]
  currency: Currency
  /** This month, YYYY-MM. */
  month: string
  span: TileSpan
  mdSpan?: TileMdSpan
  busyKey: string | null
  /** `key` identifies the row, for `busyKey`. */
  onPay: (u: AdvisorUpcoming, key: string) => void
  onAll: () => void
}>(function ComingUpTile({ rows, currency, month, span, mdSpan, busyKey, onPay, onAll }, headingRef) {
  const { t, lang } = useLang()
  return (
    <Tile span={span} mdSpan={mdSpan} as="section">
      <TileHead
        title={t('home.upcoming.title')}
        headingRef={headingRef}
        action={<LinkButton label={t('home.upcoming.all')} onClick={onAll} />}
      />
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('home.upcoming.empty')}</p>
      ) : (
        <ul className="mt-1 divide-y divide-hairline">
          {rows.map((u, i) => {
            // Kind, id and date can repeat — a payment recorded for the very day a bill is due, or
            // two that name no loan — so the position settles it.
            const key = `${u.kind}-${u.refId ?? 'none'}-${u.date}-${i}`
            const nameId = `upcoming-${key}`
            const day = formatDate(u.date, lang, 'dayShort')
            const [d, m] = day.split(' ')
            const amount = moneyFull(u.amount, currency)
            return (
              <li key={key} className="flex min-h-[60px] items-center gap-3 py-2">
                {/* A calendar chip: the day, then the month. Red when the date has passed. */}
                <span
                  className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-chip leading-none ${
                    u.overdue ? 'bg-rose-50 text-expense' : 'bg-slate-100 text-slate-700'
                  }`}
                  aria-hidden="true"
                >
                  <span className="text-sm font-semibold tabular-nums">{d}</span>
                  <span className="mt-0.5 text-[11px] font-medium">{m}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p id={nameId} className="truncate text-sm font-medium text-slate-900">{u.name}</p>
                  <p className="text-xs tabular-nums text-slate-500">
                    <span className="sr-only">{day} · </span>
                    <span className="sm:hidden">{amount}</span>
                    {u.overdue && (
                      <span className="font-semibold text-expense">
                        <span className="sm:hidden"> · </span>{t('home.upcoming.overdue')}
                      </span>
                    )}
                  </p>
                </div>
                <p className="hidden shrink-0 text-sm font-semibold tabular-nums text-slate-900 sm:block">{amount}</p>
                {canPayUpcoming(u, month) ? (
                  <Button
                    size="sm"
                    label={t('page.shared.payButton')}
                    aria-describedby={nameId}
                    loading={busyKey === key}
                    onClick={() => onPay(u, key)}
                    className="shrink-0"
                  />
                ) : u.recorded ? (
                  <span className="shrink-0 rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {t('home.upcoming.recorded')}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Tile>
  )
})

// ── You have ───────────────────────────────────────────────────────────────────────────────────

/** Wallet total, each wallet, when they were last checked, and the check itself. */
export function YouHaveTile({ d, currency, span, mdSpan, hero = false, onCheck, extra }: {
  d: AdvisorResponse
  currency: Currency
  span: TileSpan
  mdSpan?: TileMdSpan
  /** The page's big number — used when there is no daily figure to lead with. */
  hero?: boolean
  onCheck: () => void
  extra?: ReactNode
}) {
  const { t, lang } = useLang()
  const ago = d.balanceCheckedDaysAgo
  // The server asks for a wallet check — or, in a month's first days, for last month's close in
  // its place. The web no longer closes months; a check of the wallets is what that ask comes to.
  const checkDue = d.suggestions.some(s => s.action === 'CHECK_IN' || s.action === 'CLOSE_MONTH')
  const checked = ago == null ? t('home.have.notChecked')
    : ago === 0 ? t('home.have.checkedToday')
    : plural(ago, t('home.have.checkedAgoOne', { days: ago }), t('home.have.checkedAgo', { days: ago }), lang)

  return (
    <Tile span={span} mdSpan={mdSpan} padding={hero ? 'hero' : 'normal'} as="section">
      <h2 className="text-label uppercase text-slate-500">{t('page.advisor.have')}</h2>
      <p className={`mt-3 tabular-nums text-slate-900 ${hero ? 'text-hero whitespace-nowrap' : 'text-stat'}`}>
        {money(d.have, currency)}
      </p>
      {extra}
      {d.wallets.length > 0 && (
        <ul className="mt-3 divide-y divide-hairline">
          {d.wallets.map(w => (
            <li key={`${w.type}-${w.cardId ?? 'cash'}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate text-slate-700">{w.type === 'CASH' ? t('tx.cash') : w.label}</span>
              <span className="shrink-0 tabular-nums text-slate-900">{moneyFull(w.balance, currency)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
        <p className={`flex items-center gap-1.5 text-sm ${checkDue ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
          {checkDue && <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {checked}
        </p>
        <Button
          size="sm"
          icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
          label={t('page.advisor.btn.checkIn')}
          onClick={onCheck}
        />
      </div>
    </Tile>
  )
}

// ── What to do next ────────────────────────────────────────────────────────────────────────────

export function NextStepsTile({ steps, currency, span, mdSpan, onAct }: {
  steps: AdvisorSuggestion[]
  currency: Currency
  span: TileSpan
  mdSpan?: TileMdSpan
  onAct: (s: AdvisorSuggestion) => void
}) {
  const { t, lang } = useLang()

  const sentence = (s: AdvisorSuggestion) => {
    const p = s.params ?? {}
    const amount = s.amount ?? num(p.amount)
    const vars = {
      name: p.name ?? '',
      month: p.month ? formatMonth(p.month, lang) : '',
      days: p.days ?? '',
      bucket: (() => {
        const b = p.bucket ?? s.bucket
        return b && BUCKET_KEY[b] ? t(BUCKET_KEY[b]) : (b ?? '')
      })(),
      amount: amount != null ? moneyFull(amount, currency) : '',
      date: p.date ? formatDate(p.date, lang, 'dayShort') : '',
      pace: num(p.pace) != null ? money(num(p.pace)!, currency) : '',
      safe: num(p.safe) != null ? money(num(p.safe)!, currency) : '',
    }
    // The new "short" warning names the date; an older server sends it without one.
    if (s.code === 'advisor.s.short' && p.date) return t('home.s.short', vars)
    const key = SUGGESTION_KEY[s.code]
    return key ? t(key, vars) : s.text
  }

  const buttonLabel = (s: AdvisorSuggestion): string | null => {
    switch (s.action) {
      case 'PAY_SUBSCRIPTION':
      case 'PAY_BANK':
      case 'PAY_DEBT': return t('page.shared.payButton')
      case 'CHECK_IN': return t('page.advisor.btn.checkIn')
      case 'SET_ASIDE': return s.bucket === 'SAVINGS' ? t('action.add') : t('page.shared.payButton')
      case 'ADD_GOAL': return t('page.advisor.btn.addGoal')
      case 'SET_INCOME': return t('page.advisor.btn.setIncome')
      default: return null
    }
  }

  const stepIcon = (s: AdvisorSuggestion): { icon: ReactNode; tone: string } => {
    if (s.kind === 'WARN') return { icon: <AlertTriangle className="h-4 w-4" />, tone: 'bg-amber-100 text-amber-700' }
    if (s.kind === 'IDEA') return { icon: <Lightbulb className="h-4 w-4" />, tone: 'bg-teal-100 text-teal-700' }
    switch (s.action) {
      case 'PAY_SUBSCRIPTION': return { icon: <CreditCard className="h-4 w-4" />, tone: 'bg-indigo-100 text-indigo-600' }
      case 'PAY_BANK':
      case 'PAY_DEBT': return { icon: <Landmark className="h-4 w-4" />, tone: 'bg-indigo-100 text-indigo-600' }
      case 'CHECK_IN': return { icon: <Wallet className="h-4 w-4" />, tone: 'bg-slate-100 text-slate-600' }
      default: return { icon: <Target className="h-4 w-4" />, tone: 'bg-pink-100 text-pink-600' }
    }
  }

  return (
    <Tile span={span} mdSpan={mdSpan} as="section">
      <TileHead title={t('page.advisor.next')} />
      <ul className="mt-1 divide-y divide-hairline">
        {steps.map((s, i) => {
          const { icon, tone } = stepIcon(s)
          const label = buttonLabel(s)
          const textId = `step-${i}`
          return (
            <li key={`${s.code}-${s.refId ?? s.bucket ?? i}`} className="flex items-center gap-3 py-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-chip ${tone}`} aria-hidden="true">
                {icon}
              </span>
              <p id={textId} className={`min-w-0 flex-1 text-sm ${s.kind === 'IDEA' ? 'text-slate-600' : 'text-slate-900'}`}>
                {sentence(s)}
              </p>
              {label && (
                <Button size="sm" label={label} aria-describedby={textId} onClick={() => onAct(s)} className="shrink-0" />
              )}
            </li>
          )
        })}
      </ul>
    </Tile>
  )
}

// ── Small shared bits ──────────────────────────────────────────────────────────────────────────

/** A tile's title row, with an optional link-style action on the right. */
export function TileHead({ title, action, headingRef }: {
  title: string
  action?: ReactNode
  headingRef?: Ref<HTMLHeadingElement>
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        ref={headingRef}
        // Focusable from script only — "See what's due" lands here.
        tabIndex={headingRef ? -1 : undefined}
        className="rounded-chip text-title text-slate-900 focus-ring"
      >
        {title}
      </h2>
      {action}
    </div>
  )
}

/** "All loans & bills →" — a quiet way to another page, the arrow after the words. */
export function LinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring -mr-2 inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-control px-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
