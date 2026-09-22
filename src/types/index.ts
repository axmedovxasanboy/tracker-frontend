export type TransactionType = 'INCOME' | 'EXPENSE'
export type TransactionSubType =
  | 'REGULAR_INCOME' | 'LOAN_RECEIVED' | 'LOAN_RETURNED_TO_ME'
  | 'REGULAR_EXPENSE' | 'LOAN_GIVEN' | 'LOAN_REPAYMENT'
  | 'BANK_LOAN_PAYMENT' | 'INVESTMENT' | 'STOCK_PURCHASE' | 'DONATION'
  | 'EMERGENCY_CONTRIBUTION'
  | 'TRANSFER_OUT' | 'TRANSFER_IN'
// USD/EUR exist only as standalone cash pots — nothing converts them to UZS.
export type Currency = 'UZS' | 'USD' | 'EUR'
export type CategoryType = 'INCOME' | 'EXPENSE' | 'BOTH'
export type CardType = 'UZCARD' | 'HUMO' | 'VISA' | 'CASH'
export type RecordStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE'
export type BankLoanStatus = 'ACTIVE' | 'PAID_OFF' | 'DEFAULTED'
export type InvestmentType = 'REAL_ESTATE' | 'BONDS' | 'MUTUAL_FUND' | 'GOLD' | 'OTHER'

export interface Category {
  id: number
  name: string
  /** Uzbek display name; null falls back to `name`. */
  nameUz?: string | null
  type: CategoryType
  color: string
  icon: string
  applicableSubType: TransactionSubType | null
  descriptionLabel: string | null
  descriptionRequired: boolean
  anonymizes: boolean
  bonusIncome: boolean
  parentId: number | null
  children: Category[]
}

export interface CardSummary {
  id: number
  name: string
  bankName: string
  type: CardType
  lastFourDigits: string
  currentBalance?: number
  currency: Currency
  color: string
}

export interface CardResponse {
  id: number
  name: string
  bankName: string
  type: CardType
  lastFourDigits: string
  initialBalance: number
  currentBalance: number
  currency: Currency
  color: string
  createdAt: string
}

export interface CardRequest {
  name: string
  bankName: string
  type: CardType
  lastFourDigits: string
  initialBalance: number
  currency: Currency
  color?: string
}

