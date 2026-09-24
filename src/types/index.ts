export type TransactionType = 'INCOME' | 'EXPENSE'
export type TransactionSubType =
  | 'REGULAR_INCOME' | 'LOAN_RECEIVED' | 'LOAN_RETURNED_TO_ME'
  | 'REGULAR_EXPENSE' | 'LOAN_GIVEN' | 'LOAN_REPAYMENT'
  | 'BANK_LOAN_PAYMENT' | 'INVESTMENT' | 'STOCK_PURCHASE' | 'DONATION'
  | 'EMERGENCY_CONTRIBUTION'
  | 'TRANSFER_OUT' | 'TRANSFER_IN'
  // Booked by a wallet check: the gap between what the app computed and what was really there.
  | 'EVERYDAY_SPENDING'
// USD/EUR exist only as standalone cash pots — nothing converts them to UZS.
export type Currency = 'UZS' | 'USD' | 'EUR'
export type CategoryType = 'INCOME' | 'EXPENSE' | 'BOTH'
export type CardType = 'UZCARD' | 'HUMO' | 'VISA' | 'CASH'
export type RecordStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE'
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
  /** The person owed. Absent on an older server. */
  lenderId?: number | null
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
  lenderId?: number | null
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
  /** The person who borrowed it. Absent on an older server. */
  borrowerId?: number | null
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
  borrowerId?: number | null
  /** Create only: take the money out of a wallet in the same step. */
  moveMoney?: boolean
  /** With `moveMoney`: the card, or null for cash. */
  cardId?: number | null
}

/** MONTHLY: repaid by a monthly plan, like a bank loan. ASAP: as fast as possible (the 70% / 34% rule). */
export type RepaymentType = 'MONTHLY' | 'ASAP'

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
  /** Absent on an older server: read as MONTHLY when there is a plan, ASAP when there is not. */
  repaymentType?: RepaymentType
  /** The person lent it. Absent on an older server. */
  lenderId?: number | null
}

export interface LoanTakenRequest {
  /** Null keeps (or puts back) the default rule: the server stores exactly what is sent. */
  plannedMonthlyPayment?: number | null
  repaymentType?: RepaymentType
  lenderId?: number | null
  /** Create only: put the money into a wallet in the same step. */
  moveMoney?: boolean
  /** With `moveMoney`: the card, or null for cash. */
  cardId?: number | null
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
  /** A savings goal's deadline, YYYY-MM-DD (the last day of its month). Absent on an older backend. */
  targetDate?: string | null
  /** What a savings goal asks each month. Absent on an older backend. */
  monthlyContribution?: number | null
  /** The month a savings goal's payments start, YYYY-MM-01; null = the month of `purchaseDate`.
   *  Absent on an older backend, which is read the same way. */
  paymentStartDate?: string | null
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
  /** A savings goal's deadline, YYYY-MM-DD (the last day of its month). On update, a key left out
   *  keeps the stored deadline and an explicit null removes it. */
  targetDate?: string | null
  /** What a savings goal asks each month. */
  monthlyContribution?: number | null
  /** The month a savings goal's payments start, YYYY-MM-01. On update, a key left out keeps the
   *  stored month and null resets it to the purchase month. */
  paymentStartDate?: string | null
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

// The three kinds of saving the advisor asks for each month.
export type Bucket = 'DONATION' | 'EMERGENCY' | 'INVESTMENTS'

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

// ── Wallet check-in ────────────────────────────────────────────────────────
export type WalletType = 'CARD' | 'CASH'

export interface MonthPreviewWallet {
  walletType: WalletType
  cardId: number | null
  label: string
  currency: Currency
  /** Computed balance in this wallet's own currency. */
  computedBalance: number
}

/**
 * Whether a wallet check-in can be recorded today and what to tell the owner either way. The
 * rules are the server's (WalletCheckInService), so the web app and the bot cannot disagree.
 */
export interface WalletCheckInStatus {
  date: string
  month: string
  allowed: boolean
  /** MONTH_CLOSED — the month is locked; the only reason a check-in is refused. */
  blockedCode: 'MONTH_CLOSED' | null
  blockedReason: string | null
  lastReconciledOn: string | null
  daysSinceLastReconciled: number | null
  intervalDays: number
  due: boolean
  /** When the next one is suggested; null when the month is closed. */
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

/** One bill or loan payment due between today and the next few weeks. */
export interface AdvisorUpcoming {
  /** YYYY-MM-DD */
  date: string
  /** BILL: a subscription · BANK: a bank loan · LOAN: money borrowed from a person · DEBT: a debt. */
  kind: 'BILL' | 'BANK' | 'LOAN' | 'DEBT'
  /**
   * The subscription / bank loan / loan-taken / debt id, per `kind`. Null for a payment recorded
   * ahead that names no loan.
   */
  refId: number | null
  name: string
  amount: number
  /** The due date has passed and it is still unpaid. */
  overdue: boolean
  /**
   * A payment the owner already entered for this later day: the money leaves the wallet then, and
   * there is nothing left to pay for it. Absent on an older backend — read it as false.
   */
  recorded?: boolean
  /** This month's due on a loan or debt repaid as fast as possible (dated today). */
  asap?: boolean
}

/** One income the safe-to-spend figure expects before its window ends (salary, capped). */
export interface AdvisorIncomePart {
  date: string
  name: string
  amount: number
}

/** The window from today to `tightestOn`, in the words the "How is this worked out?" line uses. */
export interface AdvisorDailyBreakdown {
  have: number
  comingIn: number
  /** Bills and loan payments due inside the window. */
  goingOut: number
  savings: number
  /** have + comingIn − goingOut − savings */
  net: number
  days: number
}

/**
 * "How much can I safely spend each day until salary." Every figure is UZS; dates are YYYY-MM-DD.
 * Optional on the response because the backend ships separately — a client must fall back to
 * "You have" plus the suggestions when it is absent.
 */
export interface AdvisorDaily {
  /** The most the owner can spend each day without running short before `until`. */
  safePerDay: number
  until: string
  /** The date that limits `safePerDay`; `breakdown` explains today → this date. */
  tightestOn: string
  breakdown: AdvisorDailyBreakdown
  /** What they actually spent per day lately, over [paceFrom, paceTo]. */
  paceDaily: number | null
  paceFrom: string | null
  paceTo: string | null
  /** When the money runs out at `paceDaily`; null when it lasts. */
  runsOutOn: string | null
  /** Set when even spending nothing is not enough. */
  shortBy: { date: string; amount: number } | null
  upcoming: AdvisorUpcoming[]
  incomes: AdvisorIncomePart[]
}

/** One savings line for this month: what it asks, what went in, what is left. */
export interface AdvisorSavingsRow {
  /** GOAL: one savings goal, its target being the goal's monthly payment. Not sent by an older backend. */
  bucket: Bucket | 'GOAL'
  percent: number | null
  target: number
  paid: number
  remaining: number
  /** GOAL only: the goal's investment id. */
  refId?: number | null
  /** GOAL only: the goal's name. */
  name?: string | null
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
  /**
   * Safe-to-spend per day. Null while the stable income is unset; absent on an older backend.
   * Either way the client falls back to "You have" plus the suggestions.
   */
  daily?: AdvisorDaily | null
  /** This month's savings lines (met ones included). Absent on an older backend. */
  savingsThisMonth?: AdvisorSavingsRow[]
}
