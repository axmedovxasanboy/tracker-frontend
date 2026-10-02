import type { TransactionFlow } from './fixes'

/**
 * `GET /analytics/breakdown` — the one request behind Analytics V2 (ANALYTICS-V2-SPEC.md §4.2,
 * field reference §4.3). The server classifies every row; the page only draws what it is given.
 *
 * The backend ships separately from this page, so the response is read through
 * `withBreakdownDefaults` before anything touches it: a field the server left out is an empty
 * list, a null or a zero — never a blank page and never a throw (§5.6).
 */

/** YYYY-MM */
type Month = string

/**
 * One month's figures, or a sum of months — the server's `AnalyticsResponse.Flow` as the
 * salary-month batch ships it. In − Out − Set aside = Left over, exactly.
 */
export interface BreakdownFlow {
  /** In: earned income, counted in the month it belongs to (§1.3). */
  earned: number
  earnedPay: number
  earnedBonus: number
  earnedOther: number
  /** Itemised everyday spending + wallet-check shortfalls − surpluses. */
  everyday: number
  /** The wallet-check part of `everyday` ("Not itemised"). */
  everydayUnitemised: number
  bills: number
  loanPayments: number
  /** everyday + bills + loanPayments. */
  out: number
  /** Set aside: investments + emergency fund + goals + donations. */
  saved: number
  savedDonation: number
  savedEmergency: number
  savedInvestments: number
  savedGoals: number
  /** earned − out − saved. May be negative. */
  leftOver: number
  borrowed: number
  lent: number
  returned: number
  fromSavings: number
  /** Never displayed or averaged; null in `expected.flow` and `average.flow`. */
  payForOtherMonths: number | null
  /** Never displayed or averaged; null in `expected.flow` and `average.flow`. */
  walletChange: number | null
  count: number
}

export interface BreakdownMonth extends BreakdownFlow {
  month: Month
  /** The month has ended before the owner's day. */
  complete: boolean
  /** Has at least one counted row. An untracked month is never averaged (§1.2). */
  tracked: boolean
  /** Days counted so far (the whole month once it is complete). */
  days: number
  daysInMonth: number
}

export interface BreakdownHistory {
  /** §1.2 history start; null only when nothing is recorded at all. */
  start: Month | null
  firstEarned: Month | null
  firstOut: Month | null
  trackingStart: Month | null
  /** Tracked months from `start` to the month of `date`. */
  tracked: Month[]
}

export interface BreakdownExpected {
  month: Month
  /** The base months, oldest first. */
  basedOn: Month[]
  /** Untracked months left out of the average — named in the header line. */
  skipped: Month[]
  /** Display only; never a multiplier. */
  dayFactor: number
  flow: BreakdownFlow
  /** Month in progress only: the itemised everyday spending expected by today. */
  everydayByToday: number | null
  /** Σ expected of the paid-off loans — never "to come". */
  paidOffLoans: number
}

export interface BreakdownAverage {
  basedOn: Month[]
  flow: BreakdownFlow
}

/** Income dated inside the range but counted in a month outside it. */
export interface ReceivedForOtherMonth {
  date: string
  countedIn: Month
  amount: number
  categoryId: number | null
  name: string
  nameUz: string | null
}

/** One day of ITEMISED everyday spending (wallet checks have their own row). */
export interface EverydayDay {
  day: number
  amount: number
  cumulative: number
}

export type LineKind =
  | 'CATEGORY' | 'BILL' | 'LOAN' | 'NOT_ITEMISED' | 'CHECK' | 'GROUP'
  | 'HOLDING' | 'GOAL' | 'DONATION_KIND' | 'PERSON'

/** The History filter that lists exactly a line's rows for one month. */
export interface LineHistory {
  categoryId?: number
  investmentId?: number
  flow?: TransactionFlow
  walletCheck?: boolean
  from?: string
  to?: string
}

export interface LineTop {
  id: number
  date: string
  description: string
  amount: number
}