export interface Transaction {
  id: number
  type: TransactionType
  amount: number
  cashAmount: number
  cardAmount: number
  currency: Currency
  category: Category | null
  card: CardSummary | null
  description: string
  transactionDate: string
  createdAt: string
  note: string | null
  subType: TransactionSubType | null
  investmentId: number | null
  transferPairId: number | null
  repaidLoanTakenId: number | null
  repaidLoanGivenId: number | null
  repaidDebtId: number | null
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface DashboardSummary {
  currency: Currency
  totalIncome: number
  totalExpense: number
  netBalance: number
  transactionCount: number
  availableBalance: number
  /** Wallet money you can spend right now (= availableBalance). */
  spendableBalance: number
  /** spendable (all currencies) + every investment/savings current value, in this currency. */
  netWorth: number
}

export interface MonthlyData {
  month: number
  monthName: string
  income: number
  expense: number
  net: number
}

export interface CategoryBreakdown {
  category: string
  color: string
  amount: number
  percentage: number
}

export interface TransactionFilters {
  type?: TransactionType | ''
  currency?: Currency | ''
  categoryId?: number | ''
  cardId?: number | ''
  investmentId?: number | ''
  startDate?: string
  endDate?: string
  search?: string
  page: number
  size: number
  sortBy: string
  sortDir: 'asc' | 'desc'
  cashOnly?: boolean
  excludeTransfers?: boolean
}

export interface TransactionRequest {
  type: TransactionType
  amount: number
  currency: Currency
  categoryId?: number
  cardId?: number
  description: string
  transactionDate: string
  note?: string
  subType?: TransactionSubType
  counterpartyName?: string
  investmentType?: InvestmentType
  investmentId?: number
  /** LOAN_GIVEN only: lend more to this existing borrower instead of opening a new loan. */
  loanGivenId?: number
  /** LOAN_RECEIVED only: month (YYYY-MM-01) repayments start counting toward the tier. */
  paymentStartDate?: string
  cashAmount?: number
}

export interface CategoryRequest {
  name: string
  nameUz?: string | null
  type: CategoryType
  color?: string
  icon?: string
  applicableSubType?: TransactionSubType
  parentId?: number
  descriptionLabel?: string | null
  descriptionRequired?: boolean
  anonymizes?: boolean
  bonusIncome?: boolean
}

export interface CachedEntry<T> {
  data: T
  timestamp: string
}

// Finance types
export interface DebtResponse {
  id: number
  creditorName: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  currency: Currency
  borrowedDate: string
  dueDate: string | null
  paymentStartDate: string | null
  status: RecordStatus
  description: string | null
  createdAt: string
}

export interface DebtRequest {
  creditorName: string
  totalAmount: number
  paidAmount?: number
  currency: Currency
  borrowedDate: string
  dueDate?: string
  paymentStartDate?: string
  status?: RecordStatus
  description?: string
}

export interface LoanGivenResponse {
  id: number
  debtorName: string
  totalAmount: number
  receivedAmount: number
  pendingAmount: number
  currency: Currency
  lentDate: string
  expectedReturnDate: string | null
  status: RecordStatus
  description: string | null
  createdAt: string
}

export interface LoanGivenRequest {
  debtorName: string
  totalAmount: number
  receivedAmount?: number
  currency: Currency
  lentDate: string
  expectedReturnDate?: string
  status?: RecordStatus
  description?: string
}

export interface LoanTakenResponse {
  id: number
  lenderName: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  currency: Currency
  borrowedDate: string
  dueDate: string | null
  paymentStartDate: string | null
  status: RecordStatus
  description: string | null
  createdAt: string
  monthlyPayment: number | null
  /** Opt-in fixed monthly repayment plan; null = default 34%-of-original charge. */
  plannedMonthlyPayment: number | null
}

export interface LoanTakenRequest {
  plannedMonthlyPayment?: number
  lenderName: string
  totalAmount: number
  paidAmount?: number
  currency: Currency
  borrowedDate: string
  dueDate?: string
  paymentStartDate?: string
  status?: RecordStatus
  description?: string
}

export interface BankLoanResponse {
  id: number
  bankName: string
  loanName: string
  totalAmount: number
  currency: Currency
  takenDate: string
  endDate: string | null
  monthlyPayment: number | null
  createdAt: string
}

export interface BankLoanRequest {
  bankName: string
  loanName: string
  totalAmount: number
  currency: Currency
  takenDate: string
  endDate?: string
  monthlyPayment?: number
}

export interface MonthlyPaymentResponse {
  id: number
  name: string
  amount: number
  currency: Currency
  dueDay: number
  active: boolean
  description: string | null
  nextDueDate: string | null
  subscribedSince: string | null
  category: Category | null
  createdAt: string
  totalPaid: number
  paymentCount: number
}

export interface MonthlyPaymentRequest {
  name: string
  amount: number
  currency: Currency
  dueDay: number
  active?: boolean
  description?: string
  nextDueDate?: string
  subscribedSince?: string
  categoryId?: number
}

export type MonthlyPaymentMode = 'CASH' | 'CARD' | 'BOTH'

export interface MonthlyPaymentPayRequest {
  amount: number
  paymentDate: string
  mode: MonthlyPaymentMode
  cardId?: number
  cashAmount?: number
  updateAmountForFuture?: boolean
}

export interface DonationResponse {
  id: number
  recipientName: string       // real name — use for edit forms
  displayName: string         // "Anonymous" when anonymous, else recipientName — use for rendering
  amount: number
  currency: Currency
  donationDate: string
  description: string | null
  anonymous: boolean
  createdAt: string
}

export interface DonationRequest {
  recipientName: string
  amount: number
  currency: Currency
  donationDate: string
  description?: string
  anonymous?: boolean
  cardId?: number
  categoryId?: number
}

export interface InvestmentResponse {
  id: number
  name: string
  type: InvestmentType
  investedAmount: number
  currency: Currency
  purchaseDate: string
  broker: string | null
  description: string | null
  emergencyFund: boolean
  /** True when this investment is a savings goal (tracked apart from the 4 mandatory buckets). */
  savingsGoal: boolean
  targetAmount: number | null
  /** Current/market value — falls back to investedAmount when not explicitly set. */
  currentValue: number | null
  /** currentValue / targetAmount as a percentage; null when there is no target. */
  progressPercent: number | null
  /** True when recorded as an opening balance (already-owned holding; no transaction; excluded
      from the monthly allocation buckets). */
  openingBalance: boolean
  createdAt: string
}

export interface InvestmentRequest {
  name: string
  type: InvestmentType
  investedAmount: number
  currency: Currency
  purchaseDate: string
  broker?: string
  description?: string
  emergencyFund?: boolean
  savingsGoal?: boolean
  targetAmount?: number | null
  currentValue?: number | null
  /** Record an already-owned holding: no wallet debit, no transaction, excluded from the
      monthly allocation buckets. */
  openingBalance?: boolean
  cardId?: number
  categoryId?: number
}

export interface InvestmentContributeRequest {
  amount: number
  currency: Currency
  date: string
  cardId?: number
  /** Record the contribution without moving money: no transaction, no wallet debited. */
  noWallet?: boolean
  categoryId?: number
  description?: string
}

export interface InvestmentValueRequest {
  currentValue: number
}

export interface RepaymentRequest {
  amount: number
  paymentDate: string
  cardId?: number
  categoryId?: number
}

// "Already paid" — mark an obligation satisfied for a month with NO transaction / money move.
export type MarkPaidKind = 'SUBSCRIPTION' | 'BANK' | 'PERSONAL_LOAN' | 'DEBT' | 'BUCKET'

export interface MarkPaidRequest {
  kind: MarkPaidKind
  refId?: number          // subscription / bank-loan / loan-taken / debt id (omit for BUCKET)
  bucket?: Bucket         // only when kind === 'BUCKET'
  month?: string          // YYYY-MM; defaults to current month server-side
  amount: number
  currency: Currency
  note?: string
}

export interface MarkPaidResponse {
  id: number
  kind: MarkPaidKind
  refId: number | null
  bucket: Bucket | null
  month: string
  amount: number
  currency: Currency
}

export interface OverviewIncomeResponse {
  month: string
  currency: Currency
  actualIncome: number
  stableIncome: number | null
}

// Stocks was removed as an allocation bucket — nothing allocates to it.
export type Bucket = 'DONATION' | 'EMERGENCY' | 'INVESTMENTS'

export interface AllocationLine {
  bucket: Bucket
  label: string
  recommended: boolean
  minPercent: number | null
  minAmount: number | null
  paidAmount: number
  paidPercent: number | null
  remainingAmount: number | null
}

export interface BucketPayment {
  id: number
  bucket: Bucket
  date: string
  amount: number          // FX-converted to display currency
  nativeAmount: number
  nativeCurrency: Currency
  label: string
  description: string | null
}

export interface EmergencyResponse {
  id: number
  amount: number
  currency: Currency
  date: string
  description: string | null
  createdAt: string
}

export interface EmergencyRequest {
  amount: number
  currency: Currency
  date: string
  description?: string
  cardId?: number
  categoryId?: number
}

export interface ActionItem {
  text: string
  action: 'PAY_BANK' | 'PAY_PERSONAL_LOAN' | null
  paid: number | null
  target: number | null
  // Amount that must be paid this month for the item to count as "met" (and stop
  // locking the allocation buckets). Bank = 90% of target; personal = full target.
  unlockThreshold: number | null
}

export interface TierAllocation {
  scenarioKey: string | null
  scenarioLabel: string
  lines: AllocationLine[]
  actions: ActionItem[]
  // True while any actionable item is below its unlockThreshold — allocation recording
  // is disabled until debts are paid to their recommended amounts.
  allocationLocked: boolean
}

export interface OverviewTierResponse {
  currency: Currency
  income: number
  mandatorySubscriptions: number
  leftMoney: number
  // What the bucket percentages apply to: the left balance, max(0, leftMoney − debtPayments), plus
  // `bonusIncome`. The tier level uses leftMoney and never sees the bonus.
  allocationBase: number
  // This month's income in bonus-flagged categories — already inside allocationBase. Optional so a
  // cached response from an older backend still type-checks; treat a missing value as 0.
  bonusIncome?: number
  debtPayments: number
  debtBreakdown: {
    bankLoans: number
    loansTaken: number
    debts: number
  }
  debtRatio: number | null
  level: number | null
  subLevel: string | null
  levelLabel: string
  missingStableIncome: boolean
  // True when the viewed month is before the configured allocation tracking start month —
  // guidance is paused (no payment asks) and the dashboard is greyed out.
  beforeTrackingStart: boolean
  trackingStartMonth: string | null
  // True while any active mandatory subscription is unpaid this month — level / sub-level /
  // action items / allocation are withheld until they're paid.
  subscriptionsPending: boolean
  pendingSubscriptions: PendingSubscription[]
  allocation: TierAllocation | null
}

export interface PendingSubscription {
  id: number
  name: string
  currency: Currency
  amount: number
  paid: number
}

export interface SettingsResponse {
  id: number
  monthlyStableIncome: number | null
  monthlyStableIncomeCurrency: Currency | null
  allocationTrackingStartMonth: string | null
  telegramWebhookUrl: string | null
  telegramWebViewUrl: string | null
  updatedAt: string
}

export interface SettingsRequest {
  monthlyStableIncome?: number
  monthlyStableIncomeCurrency?: Currency
  allocationTrackingStartMonth?: string
  telegramWebhookUrl?: string
  telegramWebViewUrl?: string
}

// Allocation ledger (cross-month backlog)
export interface AllocationLedgerLine {
  bucket: Bucket
  percent: number | null
  recommended: number
  paid: number
  net: number
}

export interface AllocationLedgerMonth {
  month: string
  level: number | null
  subLevel: string | null
  stableIncome: number
  bonus: number
  allocationBase: number
  selected: boolean
  lines: AllocationLedgerLine[]
}

export interface AllocationLedgerBucket {
  bucket: Bucket
  label: string
  percent: number | null
  recommended: number
  paid: number
  carried: number
  outstanding: number
  effectivePercent: number | null
  overAllocated: boolean
}

export interface LevelAllocationRuleRequest {
  subLevel: string
  donationPercent?: number | null
  emergencyPercent?: number | null
  investmentsPercent?: number | null
  stocksPercent?: number | null
  note?: string | null
}

// Allocation rules view (Levels 1–6; Level 1 is a read-only reference). UZS amounts.
export interface AllocationSubLevelView {
  subLevel: string
  debtLabel: string
  donationPercent: number | null
  emergencyPercent: number | null
  investmentsPercent: number | null
  stocksPercent: number | null
}

export interface AllocationLevelView {
  level: number
  incomeLow: number
  incomeHigh: number
  minLeftover: number | null
  expirationMonth: string | null
  locked: boolean
  editable: boolean
  builtIn: boolean
  subLevels: AllocationSubLevelView[]
}

export interface AllocationRulesView {
  currentLevel: number | null
  currentSubLevel: string | null
  missingStableIncome: boolean
  levels: AllocationLevelView[]
}

export interface LevelConfigRequest {
  level: number
  minLeftover?: number | null
  expirationMonth?: string | null
  rules?: LevelAllocationRuleRequest[]
}

export interface AllocationLedgerResponse {
  currency: Currency
  startMonth: string
  selectedMonth: string
  missingStableIncome: boolean
  beforeTrackingStart?: boolean
  trackingStartMonth?: string | null
  stableIncome: number | null
  bonusThisMonth: number | null
  allocationBase: number | null
  level: number | null
  subLevel: string | null
  dueThisMonth: number | null
  carriedFromPrevious: number | null
  totalDueNow: number | null
  carriedStartMonth: string | null
  carriedEndMonth: string | null
  buckets: AllocationLedgerBucket[]
  months: AllocationLedgerMonth[]
}

export interface CashBalanceResponse {
  id: number
  currency: Currency
  initialBalance: number
  currentBalance: number
  createdAt: string
  updatedAt: string
}

export interface CashBalanceRequest {
  currency: Currency
  initialBalance: number
}

export interface BalanceTransferRequest {
  /** null = the cash pot */
  fromCardId: number | null
  /** null = the cash pot */
  toCardId: number | null
  amount: number
  description?: string
  transactionDate: string
}

// ── Monthly-envelope: month close + summary ───────────────────────────────
export type WalletType = 'CARD' | 'CASH'

/** The "earned / tagged / spent / left" envelope view for one month. */
export interface MonthSummaryResponse {
  month: string
  currency: Currency
  closed: boolean
  startBalance: number
  income: number
  donation: number
  emergency: number
  investments: number
  stocks: number
  savings: number
  /**
   * Every bucket figure above, summed — and it counts "already paid" marks, on a closed month
   * exactly as on an open one, so this page and the Plan never quote two totals for one bucket.
   */
  taggedTotal: number
  /**
   * The recorded half alone: the part of `totalSpent` that actually left a wallet for a bucket.
   * This — not `taggedTotal` — is what the close freezes and what `everydaySpend` balances against.
   *
   *   taggedTotal   = taggedRecorded + markedNotMoved
   *   everydaySpend = totalSpent − taggedRecorded      (closed months)
   */
  taggedRecorded: number
  /** The marks-only delta: money declared paid that never left a wallet. Reported for both. */
  markedNotMoved: number
  /** null until the month is closed. */
  everydaySpend: number | null
  /**
   * Open months only (null once closed): net everyday spending the wallet check-ins have booked
   * so far. Optional so an older backend that does not report it simply shows nothing.
   */
  everydaySoFar?: number | null
  totalSpent: number | null
  leftover: number | null
}

export interface MonthPreviewWallet {
  walletType: WalletType
  cardId: number | null
  label: string
  currency: Currency
  /** Computed balance in this wallet's own currency. */
  computedBalance: number
}

export interface MonthClosePreviewResponse {
  month: string
  currency: Currency
  alreadyClosed: boolean
  closeable: boolean
  blockedReason: string | null
  wallets: MonthPreviewWallet[]
  startBalance: number
  income: number
  donation: number
  emergency: number
  investments: number
  stocks: number
  savings: number
  taggedTotal: number
  spendableNow: number
}

/**
 * Whether a wallet check-in can be recorded today and what to tell the owner either way. The
 * rules are the server's (WalletCheckInService), so the web app and the bot cannot disagree.
 */
export interface WalletCheckInStatus {
  date: string
  month: string
  allowed: boolean
  /** MONTH_ENDING — the next one would fall in next month, so the close takes over.
   *  MONTH_CLOSED — the month is locked. */
  blockedCode: 'MONTH_ENDING' | 'MONTH_CLOSED' | null
  blockedReason: string | null
  daysUntilMonthEnd: number
  nextMonthStart: string
  lastReconciledOn: string | null
  daysSinceLastReconciled: number | null
  intervalDays: number
  due: boolean
  /** When the next one is suggested; null when the month close will come first. */
  nextDueOn: string | null
  everydaySoFar: number
  checkInsThisMonth: number
  /** Every wallet with the balance the app computes for it as of `date`. */
  wallets: MonthPreviewWallet[]
}

export interface WalletCheckInRequest {
  /** The owner's local day — the server's clock is UTC. */
  date: string
  wallets: MonthCloseWalletEntry[]
}

export interface WalletCheckInResult {
  id: number
  date: string
  /** Net everyday spending this check-in booked: untracked spending minus any surplus found. */
  everydayRecorded: number
  everydaySoFar: number
  nextDueOn: string | null
}

export interface MonthCloseWalletEntry {
  walletType: WalletType
  cardId?: number | null
  currency: Currency
  enteredBalance: number
}

export interface MonthCloseRequest {
  month: string
  wallets: MonthCloseWalletEntry[]
}

export interface MonthCloseWalletResult {
  walletType: WalletType
  cardId: number | null
  currency: Currency
  computedBalance: number
  enteredBalance: number
  everydaySpend: number
  adjustmentTxId: number | null
}

/** A committed, permanent month close. All money figures are the UZS snapshot (currency = UZS). */
export interface MonthCloseResponse {
  id: number
  month: string
  closedAt: string
  currency: Currency
  startBalance: number
  income: number
  donation: number
  emergency: number
  investments: number
  stocks: number
  savings: number
  everydaySpend: number
  totalSpent: number
  leftover: number
  wallets: MonthCloseWalletResult[]
}

// ── Allocation preview (what a draft transaction would do) ────────────────
export interface AllocationPreviewRequest {
  subType?: TransactionSubType | ''
  amount: number
  transactionDate: string
  investmentId?: number
}

export interface AllocationPreviewResponse {
  applicable: boolean
  bucket?: string
  label?: string
  message?: string
  bucketNotRecommended: boolean
  recommended?: number
  paidBefore?: number
  amount?: number
  paidAfter?: number
  remainingBefore?: number
  remainingAfter?: number
  completesBucket: boolean
}

// ── Advisor (GET /advisor) ──────────────────────────────────────────────────
// One answer shared by web Home and the Telegram bot: what you have, what is coming, what this
// month still asks for, what is free after that, and what to do next. Every figure is UZS.

export interface AdvisorWallet {
  type: 'CARD' | 'CASH'
  /** Null for cash. */
  cardId: number | null
  label: string
  balance: number
}

export interface AdvisorOwed {
  id: number
  name: string
  amount: number
  expectedOn: string | null
}

export interface AdvisorBill {
  kind: 'SUBSCRIPTION' | 'BANK' | 'LOAN_PLAN' | 'DEBTS'
  /** The subscription id for SUBSCRIPTION. */
  refId: number | null
  /** The subscription name for SUBSCRIPTION; the client labels the other kinds. */
  name: string | null
  /** Still to pay this month. */
  amount: number
  paid: number
  target: number
}

export interface AdvisorSetAside {
  bucket: Bucket
  percent: number | null
  target: number
  paid: number
  remaining: number
}

export type AdvisorAction =
  | 'SET_INCOME' | 'PAY_SUBSCRIPTION' | 'PAY_BANK' | 'PAY_DEBT'
  | 'CLOSE_MONTH' | 'CHECK_IN' | 'SET_ASIDE' | 'ADD_GOAL'

export interface AdvisorSuggestion {
  /** Translation key root, e.g. "advisor.s.paySubscription". */
  code: string
  /** Names and months only — the amount is `amount`. */
  params: Record<string, string>
  /** The same sentence in English, for a code this client does not know. */
  text: string
  /** DO: due now · IDEA: optional encouragement · WARN: a heads-up with nothing to tap. */
  kind: 'DO' | 'IDEA' | 'WARN'
  action: AdvisorAction | null
  /** PAY_SUBSCRIPTION: the subscription id. SET_ASIDE into a goal: the goal id. */
  refId: number | null
  /** SET_ASIDE: DONATION | EMERGENCY | INVESTMENTS | SAVINGS. */
  bucket: Bucket | 'SAVINGS' | null
  amount: number | null
}

export interface AdvisorResponse {
  date: string
  month: string
  currency: Currency
  missingStableIncome: boolean
  have: number
  wallets: AdvisorWallet[]
  balanceCheckedOn: string | null
  balanceCheckedDaysAgo: number | null
  salaryExpected: number
  salaryReceived: number
  salaryComing: number
  bonusReceived: number
  owedToYou: AdvisorOwed[]
  owedToYouTotal: number
  bills: AdvisorBill[]
  billsLeft: number
  setAside: AdvisorSetAside[]
  setAsideLeft: number
  /** The Plan asks for the bills first; the set-aside figures are the step after. */
  setAsideAfterBills: boolean
  /** Null while the monthly stable income is unset. Negative = short. */
  free: number | null
  suggestions: AdvisorSuggestion[]
}
