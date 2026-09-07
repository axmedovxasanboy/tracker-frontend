import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, Info, Plus, Wallet, X } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { useLang } from '../../i18n/LanguageContext'
import { AllocationPreviewPanel } from './AllocationPreviewPanel'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { overviewApi } from '../../api/overview'
import { categoriesApi } from '../../api/categories'
import { cardsApi } from '../../api/cards'
import { transactionsApi } from '../../api/transactions'
import { financeApi } from '../../api/finance'
import { cashBalancesApi } from '../../api/cashBalances'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, todayLocal } from '../../utils/format'
import { AmountInput } from '../ui/AmountInput'
import {
  parseTransportDescription as parseRoute,
  composeTransportDescription as composeRoute,
} from '../../utils/transactionDescription'
import type {
  CardResponse, Category, CategoryRequest, CategoryType,
  Currency, InvestmentType, LoanTakenResponse, Transaction, TransactionRequest,
  TransactionSubType, TransactionType,
} from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  transaction?: Transaction | null
  defaultCurrency: Currency
  /** Pre-select this card for a NEW transaction (e.g. the per-card quick-add on the Cards page). */
  preselectCardId?: number
  /** Open a NEW transaction already set to Income or Expense (the +Income / +Expense shortcuts). */
  presetType?: TransactionType
}

const NEEDS_COUNTERPARTY = new Set<TransactionSubType>([
  'LOAN_RECEIVED','LOAN_RETURNED_TO_ME','LOAN_GIVEN','LOAN_REPAYMENT','BANK_LOAN_PAYMENT','INVESTMENT','DONATION',
])
const AUTO_CREATES = new Set<TransactionSubType>(['LOAN_RECEIVED','LOAN_GIVEN','INVESTMENT','DONATION'])
const COLORS = ['#10b981','#f43f5e','#6366f1','#f59e0b','#06b6d4','#a855f7','#ec4899','#14b8a6','#3b82f6','#ef4444','#8b5cf6','#6b7280']

/** The submit button lives in the sheet's sticky footer, outside the <form> it submits. */
const FORM_ID = 'tx-form'

const CONTROL = 'w-full h-11 rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-ring'
const CONTROL_INVALID = 'w-full h-11 rounded-control border border-expense bg-white px-3 text-sm text-slate-900 focus-ring'
const TEXTAREA = 'w-full rounded-control border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus-ring resize-none'
/**
 * One option row inside the three suggestion popovers (borrowers, banks, descriptions).
 * Those containers clip — overflow-y-auto for the scrolling one, overflow-hidden to keep the
 * 12px corners on the others — and a plain .focus-ring paints its ring outside the button's
 * border box, so on a full-width row the left and right bands were cut away entirely and only
 * the top and bottom survived (the first and last row losing even one of those). ring-inset
 * moves the indicator inside the row where nothing can clip it, and ring-offset-0 drops the
 * second, white band that inset would otherwise paint white-on-white over the row itself.
 * Same fix, same reason as ListRow inside its overflow-hidden ListTile.
 */
const POPOVER_ITEM =
  'focus-ring focus-visible:ring-inset focus-visible:ring-offset-0 w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-700'

const SEGMENT_TRACK = 'flex gap-1 rounded-control bg-slate-100 p-1'
const SEGMENT_BASE =
  'flex-1 min-h-[44px] md:min-h-[38px] rounded-chip px-2 text-xs font-semibold transition-colors focus-ring cursor-pointer disabled:cursor-not-allowed disabled:opacity-40'
/**
 * The direction control is the form's first decision, so it is a size up from the other
 * segmented controls: 44px at every width (never the 38px desktop shrink) and body-sized text,
 * because everything below it — which categories exist, what the amount means — reads off it.
 */
const DIRECTION_OPTION =
  'flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-chip px-3 text-sm font-semibold transition-colors focus-ring cursor-pointer'

/** Which control the current validation message belongs to, so it renders beside it. */
type ErrorField =
  | 'category' | 'subCategory' | 'investment' | 'card' | 'amount' | 'split'
  | 'description' | 'counterparty' | 'date'

/** Fields that live behind the disclosure — a message there is invisible until it is open. */
const HIDDEN_BEHIND_MORE: ReadonlySet<ErrorField> =
  new Set<ErrorField>(['description', 'counterparty', 'split', 'investment'])

const defaultForm = (currency: Currency): TransactionRequest => ({
  type: 'EXPENSE', amount: 0, currency, description: '',
  transactionDate: todayLocal(), subType: 'REGULAR_EXPENSE',
})

/** First day of next month as YYYY-MM (for the "payment starts" month picker default). */
function nextMonthStr() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * The borrower a LOAN_GIVEN top-up was booked against. The wire response carries it
 * (`TransactionResponse.loanGivenId`) but the shared `Transaction` type has not been widened
 * for it yet, so it is read structurally here. It has to survive an edit: the backend compares
 * the posted id with the stored one and, when they differ, backs the money out of the borrower's
 * loan and opens a second loan for the same person.
 */
function linkedLoanGivenId(tx: Transaction): number | undefined {
  return (tx as Transaction & { loanGivenId?: number | null }).loanGivenId ?? undefined
}