export interface BreakdownLine {
  /** Unique within its list and stable across requests: `cat:9`, `bill:3`, `loans`, `group:GOALS` … */
  key: string
  kind: LineKind
  refId: number | null
  /** The thing's own name; GROUP names are codes the page translates. */
  name: string
  nameUz: string | null
  incomeKind: 'PAY' | 'BONUS' | 'OTHER' | null
  loanKind: 'BANK' | 'LOAN' | 'DEBT' | null
  /** A loan paid off before this month: "paid off", no tick. */
  closed: boolean
  /** `moved[]` groups. */
  flow: TransactionFlow | null
  /** Total over the range (one month: that month). */
  amount: number
  /** `out[]` categories: the two parts of `amount`. */
  everyday: number | null
  bills: number | null
  count: number
  /** One month with a base: §1.2 for this line; null when new, for `moved[]`, and for a range. */
  expected: number | null
  isNew: boolean
  /** A range: Σ complete tracked months ÷ their count. */
  average: number | null
  /** A range: the amount per `months[]` entry, same order. */
  byMonth: number[]
  /** The four `group:` lines of `setAside[]` only: from the history start to today. */
  sinceStart: number | null
  /** `income[]`: rows counted here but dated in another month. */
  otherMonth: { date: string; amount: number }[]
  /** `out[]` categories: the 3 largest itemised everyday rows. */
  top: LineTop[]
  /** Null when no History filter selects exactly this line's rows (and always in a range). */
  history: LineHistory | null
  children: BreakdownLine[]
}

export interface GoalMonth {
  month: Month
  putIn: number
  takenOut: number
  net: number
  /** A plan's payment for the month, capped at what finishes it; null for a wish. */
  asked: number | null
  /** Value at the end of the month (now, for the month in progress). */
  reachedEnd: number
  /** The rebuild cannot be exact for this month: "≈" before the percentage. */
  approximate: boolean
  fromSnapshot: boolean
  history: { investmentId?: number } | null
}

export interface BreakdownGoal {
  refId: number
  name: string
  kind: 'PLAN' | 'WISH'
  target: number | null
  /** YYYY-MM */
  deadline: Month | null
  monthly: number | null
  startMonth: Month | null
  createdMonth: Month | null
  valueNow: number
  valueTracked: boolean
  putInTotal: number
  takenOutTotal: number
  /** The last month up to `to` with money put in. */
  lastPutIn: Month | null
  months: GoalMonth[]
}

export interface BreakdownHolding {
  /** Null for the emergency money that sits in no account. */
  refId: number | null
  name: string
  kind: 'INVESTMENT' | 'EMERGENCY' | 'GOAL'
  value: number
  putIn: number
  valueTracked: boolean
  openingBalance: boolean
}

export interface AnalyticsBreakdown {
  currency: 'UZS'
  /** The owner's day the figures are as of. */
  date: string
  from: Month
  to: Month
  history: BreakdownHistory
  /** Rows dated after `date` inside the range's months. */
  notYetCount: number
  /** Settings' monthly income for `to` — context only, never a base. */
  stableIncome: number | null
  months: BreakdownMonth[]
  total: BreakdownFlow
  sinceStart: { from: Month; setAside: number; fromSavings: number } | null
  expected: BreakdownExpected | null
  average: BreakdownAverage | null
  receivedForOtherMonths: ReceivedForOtherMonth[]
  everydayDaily: EverydayDay[]
  income: BreakdownLine[]
  out: BreakdownLine[]
  setAside: BreakdownLine[]
  moved: BreakdownLine[]
  goals: BreakdownGoal[]
  holdingsNow: BreakdownHolding[]
}

// ── Reading a response that may be missing fields ──────────────────────────────────────────────

/** What actually arrives: any field may be missing on a server older or newer than this page. */
export type RawBreakdown = DeepPartial<AnalyticsBreakdown>

type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> | null }
    : T

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const list = <T>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : [])
const months = (v: unknown): string[] =>
  (Array.isArray(v) ? v.filter((m): m is string => typeof m === 'string') : [])

