import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Plus, X } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { IconChip } from '../ui/IconChip'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { categoriesApi } from '../../api/categories'
import { transactionsApi } from '../../api/transactions'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, todayLocal } from '../../utils/format'
import { BalanceTransferModal } from './BalanceTransferModal'
import { PayBucketModal } from '../overview/PayBucketModal'
import { SAVINGS_ICON, SAVINGS_NAME_KEY } from '../savings/SavingsThisMonth'
import { CashPart, ChipGroup, CompactDate, CONTROL, CONTROL_INVALID, LINK_BLOCK, useOptional } from './formParts'
import { WalletPicker } from './WalletPicker'
import {
  readLastChild, readLastType, rememberChild, rememberType, rememberWallet, useWalletChoice, useWallets,
} from './wallets'
import type { WalletValue } from './wallets'
import type {
  Bucket, Category, CategoryType, Currency, DonationResponse, InvestmentResponse, InvestmentType,
  LoanGivenResponse, Transaction, TransactionRequest, TransactionSubType, TransactionType,
} from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  transaction?: Transaction | null
  defaultCurrency: Currency
  /**
   * Open a NEW transaction already set to Income or Expense. Without it the form starts on the
   * direction the owner used last, else Expense.
   */
  presetType?: TransactionType
}

const NEEDS_COUNTERPARTY = new Set<TransactionSubType>([
  'LOAN_RECEIVED', 'LOAN_RETURNED_TO_ME', 'LOAN_GIVEN', 'LOAN_REPAYMENT', 'BANK_LOAN_PAYMENT', 'INVESTMENT', 'DONATION',
])
/** Kinds whose counterparty is taken from the linked record, so the form never asks for it. */
const COUNTERPARTY_OPTIONAL = new Set<TransactionSubType>(['LOAN_REPAYMENT', 'LOAN_RETURNED_TO_ME'])
/** A new category gets the next of these, so the owner is not asked to pick a colour. */
const COLORS = ['#10b981', '#f43f5e', '#6366f1', '#f59e0b', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6', '#3b82f6', '#ef4444', '#8b5cf6', '#6b7280']

/** The submit button lives in the sheet's sticky footer, outside the <form> it submits. */
const FORM_ID = 'tx-form'

/**
 * One option row inside the suggestion popovers. ring-inset keeps the focus indicator inside a
 * row that its clipping container would otherwise cut in half (same fix as ListRow).
 */
const POPOVER_ITEM =
  'focus-ring focus-visible:ring-inset focus-visible:ring-offset-0 w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-700'

const SEGMENT_TRACK = 'flex gap-1 rounded-control bg-slate-100 p-1'
const SEGMENT_BASE =
  'flex-1 min-h-[44px] md:min-h-[38px] rounded-chip px-2 text-xs font-semibold transition-colors focus-ring cursor-pointer'
const DIRECTION_OPTION =
  'flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-chip px-3 text-sm font-semibold transition-colors focus-ring cursor-pointer disabled:cursor-default'

/** Which control the current validation message belongs to, so it renders beside it. */
type ErrorField =
  | 'amount' | 'split' | 'category' | 'subCategory' | 'investment' | 'counterparty'
  | 'card' | 'description' | 'date'

/** Where focus goes when a check fails — the control the message is about. */
const FIELD_TARGET: Record<ErrorField, string> = {
  amount: '#tx-amount',
  split: '#tx-cash-part',
  category: '#tx-category',
  subCategory: '#tx-subcategory [role="radio"]',
  investment: '#tx-investment',
  counterparty: '#tx-counterparty',
  card: '#tx-wallet [role="radio"]',
  description: '#tx-description',
  date: '#tx-date',
}

const defaultForm = (currency: Currency, type: TransactionType = 'EXPENSE'): TransactionRequest => ({
  type, amount: 0, currency, description: '',
  transactionDate: todayLocal(),
  subType: type === 'INCOME' ? 'REGULAR_INCOME' : 'REGULAR_EXPENSE',
})

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

/**
 * The donation a DONATION row mirrors. The wire carries no link between the two, so it is found the
 * way they were made: the same day, amount and currency — and, when two match, the title the server
 * gave the row. Null when it cannot be told apart.
 */
function linkedDonation(tx: Transaction, donations: DonationResponse[]): DonationResponse | null {
  const same = donations.filter(d => d.donationDate === tx.transactionDate
    && d.currency === tx.currency && Math.abs(d.amount - tx.amount) < 0.005)
  if (same.length <= 1) return same[0] ?? null
  const title = (tx.description ?? '').trim()
  const named = same.filter(d =>
    (d.description?.trim() || `Donation to ${d.anonymous ? 'Anonymous' : d.recipientName}`) === title)
  return named.length === 1 ? named[0] : null
}

/**
 * The wallet an existing row was paid from, and whether it was split. A row with no card, or on a
 * legacy CASH-type card, is cash; a card row that also carries a cash part is a split.
 */
function walletOf(tx: Transaction): { wallet: WalletValue; split: boolean; cash: number } {
  const cash = tx.cashAmount ?? 0
  const cardPortion = (tx.amount ?? 0) - cash
  const realCard = !!tx.card && tx.card.type !== 'CASH'
  if (realCard && cardPortion > 0) return { wallet: tx.card!.id, split: cash > 0, cash }
  return { wallet: 'cash', split: false, cash: 0 }
}

/**
 * Add (or edit) one money movement: Income/Expense, the amount, a category, the wallet, an
 * optional note, the date — in that order, amount focused.
 *
 * Everything that can be remembered is: the direction used last, the wallet used last (else the
 * card holding the most), the sub-category last used under each category. A new entry is always a
 * plain income or expense; the special kinds are recorded where they live — linked from the foot
 * of the form — and an existing special row keeps its kind, shown read-only.
 */
export function TransactionModal({ open, onClose, onSaved, transaction, defaultCurrency, presetType }: Props) {
  // Aliased to `translate` — this file uses `t` as a local loop variable in a couple of callbacks.
  const { t: translate, categoryName } = useLang()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const optional = useOptional()
  const { showSuccess } = useToast()

  const SUB_TYPE_LABEL: Partial<Record<TransactionSubType, string>> = {
    LOAN_RECEIVED: translate('cmp.txModal.subType.loanReceived'),
    LOAN_RETURNED_TO_ME: translate('cmp.txModal.subType.loanReturnedToMe'),
    LOAN_GIVEN: translate('cmp.txModal.subType.loanGiven'),
    LOAN_REPAYMENT: translate('cmp.txModal.subType.loanRepayment'),
    BANK_LOAN_PAYMENT: translate('cmp.txModal.subType.bankLoanPayment'),
    INVESTMENT: translate('cmp.txModal.subType.investment'),
    DONATION: translate('cmp.txModal.subType.donation'),
    EMERGENCY_CONTRIBUTION: translate('cmp.bucket.emergency'),
    EVERYDAY_SPENDING: translate('home.form.everydaySpending'),
    INVESTMENT_WITHDRAWAL: translate('cmp.subType.investmentWithdrawal'),
    TRANSFER_IN: translate('shell.wallets.moveMoney'),
    TRANSFER_OUT: translate('shell.wallets.moveMoney'),
  }
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

  const [form, setForm] = useState<TransactionRequest>(defaultForm(defaultCurrency))
  const [rootCategories, setRootCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<Category[]>([])
  const [selectedRootId, setSelectedRootId] = useState<number | undefined>()
  /** The root whose sub-categories are wanted — a late response for another root is dropped. */
  const wantedRootRef = useRef<number | undefined>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBalanceError, setIsBalanceError] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [invalidField, setInvalidField] = useState<ErrorField | null>(null)
  // Set by the owner's own edits only — auto-picks write to `form` without it.
  const [touched, setTouched] = useState(false)
  const [categoryCleared, setCategoryCleared] = useState(false)

  // "What for" autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // New category / sub-category, inline — a name is all they ask.
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)
  const [newCatError, setNewCatError] = useState<string | null>(null)
  const [showNewSubCat, setShowNewSubCat] = useState(false)
  const [newSubCatName, setNewSubCatName] = useState('')
  const [creatingSubCat, setCreatingSubCat] = useState(false)
  const [newSubCatError, setNewSubCatError] = useState<string | null>(null)

  // Edit-only: the records a special row is linked to.
  const [existingInvestments, setExistingInvestments] = useState<InvestmentResponse[]>([])
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<number | undefined>()
  const [investmentMode, setInvestmentMode] = useState<'existing' | 'new'>('existing')
  const [allLoansGiven, setAllLoansGiven] = useState<LoanGivenResponse[]>([])
  const [donation, setDonation] = useState<DonationResponse | null>(null)
  const [bankOptions, setBankOptions] = useState<string[]>([])
  const [showBorrowerPopover, setShowBorrowerPopover] = useState(false)
  const [showBankPopover, setShowBankPopover] = useState(false)

  // Split: the amount above is the total, this is the cash part, the card carries the rest.
  const [split, setSplit] = useState(false)
  const [cashPart, setCashPart] = useState(0)

  // Move money opens on top of this form; saving it closes both.
  const [transferOpen, setTransferOpen] = useState(false)
  // So does a savings payment: which kind first, then the dialog that pays it.
  const [savingsChooserOpen, setSavingsChooserOpen] = useState(false)
  const [savingsBucket, setSavingsBucket] = useState<Bucket | null>(null)

  const amountRef = useRef<HTMLInputElement>(null)
  const borrowerPopoverRef = useRef<HTMLDivElement>(null)
  const bankPopoverRef = useRef<HTMLDivElement>(null)
  const suggestionsPopoverRef = useRef<HTMLDivElement>(null)
  const counterpartyRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  // Raised while focus is handed back to a field after its list closed, so the field's own onFocus
  // does not reopen the list the owner just dismissed.
  const restoringFocus = useRef(false)
  // The counterparty of an edited row is filled once from its linked record — never again, so a
  // name the owner cleared on purpose is not typed back in.
  const counterpartySeeded = useRef(false)
  // Likewise once: an anonymous donation's "Anonymous" sub-category (see below).
  const anonymitySeeded = useRef(false)
  // The row the dialog is open on, so a late answer for another one is dropped.
  const openTxId = useRef<number | null>(null)

  const incoming = form.type === 'INCOME'
  // An existing special row keeps its direction as well as its kind: turning borrowed money into an
  // expense, say, would unpick the loan record behind it.
  const directionLocked = !!transaction && transaction.subType != null
    && transaction.subType !== 'REGULAR_INCOME' && transaction.subType !== 'REGULAR_EXPENSE'
  const wallets = useWallets(open, defaultCurrency)
  const fixedWallet: WalletValue = transaction ? walletOf(transaction).wallet : null
  const walletChoice = useWalletChoice({
    open,
    cards: wallets.cards,
    cashBalance: wallets.cashBalance,
    loaded: wallets.loaded,
    amount: form.amount || 0,
    incoming,
    allowCash: !split,
    fixed: fixedWallet,
  })
  const wallet = walletChoice.value

  const loadRoots = useCallback(async (type: CategoryType, subType?: TransactionSubType) => {
    const res = await categoriesApi.getAll(type, subType).catch(() => null)
    if (res) setRootCategories(res.data)
  }, [])

  /**
   * The children of `parentId`. On a new entry the one last used under this parent is picked for
   * the owner (or the only one there is), so the required sub-category is usually already filled.
   */
  const loadSubs = useCallback(async (parentId: number, preselect: boolean) => {
    wantedRootRef.current = parentId
    const res = await categoriesApi.getSubCategories(parentId).catch(() => null)
    if (wantedRootRef.current !== parentId) return
    const subs = res?.data ?? []
    setSubCategories(subs)
    if (!preselect || subs.length === 0) return
    const last = readLastChild(parentId)
    const pick = subs.find(s => s.id === last) ?? (subs.length === 1 ? subs[0] : undefined)
    if (pick) setForm(prev => (prev.categoryId === parentId ? { ...prev, categoryId: pick.id } : prev))
  }, [])

  useEffect(() => {
    if (!open) { setTransferOpen(false); setSavingsChooserOpen(false); setSavingsBucket(null); return }
    setError(null); setIsBalanceError(false); setValidationError(null); setInvalidField(null)
    setShowNewCat(false); setNewCatName(''); setNewCatError(null)
    setShowNewSubCat(false); setNewSubCatName(''); setNewSubCatError(null)
    setSuggestions([]); setShowSuggestions(false)
    setShowBankPopover(false); setShowBorrowerPopover(false); setBankOptions([])
    setTouched(false); setCategoryCleared(false)
    counterpartySeeded.current = false
    anonymitySeeded.current = false
    openTxId.current = transaction?.id ?? null
    setDonation(null)
    setInvestmentMode('existing')

    if (transaction) {
      const f: TransactionRequest = {
        type: transaction.type, amount: transaction.amount,
        // Currency follows the app — no per-row override any more.
        currency: defaultCurrency,
        categoryId: transaction.category?.id, cardId: transaction.card?.id,
        description: transaction.description ?? '',
        transactionDate: transaction.transactionDate,
        note: transaction.note ?? '',
        subType: transaction.subType ?? (transaction.type === 'INCOME' ? 'REGULAR_INCOME' : 'REGULAR_EXPENSE'),
        cashAmount: transaction.cashAmount ?? 0,
        // A top-up is only a top-up while it still names the record it topped up. Posting these
        // back as undefined makes the backend read the edit as "moved to a different fund /
        // borrower": it reverses the contribution out of the original and opens a duplicate.
        investmentId: transaction.investmentId ?? undefined,
        loanGivenId: linkedLoanGivenId(transaction),
      }
      setForm(f)
      const w = walletOf(transaction)
      setSplit(w.split); setCashPart(w.cash)
      const cat = transaction.category
      const rootId = cat?.parentId ?? cat?.id
      setSelectedRootId(rootId)
      setSubCategories([])
      loadRoots(transaction.type === 'INCOME' ? 'INCOME' : 'EXPENSE', f.subType)
      if (rootId) loadSubs(rootId, false)
      setSelectedInvestmentId(transaction.investmentId ?? undefined)
      // The linked records, only for the kinds that show them.
      if (transaction.subType === 'INVESTMENT') {
        financeApi.getInvestments().then(r => setExistingInvestments(r.data)).catch(() => {})
      }
      if (transaction.subType === 'LOAN_GIVEN') {
        financeApi.getLoansGiven().then(r => setAllLoansGiven(r.data)).catch(() => {})
      }
      if (transaction.subType === 'BANK_LOAN_PAYMENT') {
        financeApi.getBankNameSuggestions('').then(r => setBankOptions(r.data)).catch(() => {})
      }
      if (transaction.subType === 'DONATION') {
        financeApi.getDonations()
          .then(r => { if (openTxId.current === transaction.id) setDonation(linkedDonation(transaction, r.data)) })
          .catch(() => {})
      }
    } else {
      const type = presetType ?? readLastType() ?? 'EXPENSE'
      setForm(defaultForm(defaultCurrency, type))
      setSplit(false); setCashPart(0)
      setSelectedRootId(undefined); setSubCategories([]); wantedRootRef.current = undefined
      setSelectedInvestmentId(undefined)
      loadRoots(type, type === 'INCOME' ? 'REGULAR_INCOME' : 'REGULAR_EXPENSE')
    }
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current) }
  }, [open, transaction, defaultCurrency, presetType, loadRoots, loadSubs])

  // A new entry whose kind has exactly one root category gets it picked for it — the same rule the
  // form always had: an exact `applicableSubType` match wins over a bare count.
  useEffect(() => {
    if (!open || transaction || selectedRootId) return
    const exact = rootCategories.filter(c => c.applicableSubType === form.subType)
    const only = exact.length === 1 ? exact[0] : rootCategories.length === 1 ? rootCategories[0] : undefined
    if (!only) return
    setSelectedRootId(only.id)
    setForm(prev => ({ ...prev, categoryId: only.id }))
    loadSubs(only.id, true)
  }, [open, rootCategories, transaction, selectedRootId, form.subType, loadSubs])

  // A counterparty name is never stored on a transaction, so an edit reopens with the field blank
  // while the form still demands it — and retyping it is what breaks a top-up (the borrower input
  // drops `loanGivenId` the moment the text stops matching). Fill it from the linked record, once,
  // without marking the form dirty.
  useEffect(() => {
    if (!open || !transaction || counterpartySeeded.current) return
    const sub = transaction.subType
    const name = sub === 'LOAN_GIVEN'
      ? allLoansGiven.find(l => l.id === linkedLoanGivenId(transaction))?.debtorName
      : sub === 'INVESTMENT'
        ? existingInvestments.find(i => i.id === transaction.investmentId)?.name
        : sub === 'DONATION' && donation && !donation.anonymous
          ? donation.recipientName
          : undefined
    if (!name) return
    counterpartySeeded.current = true
    setForm(prev => ({
      ...prev,
      counterpartyName: prev.counterpartyName || name,
      // A description that is nothing but this name was written by the server; left in the field
      // it would stop following the name.
      description: (prev.description ?? '').trim() === name.trim() ? '' : prev.description,
    }))
  }, [open, transaction, allLoansGiven, existingInvestments, donation])

  // The short Donate form files a donation on its root category, and the server reads anonymity off
  // the category on every edit — so an anonymous one saved from here as it stands would come back
  // named. Its root's "Anonymous" sub-category (the server keeps one under Donation) carries the
  // anonymity instead: picked for the owner, in plain sight, without marking the form dirty.
  useEffect(() => {
    if (!open || !transaction || transaction.subType !== 'DONATION' || anonymitySeeded.current) return
    const cat = transaction.category
    if (!donation?.anonymous || !cat || cat.anonymizes) return
    if (cat.id !== selectedRootId) { anonymitySeeded.current = true; return }
    const anon = subCategories.find(c => c.anonymizes)
    if (!anon) return
    anonymitySeeded.current = true
    setForm(prev => (prev.categoryId === selectedRootId ? { ...prev, categoryId: anon.id } : prev))
  }, [open, transaction, donation, subCategories, selectedRootId])

  const returnFocus = (el: HTMLInputElement | null) => {
    restoringFocus.current = true
    el?.focus()
    restoringFocus.current = false
  }

  const set = <K extends keyof TransactionRequest>(key: K, value: TransactionRequest[K]) => {
    setTouched(true)
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const clearFieldError = (field: ErrorField) => {
    if (invalidField === field) { setInvalidField(null); setValidationError(null) }
  }

  const fail = (field: ErrorField, message: string) => {
    setInvalidField(field)
    setValidationError(message)
    // After the render that marks it invalid, so the control is focused in its error state.
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(FIELD_TARGET[field])
      el?.focus()
    }, 0)
  }
  const fieldError = (field: ErrorField) => (invalidField === field ? validationError ?? undefined : undefined)

  const switchType = (next: TransactionType) => {
    // Pressing the direction already on used to clear the category all the same.
    if (next === form.type || directionLocked) return
    const st: TransactionSubType = next === 'INCOME' ? 'REGULAR_INCOME' : 'REGULAR_EXPENSE'
    // Switching direction is not typing: on a new entry it does not make the form "dirty".
    if (transaction) setTouched(true)
    setForm(prev => ({
      ...prev, type: next, subType: st, categoryId: undefined, investmentId: undefined, loanGivenId: undefined,
      currency: defaultCurrency,
    }))
    // Income and expense keep different category lists, so the pick has to go — and say so.
    setCategoryCleared(!!selectedRootId)
    setSelectedRootId(undefined); setSubCategories([]); wantedRootRef.current = undefined
    setShowNewCat(false); setShowNewSubCat(false)
    setSelectedInvestmentId(undefined); setInvestmentMode('existing')
    if (invalidField === 'category' || invalidField === 'subCategory') { setInvalidField(null); setValidationError(null) }
    loadRoots(next === 'INCOME' ? 'INCOME' : 'EXPENSE', st)
  }

  const selectRoot = (id: number | undefined) => {
    setTouched(true)
    setSelectedRootId(id); setSubCategories([])
    setForm(prev => ({ ...prev, categoryId: id }))
    setCategoryCleared(false)
    setShowNewSubCat(false)
    clearFieldError('category'); clearFieldError('subCategory')
    if (id) loadSubs(id, !transaction)
    else wantedRootRef.current = undefined
  }

  const handleDescriptionChange = (value: string) => {
    set('description', value)
    clearFieldError('description')
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (value.length < 2) { setSuggestions([]); return }
    suggestTimer.current = setTimeout(async () => {
      // Scoped to the chosen (sub-)category, so the suggestions are that category's own.
      const res = await transactionsApi.getSuggestions(value, form.categoryId).catch(() => null)
      if (res) { setSuggestions(res.data.filter(s => s !== value)); setShowSuggestions(true) }
    }, 250)
  }

  const handleCreateCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    setCreatingCat(true); setNewCatError(null)
    try {
      const res = await categoriesApi.create({
        name,
        type: form.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        color: COLORS[rootCategories.length % COLORS.length],
        applicableSubType: form.subType,
      })
      setRootCategories(prev => [...prev, res.data])
      selectRoot(res.data.id)
      setShowNewCat(false); setNewCatName('')
    } catch (err: unknown) {
      setNewCatError(extractErrorMessage(err))
    } finally { setCreatingCat(false) }
  }

  const handleCreateSubCategory = async () => {
    const name = newSubCatName.trim()
    if (!name || !selectedRootId) return
    setCreatingSubCat(true); setNewSubCatError(null)
    try {
      const parent = rootCategories.find(c => c.id === selectedRootId)
      const res = await categoriesApi.create({
        name,
        parentId: selectedRootId,
        applicableSubType: form.subType,
        type: form.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        color: parent?.color ?? COLORS[subCategories.length % COLORS.length],
      })
      setSubCategories(prev => [...prev, res.data])
      set('categoryId', res.data.id)
      clearFieldError('subCategory')
      setShowNewSubCat(false); setNewSubCatName('')
    } catch (err: unknown) {
      setNewSubCatError(extractErrorMessage(err))
    } finally { setCreatingSubCat(false) }
  }

  const selectedRoot = rootCategories.find(c => c.id === selectedRootId)
  const hasSubs = subCategories.length > 0
  const activeCategory: Category | undefined =
    (form.categoryId && form.categoryId !== selectedRootId
      ? subCategories.find(c => c.id === form.categoryId)
      : undefined)
    ?? selectedRoot

  // The category may name its own label for "What for" and make it required; the default is
  // optional — left blank, the server names the row after the category.
  const descriptionLabel = activeCategory?.descriptionLabel || translate('cmp.txModal.label.whatFor')
  const descriptionRequired = activeCategory?.descriptionRequired ?? false

  const isAnonymousDonation =
    form.subType === 'DONATION' &&
    (Boolean(activeCategory?.anonymizes) ||
      (activeCategory?.parentId != null && Boolean(selectedRoot?.anonymizes)))
  const hasCounterparty = !!form.subType && NEEDS_COUNTERPARTY.has(form.subType)
  const isSpecialSubType = !!form.subType
    && form.subType !== 'REGULAR_INCOME' && form.subType !== 'REGULAR_EXPENSE'
  // A row already saved on its root category (the quick Pay and Add forms file it there) may stay
  // there: an edit does not have to pick a sub-category it never had.
  const keepsRoot = !!transaction && selectedRootId != null
    && transaction.category?.id === selectedRootId && form.categoryId === selectedRootId

  const total = form.amount || 0
  const cardPart = total - (cashPart || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // In the order the fields appear, so the first message is about the first thing to fix.
    if (total <= 0) { fail('amount', translate('cmp.err.amountPositive')); return }
    if (split && ((cashPart || 0) <= 0 || cardPart <= 0)) {
      fail('split', translate('home.form.err.splitParts')); return
    }
    if (!selectedRootId) { fail('category', translate('cmp.txModal.err.selectCategory')); return }
    if (hasSubs && form.categoryId === selectedRootId && !keepsRoot) {
      fail('subCategory', translate('cmp.txModal.err.selectSubCategory')); return
    }
    if (form.subType === 'INVESTMENT' && investmentMode === 'existing' && !selectedInvestmentId && existingInvestments.length > 0) {
      fail('investment', translate('cmp.txModal.err.selectInvestment')); return
    }
    if (hasCounterparty && !isAnonymousDonation && !COUNTERPARTY_OPTIONAL.has(form.subType!)
        && !(form.counterpartyName && form.counterpartyName.trim())) {
      fail('counterparty', translate('cmp.txModal.err.fieldRequired', {
        field: COUNTERPARTY_LABEL[form.subType!] ?? translate('cmp.txModal.counterparty.generic'),
      })); return
    }
    if (wallet == null || wallet === 'none' || (split && typeof wallet !== 'number')) {
      fail('card', translate(split ? 'cmp.err.pickCardForPortion' : 'cmp.txModal.err.selectCardOrSwitch')); return
    }
    if (descriptionRequired && !(form.description && form.description.trim())) {
      fail('description', translate('cmp.txModal.err.fillInField', { field: descriptionLabel.toLowerCase() })); return
    }
    if (!form.transactionDate) { fail('date', translate('cmp.txModal.err.selectDate')); return }

    setValidationError(null); setInvalidField(null)
    setSaving(true); setError(null); setIsBalanceError(false)
    const onCard = typeof wallet === 'number'
    const payload: TransactionRequest = {
      ...form,
      amount: total,
      currency: defaultCurrency,
      description: form.description ?? '',
      cardId: onCard ? wallet : undefined,
      // The cash part of the amount: all of it for cash, none for a card, the typed part for a split.
      cashAmount: split ? (cashPart || 0) : onCard ? 0 : total,
      // Only for a kind that has a counterparty — neither a direction switch nor a kind change
      // clears this field, and a stray name would become the title of a plain expense.
      counterpartyName: !hasCounterparty ? undefined
        : isAnonymousDonation ? 'Anonymous' : form.counterpartyName,
      // Edit only ever keeps the stored month; the payment-start month is set in Loans & bills.
      paymentStartDate: undefined,
      loanGivenId: form.subType === 'LOAN_GIVEN' ? form.loanGivenId : undefined,
    }
    try {
      if (transaction) {
        await transactionsApi.update(transaction.id, payload)
      } else {
        await transactionsApi.create(payload)
        // The next entry starts where this one ended.
        rememberType(form.type)
        rememberWallet(wallet)
        if (activeCategory?.parentId != null) rememberChild(activeCategory.parentId, activeCategory.id)
      }
      // The raw onClose, not the guard: the work is saved, so there is nothing left to discard.
      onSaved(); onClose()
      showSuccess(transaction ? translate('tx.updated') : translate('tx.saved'))
    } catch (err: unknown) {
      const msg = extractErrorMessage(err)
      setError(msg)
      setIsBalanceError(msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance'))
    } finally { setSaving(false) }
  }

  // A new entry asks before throwing away only what the owner actually typed — an amount or some
  // text. Flipping Income/Expense or tapping a category is one tap to redo, not work to protect.
  const typedSomething = transaction
    ? touched
    : total > 0 || (cashPart || 0) > 0
      || !!form.description?.trim() || !!form.counterpartyName?.trim()
      || (showNewCat && !!newCatName.trim()) || (showNewSubCat && !!newSubCatName.trim())
  const isDirty = typedSomething && !saving

  /** Shared by Cancel and the links out of the form — each leaves the form behind. */
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

  const goTo = async (path: string) => {
    if (!(await confirmDiscard())) return
    onClose()
    navigate(path)
  }

  const toggleSplit = (next: boolean) => {
    setTouched(true)
    setSplit(next)
    clearFieldError('split')
    if (next) {
      // A split needs a card beside the cash; start on the one already chosen, else the fullest.
      if (typeof wallet !== 'number' && wallets.cards.length > 0) {
        const best = wallets.cards.reduce((a, c) => ((c.currentBalance ?? 0) > (a.currentBalance ?? 0) ? c : a))
        walletChoice.choose(best.id)
      }
    } else {
      setCashPart(0)
    }
  }

  const subTypeLabel = form.subType ? SUB_TYPE_LABEL[form.subType] : undefined
  const walletLabel = translate(incoming ? 'home.wallet.to' : 'home.wallet.from')

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={transaction ? translate('action.edit') : translate('action.add')}
        dirty={isDirty}
        // The amount is what the owner came to type, so the form opens with the caret in it.
        initialFocusRef={amountRef}
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
                : transaction ? translate('action.save') : translate('action.add')}
            />
          </div>
        }
      >
        <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">

          {/* 1. Money in or out. */}
          <div className={SEGMENT_TRACK} role="group" aria-label={translate('cmp.txModal.label.direction')}>
            {(['INCOME', 'EXPENSE'] as TransactionType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => switchType(t)}
                aria-pressed={form.type === t}
                disabled={directionLocked}
                className={`${DIRECTION_OPTION} ${
                  form.type === t
                    ? t === 'INCOME' ? 'bg-income text-white' : 'bg-expense text-white'
                    : directionLocked ? 'text-slate-400' : 'text-slate-600 hover:text-slate-900'}`}>
                {t === 'INCOME'
                  ? <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  : <ArrowDownRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {t === 'INCOME' ? translate('tx.income') : translate('tx.expense')}
              </button>
            ))}
          </div>

          {/* An existing special row keeps its kind; changing it would mean creating or unpicking
              a loan / donation / holding behind the scenes. */}
          {transaction && isSpecialSubType && subTypeLabel && (
            <div className="flex items-center justify-between gap-3 rounded-control border border-hairline px-3 py-2">
              <span className="text-xs font-medium text-slate-600">{translate('tx.type')}</span>
              <span className="text-sm font-semibold text-slate-900">{subTypeLabel}</span>
            </div>
          )}

          {/* 2. Amount — autofocused. */}
          <Field id="tx-amount" label={translate('cmp.txModal.label.amount')} required error={fieldError('amount')}>
            <AmountInput
              ref={amountRef}
              value={total}
              currency={defaultCurrency}
              onChange={v => { set('amount', v); clearFieldError('amount') }}
              className={`w-full rounded-control border bg-white py-3 pl-3 pr-20 text-stat tabular-nums text-slate-900 focus-ring ${
                fieldError('amount') || isBalanceError ? 'border-expense' : 'border-slate-200'
              }`}
              placeholder="0"
              suffix={defaultCurrency}
              suffixClassName="text-sm"
            />
          </Field>

          {/* 3. Category, then its sub-categories as chips. */}
          {showNewCat ? (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="tx-new-category" className="text-xs font-medium text-slate-600">
                  {translate('cmp.txModal.newCategory')}
                </label>
                <Button
                  size="sm" variant="ghost" iconOnly
                  icon={<X className="h-3.5 w-3.5" aria-hidden="true" />}
                  label={translate('action.cancel')}
                  onClick={() => { setShowNewCat(false); setNewCatName(''); setNewCatError(null) }}
                />
              </div>
              <div className="flex gap-2">
                <input
                  id="tx-new-category" value={newCatName} autoFocus
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory() } }}
                  className={CONTROL}
                  placeholder={translate('cmp.txModal.categoryNamePlaceholder')}
                />
                <Button
                  variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                  loading={creatingCat} disabled={!newCatName.trim()}
                  onClick={handleCreateCategory} label={translate('action.add')}
                  className="shrink-0"
                />
              </div>
              {newCatError && <p role="alert" className="mt-1 text-xs text-expense">{newCatError}</p>}
            </div>
          ) : (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label htmlFor="tx-category" className="text-xs font-medium text-slate-600">
                  {translate('cmp.txModal.label.category')}
                  <span aria-hidden="true" className="text-expense"> *</span>
                </label>
                <Button
                  size="sm" variant="ghost"
                  icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  label={translate('cmp.txModal.new')}
                  onClick={() => { setShowNewCat(true); setNewCatError(null) }}
                />
              </div>
              <select
                id="tx-category"
                aria-required="true"
                aria-invalid={fieldError('category') ? true : undefined}
                aria-describedby={fieldError('category') ? 'tx-category-error' : undefined}
                value={selectedRootId ?? ''}
                onChange={e => selectRoot(e.target.value ? Number(e.target.value) : undefined)}
                className={fieldError('category') ? CONTROL_INVALID : CONTROL}>
                <option value="">{translate('home.form.pickCategory')}</option>
                {rootCategories.map(c => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}
              </select>
              {fieldError('category') && (
                <p id="tx-category-error" role="alert" className="mt-1 text-xs text-expense">{fieldError('category')}</p>
              )}
              {!fieldError('category') && categoryCleared && !selectedRootId && (
                <p className="mt-1 text-xs text-slate-500">{translate('cmp.txModal.categoryClearedByDirection')}</p>
              )}
            </div>
          )}

          {selectedRootId && hasSubs && !showNewCat && (
            showNewSubCat ? (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="tx-new-subcategory" className="text-xs font-medium text-slate-600">
                    {translate('cmp.txModal.label.subCategory')}
                  </label>
                  <Button
                    size="sm" variant="ghost" iconOnly
                    icon={<X className="h-3.5 w-3.5" aria-hidden="true" />}
                    label={translate('action.cancel')}
                    onClick={() => { setShowNewSubCat(false); setNewSubCatName(''); setNewSubCatError(null) }}
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    id="tx-new-subcategory" value={newSubCatName} autoFocus
                    onChange={e => setNewSubCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateSubCategory() } }}
                    className={CONTROL}
                    placeholder={translate('cmp.txModal.subCategoryNamePlaceholder')}
                  />
                  <Button
                    variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                    loading={creatingSubCat} disabled={!newSubCatName.trim()}
                    onClick={handleCreateSubCategory} label={translate('action.add')}
                    className="shrink-0"
                  />
                </div>
                {newSubCatError && <p role="alert" className="mt-1 text-xs text-expense">{newSubCatError}</p>}
              </div>
            ) : (
              <ChipGroup<number>
                id="tx-subcategory"
                compact
                label={translate('cmp.txModal.label.subCategory')}
                required={!keepsRoot}
                options={subCategories.map(c => ({ value: c.id, label: categoryName(c) }))}
                value={form.categoryId && form.categoryId !== selectedRootId ? form.categoryId : null}
                onChange={id => { set('categoryId', id); clearFieldError('subCategory') }}
                error={fieldError('subCategory')}
                trailing={
                  <button
                    type="button"
                    onClick={() => { setShowNewSubCat(true); setNewSubCatError(null) }}
                    aria-label={translate('cmp.txModal.addSubCategory')}
                    title={translate('cmp.txModal.addSubCategory')}
                    className="focus-ring flex h-11 w-11 items-center justify-center rounded-control border border-dashed border-slate-300 text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                }
              />
            )
          )}

          {/* Edit only: whatever an existing special row is linked to. */}
          {transaction && hasCounterparty && !isAnonymousDonation && (
            <div className="relative">
              <Field
                id="tx-counterparty"
                label={COUNTERPARTY_LABEL[form.subType!] ?? translate('cmp.txModal.counterparty.generic')}
                required={!COUNTERPARTY_OPTIONAL.has(form.subType!)}
                error={fieldError('counterparty')}
              >
                <input ref={counterpartyRef} value={form.counterpartyName ?? ''}
                  onChange={e => {
                    set('counterpartyName', e.target.value)
                    clearFieldError('counterparty')
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
                  onBlur={e => {
                    const next = e.relatedTarget as Node | null
                    if (next && (borrowerPopoverRef.current?.contains(next)
                      || bankPopoverRef.current?.contains(next))) return
                    setShowBankPopover(false); setShowBorrowerPopover(false)
                  }}
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
                          {moneyFull(l.pendingAmount, l.currency)}
                        </span>
                      </button>
                    ))}
                </div>
              )}
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
          )}

          {transaction && form.subType === 'INVESTMENT' && (
            <div className="space-y-2">
              <div className={SEGMENT_TRACK} role="group" aria-label={translate('cmp.txModal.label.investment')}>
                <button type="button"
                  // Mirrors the picker rather than clearing it: the two are one fact.
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
                  <Field id="tx-investment" label={translate('cmp.txModal.label.investment')} required error={fieldError('investment')}>
                    <select
                      value={selectedInvestmentId ?? ''}
                      onChange={e => {
                        const id = e.target.value ? Number(e.target.value) : undefined
                        setSelectedInvestmentId(id)
                        set('investmentId', id)
                        clearFieldError('investment')
                        const inv = existingInvestments.find(i => i.id === id)
                        if (inv) set('counterpartyName', inv.name)
                      }}
                      className={fieldError('investment') ? CONTROL_INVALID : CONTROL}
                    >
                      <option value="">{translate('cmp.txModal.selectAnInvestment')}</option>
                      {existingInvestments.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.name} · {moneyFull(i.investedAmount, i.currency)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )
              ) : (
                <Field id="tx-investment-type" label={translate('cmp.txModal.investmentType')}>
                  <select value={form.investmentType ?? 'OTHER'}
                    onChange={e => set('investmentType', e.target.value as InvestmentType)}
                    className={CONTROL}>
                    {(['REAL_ESTATE', 'BONDS', 'MUTUAL_FUND', 'GOLD', 'OTHER'] as InvestmentType[]).map(it => (
                      <option key={it} value={it}>{INVESTMENT_TYPE_LABELS[it]}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          )}
          {transaction && isAnonymousDonation && (
            <p className="text-xs text-slate-500">{translate('cmp.txModal.anonymousDonationNotice')}</p>
          )}

          {/* 4. The wallet: one question — From for an expense, To for an income. */}
          <WalletPicker
            id="tx-wallet"
            label={walletLabel}
            cards={wallets.cards}
            cashBalance={wallets.cashBalance}
            currency={defaultCurrency}
            loaded={wallets.loaded}
            failed={wallets.failed}
            onRetry={wallets.reload}
            value={wallet}
            onChange={v => { walletChoice.choose(v); setTouched(true); clearFieldError('card') }}
            split={split}
            onSplitChange={toggleSplit}
            error={fieldError('card')}
          />
          {split && (
            <CashPart
              id="tx-cash-part"
              total={total}
              cash={cashPart}
              onCash={v => { setTouched(true); setCashPart(v); clearFieldError('split') }}
              currency={defaultCurrency}
              error={fieldError('split')}
            />
          )}

          {/* 5. What for — optional unless the category asks for it. */}
          <div className="relative">
            <Field
              id="tx-description"
              label={descriptionRequired ? descriptionLabel : optional(descriptionLabel)}
              required={descriptionRequired}
              error={fieldError('description')}
            >
              <input ref={descriptionRef} value={form.description ?? ''} onChange={e => handleDescriptionChange(e.target.value)}
                onFocus={() => {
                  if (restoringFocus.current) { restoringFocus.current = false; return }
                  if (suggestions.length > 0) setShowSuggestions(true)
                }}
                // Close only once focus has left the options too, so tabbing into them works.
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
                className={fieldError('description') ? CONTROL_INVALID : CONTROL}
                placeholder={translate('cmp.txModal.descriptionPlaceholder', {
                  example: descriptionLabel === translate('cmp.txModal.label.whatFor')
                    ? translate(incoming ? 'cmp.txModal.descriptionExampleIncome' : 'cmp.txModal.descriptionExampleExpense')
                    : descriptionLabel,
                })}
                autoComplete="off" />
            </Field>
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

          {/* 6. Date — today on the owner's clock, one line. */}
          <CompactDate
            id="tx-date"
            label={translate('cmp.txModal.label.date')}
            value={form.transactionDate}
            onChange={v => { set('transactionDate', v); clearFieldError('date') }}
            error={fieldError('date')}
          />

          {!transaction && (
            <p className="flex flex-wrap items-center gap-x-4 border-t border-hairline pt-1 text-xs text-slate-500">
              {translate('cmp.txModal.elseTitle')}
              <button type="button" onClick={() => goTo('/loans')} className={LINK_BLOCK}>
                {translate('cmp.txModal.elseLoans')}
              </button>
              {/* Like Move money: on top of this form, taking the amount and wallet along. */}
              <button type="button" onClick={() => setSavingsChooserOpen(true)} className={LINK_BLOCK}>
                {translate('home.form.elseSavings')}
              </button>
              {/* Opens on top of this form and takes the amount along, so nothing typed is lost. */}
              <button type="button" onClick={() => setTransferOpen(true)} className={LINK_BLOCK}>
                {translate('cmp.txModal.elseTransfer')}
              </button>
            </p>
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

      {/* Move money, on top of the form: saving it closes both, cancelling returns here. */}
      <BalanceTransferModal
        open={open && transferOpen}
        presetAmount={total > 0 ? total : undefined}
        onClose={() => setTransferOpen(false)}
        onSaved={() => { setTransferOpen(false); onSaved(); onClose() }}
      />

      {/* Savings, the same way: pick the kind, then pay it. Saving closes everything; backing out of
          either returns to this form with what was typed still in it. */}
      <Sheet
        open={open && savingsChooserOpen}
        onClose={() => setSavingsChooserOpen(false)}
        title={translate('home.form.elseSavings')}
        maxWidth="max-w-md"
      >
        <div className="space-y-2">
          {(['INVESTMENTS', 'EMERGENCY', 'DONATION'] as Bucket[]).map(b => (
            <button
              key={b}
              type="button"
              onClick={() => {
                // The chooser gives focus back before the dialog takes it, so closing the dialog
                // lands on this form's Savings link rather than on a button that no longer exists.
                setSavingsChooserOpen(false)
                setTimeout(() => setSavingsBucket(b), 0)
              }}
              className="focus-ring flex min-h-[56px] w-full items-center gap-3 rounded-control border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            >
              <IconChip tone={SAVINGS_ICON[b].tone}>{SAVINGS_ICON[b].icon}</IconChip>
              {translate(SAVINGS_NAME_KEY[b])}
            </button>
          ))}
        </div>
      </Sheet>
      <PayBucketModal
        open={open && !!savingsBucket}
        bucket={savingsBucket}
        currency={defaultCurrency}
        defaultMonth={todayLocal().slice(0, 7)}
        presetAmount={total > 0 ? total : undefined}
        // A split cannot be carried: the dialog pays from one wallet.
        presetWallet={!split && (typeof wallet === 'number' || wallet === 'cash') ? wallet : undefined}
        onClose={() => setSavingsBucket(null)}
        onSaved={() => { setSavingsBucket(null); onSaved(); onClose() }}
      />
    </>
  )
}
