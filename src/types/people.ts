/**
 * The people money moves between: LENDERS lent to the owner, BORROWERS borrowed from them. One
 * person can be both, as two entries.
 */
export type PersonKind = 'LENDER' | 'BORROWER'

/** One person as the people lists show them, sorted by `total`, largest first. */
export interface PersonSummary {
  id: number
  name: string
  /** How many loans, all time. */
  times: number
  /** How much, all time. */
  total: number
  /** How much is still to be paid back. */
  open: number
  lastDate: string | null
}

export interface PersonResponse {
  id: number
  name: string
  kind?: PersonKind
}