/** A History filter with only the keys that hold a value — a null id is no filter at all. */
function historyOf(raw: DeepPartial<LineHistory> | null | undefined): LineHistory | null {
  if (!raw) return null
  const h: LineHistory = {}
  if (typeof raw.categoryId === 'number') h.categoryId = raw.categoryId
  if (typeof raw.investmentId === 'number') h.investmentId = raw.investmentId
  if (typeof raw.flow === 'string') h.flow = raw.flow as TransactionFlow
  if (raw.walletCheck === true) h.walletCheck = true
  if (typeof raw.from === 'string' && raw.from) h.from = raw.from
  if (typeof raw.to === 'string' && raw.to) h.to = raw.to
  return h
}

/** Every Flow field the page reads, zero when absent — arithmetic on a missing field is never NaN. */
function flowOf(raw: DeepPartial<BreakdownFlow> | null | undefined, nullables: 'keep' | 'null' = 'keep'): BreakdownFlow {
  const f = raw ?? {}
  return {
    earned: num(f.earned),
    earnedPay: num(f.earnedPay),
    earnedBonus: num(f.earnedBonus),
    earnedOther: num(f.earnedOther),
    everyday: num(f.everyday),
    everydayUnitemised: num(f.everydayUnitemised),
    bills: num(f.bills),
    loanPayments: num(f.loanPayments),
    out: num(f.out),
    saved: num(f.saved),
    savedDonation: num(f.savedDonation),
    savedEmergency: num(f.savedEmergency),
    savedInvestments: num(f.savedInvestments),
    savedGoals: num(f.savedGoals),
    leftOver: num(f.leftOver),
    borrowed: num(f.borrowed),
    lent: num(f.lent),
    returned: num(f.returned),
    fromSavings: num(f.fromSavings),
    payForOtherMonths: nullables === 'null' ? null : numOrNull(f.payForOtherMonths),
    walletChange: nullables === 'null' ? null : numOrNull(f.walletChange),
    count: num(f.count),
  }
}

/** Σ of the months — what `total` is, for a server that does not send it. */
function sumFlows(rows: BreakdownFlow[]): BreakdownFlow {
  const total = flowOf(null)
  for (const r of rows) {
    for (const k of Object.keys(total) as (keyof BreakdownFlow)[]) {
      if (k === 'payForOtherMonths' || k === 'walletChange') continue
      total[k] = (total[k] as number) + (r[k] as number)
    }
  }
  return total
}

function lineOf(raw: DeepPartial<BreakdownLine> | null | undefined): BreakdownLine {
  const l = raw ?? {}
  return {
    key: str(l.key),
    kind: (l.kind ?? 'CATEGORY') as LineKind,
    refId: numOrNull(l.refId),
    name: str(l.name),
    nameUz: strOrNull(l.nameUz),
    incomeKind: l.incomeKind ?? null,
    loanKind: l.loanKind ?? null,
    closed: l.closed === true,
    flow: (l.flow ?? null) as TransactionFlow | null,
    amount: num(l.amount),
    everyday: numOrNull(l.everyday),
    bills: numOrNull(l.bills),
    count: num(l.count),
    expected: numOrNull(l.expected),
    isNew: l.isNew === true,
    average: numOrNull(l.average),
    byMonth: list(l.byMonth).map(num),
    sinceStart: numOrNull(l.sinceStart),
    otherMonth: list(l.otherMonth).map(o => ({ date: str(o?.date), amount: num(o?.amount) })),
    top: list(l.top).map(t => ({
      id: num(t?.id), date: str(t?.date), description: str(t?.description), amount: num(t?.amount),
    })),
    history: historyOf(l.history),
    children: list(l.children).map(lineOf),
  }
}

function goalOf(raw: DeepPartial<BreakdownGoal> | null | undefined): BreakdownGoal {
  const g = raw ?? {}
  return {
    refId: num(g.refId),
    name: str(g.name),
    kind: g.kind === 'WISH' ? 'WISH' : 'PLAN',
    target: numOrNull(g.target),
    deadline: strOrNull(g.deadline),
    monthly: numOrNull(g.monthly),
    startMonth: strOrNull(g.startMonth),
    createdMonth: strOrNull(g.createdMonth),
    valueNow: num(g.valueNow),
    valueTracked: g.valueTracked === true,
    putInTotal: num(g.putInTotal),
    takenOutTotal: num(g.takenOutTotal),
    lastPutIn: strOrNull(g.lastPutIn),
    months: list(g.months).map(m => ({
      month: str(m?.month),
      putIn: num(m?.putIn),
      takenOut: num(m?.takenOut),
      net: num(m?.net),
      asked: numOrNull(m?.asked),
      reachedEnd: num(m?.reachedEnd),
      approximate: m?.approximate === true,
      fromSnapshot: m?.fromSnapshot === true,
      history: historyOf(m?.history),
    })),
  }
}

