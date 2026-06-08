export type TransactionType = 'INCOME' | 'EXPENSE'
export type TransactionSubType =
  | 'REGULAR_INCOME' | 'LOAN_RECEIVED' | 'LOAN_RETURNED_TO_ME'
  | 'REGULAR_EXPENSE' | 'LOAN_GIVEN' | 'LOAN_REPAYMENT'
  | 'BANK_LOAN_PAYMENT' | 'INVESTMENT' | 'STOCK_PURCHASE' | 'DONATION'
  | 'EMERGENCY_CONTRIBUTION'
  | 'TRANSFER_OUT' | 'TRANSFER_IN'
  | 'EXCHANGE_OUT' | 'EXCHANGE_IN'
export type Currency = 'USD' | 'EUR' | 'UZS'
export type CategoryType = 'INCOME' | 'EXPENSE' | 'BOTH'
export type CategoryKind = 'GENERIC' | 'FOOD' | 'TRANSPORT'
export type CardType = 'UZCARD' | 'HUMO' | 'VISA' | 'CASH'
export type RecordStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE'
export type BankLoanStatus = 'ACTIVE' | 'PAID_OFF' | 'DEFAULTED'
export type InvestmentType = 'REAL_ESTATE' | 'BONDS' | 'MUTUAL_FUND' | 'GOLD' | 'OTHER'

export interface Category {
  id: number
  name: string
  type: CategoryType
  color: string
  icon: string
  applicableSubType: TransactionSubType | null
  kind: CategoryKind
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
  hasFullNumber: boolean
  hasPin: boolean
  createdAt: string
}

export interface CardRequest {
  name: string
  bankName: string
  type: CardType
  lastFourDigits: string
  fullNumber?: string
  pin?: string
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
  place: string | null
  fromLocation: string | null
  toLocation: string | null
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
  /** LOAN_RECEIVED only: month (YYYY-MM-01) repayments start counting toward the tier. */
  paymentStartDate?: string
  cashAmount?: number
  place?: string
  fromLocation?: string
  toLocation?: string
}

export interface CategoryRequest {
  name: string
  type: CategoryType
  color?: string
  icon?: string
  applicableSubType?: TransactionSubType
  parentId?: number
  kind?: CategoryKind
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
}

export interface LoanTakenRequest {
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
  fxRatesUsingDefaults: boolean
}

export type Bucket = 'DONATION' | 'EMERGENCY' | 'INVESTMENTS' | 'STOCKS'

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
  // "Left balance" = leftMoney − debtPayments (stable income − mandatory subscriptions − monthly
  // debt charge). The bucket allocation percentages apply to THIS. The tier level uses leftMoney.
  allocationBase: number
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
  fxRatesUsingDefaults: boolean
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
  usdToUzs: number | null
  eurToUzs: number | null
  allocationTrackingStartMonth: string | null
  telegramWebhookUrl: string | null
  telegramWebViewUrl: string | null
  updatedAt: string
}

export interface SettingsRequest {
  monthlyStableIncome?: number
  monthlyStableIncomeCurrency?: Currency
  usdToUzs?: number
  eurToUzs?: number
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
  fromCardId: number
  toCardId: number
  amount: number
  description?: string
  transactionDate: string
}

export interface ExchangeRequest {
  fromCardId?: number          // null/undefined = source is cash
  fromCurrency: Currency
  fromAmount: number
  toCardId?: number            // null/undefined = destination is cash
  toCurrency: Currency
  toAmount: number
  transactionDate: string
  description?: string
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
  taggedTotal: number
  /** null until the month is closed. */
  everydaySpend: number | null
  totalSpent: number | null
  leftover: number | null
  fxRatesUsingDefaults: boolean
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
  fxRatesUsingDefaults: boolean
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
