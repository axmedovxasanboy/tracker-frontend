/**
 * Levels and savings rules — every field LEVELS-ALLOCATION-SPEC.md §3 asks the server for, in one
 * file so a rename is one edit. Nothing here exists on a server from before the levels work:
 * `GET /levels` then answers 404, and the screens stay as they were (see `context/LevelsContext`).
 */

/**
 * The seven situations a month can be in, at every level — the same keys `/profile` already sends
 * as `rule.reason` (spec §1.2). Each holds three percentages.
 */
export type LevelSituation =
  | 'NO_DEBT'
  | 'BANK_LOAN_COMFORTABLE' | 'BANK_LOAN_TIGHT'
  | 'DEBTS_COMFORTABLE' | 'DEBTS_TIGHT'
  | 'BANK_AND_DEBTS'
  | 'HEAVY_DEBT'

/** The order the page lists them in, top to bottom. */
export const LEVEL_SITUATIONS: readonly LevelSituation[] = [
  'NO_DEBT', 'BANK_LOAN_COMFORTABLE', 'BANK_LOAN_TIGHT', 'DEBTS_COMFORTABLE', 'DEBTS_TIGHT',
  'BANK_AND_DEBTS', 'HEAVY_DEBT',
]

/** The four whose rows are split by the level's line ("{cutoff} or more left" / "under"). */
export const SPLIT_SITUATIONS: ReadonlySet<LevelSituation> = new Set<LevelSituation>([
  'BANK_LOAN_COMFORTABLE', 'BANK_LOAN_TIGHT', 'DEBTS_COMFORTABLE', 'DEBTS_TIGHT',
])

/** Percent of the allocation base, 0–100, at most one decimal. 0 = not asked. */
export interface LevelPercents {
  donation: number
  emergency: number
  investments: number
  /**
   * Each of the owner's own savings, by its id ("12") — every saving listed, 0 when not asked.
   * Absent on an older server, on the level notice, and in a request that leaves them as they are.
   */
  custom?: Record<string, number>
}

/** One of the owner's own savings: a column beside the three, made on Savings rules. */
export interface OwnSaving {
  id: number
  name: string
  /** Money ever moved through it, or it holds some: it can be stopped, not deleted. */
  hasMoney: boolean
}

/** `POST /levels/savings` (all three), `PUT /levels/savings/{id}` (name), `POST …/{id}/stop` (from). */
export interface OwnSavingRequest {
  name?: string
  percent?: number
  /** YYYY-MM; left out, this month. */
  from?: string
}

/** One level's rules from a month on, until that level's next version. */
export interface LevelRulesVersion {
  /** YYYY-MM */
  from: string
  /** UZS left after bills and loans that separates "or more left" from "under". */
  cutoff: number
  rules: Record<LevelSituation, LevelPercents>
}

export interface LevelEntry {
  /** 1..5 */
  level: number
  /** Left-after-bills band, UZS. Level 4: `leftTo` null. Level 5: both null (it is earned by pay). */
  leftFrom: number | null
  leftTo: number | null
  /** `from` of the version in force this month. */
  inForce: string
  /** Oldest first; never empty. */
  versions: LevelRulesVersion[]
}

/** One month of the run toward Level 5 (or away from it). */
export interface LevelRoadMonth {
  /** YYYY-MM */
  month: string
  pay: number
}

/** Null on Levels 1–3. */
export interface LevelRoad {
  /** 5 while on Level 4; the base level while on Level 5. */
  toward: number
  payThreshold: number
  monthsNeeded: number
  /** The current run, oldest first: ended months that count. */
  months: LevelRoadMonth[]
  /** Pay for the month in progress — never counted until the month ends. */
  thisMonthSoFar: number
  /** YYYY-MM — when the change would apply if the run completes unbroken. */
  appliesFrom: string | null
}

/** `GET /levels?date=` */
export interface LevelsResponse {
  /** YYYY-MM, the month of `date`. */
  month: string
  /** In force this month, 1..5; null without a monthly income. */
  level: number | null
  /** From income − bills alone, 1..4. */
  baseLevel: number | null
  leftAfterBills: number
  /** Null without a monthly income. */
  situation: LevelSituation | null
  percents: LevelPercents | null
  /** YYYY-MM while on Level 5. */
  level5Since: string | null
  road: LevelRoad | null
  /** YYYY-MM — the earliest `from` a version may take. */
  firstMonth: string
  /** Always five, Level 1 first. */
  levels: LevelEntry[]
  /** The owner's own savings, oldest first. Absent on an older server. */
  customSavings?: OwnSaving[]
}