/**
 * The response as the page reads it: every list a list, every optional block null, every number
 * a number (§5.6). Each part of the page then hides itself when its data is empty.
 */
export function withBreakdownDefaults(raw: RawBreakdown | null | undefined): AnalyticsBreakdown {
  const r = raw ?? {}
  const monthRows: BreakdownMonth[] = list(r.months).map(m => ({
    ...flowOf(m),
    month: str(m?.month),
    complete: m?.complete === true,
    // A server that leaves the flag out has still sent the month: a month with rows is tracked.
    tracked: typeof m?.tracked === 'boolean' ? m.tracked : num(m?.count) > 0,
    days: num(m?.days),
    daysInMonth: num(m?.daysInMonth),
  }))

  // `history` missing altogether (not `start: null`, which means "nothing recorded") falls back on
  // the months sent, so an older server's answer still draws a page.
  const h = r.history
  const trackedSent = monthRows.filter(m => m.tracked).map(m => m.month)
  const history: BreakdownHistory = h
    ? {
        start: strOrNull(h.start),
        firstEarned: strOrNull(h.firstEarned),
        firstOut: strOrNull(h.firstOut),
        trackingStart: strOrNull(h.trackingStart),
        tracked: months(h.tracked),
      }
    : {
        start: trackedSent[0] ?? null, firstEarned: null, firstOut: null, trackingStart: null,
        tracked: trackedSent,
      }

  // An expected or average block without its figures says nothing; it is dropped whole.
  const e = r.expected
  const expected: BreakdownExpected | null = e && e.flow
    ? {
        month: str(e.month),
        basedOn: months(e.basedOn),
        skipped: months(e.skipped),
        dayFactor: num(e.dayFactor),
        flow: flowOf(e.flow, 'null'),
        everydayByToday: numOrNull(e.everydayByToday),
        paidOffLoans: num(e.paidOffLoans),
      }
    : null
  const a = r.average
  const average: BreakdownAverage | null = a && a.flow
    ? { basedOn: months(a.basedOn), flow: flowOf(a.flow, 'null') }
    : null

  const s = r.sinceStart
  return {
    currency: 'UZS',
    date: str(r.date),
    from: str(r.from),
    to: str(r.to),
    history,
    notYetCount: num(r.notYetCount),
    stableIncome: numOrNull(r.stableIncome),
    months: monthRows,
    total: r.total ? flowOf(r.total) : sumFlows(monthRows),
    sinceStart: s ? { from: str(s.from), setAside: num(s.setAside), fromSavings: num(s.fromSavings) } : null,
    expected,
    average,
    receivedForOtherMonths: list(r.receivedForOtherMonths).map(x => ({
      date: str(x?.date),
      countedIn: str(x?.countedIn),
      amount: num(x?.amount),
      categoryId: numOrNull(x?.categoryId),
      name: str(x?.name),
      nameUz: strOrNull(x?.nameUz),
    })),
    everydayDaily: list(r.everydayDaily).map(x => ({
      day: num(x?.day), amount: num(x?.amount), cumulative: num(x?.cumulative),
    })),
    income: list(r.income).map(lineOf),
    out: list(r.out).map(lineOf),
    setAside: list(r.setAside).map(lineOf),
    moved: list(r.moved).map(lineOf),
    goals: list(r.goals).map(goalOf),
    holdingsNow: list(r.holdingsNow).map(x => ({
      refId: numOrNull(x?.refId),
      name: str(x?.name),
      kind: x?.kind === 'EMERGENCY' || x?.kind === 'GOAL' ? x.kind : 'INVESTMENT',
      value: num(x?.value),
      putIn: num(x?.putIn),
      valueTracked: x?.valueTracked === true,
      openingBalance: x?.openingBalance === true,
    })),
  }
}