export function TransactionModal({ open, onClose, onSaved, transaction, defaultCurrency, preselectCardId, presetType }: Props) {
  // Aliased to `translate` — this file uses `t` as a local loop variable in a couple of
  // .map() callbacks (income/expense toggle, investment-type select), so binding the hook
  // itself to `t` would shadow those and silently break translation calls made inside them.
  const { t: translate, categoryName } = useLang()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const INCOME_SUB_TYPES: { value: TransactionSubType; label: string; hint: string }[] = [
    { value: 'REGULAR_INCOME',      label: translate('cmp.txModal.subType.regularIncome'),      hint: translate('cmp.txModal.hint.regularIncome') },
    { value: 'LOAN_RECEIVED',       label: translate('cmp.txModal.subType.loanReceived'),       hint: translate('cmp.txModal.hint.loanReceived') },
    { value: 'LOAN_RETURNED_TO_ME', label: translate('cmp.txModal.subType.loanReturnedToMe'), hint: translate('cmp.txModal.hint.loanReturnedToMe') },
  ]
  const EXPENSE_SUB_TYPES: { value: TransactionSubType; label: string; hint: string }[] = [
    { value: 'REGULAR_EXPENSE',   label: translate('cmp.txModal.subType.regularExpense'),   hint: translate('cmp.txModal.hint.regularExpense') },
    { value: 'LOAN_GIVEN',        label: translate('cmp.txModal.subType.loanGiven'),        hint: translate('cmp.txModal.hint.loanGiven') },
    { value: 'LOAN_REPAYMENT',    label: translate('cmp.txModal.subType.loanRepayment'),    hint: translate('cmp.txModal.hint.loanRepayment') },
    { value: 'BANK_LOAN_PAYMENT', label: translate('cmp.txModal.subType.bankLoanPayment'), hint: translate('cmp.txModal.hint.bankLoanPayment') },
    { value: 'INVESTMENT',        label: translate('cmp.txModal.subType.investment'),        hint: translate('cmp.txModal.hint.investment') },
    { value: 'DONATION',          label: translate('cmp.txModal.subType.donation'),          hint: translate('cmp.txModal.hint.donation') },
  ]
  const COUNTERPARTY_LABEL: Partial<Record<TransactionSubType, string>> = {
    LOAN_RECEIVED: translate('cmp.txModal.counterparty.lenderName'),
    LOAN_RETURNED_TO_ME: translate('cmp.txModal.counterparty.debtorName'),
    LOAN_GIVEN: translate('cmp.txModal.counterparty.borrowerName'),
    LOAN_REPAYMENT: translate('cmp.txModal.counterparty.lenderCreditor'),
    BANK_LOAN_PAYMENT: translate('cmp.txModal.counterparty.bankName'),
    INVESTMENT: translate('cmp.txModal.counterparty.assetPlatform'),
    DONATION: translate('cmp.txModal.counterparty.recipientName'),
  }
  const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
    REAL_ESTATE: translate('cmp.investmentType.realEstate'),
    BONDS: translate('cmp.investmentType.bonds'),
    MUTUAL_FUND: translate('cmp.investmentType.mutualFund'),
    GOLD: translate('cmp.investmentType.gold'),
    OTHER: translate('cmp.investmentType.other'),
  }
  const { showSuccess } = useToast()
  const [form, setForm] = useState<TransactionRequest>(defaultForm(defaultCurrency))
  const [rootCategories, setRootCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<Category[]>([])
  const [selectedRootId, setSelectedRootId] = useState<number | undefined>()
  const [cards, setCards] = useState<CardResponse[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBalanceError, setIsBalanceError] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [invalidField, setInvalidField] = useState<ErrorField | null>(null)

  // Autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // New root category inline form
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCat, setNewCat] = useState<CategoryRequest>({ name: '', type: 'EXPENSE', color: '#6366f1' })
  const [creatingCat, setCreatingCat] = useState(false)
  // The server's refusal, kept beside the inline form that caused it: the dialog's own error strip
  // sits at the very bottom of a long scrolling form, where a user looking at the category picker
  // would never see it.
  const [newCatError, setNewCatError] = useState<string | null>(null)

  // New sub-category inline form (inside sub-category column)
  const [showNewSubCat, setShowNewSubCat] = useState(false)
  const [newSubCat, setNewSubCat] = useState<CategoryRequest>({ name: '', type: 'EXPENSE', color: '#6366f1' })
  const [creatingSubCat, setCreatingSubCat] = useState(false)
  const [newSubCatError, setNewSubCatError] = useState<string | null>(null)

  // Existing investments — used when sub-type === INVESTMENT
  const [existingInvestments, setExistingInvestments] = useState<import('../../types').InvestmentResponse[]>([])
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<number | undefined>()
  const [investmentMode, setInvestmentMode] = useState<'existing' | 'new'>('existing')

  // Active borrowed loans — used when sub-type === LOAN_REPAYMENT
  const [activeLoans, setActiveLoans] = useState<LoanTakenResponse[]>([])
  const [selectedLoanId, setSelectedLoanId] = useState<number | undefined>()

  // Active lent loans — used when sub-type === LOAN_RETURNED_TO_ME
  const [activeLoansGiven, setActiveLoansGiven] = useState<import('../../types').LoanGivenResponse[]>([])
  const [selectedLoanGivenId, setSelectedLoanGivenId] = useState<number | undefined>()

  // Payment method: card-only, cash-only (no card touched), or both (split). The default is
  // decided once the card list lands — "Card only" cannot be satisfied with an empty wallet.
  type PaymentMode = 'CARD' | 'CASH' | 'BOTH'
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CARD')
  const [cashInput, setCashInput] = useState<number>(0)
  const [cardInput, setCardInput] = useState<number>(0)

  // Bank-name autocomplete (BANK_LOAN_PAYMENT counterparty).
  const [bankOptions, setBankOptions] = useState<string[]>([])
  // All loans given (settled ones included) — the borrower picker for LOAN_GIVEN.
  const [allLoansGiven, setAllLoansGiven] = useState<import('../../types').LoanGivenResponse[]>([])
  const [showBorrowerPopover, setShowBorrowerPopover] = useState(false)
  const [showBankPopover, setShowBankPopover] = useState(false)

  // Current cash balance for the active currency — shown next to the Cash source.
  const [cashBalance, setCashBalance] = useState<number | null>(null)

  // A failed card fetch and an empty wallet used to be the same screen. They are not the same
  // problem, and only one of them is fixed by adding a card.
  const [cardsLoaded, setCardsLoaded] = useState(false)
  const [cardsFailed, setCardsFailed] = useState(false)

  // Everything past Amount / Category / Card / Date lives behind this.
  const [moreOpen, setMoreOpen] = useState(false)
  // Set by the user's own edits only. The auto-select effects write to `form` on their own, so
  // comparing snapshots would report an untouched form as dirty the moment a category loads.
  const [touched, setTouched] = useState(false)
  // The root the sub-type picked on the user's behalf, and whether they asked to override it.
  const [autoPickedRootId, setAutoPickedRootId] = useState<number | undefined>()
  const [categoryUnlocked, setCategoryUnlocked] = useState(false)
  // Why the category picker went empty. The two causes read differently to the user — "income
  // and expense keep different lists" is not "this special type files itself" — and now that the
  // direction control is the first thing in the form, the first one is what they will hit.
  const [categoryCleared, setCategoryCleared] = useState<'direction' | 'subType' | null>(null)
  // A direction switch carries a typed amount over instead of dropping it. Money surviving a
  // green/red flip is exactly the kind of thing a user goes back to double-check, so say it.
  const [amountKeptOnSwitch, setAmountKeptOnSwitch] = useState(false)

  const directionRef = useRef<HTMLButtonElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  // The three suggestion popovers close on focus leaving them. Tabbing from the input INTO the
  // list is focus leaving the input, so the handler has to know where focus landed — hence a ref
  // per list rather than a blanket timer that would unmount the options under a keyboard user.
  const borrowerPopoverRef = useRef<HTMLDivElement>(null)
  const bankPopoverRef = useRef<HTMLDivElement>(null)
  const suggestionsPopoverRef = useRef<HTMLDivElement>(null)
  const counterpartyRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  // Raised while focus is being handed back to a field after its list was dismissed, so the
  // field's own onFocus does not reopen the list the user just closed.
  const restoringFocus = useRef(false)

  // A counterparty name is never stored on a transaction, so an edit reopens with the field
  // blank. It is filled once from the linked finance record; the flag keeps a later re-render
  // from typing it back in after the user has deliberately cleared it.
  const counterpartySeeded = useRef(false)

  // CASH cards are legacy — they're migrated to CashBalance on the backend on next boot.
  // Defensively exclude them so "Card only" never offers a cash wallet. Filtered on
  // `defaultCurrency`, which is also what the payload is saved with, rather than on
  // `form.currency`, which a loan or investment selection can overwrite mid-form.
  const usableCards = cards.filter(c => c.currency === defaultCurrency && c.type !== 'CASH')
  const noUsableCards = cardsLoaded && !cardsFailed && usableCards.length === 0

  // The two sub-types that bypass transactionsApi.create for an atomic finance update. That
  // endpoint books the whole amount to one source, so a split there is silently discarded.
  const atomicLoanPath = !transaction && (
    (form.subType === 'LOAN_REPAYMENT' && !!selectedLoanId) ||
    (form.subType === 'LOAN_RETURNED_TO_ME' && !!selectedLoanGivenId)
  )

  const loadCards = useCallback(() => {
    setCardsFailed(false)
    return cardsApi.getAll()
      .then(r => { setCards(r.data); setCardsFailed(false) })
      .catch(() => setCardsFailed(true))
      .finally(() => setCardsLoaded(true))
  }, [])

  const loadRoots = useCallback(async (type?: CategoryType, subType?: TransactionSubType) => {
    const res = await categoriesApi.getAll(type, subType).catch(() => null)
    if (res) setRootCategories(res.data)
  }, [])

  const loadSubs = useCallback(async (parentId: number) => {
    const res = await categoriesApi.getSubCategories(parentId).catch(() => null)
    setSubCategories(res?.data ?? [])
  }, [])

  // Auto-select the root category for the chosen sub-type. An exact `applicableSubType` match
  // wins over a bare count, so adding a second Donation category does not break the pick.
  useEffect(() => {
    if (transaction || selectedRootId) return
    const exact = rootCategories.filter(c => c.applicableSubType === form.subType)
    const only = exact.length === 1 ? exact[0] : rootCategories.length === 1 ? rootCategories[0] : undefined
    if (!only) return
    setSelectedRootId(only.id)
    setForm(prev => ({ ...prev, categoryId: only.id }))
    setAutoPickedRootId(only.id)
    setCategoryCleared(null)
    loadSubs(only.id)
  }, [rootCategories, transaction, selectedRootId, form.subType, loadSubs])

  // Auto-select the sub-category when exactly one exists under the chosen root.
  useEffect(() => {
    if (transaction) return
    if (subCategories.length === 1 && selectedRootId && form.categoryId === selectedRootId) {
      setForm(prev => ({ ...prev, categoryId: subCategories[0].id }))
    }
  }, [subCategories, transaction, selectedRootId, form.categoryId])

  // Sync form.amount + form.cashAmount + form.cardId whenever the user moves Cash/Card/Both.
  // Cash is no longer a "wallet card" — cash transactions are stored with cardId=null and the
  // running total is tracked by the CashBalance entity per currency.
  useEffect(() => {
    if (paymentMode === 'CARD') {
      setForm(prev => ({ ...prev, cashAmount: 0 }))
    } else if (paymentMode === 'CASH') {
      // Pure cash → no card link. Backend tracks via CashBalance for the currency.
      setForm(prev => ({ ...prev, cashAmount: prev.amount, cardId: undefined }))
    } else {
      // BOTH — form.amount = cashInput + cardInput; form.cashAmount = cashInput.
      const total = (cashInput || 0) + (cardInput || 0)
      setForm(prev => ({ ...prev, amount: total, cashAmount: cashInput || 0 }))
    }
  }, [paymentMode, cashInput, cardInput])

  useEffect(() => {
    if (!open) return
    setCardsLoaded(false)
    loadCards()
    // Load existing investments for INVESTMENT sub-type
    financeApi.getInvestments().then(r => setExistingInvestments(r.data)).catch(() => {})
    setSelectedInvestmentId(undefined)
    setInvestmentMode('existing')
    // Load active borrowed loans for LOAN_REPAYMENT
    financeApi.getLoansTaken()
      .then(r => setActiveLoans(r.data.filter(l => l.status !== 'PAID')))
      .catch(() => {})
    setSelectedLoanId(undefined)
    // Load active lent loans for LOAN_RETURNED_TO_ME
    financeApi.getLoansGiven()
      .then(r => {
        setActiveLoansGiven(r.data.filter(l => l.status !== 'PAID'))
        setAllLoansGiven(r.data)
      })
      .catch(() => {})
    setSelectedLoanGivenId(undefined)
    if (transaction) {
      // Parse description back into route + user note when the picked category
      // is TRANSPORT-kind. Format: "From >>> To\n<user note>"
      const parsed = parseRoute(
        transaction.description,
        transaction.category?.kind === 'TRANSPORT',
      )
      const f: TransactionRequest = {
        type: transaction.type, amount: transaction.amount,
        // Currency follows the global selector — no per-tx override anymore.
        currency: defaultCurrency,
        categoryId: transaction.category?.id, cardId: transaction.card?.id,
        description: parsed.note,
        transactionDate: transaction.transactionDate,
        note: transaction.note ?? '',
        subType: transaction.subType ?? (transaction.type === 'INCOME' ? 'REGULAR_INCOME' : 'REGULAR_EXPENSE'),
        cashAmount: transaction.cashAmount ?? 0,
        fromLocation: parsed.from ?? transaction.fromLocation ?? undefined,
        toLocation: parsed.to ?? transaction.toLocation ?? undefined,
        // A top-up is only a top-up while it still names the record it topped up. Posting these
        // back as undefined makes the backend read the edit as "moved to a different fund /
        // borrower": it reverses the contribution out of the original and opens a duplicate.
        investmentId: transaction.investmentId ?? undefined,
        loanGivenId: linkedLoanGivenId(transaction),
      }
      setForm(f)
      const cat = transaction.category
      const rootId = cat?.parentId ?? cat?.id
      setSelectedRootId(rootId)
      loadRoots(transaction.type === 'INCOME' ? 'INCOME' : 'EXPENSE', f.subType)
      if (rootId) loadSubs(rootId)
      // Everything about an existing row is already filled in; hiding half of it behind a
      // disclosure would mean the edit form silently omits what the user came to change.
      setMoreOpen(true)
    } else {
      // New transaction — optionally pre-target a card (per-card quick-add on the Cards page).
      const type = presetType ?? 'EXPENSE'
      const subType = type === 'INCOME' ? 'REGULAR_INCOME' : 'REGULAR_EXPENSE'
      setForm({ ...defaultForm(defaultCurrency), type, subType, cardId: preselectCardId })
      setSelectedRootId(undefined); setSubCategories([])
      loadRoots(type, subType)
      // "+ Add income" / "+ Add expense" know what they are; the bare "+ Add other" button
      // exists precisely to reach the special types, so it opens expanded.
      setMoreOpen(!presetType)
    }
    setError(null); setIsBalanceError(false); setValidationError(null); setInvalidField(null)
    setShowNewCat(false); setShowNewSubCat(false); setSuggestions([])
    // The picker mirrors form.investmentId, so an edited contribution reopens on the fund it
    // was booked against instead of on an empty "Select an investment".
    setSelectedInvestmentId(transaction?.investmentId ?? undefined)
    setInvestmentMode('existing')
    counterpartySeeded.current = false
    setTouched(false)
    setAutoPickedRootId(undefined); setCategoryUnlocked(false); setCategoryCleared(null)
    setAmountKeptOnSwitch(false)
    // Initialize payment mode from the transaction being edited, else default to Card-only —
    // which the effect below downgrades to Cash if the wallet turns out to be empty.
    // A transaction with cardId=null represents pure cash (tracked via CashBalance).
    // Legacy: a transaction linked to an old CASH-type card also represents cash —
    // detected and surfaced as CASH mode so the round-trip stays honest.
    if (transaction) {
      const cash = transaction.cashAmount ?? 0
      const cardPortion = (transaction.amount ?? 0) - cash
      const legacyCashWalletAttached = transaction.card?.type === 'CASH'
      const isCashless = !transaction.card
      if (cash > 0 && cardPortion > 0) {
        setPaymentMode('BOTH')
        setCashInput(cash); setCardInput(cardPortion)
      } else if (cash > 0 && cardPortion === 0) {
        setPaymentMode('CASH'); setCashInput(cash); setCardInput(0)
      } else if (legacyCashWalletAttached || isCashless) {
        setPaymentMode('CASH'); setCashInput(transaction.amount ?? 0); setCardInput(0)
      } else {
        setPaymentMode('CARD'); setCashInput(0); setCardInput(transaction.amount ?? 0)
      }
    } else {
      setPaymentMode('CARD'); setCashInput(0); setCardInput(0)
    }
    setBankOptions([]); setShowBankPopover(false); setShowBorrowerPopover(false)
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current) }
  }, [open, transaction, defaultCurrency, preselectCardId, presetType, loadCards, loadRoots, loadSubs])

  // With no card there is nothing "Card only" can point at, and the message that would explain
  // it is a native validation bubble the user never sees. Gated on `cardsLoaded` so an empty
  // list mid-flight cannot flip the mode, on `!cardsFailed` so a fetch that failed is not read
  // as an empty wallet, and on `!transaction` so editing a card transaction is never silently
  // rewritten to cash.
  useEffect(() => {
    if (!open || transaction || !cardsLoaded || cardsFailed) return
    if (usableCards.length === 0) setPaymentMode('CASH')
  }, [open, transaction, cardsLoaded, cardsFailed, usableCards.length])

  // The atomic repayment endpoints book the whole amount to one source, so fold a split back
  // into a single figure rather than letting the user type one that will be thrown away.
  useEffect(() => {
    if (!atomicLoanPath || paymentMode !== 'BOTH') return
    const total = (cashInput || 0) + (cardInput || 0)
    if (usableCards.length === 0) { setPaymentMode('CASH'); setCashInput(total); setCardInput(0) }
    else { setPaymentMode('CARD'); setCardInput(total); setCashInput(0) }
  }, [atomicLoanPath, paymentMode, usableCards.length, cashInput, cardInput])

  // Load bank suggestions for BANK_LOAN_PAYMENT sub-type.
  useEffect(() => {
    if (!open || form.subType !== 'BANK_LOAN_PAYMENT') { setBankOptions([]); return }
    financeApi.getBankNameSuggestions('')
      .then(r => setBankOptions(r.data))
      .catch(() => {})
  }, [open, form.subType])

  // Current cash balance for the active currency.
  useEffect(() => {
    if (!open) { setCashBalance(null); return }
    cashBalancesApi.getAll()
      .then(r => {
        const match = r.data.find(b => b.currency === defaultCurrency)
        setCashBalance(match ? match.currentBalance : null)
      })
      .catch(() => setCashBalance(null))
  }, [open, defaultCurrency])

  // A counterparty name is only ever used to name the finance record a transaction creates, so
  // it is not stored on the transaction and an edit reopens with the field empty — while the
  // form still demands it. Retyping it is what breaks a top-up: the borrower input drops
  // `loanGivenId` the moment the text stops matching the linked borrower, so by the time the
  // name is typed out again the link is gone and the save opens a duplicate record. Fill it
  // from the linked record instead, once, and without marking the form dirty — the user did
  // not type this, so it must not turn a Cancel into a "discard changes?" prompt.
  useEffect(() => {
    if (!open || !transaction || counterpartySeeded.current) return
    const sub = transaction.subType
    const name = sub === 'LOAN_GIVEN'
      ? allLoansGiven.find(l => l.id === linkedLoanGivenId(transaction))?.debtorName
      : sub === 'INVESTMENT'
        ? existingInvestments.find(i => i.id === transaction.investmentId)?.name
        : undefined
    if (!name) return
    counterpartySeeded.current = true
    setForm(prev => (prev.counterpartyName ? prev : { ...prev, counterpartyName: name }))
  }, [open, transaction, allLoansGiven, existingInvestments])

  /**
   * Give focus back to the input a suggestion list belongs to. Closing the list unmounts the
   * option the keyboard user activated it from, and focus would otherwise fall to <body> — the
   * next Tab then restarts at the top of the dialog.
   */
  const returnFocus = (el: HTMLInputElement | null) => {
    restoringFocus.current = true
    el?.focus()
    restoringFocus.current = false
  }

  const set = <K extends keyof TransactionRequest>(key: K, value: TransactionRequest[K]) => {
    setTouched(true)
    setForm(prev => ({ ...prev, [key]: value }))
  }

  /** Point the message at its own control, and open the disclosure if that is where it lives. */
  const fail = (field: ErrorField, message: string) => {
    setInvalidField(field)
    setValidationError(message)
    if (HIDDEN_BEHIND_MORE.has(field)) setMoreOpen(true)
  }
  const fieldError = (field: ErrorField) => (invalidField === field ? validationError ?? undefined : undefined)

  const switchType = (t: TransactionType) => {
    // Pressing the direction that is already on used to clear the category, the sub-type and the
    // Loan/Investment link all the same. That was survivable while this control was buried in
    // More options; as the form's first control it takes initial focus, so one stray Space would
    // empty a form the user had already filled in.
    if (t === form.type) return
    const st: TransactionSubType = t === 'INCOME' ? 'REGULAR_INCOME' : 'REGULAR_EXPENSE'
    setTouched(true)
    setForm(prev => ({ ...prev, type: t, subType: st, categoryId: undefined, investmentId: undefined, loanGivenId: undefined,
      // Reset kind-specific extras on type switch so stale FOOD/TRANSPORT data doesn't leak.
      fromLocation: undefined, toLocation: undefined, currency: defaultCurrency,
      // The amount itself survives the switch, so the cash half of it has to survive too:
      // zeroing it here left a cash transaction posting cashAmount 0 with no card attached,
      // and the effect that owns this field only re-runs when the payment method changes.
      cashAmount: paymentMode === 'CASH' ? prev.amount : paymentMode === 'BOTH' ? (cashInput || 0) : 0 }))
    // The categories a type offers are not the categories the other type offers, so the pick has
    // to go — but silently dropping it is what makes it feel like a bug. Say so instead.
    setCategoryCleared(selectedRootId ? 'direction' : null)
    setAmountKeptOnSwitch((form.amount || 0) > 0)
    setSelectedRootId(undefined); setSubCategories([])
    setAutoPickedRootId(undefined); setCategoryUnlocked(false)
    setShowNewCat(false); setShowNewSubCat(false)
    setSelectedInvestmentId(undefined); setInvestmentMode('existing')
    loadRoots(t === 'INCOME' ? 'INCOME' : 'EXPENSE', st)
    setNewCat(p => ({ ...p, type: t === 'INCOME' ? 'INCOME' : 'EXPENSE' }))
    // Direction first, amount next: with nothing typed yet, hand the caret straight to the field
    // the user was heading for. Once a figure exists, the control that needs attention is the
    // category this switch just cleared, so focus stays put rather than landing on a field that
    // is already right. Never in BOTH mode, where the total is derived and the input read-only.
    if (!transaction && paymentMode !== 'BOTH' && (form.amount || 0) === 0) amountRef.current?.focus()
  }

  const switchSubType = (st: TransactionSubType) => {
    setTouched(true)
    setForm(prev => ({ ...prev, subType: st, categoryId: undefined, investmentId: undefined, loanGivenId: undefined }))
    setCategoryCleared(selectedRootId ? 'subType' : null)
    // A sub-type change is a different question from a direction change; leaving the direction
    // note up would attach it to the wrong action.
    setAmountKeptOnSwitch(false)
    setSelectedRootId(undefined); setSubCategories([])
    setAutoPickedRootId(undefined); setCategoryUnlocked(false)
    setShowNewCat(false); setShowNewSubCat(false)
    setSelectedInvestmentId(undefined); setInvestmentMode('existing')
    loadRoots(form.type === 'INCOME' ? 'INCOME' : 'EXPENSE', st)
  }

  const selectRoot = (id: number | undefined) => {
    setTouched(true)
    setSelectedRootId(id); setSubCategories([])
    setForm(prev => ({ ...prev, categoryId: id }))
    setCategoryCleared(null)
    setShowNewSubCat(false)
    if (id) loadSubs(id)
  }

  const handleDescriptionChange = (value: string) => {
    set('description', value)
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (value.length < 2) { setSuggestions([]); return }
    suggestTimer.current = setTimeout(async () => {
      // Scope suggestions to the selected (sub-)category so recommendations
      // are per-sub-category, not per-parent.
      const res = await transactionsApi.getSuggestions(value, form.categoryId).catch(() => null)
      if (res) { setSuggestions(res.data.filter(s => s !== value)); setShowSuggestions(true) }
    }, 250)
  }

  // Create new ROOT category
  const handleCreateCategory = async () => {
    if (!newCat.name.trim()) return
    setCreatingCat(true); setNewCatError(null)
    try {
      const res = await categoriesApi.create({ ...newCat, applicableSubType: form.subType })
      const created = res.data
      setRootCategories(prev => [...prev, created])
      selectRoot(created.id)
      setShowNewCat(false)
      setNewCat({ name: '', type: form.type === 'INCOME' ? 'INCOME' : 'EXPENSE', color: '#6366f1' })
    } catch (err: unknown) {
      setNewCatError(extractErrorMessage(err))
    } finally { setCreatingCat(false) }
  }

  // Create new SUB-CATEGORY under the selected root
  const handleCreateSubCategory = async () => {
    if (!newSubCat.name.trim() || !selectedRootId) return
    setCreatingSubCat(true); setNewSubCatError(null)
    try {
      const res = await categoriesApi.create({
        ...newSubCat,
        parentId: selectedRootId,
        applicableSubType: form.subType,
        type: form.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
      })
      const created = res.data
      setSubCategories(prev => [...prev, created])
      set('categoryId', created.id)
      setShowNewSubCat(false)
      setNewSubCat({ name: '', type: form.type === 'INCOME' ? 'INCOME' : 'EXPENSE', color: '#6366f1' })
    } catch (err: unknown) {
      setNewSubCatError(extractErrorMessage(err))
    } finally { setCreatingSubCat(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // The form is noValidate: the browser's bubble is untranslated, and it fires on controls the
    // disclosure may have unmounted. Everything `required` below is checked here instead.
    if (!selectedRootId) {
      fail('category', translate('cmp.txModal.err.selectCategory'))
      return
    }
    // Sub-category mandatory when available
    if (subCategories.length > 0 && form.categoryId === selectedRootId) {
      fail('subCategory', translate('cmp.txModal.err.selectSubCategory'))
      return
    }
    // Investment validation
    if (form.subType === 'INVESTMENT' && investmentMode === 'existing' && !selectedInvestmentId && existingInvestments.length > 0) {
      fail('investment', translate('cmp.txModal.err.selectInvestment'))
      return
    }
    // Payment mode-driven validation
    if (paymentMode === 'CARD' && !form.cardId) {
      fail('card', translate('cmp.txModal.err.selectCardOrSwitch')); return
    }
    if (paymentMode === 'BOTH') {
      if (!form.cardId) { fail('card', translate('cmp.err.pickCardForPortion')); return }
      if ((cashInput || 0) <= 0 || (cardInput || 0) <= 0) {
        fail('split', translate('cmp.txModal.err.enterBothAmounts')); return
      }
    }
    if ((form.amount || 0) <= 0) {
      fail('amount', translate('cmp.err.amountPositive')); return
    }
    // Was covered by the browser's own `required` until this form went noValidate; the date can
    // still be cleared by hand, and an empty one would post a transaction with no month.
    if (!form.transactionDate) {
      fail('date', translate('cmp.txModal.err.selectDate')); return
    }

    // Description requirement honours the selected category's flag.
    // (FOOD's "place" semantics now flow through the description label mechanism.)
    if (descriptionRequired && !(form.description && form.description.trim())) {
      fail('description', translate('cmp.txModal.err.fillInField', { field: descriptionLabel.toLowerCase() })); return
    }

    // Counterparty rules — skip when the donation is anonymous (auto-filled below).
    if (form.subType && NEEDS_COUNTERPARTY.has(form.subType)
        && !isAnonymousDonation
        && !(['LOAN_REPAYMENT','LOAN_RETURNED_TO_ME'] as TransactionSubType[]).includes(form.subType)
        && !(form.counterpartyName && form.counterpartyName.trim())) {
      fail('counterparty', translate('cmp.txModal.err.fieldRequired', { field: COUNTERPARTY_LABEL[form.subType] ?? translate('cmp.txModal.counterparty.generic') })); return
    }

    setValidationError(null); setInvalidField(null)
    setSaving(true); setError(null); setIsBalanceError(false)
    try {
      // LOAN_REPAYMENT with a specific loan → atomic repay (expense + loan update)
      if (form.subType === 'LOAN_REPAYMENT' && selectedLoanId && !transaction) {
        const loan = activeLoans.find(l => l.id === selectedLoanId)
        if (loan && form.amount > loan.remainingAmount) {
          setError(translate('cmp.txModal.err.cannotExceedRemainingBalance', { amount: moneyFull(loan.remainingAmount, loan.currency as Currency) }))
          setSaving(false); return
        }
        await financeApi.repayLoanTaken(selectedLoanId, {
          amount: form.amount, paymentDate: form.transactionDate,
          cardId: form.cardId, categoryId: form.categoryId,
        })
      // LOAN_RETURNED_TO_ME with a specific lent loan → atomic mark-returned (income + loan update)
      } else if (form.subType === 'LOAN_RETURNED_TO_ME' && selectedLoanGivenId && !transaction) {
        const loan = activeLoansGiven.find(l => l.id === selectedLoanGivenId)
        if (loan && form.amount > loan.pendingAmount) {
          setError(translate('cmp.txModal.err.cannotExceedPendingAmount', { amount: moneyFull(loan.pendingAmount, loan.currency as Currency) }))
          setSaving(false); return
        }
        await financeApi.markLoanGivenReturned(selectedLoanGivenId, {
          amount: form.amount, paymentDate: form.transactionDate,
          cardId: form.cardId, categoryId: form.categoryId,
        })
      } else {
        // For TRANSPORT-kind categories, compose from/to into the description field.
        // No more separate from_location/to_location columns from the UI's POV.
        const composedDescription = showRouteFields
          ? composeRoute(form.fromLocation, form.toLocation, form.description)
          : (form.description ?? '')
        // Effective payload — auto-fill anonymous donor name so backend never sees blank.
        // For BOTH mode the useEffect already populated form.amount = cash+card and
        // form.cashAmount = cashInput, so we save a single row.
        const payload: TransactionRequest = {
          ...form,
          currency: defaultCurrency,
          description: composedDescription,
          counterpartyName: isAnonymousDonation ? 'Anonymous' : form.counterpartyName,
          // Payment-start only applies to a NEW Loan Received (drives when the borrowed
          // money starts counting toward the tier). On edit we leave it untouched so the
          // backend keeps the stored month; edit it from Finance → Loan Borrowed.
          paymentStartDate: form.subType === 'LOAN_RECEIVED' && !transaction
            ? (form.paymentStartDate || `${nextMonthStr()}-01`)
            : undefined,
          loanGivenId: form.subType === 'LOAN_GIVEN' ? form.loanGivenId : undefined,
          // Legacy structured columns no longer populated from the modal.
          place: undefined,
          fromLocation: undefined,
          toLocation: undefined,
        }
        if (transaction) {
          await transactionsApi.update(transaction.id, payload)
        } else {
          await transactionsApi.create(payload)
        }
      }
      // The raw onClose, not the guard: the work is saved, so there is nothing left to discard.
      onSaved(); onClose()
      showSuccess(transaction ? translate('tx.updated') : translate('tx.saved'))
      // Post-save summary: re-ask the server where the bucket now stands. Sent with
      // amount 0 because the transaction is already recorded — passing the amount again
      // would count it twice.
      if (!transaction && form.subType) {
        overviewApi.previewAllocation(
          {
            subType: form.subType,
            amount: 0,
            transactionDate: form.transactionDate,
            investmentId: form.subType === 'INVESTMENT' && investmentMode === 'existing'
              ? selectedInvestmentId : undefined,
          },
          form.currency,
        )
          .then(r => {
            const p = r.data
            if (!p.applicable || !p.label) return
            showSuccess(p.bucketNotRecommended
              ? translate('cmp.txModal.recordedUnder', { label: p.label })
              : translate('cmp.txModal.progressSummary', {
                  label: p.label,
                  before: moneyFull(Number(p.paidBefore ?? 0), form.currency),
                  recommended: moneyFull(Number(p.recommended ?? 0), form.currency),
                }) + (Number(p.remainingAfter ?? 0) > 0
                    ? translate('cmp.txModal.progressRemaining', { amount: moneyFull(Number(p.remainingAfter), form.currency) })
                    : translate('cmp.txModal.progressFullyCovered')))
          })
          .catch(() => { /* summary is a nicety; never surface its failure */ })
      }
    } catch (err: unknown) {
      const msg = extractErrorMessage(err)
      setError(msg)
      setIsBalanceError(msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance'))
    } finally { setSaving(false) }
  }

  const isDirty = touched && !saving

  /** Shared by Cancel and by the "add a card" escape hatch — both leave the form behind. */
  const confirmDiscard = async () => {
    if (!isDirty) return true
    return confirm({
      title: translate('ui.discard.title'),
      message: translate('ui.discard.body'),
      confirmLabel: translate('ui.discard.confirm'),
      cancelLabel: translate('ui.discard.cancel'),
      destructive: true,
    })
  }

  const handleCancel = async () => {
    if (await confirmDiscard()) onClose()
  }

  const goToWallets = async () => {
    if (!(await confirmDiscard())) return
    onClose()
    navigate('/cards')
  }

  const subTypes = form.type === 'INCOME' ? INCOME_SUB_TYPES : EXPENSE_SUB_TYPES
  const selectedCard = cards.find(c => c.id === form.cardId)
  const hasSubs = subCategories.length > 0
  // selected sub-category value for the select
  const subCatValue = (form.categoryId && form.categoryId !== selectedRootId) ? form.categoryId : ''

  // Derive the selected root category's kind so kind-specific fields appear/disappear.
  // FOOD no longer needs a special field — it relies on a category's descriptionLabel.
  const selectedRoot = rootCategories.find(c => c.id === selectedRootId)
  const selectedRootKind = selectedRoot?.kind ?? 'GENERIC'
  const showRouteFields = selectedRootKind === 'TRANSPORT'

  // The most-specific selected category — sub-category if picked, else root.
  const activeCategory: Category | undefined =
    (form.categoryId && form.categoryId !== selectedRootId
      ? subCategories.find(c => c.id === form.categoryId)
      : undefined)
    ?? selectedRoot

  // Description label / requiredness flow from the most-specific selected category. The default
  // is now OPTIONAL: the column is null on every seeded category, the wire contract has no
  // @NotBlank, and the backend already synthesises "Parent — Category" when it is blank — so
  // `?? true` was making the user type a sentence the server was about to overwrite anyway.
  const descriptionLabel = activeCategory?.descriptionLabel || translate('tx.description')
  const descriptionRequired = activeCategory?.descriptionRequired ?? false

  // What the server will write when Description is left blank — shown so the default is a
  // choice rather than a surprise. TRANSPORT composes its own line from From/To instead.
  const derivedDescription = !activeCategory || showRouteFields
    ? ''
    : selectedRoot && activeCategory.id !== selectedRoot.id
      ? `${categoryName(selectedRoot)} — ${categoryName(activeCategory)}`
      : categoryName(activeCategory)

  // Donation anonymity — the selected sub-category (or its parent) declares it.
  const isAnonymousDonation =
    form.subType === 'DONATION' &&
    (Boolean(activeCategory?.anonymizes) ||
      (activeCategory?.parentId != null && Boolean(selectedRoot?.anonymizes)))

  // Total when the user types separate cash + card amounts under "Both".
  const splitTotal = (cashInput || 0) + (cardInput || 0)

  const isSpecialSubType = !!form.subType
    && form.subType !== 'REGULAR_INCOME' && form.subType !== 'REGULAR_EXPENSE'
  // A special type needs its counterparty, its picker and its notice; BOTH needs its two split
  // inputs; an opted-in category needs its Description. All of those are `required`, so the
  // panel is pinned open rather than hiding a control the user cannot satisfy.
  const moreForced = !!transaction || isSpecialSubType || paymentMode === 'BOTH' || descriptionRequired
  const showMore = moreOpen || moreForced

  const paymentModeLabel = paymentMode === 'CARD'
    ? translate('cmp.txModal.cardOnly')
    : paymentMode === 'CASH' ? translate('cmp.txModal.cashOnly') : translate('tx.both')
  // What is folded away, and only that: the direction moved to the top of the form, where it is
  // on screen whether this panel is open or shut, so repeating it here would spend the one line
  // of summary on the one thing the user can already see.
  const collapsedSummary = [
    subTypes.find(s => s.value === form.subType)?.label,
    paymentModeLabel,
  ].filter(Boolean).join(' · ')

  // The category the sub-type chose on the user's behalf. Locked so the two facts stay one fact,
  // with a way out — a Donation may legitimately be filed under a custom child category.
  const categoryLocked = isSpecialSubType && !!selectedRootId
    && selectedRootId === autoPickedRootId && !categoryUnlocked && !showNewCat
  const lockedRoot = categoryLocked ? selectedRoot : undefined

  const cardOptions = usableCards.map(c => (
    <option key={c.id} value={c.id}>
      {c.name} •••• {c.lastFourDigits} · {moneyFull(c.currentBalance ?? 0, c.currency)}
    </option>
  ))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={transaction ? translate('tx.editTransaction') : translate('tx.newTransaction')}
      dirty={isDirty}
      // The direction decides which categories exist and what the amount means, so it is both
      // the first control and the one focus lands on.
      initialFocusRef={directionRef}
      footer={
        <div className="flex gap-3">
          <Button label={translate('action.cancel')} onClick={handleCancel} className="flex-1" />
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            loading={saving}
            className="flex-1"
            label={saving
              ? translate('action.saving')
              : transaction ? translate('action.update') : translate('action.create')}
          />
        </div>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">

        {/* 1. Money in or out. First, and focused on open: it decides which categories are
            offered and what the figure below it means, so typing an amount before choosing is
            typing into a field whose meaning has not been settled yet. */}
        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">{translate('cmp.txModal.label.direction')}</p>
          <div className={SEGMENT_TRACK} role="group" aria-label={translate('cmp.txModal.label.direction')}>
            {(['INCOME', 'EXPENSE'] as TransactionType[]).map(t => (
              <button
                key={t}
                type="button"
                // The ref follows the selected option, so the sheet opens on the choice in force
                // rather than always on Income.
                ref={form.type === t ? directionRef : undefined}
                onClick={() => switchType(t)}
                aria-pressed={form.type === t}
                className={`${DIRECTION_OPTION} ${
                  form.type === t
                    ? t === 'INCOME' ? 'bg-income text-white' : 'bg-expense text-white'
                    : 'text-slate-600 hover:text-slate-900'}`}>
                {t === 'INCOME'
                  ? <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  : <ArrowDownRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {t === 'INCOME' ? translate('tx.income') : translate('tx.expense')}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Amount — the thing the user came here to type. One instance, mounted for the life
            of the form, so switching payment method never loses a half-typed figure. */}
        <Field
          id="tx-amount"
          label={translate('cmp.txModal.label.amount')}
          required
          error={fieldError('amount')}
        >
          <AmountInput
            ref={amountRef}
            required
            value={form.amount || 0}
            currency={defaultCurrency}
            // In BOTH mode this is the sum of the two split fields. readOnly rather than
            // disabled so it stays focusable — and so its onChange cannot fight the effect
            // that recomputes the total.
            readOnly={paymentMode === 'BOTH'}
            onChange={v => {
              set('amount', v)
              // The user is typing the figure now, so the note about the one carried over from
              // before the switch has nothing left to reassure them about.
              setAmountKeptOnSwitch(false)
              if (paymentMode === 'CARD') setCardInput(v)
              else if (paymentMode === 'CASH') setCashInput(v)
            }}
            // One colour class, not two: Tailwind emits text-slate-900 after text-slate-600, so
            // stacking them would silently keep the darker ink in the derived state.
            className={`w-full rounded-control border bg-white py-3 pl-3 pr-20 text-stat tabular-nums focus-ring ${
              fieldError('amount') || isBalanceError ? 'border-expense' : 'border-slate-200'
            } ${paymentMode === 'BOTH' ? 'text-slate-600' : 'text-slate-900'}`}
            placeholder="0"
            suffix={defaultCurrency}
            suffixClassName="text-sm"
          />
        </Field>
        {paymentMode === 'BOTH' && (
          <p className="-mt-2 text-xs text-slate-500">{translate('cmp.txModal.totalFromSplit')}</p>
        )}
        {amountKeptOnSwitch && (
          <p className="-mt-2 text-xs text-slate-500">{translate('cmp.txModal.amountKeptOnSwitch')}</p>
        )}

        {/* 3. What this draft transaction would do to the monthly allocation (create mode only —
            editing an existing row would double-count it against what is already recorded). */}
        {!transaction && (
          <AllocationPreviewPanel
            subType={form.subType}
            amount={form.amount || 0}
            transactionDate={form.transactionDate}
            investmentId={form.subType === 'INVESTMENT' && investmentMode === 'existing'
              ? selectedInvestmentId : undefined}
            currency={form.currency}
          />
        )}

        {/* 4. Category + Sub-category — same row once a root is picked. */}
        <div>
          {showNewCat && (
            <>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="tx-new-category" className="text-xs font-medium text-slate-600">
                  {translate('cmp.txModal.newCategory')}
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<X className="h-3.5 w-3.5" />}
                  label={translate('action.cancel')}
                  onClick={() => { setShowNewCat(false); setNewCatError(null) }}
                />
              </div>
              <div className="space-y-2 rounded-control border border-slate-200 p-3">
                <input id="tx-new-category" value={newCat.name}
                  onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                  className={CONTROL}
                  placeholder={translate('cmp.txModal.categoryNamePlaceholder')} autoFocus />
                <div className="flex items-center gap-2">
                  {/* The dot stays 24px; the button around it is a 44px touch target. Growing
                      the dot itself would turn twelve swatches into a wall of colour. */}
                  <div className="flex flex-1 flex-wrap">
                    {COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setNewCat(p => ({ ...p, color: c }))}
                        aria-label={c}
                        title={c}
                        aria-pressed={newCat.color === c}
                        className="focus-ring group flex h-11 w-11 cursor-pointer items-center justify-center rounded-control">
                        <span aria-hidden="true"
                          className={`h-6 w-6 rounded-full transition-transform ${
                            newCat.color === c ? 'scale-110 ring-2 ring-slate-400 ring-offset-1' : 'group-hover:scale-110'}`}
                          style={{ backgroundColor: c }} />
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    loading={creatingCat}
                    disabled={!newCat.name.trim()}
                    onClick={handleCreateCategory}
                    label={translate('action.create')}
                  />
                </div>
                {newCatError && (
                  <p role="alert" className="text-sm text-expense">{newCatError}</p>
                )}
              </div>
            </>
          )}

          {!showNewCat && (
            <div className={`grid gap-2 ${selectedRootId ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* Category column */}
              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-2">
                  {/* A <label> only while the select it names exists; the locked state has a chip
                      instead of a control, and htmlFor pointing at nothing is worse than a span. */}
                  {lockedRoot ? (
                    <span className="text-xs font-medium text-slate-600">
                      {translate('cmp.txModal.label.category')}
                      <span aria-hidden="true" className="text-expense"> *</span>
                    </span>
                  ) : (
                    <label htmlFor="tx-category" className="text-xs font-medium text-slate-600">
                      {translate('cmp.txModal.label.category')}
                      <span aria-hidden="true" className="text-expense"> *</span>
                    </label>
                  )}
                  {!categoryLocked && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      label={translate('cmp.txModal.new')}
                      onClick={() => { setShowNewCat(true); setNewCatError(null) }}
                    />
                  )}
                </div>

                {lockedRoot ? (
                  <>
                    <div className="flex h-11 items-center justify-between gap-2 rounded-control border border-slate-200 pl-3 pr-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: lockedRoot.color }} />
                        <span className="truncate text-sm text-slate-900">{categoryName(lockedRoot)}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        label={translate('cmp.txModal.change')}
                        onClick={() => setCategoryUnlocked(true)}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {translate('cmp.txModal.categorySwitchedForType', { name: categoryName(lockedRoot) })}
                    </p>
                  </>
                ) : (
                  <>
                    <select
                      id="tx-category"
                      aria-required="true"
                      aria-invalid={fieldError('category') ? true : undefined}
                      value={selectedRootId ?? ''}
                      onChange={e => selectRoot(e.target.value ? Number(e.target.value) : undefined)}
                      className={fieldError('category') ? CONTROL_INVALID : CONTROL}>
                      <option value="">{translate('cmp.txModal.selectCategory')}</option>
                      {rootCategories.map(c => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}
                    </select>
                    {fieldError('category') && (
                      <p role="alert" className="mt-1 text-xs text-expense">{fieldError('category')}</p>
                    )}
                    {!fieldError('category') && categoryCleared && !selectedRootId && (
                      <p className="mt-1 text-xs text-slate-500">
                        {translate(categoryCleared === 'direction'
                          ? 'cmp.txModal.categoryClearedByDirection'
                          : 'cmp.txModal.categoryClearedByType')}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Sub-category column — visible as soon as a root is selected. */}
              {selectedRootId && (
                <div className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    {/* Bound only when the sub-category select is the control on show — the
                        inline creator and the dashed "add" button are not it. */}
                    {hasSubs && !showNewSubCat ? (
                      <label htmlFor="tx-subcategory" className="flex items-center gap-1 text-xs font-medium text-slate-600">
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        {translate('cmp.txModal.label.subCategory')}
                        <span aria-hidden="true" className="text-expense">*</span>
                      </label>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        {translate('cmp.txModal.label.subCategory')}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={showNewSubCat ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      iconOnly={showNewSubCat}
                      label={showNewSubCat ? translate('action.cancel') : translate('cmp.txModal.new')}
                      onClick={() => { setShowNewSubCat(v => !v); setNewSubCatError(null) }}
                    />
                  </div>

                  {showNewSubCat ? (
                    /* Inline sub-category creation — also captures custom description label/required. */
                    <div className="space-y-2 rounded-control border border-slate-200 p-2.5">
                      <input value={newSubCat.name} onChange={e => setNewSubCat(p => ({ ...p, name: e.target.value }))}
                        className={CONTROL}
                        aria-label={translate('cmp.txModal.subCategoryNamePlaceholder')}
                        placeholder={translate('cmp.txModal.subCategoryNamePlaceholder')} autoFocus />
                      <input value={newSubCat.descriptionLabel ?? ''}
                        onChange={e => setNewSubCat(p => ({ ...p, descriptionLabel: e.target.value || undefined }))}
                        className={CONTROL}
                        aria-label={translate('cmp.txModal.descriptionLabelPlaceholder')}
                        placeholder={translate('cmp.txModal.descriptionLabelPlaceholder')} />
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox"
                          checked={newSubCat.descriptionRequired ?? true}
                          onChange={e => setNewSubCat(p => ({ ...p, descriptionRequired: e.target.checked }))}
                          className="focus-ring h-4 w-4 rounded text-indigo-600" />
                        {translate('cmp.txModal.descriptionRequiredLabel')}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {/* 20px dots 4px apart were unhittable on a phone — same 44px target as
                            the root-category picker above, dot size unchanged. */}
                        <div className="flex flex-1 flex-wrap">
                          {COLORS.map(c => (
                            <button key={c} type="button" onClick={() => setNewSubCat(p => ({ ...p, color: c }))}
                              aria-label={c}
                              title={c}
                              aria-pressed={newSubCat.color === c}
                              className="focus-ring group flex h-11 w-11 cursor-pointer items-center justify-center rounded-control">
                              <span aria-hidden="true"
                                className={`h-5 w-5 rounded-full transition-transform ${
                                  newSubCat.color === c ? 'scale-110 ring-2 ring-slate-400 ring-offset-1' : 'group-hover:scale-110'}`}
                                style={{ backgroundColor: c }} />
                            </button>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<Plus className="h-3.5 w-3.5" />}
                          loading={creatingSubCat}
                          disabled={!newSubCat.name.trim()}
                          onClick={handleCreateSubCategory}
                          label={translate('action.add')}
                        />
                      </div>
                      {newSubCatError && (
                        <p role="alert" className="text-sm text-expense">{newSubCatError}</p>
                      )}
                    </div>
                  ) : hasSubs ? (
                    <>
                      <select
                        id="tx-subcategory"
                        aria-required="true"
                        aria-invalid={fieldError('subCategory') ? true : undefined}
                        value={subCatValue}
                        onChange={e => set('categoryId', e.target.value ? Number(e.target.value) : selectedRootId)}
                        className={fieldError('subCategory') ? CONTROL_INVALID : CONTROL}>
                        <option value="">{translate('cmp.txModal.selectSubCategory')}</option>
                        {subCategories.map(c => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}
                      </select>
                      {fieldError('subCategory') && (
                        <p role="alert" className="mt-1 text-xs text-expense">{fieldError('subCategory')}</p>
                      )}
                    </>
                  ) : (
                    <button type="button" onClick={() => { setShowNewSubCat(true); setNewSubCatError(null) }}
                      className="focus-ring h-11 w-full cursor-pointer rounded-control border border-dashed border-slate-300 px-3 text-sm text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600">
                      + {translate('cmp.txModal.addSubCategory')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. Where the money moves. The payment METHOD lives in More options; this field always
            names the actual source, so the quick path never hides which wallet is hit. */}
        {paymentMode === 'CASH' ? (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">{translate('cmp.txModal.label.card')}</p>
            <div className="flex h-11 items-center justify-between gap-2 rounded-control border border-slate-200 pl-3 pr-1">
              <span className="flex min-w-0 items-center gap-2 text-sm text-slate-900">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-chip bg-slate-100 text-slate-600">
                  <Wallet className="h-3.5 w-3.5" />
                </span>
                {translate('cmp.txModal.paidWithCash')}
              </span>
              <Button
                size="sm"
                variant="ghost"
                label={translate('cmp.txModal.change')}
                onClick={() => setMoreOpen(true)}
              />
            </div>
            {cashBalance !== null && (
              <p className="mt-1 text-xs tabular-nums text-slate-500">
                {translate('cmp.txModal.cashBalanceCaption', { amount: moneyFull(cashBalance, defaultCurrency) })}
              </p>
            )}
            {noUsableCards && (
              <p className="mt-1 text-xs text-slate-500">{translate('cmp.txModal.noCardsCashNotice')}</p>
            )}
          </div>
        ) : cardsFailed ? (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">{translate('cmp.txModal.label.card')}</p>
            <div className="flex items-center justify-between gap-3 rounded-control border border-slate-200 px-3 py-2">
              <p className="text-xs text-slate-500">{translate('cmp.txModal.cardsLoadFailed')}</p>
              <Button
                size="sm"
                label={translate('ui.error.retry')}
                onClick={() => { setCardsLoaded(false); loadCards() }}
              />
            </div>
            {fieldError('card') && <p role="alert" className="mt-1 text-xs text-expense">{fieldError('card')}</p>}
          </div>
        ) : noUsableCards ? (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">{translate('cmp.txModal.label.card')}</p>
            <button type="button" onClick={goToWallets}
              className="focus-ring w-full cursor-pointer rounded-control border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600">
              {translate('cmp.txModal.noCardsYet')}
            </button>
            {fieldError('card') && <p role="alert" className="mt-1 text-xs text-expense">{fieldError('card')}</p>}
          </div>
        ) : (
          <Field
            id="tx-card"
            label={translate('cmp.txModal.label.card')}
            required
            error={fieldError('card')}
          >
            <select
              value={form.cardId ?? ''}
              onChange={e => set('cardId', e.target.value ? Number(e.target.value) : undefined)}
              className={fieldError('card') || isBalanceError ? CONTROL_INVALID : CONTROL}>
              <option value="">{translate('cmp.source.chooseCard')}</option>
              {cardOptions}
            </select>
          </Field>
        )}
        {selectedCard && form.type === 'EXPENSE' && paymentMode !== 'CASH' && (
          <p className="-mt-2 text-xs tabular-nums text-slate-500">
            {translate('cmp.txModal.available')} {moneyFull(selectedCard.currentBalance ?? 0, selectedCard.currency)}
          </p>
        )}

        {/* 6. Date — defaults to today on the viewer's clock, not UTC. */}
        <Field id="tx-date" label={translate('cmp.txModal.label.date')} required error={fieldError('date')}>
          <input required type="date" value={form.transactionDate}
            onChange={e => set('transactionDate', e.target.value)}
            className={fieldError('date') ? CONTROL_INVALID : CONTROL} />
        </Field>

        {/* 7. More options. Unmounted, never CSS-hidden: it holds `required` controls, and Chrome
            refuses to submit a form containing a required control it cannot focus — with no
            visible message at all. `moreForced` keeps it open whenever it holds something the
            user must fill in. */}
        {!moreForced && (
          <button
            type="button"
            onClick={() => setMoreOpen(o => !o)}
            aria-expanded={showMore}
            // Only while the panel exists: the section is unmounted when collapsed, and pointing
            // aria-controls at an id that is not in the document is worse than omitting it.
            aria-controls={showMore ? 'tx-more' : undefined}
            className="focus-ring flex w-full cursor-pointer items-center justify-between gap-2 rounded-control border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50">
            <span className="text-sm font-medium text-slate-700">{translate('cmp.txModal.moreOptions')}</span>
            <span className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
              <span className="truncate">{collapsedSummary}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${showMore ? 'rotate-180' : ''}`} />
            </span>
          </button>
        )}

        {/* Forced open, so no toggle — but the section still needs a name, or the quick path just
            runs on into six more controls with nothing marking where it ended. */}
        {moreForced && (
          <p className="pt-1 text-label uppercase text-slate-500">{translate('cmp.txModal.moreOptions')}</p>
        )}

        {showMore && (
          <div id="tx-more" className="space-y-4">

            {/* (a) Sub-type. The direction it belongs to is settled at the top of the form. */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">{translate('tx.type')}</p>
              <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={translate('tx.type')}>
                {subTypes.map(s => (
                  <button key={s.value} type="button" onClick={() => switchSubType(s.value)}
                    aria-pressed={form.subType === s.value}
                    className={`focus-ring flex cursor-pointer items-start gap-2 rounded-control border px-2.5 py-2 text-left transition-colors ${
                      form.subType === s.value ? 'border-indigo-500' : 'border-slate-200 hover:border-slate-300'}`}>
                    <span className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${
                      form.subType === s.value ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`} />
                    <span className="min-w-0">
                      <span className={`block text-xs font-semibold leading-tight ${
                        form.subType === s.value ? 'text-indigo-700' : 'text-slate-700'}`}>{s.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-slate-500">{s.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* (b) Kind-specific extras — TRANSPORT shows from/to (FOOD uses descriptionLabel). */}
            {selectedRootId && showRouteFields && (
              <div className="grid grid-cols-2 gap-3">
                <Field id="tx-from" label={translate('cmp.txModal.from')} help={translate('common.optional')}>
                  <input value={form.fromLocation ?? ''} onChange={e => set('fromLocation', e.target.value)}
                    placeholder={translate('cmp.txModal.fromPlaceholder')} className={CONTROL} />
                </Field>
                <Field id="tx-to" label={translate('cmp.txModal.to')} help={translate('common.optional')}>
                  <input value={form.toLocation ?? ''} onChange={e => set('toLocation', e.target.value)}
                    placeholder={translate('cmp.txModal.toPlaceholder')} className={CONTROL} />
                </Field>
              </div>
            )}

            {/* Counterparty / Loan selector */}
            {form.subType === 'LOAN_REPAYMENT' && !transaction ? (
              <div>
                {activeLoans.length === 0
                  ? <p className="mb-1 text-xs font-medium text-slate-600">{translate('cmp.txModal.selectLoanToRepay')}</p>
                  : <label htmlFor="tx-loan" className="mb-1 block text-xs font-medium text-slate-600">{translate('cmp.txModal.selectLoanToRepay')}</label>}
                {activeLoans.length === 0 ? (
                  <p className="rounded-control border border-dashed border-slate-300 px-3 py-3 text-center text-xs text-slate-500">
                    {translate('cmp.txModal.noActiveBorrowedLoans')} <br />{translate('cmp.txModal.addLoanFirst')}
                  </p>
                ) : (
                  <>
                    <select id="tx-loan" value={selectedLoanId ?? ''}
                      onChange={e => {
                        const id = e.target.value ? Number(e.target.value) : undefined
                        setSelectedLoanId(id)
                        const loan = activeLoans.find(l => l.id === id)
                        if (loan) {
                          set('amount', loan.remainingAmount)
                          set('currency', loan.currency as Currency)
                          set('description', translate('cmp.txModal.loanRepaymentTo', { name: loan.lenderName }))
                          set('counterpartyName', loan.lenderName)
                        }
                      }}
                      className={CONTROL}>
                      <option value="">{translate('cmp.txModal.selectLoanOrManual')}</option>
                      {activeLoans.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.lenderName} · {translate('cmp.repay.remaining')}{moneyFull(l.remainingAmount, l.currency as Currency)} · {l.status}
                        </option>
                      ))}
                    </select>
                    {selectedLoanId && (() => {
                      const loan = activeLoans.find(l => l.id === selectedLoanId)
                      return loan ? (
                        <p className="mt-1.5 text-xs text-slate-500">
                          {translate('cmp.txModal.maxPayable')}{' '}
                          <span className="font-semibold tabular-nums text-slate-900">
                            {moneyFull(loan.remainingAmount, loan.currency as Currency)}
                          </span>
                          <span className="ml-2 inline-flex rounded-chip bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                            {loan.status}
                          </span>
                        </p>
                      ) : null
                    })()}
                  </>
                )}
              </div>
            ) : form.subType === 'LOAN_RETURNED_TO_ME' && !transaction ? (
              <div>
                {activeLoansGiven.length === 0
                  ? <p className="mb-1 text-xs font-medium text-slate-600">{translate('cmp.txModal.selectLoanReturned')}</p>
                  : <label htmlFor="tx-loan-given" className="mb-1 block text-xs font-medium text-slate-600">{translate('cmp.txModal.selectLoanReturned')}</label>}
                {activeLoansGiven.length === 0 ? (
                  <p className="rounded-control border border-dashed border-slate-300 px-3 py-3 text-center text-xs text-slate-500">
                    {translate('cmp.txModal.noActiveLentLoans')} <br />{translate('cmp.txModal.addLoanFirst')}
                  </p>
                ) : (
                  <>
                    <select id="tx-loan-given" value={selectedLoanGivenId ?? ''}
                      onChange={e => {
                        const id = e.target.value ? Number(e.target.value) : undefined
                        setSelectedLoanGivenId(id)
                        const loan = activeLoansGiven.find(l => l.id === id)
                        if (loan) {
                          set('amount', loan.pendingAmount)
                          set('currency', loan.currency as Currency)
                          set('description', translate('cmp.txModal.loanReturnedBy', { name: loan.debtorName }))
                          set('counterpartyName', loan.debtorName)
                        }
                      }}
                      className={CONTROL}>
                      <option value="">{translate('cmp.txModal.selectLoanOrManual')}</option>
                      {activeLoansGiven.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.debtorName} · {translate('cmp.txModal.pending')} {moneyFull(l.pendingAmount, l.currency as Currency)} · {l.status}
                        </option>
                      ))}
                    </select>
                    {selectedLoanGivenId && (() => {
                      const loan = activeLoansGiven.find(l => l.id === selectedLoanGivenId)
                      return loan ? (
                        <p className="mt-1.5 text-xs text-slate-500">
                          {translate('cmp.txModal.maxReceivable')}{' '}
                          <span className="font-semibold tabular-nums text-slate-900">
                            {moneyFull(loan.pendingAmount, loan.currency as Currency)}
                          </span>
                          <span className="ml-2 inline-flex rounded-chip bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                            {loan.status}
                          </span>
                        </p>
                      ) : null
                    })()}
                  </>
                )}
              </div>
            ) : form.subType && NEEDS_COUNTERPARTY.has(form.subType) && !isAnonymousDonation ? (
              <div className="relative">
                <Field
                  id="tx-counterparty"
                  label={COUNTERPARTY_LABEL[form.subType] ?? translate('cmp.txModal.counterparty.generic')}
                  required
                  error={fieldError('counterparty')}
                >
                  <input required ref={counterpartyRef} value={form.counterpartyName ?? ''}
                    onChange={e => {
                      set('counterpartyName', e.target.value)
                      // Typing away from the picked borrower means "someone new" again.
                      if (form.subType === 'LOAN_GIVEN' && form.loanGivenId) {
                        const linked = allLoansGiven.find(l => l.id === form.loanGivenId)
                        if (!linked || linked.debtorName !== e.target.value) set('loanGivenId', undefined)
                      }
                      if (form.subType === 'LOAN_GIVEN') setShowBorrowerPopover(true)
                    }}
                    onFocus={() => {
                      if (restoringFocus.current) { restoringFocus.current = false; return }
                      if (form.subType === 'BANK_LOAN_PAYMENT' && bankOptions.length > 0) setShowBankPopover(true)
                      if (form.subType === 'LOAN_GIVEN' && allLoansGiven.length > 0) setShowBorrowerPopover(true)
                    }}
                    // Tabbing from the input into the list is a blur of the input, so close only
                    // when focus actually left the list too — a bare timer used to unmount the
                    // options 150 ms after a keyboard user reached them.
                    onBlur={e => {
                      const next = e.relatedTarget as Node | null
                      if (next && (borrowerPopoverRef.current?.contains(next)
                        || bankPopoverRef.current?.contains(next))) return
                      setShowBankPopover(false); setShowBorrowerPopover(false)
                    }}
                    // Escape dismisses the list, not the whole sheet. Sheet listens on `document`,
                    // which the event only reaches after React's root, so stopping it here wins.
                    onKeyDown={e => {
                      if (e.key !== 'Escape' || !(showBorrowerPopover || showBankPopover)) return
                      e.stopPropagation()
                      setShowBankPopover(false); setShowBorrowerPopover(false)
                    }}
                    className={fieldError('counterparty') ? CONTROL_INVALID : CONTROL}
                    placeholder={translate('cmp.txModal.enterNamePlaceholder')} autoComplete="off" />
                </Field>
                {form.subType === 'LOAN_GIVEN' && showBorrowerPopover && allLoansGiven.length > 0 && (
                  <div
                    ref={borrowerPopoverRef}
                    onBlur={e => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShowBorrowerPopover(false)
                    }}
                    onKeyDown={e => {
                      if (e.key !== 'Escape') return
                      e.stopPropagation()
                      setShowBorrowerPopover(false)
                      returnFocus(counterpartyRef.current)
                    }}
                    className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-control border border-slate-200 bg-white shadow-tile-hover">
                    <p className="bg-slate-50 px-3 py-1.5 text-label uppercase text-slate-500">
                      {translate('cmp.txModal.existingBorrowers')}
                    </p>
                    {allLoansGiven
                      .filter(l => !form.counterpartyName
                        || l.debtorName.toLowerCase().includes(form.counterpartyName.toLowerCase()))
                      .map(l => (
                        <button key={l.id} type="button"
                          // Enter and Space on a <button> dispatch click, never mousedown, so the
                          // handler lives on onClick. onMouseDown only suppresses the pointer's
                          // blur, which would otherwise close the list before the click lands.
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            set('counterpartyName', l.debtorName)
                            set('loanGivenId', l.id)
                            setShowBorrowerPopover(false)
                            returnFocus(counterpartyRef.current)
                          }}
                          className={`${POPOVER_ITEM} flex items-center justify-between gap-2`}>
                          <span className="truncate">{l.debtorName}</span>
                          <span className="shrink-0 text-xs tabular-nums text-slate-500">
                            {moneyFull(l.pendingAmount, l.currency as Currency)}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
                {form.subType === 'LOAN_GIVEN' && (() => {
                  const linked = allLoansGiven.find(l => l.id === form.loanGivenId)
                  return linked ? (
                    <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {translate('cmp.txModal.toppingUp', { name: linked.debtorName })} · {translate('cmp.txModal.outstandingNow')}{' '}
                        <span className="font-semibold tabular-nums text-slate-900">
                          {moneyFull(linked.pendingAmount, linked.currency as Currency)}
                        </span>
                      </span>
                      <button type="button" onClick={() => set('loanGivenId', undefined)}
                        className="focus-ring shrink-0 cursor-pointer text-indigo-600 underline hover:no-underline">
                        {translate('cmp.txModal.newLoanInstead')}
                      </button>
                    </p>
                  ) : allLoansGiven.length > 0 ? (
                    <p className="mt-1.5 text-xs text-slate-500">{translate('cmp.txModal.newBorrowerHint')}</p>
                  ) : null
                })()}
                {form.subType === 'BANK_LOAN_PAYMENT' && showBankPopover && bankOptions.length > 0 && (
                  <div
                    ref={bankPopoverRef}
                    onBlur={e => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShowBankPopover(false)
                    }}
                    onKeyDown={e => {
                      if (e.key !== 'Escape') return
                      e.stopPropagation()
                      setShowBankPopover(false)
                      returnFocus(counterpartyRef.current)
                    }}
                    className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-control border border-slate-200 bg-white shadow-tile-hover">
                    {bankOptions
                      .filter(b => !form.counterpartyName || b.toLowerCase().includes(form.counterpartyName.toLowerCase()))
                      .map(b => (
                        <button key={b} type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            set('counterpartyName', b)
                            setShowBankPopover(false)
                            returnFocus(counterpartyRef.current)
                          }}
                          className={POPOVER_ITEM}>{b}</button>
                      ))}
                  </div>
                )}
              </div>
            ) : isAnonymousDonation ? (
              <p className="text-xs text-slate-500">{translate('cmp.txModal.anonymousDonationNotice')}</p>
            ) : null}

            {/* Investment: top up an existing one, or create a new record. */}
            {form.subType === 'INVESTMENT' && (
              <div className="space-y-2">
                <div className={SEGMENT_TRACK} role="group" aria-label={translate('cmp.txModal.label.investment')}>
                  <button type="button"
                    // Mirrors the picker rather than clearing it: the two are one fact, and a
                    // second press on the tab you are already on used to blank the posted id
                    // while the select still showed the fund — which is what makes the save
                    // reverse the contribution and open a duplicate record.
                    onClick={() => { setTouched(true); setInvestmentMode('existing'); set('investmentId', selectedInvestmentId) }}
                    aria-pressed={investmentMode === 'existing'}
                    className={`${SEGMENT_BASE} ${investmentMode === 'existing' ? 'bg-white text-slate-900 shadow-tile' : 'text-slate-600 hover:text-slate-900'}`}>
                    {translate('cmp.txModal.addToExisting')}
                  </button>
                  <button type="button"
                    onClick={() => { setTouched(true); setInvestmentMode('new'); setSelectedInvestmentId(undefined); set('investmentId', undefined) }}
                    aria-pressed={investmentMode === 'new'}
                    className={`${SEGMENT_BASE} ${investmentMode === 'new' ? 'bg-white text-slate-900 shadow-tile' : 'text-slate-600 hover:text-slate-900'}`}>
                    {translate('cmp.txModal.createNew')}
                  </button>
                </div>

                {investmentMode === 'existing' ? (
                  existingInvestments.length === 0 ? (
                    <p className="rounded-control border border-dashed border-slate-300 px-3 py-3 text-center text-xs text-slate-500">
                      {translate('cmp.txModal.noInvestmentsYet')}
                    </p>
                  ) : (
                    <>
                      <Field
                        id="tx-investment"
                        label={translate('cmp.txModal.label.investment')}
                        required
                        error={fieldError('investment')}
                      >
                        <select
                          value={selectedInvestmentId ?? ''}
                          onChange={e => {
                            const id = e.target.value ? Number(e.target.value) : undefined
                            setSelectedInvestmentId(id)
                            set('investmentId', id)
                            const inv = existingInvestments.find(i => i.id === id)
                            if (inv) {
                              set('currency', inv.currency as Currency)
                              set('counterpartyName', inv.name)
                              if (!form.description) set('description', translate('cmp.txModal.addFundsTo', { name: inv.name }))
                            }
                          }}
                          className={fieldError('investment') ? CONTROL_INVALID : CONTROL}
                        >
                          <option value="">{translate('cmp.txModal.selectAnInvestment')}</option>
                          {existingInvestments.map(i => (
                            <option key={i.id} value={i.id}>
                              {i.name} · {INVESTMENT_TYPE_LABELS[i.type]} · {moneyFull(i.investedAmount, i.currency as Currency)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {selectedInvestmentId && (() => {
                        const inv = existingInvestments.find(i => i.id === selectedInvestmentId)
                        return inv ? (
                          <p className="text-xs text-slate-500">
                            {translate('cmp.txModal.currentTotal')}{' '}
                            <span className="font-semibold tabular-nums text-slate-900">
                              {moneyFull(inv.investedAmount, inv.currency as Currency)}
                            </span>
                            <span className="ml-2 inline-flex rounded-chip bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                              {INVESTMENT_TYPE_LABELS[inv.type]}
                            </span>
                          </p>
                        ) : null
                      })()}
                    </>
                  )
                ) : (
                  <Field id="tx-investment-type" label={translate('cmp.txModal.investmentType')}>
                    <select value={form.investmentType ?? 'OTHER'}
                      onChange={e => set('investmentType', e.target.value as InvestmentType)}
                      className={CONTROL}>
                      {(['REAL_ESTATE','BONDS','MUTUAL_FUND','GOLD','OTHER'] as InvestmentType[]).map(it => (
                        <option key={it} value={it}>{INVESTMENT_TYPE_LABELS[it]}</option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            )}

            {/* Payment starts — when borrowed money begins counting toward the plan. */}
            {form.subType === 'LOAN_RECEIVED' && !transaction && (
              <Field
                id="tx-payment-start"
                label={translate('cmp.txModal.repaymentsStart')}
                help={translate('cmp.txModal.repaymentsStartHint')}
              >
                <input type="month"
                  value={form.paymentStartDate ? form.paymentStartDate.slice(0, 7) : nextMonthStr()}
                  onChange={e => set('paymentStartDate', e.target.value ? `${e.target.value}-01` : undefined)}
                  className={CONTROL} />
              </Field>
            )}

            {form.subType && AUTO_CREATES.has(form.subType) && (
              <p className="flex items-start gap-2 text-xs text-slate-500">
                <Info className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>
                  {form.subType === 'INVESTMENT'
                    ? investmentMode === 'existing' && selectedInvestmentId
                      ? translate('cmp.txModal.fundsAddedToInvestment')
                      : investmentMode === 'new'
                        ? <>{translate('cmp.txModal.newInvestmentPrefix')} <strong className="font-semibold text-slate-700">{translate('cmp.txModal.investmentWord')}</strong>{translate('cmp.txModal.newInvestmentSuffix')}</>
                        : null
                    : <>{translate('cmp.txModal.autoCreatePrefix')} <strong className="font-semibold text-slate-700">{subTypes.find(s => s.value === form.subType)?.label}</strong> {translate('cmp.txModal.autoCreateSuffix')}</>}
                </span>
              </p>
            )}

            {/* (c) Payment method + the inputs only a split needs. */}
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">{translate('cmp.field.paymentMethod')}</p>
              <div className={SEGMENT_TRACK} role="group" aria-label={translate('cmp.field.paymentMethod')}>
                {([
                  { value: 'CARD', label: translate('cmp.txModal.cardOnly') },
                  { value: 'CASH', label: translate('cmp.txModal.cashOnly') },
                  { value: 'BOTH', label: translate('tx.both') },
                ] as { value: PaymentMode; label: string }[]).map(opt => {
                  const needsCard = opt.value !== 'CASH'
                  const blockedByWallet = noUsableCards && needsCard
                  const blockedByLoanPath = atomicLoanPath && opt.value === 'BOTH'
                  const blocked = blockedByWallet || blockedByLoanPath
                  return (
                    <button key={opt.value} type="button"
                      disabled={blocked}
                      aria-pressed={paymentMode === opt.value}
                      title={blockedByWallet
                        ? translate('cmp.txModal.noCardsHint')
                        : blockedByLoanPath ? translate('cmp.txModal.bothNotForLoanPath') : undefined}
                      onClick={() => { setTouched(true); setPaymentMode(opt.value) }}
                      className={`${SEGMENT_BASE} ${
                        paymentMode === opt.value
                          ? 'bg-white text-slate-900 shadow-tile'
                          : 'text-slate-600 hover:text-slate-900'}`}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {noUsableCards && (
                <p className="mt-1 text-xs text-slate-500">{translate('cmp.txModal.noCardsHint')}</p>
              )}
              {!noUsableCards && atomicLoanPath && (
                <p className="mt-1 text-xs text-slate-500">{translate('cmp.txModal.bothNotForLoanPath')}</p>
              )}
              {paymentMode === 'CASH' && (
                <p className="mt-1 text-xs text-slate-500">
                  {translate('cmp.txModal.willAdjustCashPrefix')}{' '}
                  <span className="font-medium text-slate-600">{translate('cmp.txModal.willAdjustCashBold', { currency: defaultCurrency })}</span>
                  {cashBalance !== null && (
                    <> · {translate('cmp.txModal.current')} <span className="tabular-nums">{moneyFull(cashBalance, defaultCurrency)}</span></>
                  )}
                </p>
              )}
            </div>

            {paymentMode === 'BOTH' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    id="tx-cash-amount"
                    label={translate('cmp.txModal.label.cashAmount')}
                    required
                    error={fieldError('split')}
                  >
                    <AmountInput
                      required
                      value={cashInput || 0}
                      currency={defaultCurrency}
                      onChange={v => { setTouched(true); setCashInput(v) }}
                      className={`${fieldError('split') ? CONTROL_INVALID : CONTROL} pr-14 tabular-nums`}
                      placeholder="0"
                      suffix={defaultCurrency}
                    />
                  </Field>
                  <Field
                    id="tx-card-amount"
                    label={translate('cmp.txModal.label.cardAmount')}
                    required
                  >
                    <AmountInput
                      required
                      value={cardInput || 0}
                      currency={defaultCurrency}
                      onChange={v => { setTouched(true); setCardInput(v) }}
                      className={`${fieldError('split') ? CONTROL_INVALID : CONTROL} pr-14 tabular-nums`}
                      placeholder="0"
                      suffix={defaultCurrency}
                    />
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-control border border-slate-200 px-3 py-2">
                  <span className="text-xs text-slate-500">{translate('cmp.payBucket.total')}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{moneyFull(splitTotal, defaultCurrency)}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {translate('cmp.txModal.splitBadgeNoticePrefix')}
                  <span className="font-medium text-slate-600"> {translate('cmp.txModal.willAdjustCashBold', { currency: defaultCurrency })}</span>
                  {translate('cmp.txModal.splitBadgeNoticeSuffix')}
                </p>
              </>
            )}

            {/* (d) Description — optional by default; the server fills in a sensible one. */}
            <div className="relative">
              <Field
                id="tx-description"
                label={descriptionLabel}
                required={descriptionRequired}
                error={fieldError('description')}
              >
                <input ref={descriptionRef} value={form.description ?? ''} onChange={e => handleDescriptionChange(e.target.value)}
                  onFocus={() => {
                    if (restoringFocus.current) { restoringFocus.current = false; return }
                    if (suggestions.length > 0) setShowSuggestions(true)
                  }}
                  // Same rule as the counterparty lists: only close once focus has left the
                  // options too, so tabbing into them does not unmount them.
                  onBlur={e => {
                    const next = e.relatedTarget as Node | null
                    if (next && suggestionsPopoverRef.current?.contains(next)) return
                    setShowSuggestions(false)
                  }}
                  onKeyDown={e => {
                    if (e.key !== 'Escape' || !showSuggestions) return
                    e.stopPropagation()
                    setShowSuggestions(false)
                  }}
                  required={descriptionRequired}
                  className={fieldError('description') ? CONTROL_INVALID : CONTROL}
                  placeholder={translate('cmp.txModal.descriptionPlaceholder', {
                    example: descriptionLabel === translate('tx.description')
                      ? translate(form.type === 'INCOME'
                          ? 'cmp.txModal.descriptionExampleIncome'
                          : 'cmp.txModal.descriptionExampleExpense')
                      : descriptionLabel,
                  })}
                  autoComplete="off" />
              </Field>
              {!(form.description ?? '').trim() && derivedDescription && !fieldError('description') && (
                <p className="mt-1 text-xs text-slate-500">
                  {translate('cmp.txModal.descriptionDerived', { text: derivedDescription })}
                </p>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsPopoverRef}
                  onBlur={e => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShowSuggestions(false)
                  }}
                  onKeyDown={e => {
                    if (e.key !== 'Escape') return
                    e.stopPropagation()
                    setShowSuggestions(false)
                    returnFocus(descriptionRef.current)
                  }}
                  className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-control border border-slate-200 bg-white shadow-tile-hover">
                  {suggestions.map(s => (
                    <button key={s} type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        set('description', s)
                        setSuggestions([]); setShowSuggestions(false)
                        returnFocus(descriptionRef.current)
                      }}
                      className={POPOVER_ITEM}>{s}</button>
                  ))}
                </div>
              )}
            </div>

            {/* (e) Note */}
            <Field id="tx-note" label={translate('tx.note')}>
              <textarea rows={2} value={form.note ?? ''} onChange={e => set('note', e.target.value)}
                className={TEXTAREA}
                placeholder={translate('cmp.txModal.notePlaceholder')} />
            </Field>
          </div>
        )}

        {/* The one tinted alert on this form: the server said no. */}
        {error && (
          <div className="rounded-control border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
            {isBalanceError && <p className="mb-0.5 font-semibold">{translate('cmp.txModal.insufficientBalance')}</p>}
            {error}
          </div>
        )}
      </form>
    </Sheet>
  )
}