/** `PUT /levels/{level}/rules` */
export interface LevelRulesRequest {
  /** YYYY-MM; left out, the current month (server clock). */
  from?: string
  /** Left out, the cutoff in force at `from`. */
  cutoff?: number
  /** Only the situations that change. */
  rules?: Partial<Record<LevelSituation, LevelPercents>>
}

/** `GET /levels/notice?client=WEB` — the oldest level change the web has not shown yet. */
export interface LevelNotice {
  id: number
  kind: 'UP' | 'DOWN'
  level: number
  previousLevel: number
  /** YYYY-MM — the month the change applies from. */
  from: string
  /** The three months that decided it, oldest first. */
  months: LevelRoadMonth[]
  /** The situation in force at `from`, and that level's percentages for it. */
  situation: LevelSituation | null
  percents: LevelPercents | null
  /** The percents × the monthly income for `from`, UZS. */
  amounts: LevelPercents | null
  /** The level's line at `from` — for the dialog's "Split at" field. Not in the spec's §3.4 body;
   *  when absent the dialog reads it from `GET /levels`. */
  cutoff?: number | null
}

/** What `/profile` adds once the server has levels (spec §3.5). All absent on an older server. */
export interface ProfileLevelFields {
  baseLevel?: number | null
  level5Since?: string | null
  road?: LevelRoad | null
  /** YYYY-MM — `from` of the rules version in force this month. */
  ruleFrom?: string | null
}

/** One side of the recalculation: a month's rule — level, situation and its percentages. */
export interface RecalcRule {
  level: number
  situation: LevelSituation
  percents: { donation: number; emergency: number; investments: number }
  /** Every own saving, in the same order on both sides; 0 = not asked by this rule. */
  own: Array<{ id: number; name: string; percent: number }>
  /** All of them together. */
  total: number
  /** The level's tight/comfortable line, when the server sends it (names the split situations). */
  cutoff?: number | null
  /** Every figure the rule was decided from (RECALC-SPEC §4) — absent on an older server. */
  why?: RecalcWhy | null
}

/** Why a loan's ask is what it is: null = counted as is. */
export type RecalcWhyNote = 'SMALL_MONTHLY' | 'NASIYA_LATER' | 'NOT_STARTED' | 'AFTER_CUT'

export interface RecalcWhyLoan {
  kind: 'LOAN' | 'DEBT'
  id: number
  name: string
  type: 'MONTHLY' | 'ASAP' | 'NASIYA'
  /** Left at the day it was decided from. */
  left: number
  /** What the month asks of it (0 when it does not count). */
  ask: number
  note: RecalcWhyNote | null
  /** A nasiya's deadline (YYYY-MM-DD), when the server sends it. */
  dueDate?: string | null
}

/** RECALC-SPEC §4: the trace of `ruleAsOf` — read-only, the same figures the choice used. */
export interface RecalcWhy {
  /** MONTH_START (decided on the 1st), RECALCULATED (by the owner), TODAY (the preview). */
  basis: 'MONTH_START' | 'RECALCULATED' | 'TODAY'
  /** YYYY-MM-DD — the day whose figures decided it. */
  asOf: string
  /** False when the data changed since, so today's data for that day no longer gives the stored rule. */
  exact: boolean
  income: number
  bills: number
  leftAfterBills: number
  levelFrom: number | null
  /** Null at the top level. */
  levelTo: number | null
  /** YYYY-MM when a Level 5 period gives the level. */
  level5Since: string | null
  bankLoans: Array<{ id: number; name: string; monthly: number }>
  bankMonthly: number
  loans: RecalcWhyLoan[]
  asksTotal: number
  monthlyAsks: number
  /** 10% of income. */
  smallMonthlyLimit: number
  /** Monthly loan payments are > 0 and ≤ the 10% line: the rule does not count them as money owed. */
  smallMonthlyIgnored: boolean
  peopleDebtForRule: number
  /** (bank + every ask) ÷ income × 100, one decimal. */
  debtShare: number
  heavyLine: number
  /** What is left after bills, bank loans and loan asks — what the tight/comfortable split reads. */
  leftAfterLoans: number
  cutoff: number | null
  hasBank: boolean
  hasPeopleDebt: boolean
}

/**
 * GET/POST /levels/recalculate (RECALC-SPEC §1): this month's fixed rule beside the one today's
 * situation gives. POST applies the second; the answer after it has `changed: false`.
 */
export interface RecalcResponse {
  /** YYYY-MM. */
  month: string
  current: RecalcRule
  recalculated: RecalcRule
  /** Level or situation differs. */
  changed: boolean
  /** When the owner last recalculated this month (ISO local date-time); null when never. */
  recalculatedAt: string | null
}
