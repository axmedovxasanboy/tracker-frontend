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
