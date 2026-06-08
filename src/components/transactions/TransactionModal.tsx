import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, X, ChevronRight } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { useToast } from '../../context/ToastContext'
import { categoriesApi } from '../../api/categories'
import { cardsApi } from '../../api/cards'
import { transactionsApi } from '../../api/transactions'
import { financeApi } from '../../api/finance'
import { cashBalancesApi } from '../../api/cashBalances'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency } from '../../utils/format'
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
}

const INCOME_SUB_TYPES: { value: TransactionSubType; label: string; hint: string }[] = [
  { value: 'REGULAR_INCOME',      label: 'Regular Income',      hint: 'Salary, freelance…' },
  { value: 'LOAN_RECEIVED',       label: 'Loan Received',       hint: 'Creates Loans Borrowed' },
  { value: 'LOAN_RETURNED_TO_ME', label: 'Loan Returned to Me', hint: 'Someone paid you back' },
]
const EXPENSE_SUB_TYPES: { value: TransactionSubType; label: string; hint: string }[] = [
  { value: 'REGULAR_EXPENSE',   label: 'Regular Expense',   hint: 'Shopping, food, bills…' },
  { value: 'LOAN_GIVEN',        label: 'Loan Given',        hint: 'Creates Loans Lent' },
  { value: 'LOAN_REPAYMENT',    label: 'Loan Repayment',    hint: 'Paying back owed money' },
  { value: 'BANK_LOAN_PAYMENT', label: 'Bank Loan Payment', hint: 'Monthly bank instalment' },
  { value: 'INVESTMENT',        label: 'Investment',        hint: 'Creates Investment record' },
  { value: 'DONATION',          label: 'Donation',          hint: 'Creates Donation record' },
]
const NEEDS_COUNTERPARTY = new Set<TransactionSubType>([
  'LOAN_RECEIVED','LOAN_RETURNED_TO_ME','LOAN_GIVEN','LOAN_REPAYMENT','BANK_LOAN_PAYMENT','INVESTMENT','DONATION',
])
const COUNTERPARTY_LABEL: Partial<Record<TransactionSubType, string>> = {
  LOAN_RECEIVED: 'Lender Name', LOAN_RETURNED_TO_ME: 'Debtor Name', LOAN_GIVEN: 'Borrower Name',
  LOAN_REPAYMENT: 'Lender / Creditor', BANK_LOAN_PAYMENT: 'Bank Name',
  INVESTMENT: 'Asset / Platform', DONATION: 'Recipient Name',
}
const AUTO_CREATES = new Set<TransactionSubType>(['LOAN_RECEIVED','LOAN_GIVEN','INVESTMENT','DONATION'])
const COLORS = ['#10b981','#f43f5e','#6366f1','#f59e0b','#06b6d4','#a855f7','#ec4899','#14b8a6','#3b82f6','#ef4444','#8b5cf6','#6b7280']

const defaultForm = (currency: Currency): TransactionRequest => ({
  type: 'EXPENSE', amount: 0, currency, description: '',
  transactionDate: new Date().toISOString().split('T')[0], subType: 'REGULAR_EXPENSE',
})

/** First day of next month as YYYY-MM (for the "payment starts" month picker default). */
function nextMonthStr() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}


export function TransactionModal({ open, onClose, onSaved, transaction, defaultCurrency, preselectCardId }: Props) {
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

  // Autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // New root category inline form
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCat, setNewCat] = useState<CategoryRequest>({ name: '', type: 'EXPENSE', color: '#6366f1' })
  const [creatingCat, setCreatingCat] = useState(false)

  // New sub-category inline form (inside sub-category column)
  const [showNewSubCat, setShowNewSubCat] = useState(false)
  const [newSubCat, setNewSubCat] = useState<CategoryRequest>({ name: '', type: 'EXPENSE', color: '#6366f1' })
  const [creatingSubCat, setCreatingSubCat] = useState(false)

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

  // Payment method: card-only (default), cash-only (no card touched), or both (split).
  type PaymentMode = 'CARD' | 'CASH' | 'BOTH'
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CARD')
  const [cashInput, setCashInput] = useState<number>(0)
  const [cardInput, setCardInput] = useState<number>(0)

  // Bank-name autocomplete (BANK_LOAN_PAYMENT counterparty).
  const [bankOptions, setBankOptions] = useState<string[]>([])
  const [showBankPopover, setShowBankPopover] = useState(false)

  // Current cash balance for the active currency — shown next to Cash/Both inputs.
  const [cashBalance, setCashBalance] = useState<number | null>(null)

  const loadRoots = useCallback(async (type?: CategoryType, subType?: TransactionSubType) => {
    const res = await categoriesApi.getAll(type, subType).catch(() => null)
    if (res) setRootCategories(res.data)
  }, [])

  const loadSubs = useCallback(async (parentId: number) => {
    const res = await categoriesApi.getSubCategories(parentId).catch(() => null)
    setSubCategories(res?.data ?? [])
  }, [])

  // Auto-select the root category when exactly one matches the sub-type filter,
  // unless the user is editing (where we already have a chosen category).
  useEffect(() => {
    if (transaction) return
    if (rootCategories.length === 1 && !selectedRootId) {
      const only = rootCategories[0]
      setSelectedRootId(only.id)
      setForm(prev => ({ ...prev, categoryId: only.id }))
      loadSubs(only.id)
    }
  }, [rootCategories, transaction, selectedRootId, loadSubs])

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
    cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
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
      .then(r => setActiveLoansGiven(r.data.filter(l => l.status !== 'PAID')))
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
      }
      setForm(f)
      const cat = transaction.category
      const rootId = cat?.parentId ?? cat?.id
      setSelectedRootId(rootId)
      loadRoots(transaction.type === 'INCOME' ? 'INCOME' : 'EXPENSE', f.subType)
      if (rootId) loadSubs(rootId)
    } else {
      // New transaction — optionally pre-target a card (per-card quick-add on the Cards page).
      setForm({ ...defaultForm(defaultCurrency), cardId: preselectCardId })
      setSelectedRootId(undefined); setSubCategories([])
      loadRoots('EXPENSE', 'REGULAR_EXPENSE')
    }
    setError(null); setIsBalanceError(false); setValidationError(null)
    setShowNewCat(false); setShowNewSubCat(false); setSuggestions([])
    setSelectedInvestmentId(undefined); setInvestmentMode('existing')
    // Initialize payment mode from the transaction being edited, else default to Card-only.
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
    setBankOptions([]); setShowBankPopover(false)
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current) }
  }, [open, transaction, defaultCurrency, preselectCardId, loadRoots, loadSubs])

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

  const set = <K extends keyof TransactionRequest>(key: K, value: TransactionRequest[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const switchType = (t: TransactionType) => {
    const st: TransactionSubType = t === 'INCOME' ? 'REGULAR_INCOME' : 'REGULAR_EXPENSE'
    setForm(prev => ({ ...prev, type: t, subType: st, categoryId: undefined, investmentId: undefined,
      // Reset kind-specific extras on type switch so stale FOOD/TRANSPORT data doesn't leak.
      fromLocation: undefined, toLocation: undefined, cashAmount: 0, currency: defaultCurrency }))
    setSelectedRootId(undefined); setSubCategories([])
    setShowNewCat(false); setShowNewSubCat(false)
    setSelectedInvestmentId(undefined); setInvestmentMode('existing')
    loadRoots(t === 'INCOME' ? 'INCOME' : 'EXPENSE', st)
    setNewCat(p => ({ ...p, type: t === 'INCOME' ? 'INCOME' : 'EXPENSE' }))
  }

  const switchSubType = (st: TransactionSubType) => {
    setForm(prev => ({ ...prev, subType: st, categoryId: undefined, investmentId: undefined }))
    setSelectedRootId(undefined); setSubCategories([])
    setShowNewCat(false); setShowNewSubCat(false)
    setSelectedInvestmentId(undefined); setInvestmentMode('existing')
    loadRoots(form.type === 'INCOME' ? 'INCOME' : 'EXPENSE', st)
  }

  const selectRoot = (id: number | undefined) => {
    setSelectedRootId(id); setSubCategories([])
    setForm(prev => ({ ...prev, categoryId: id }))
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
    setCreatingCat(true)
    try {
      const res = await categoriesApi.create({ ...newCat, applicableSubType: form.subType })
      const created = res.data
      setRootCategories(prev => [...prev, created])
      selectRoot(created.id)
      setShowNewCat(false)
      setNewCat({ name: '', type: form.type === 'INCOME' ? 'INCOME' : 'EXPENSE', color: '#6366f1' })
    } catch { /* ignore */ } finally { setCreatingCat(false) }
  }

  // Create new SUB-CATEGORY under the selected root
  const handleCreateSubCategory = async () => {
    if (!newSubCat.name.trim() || !selectedRootId) return
    setCreatingSubCat(true)
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
    } catch { /* ignore */ } finally { setCreatingSubCat(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Manual validation: category is mandatory
    if (!selectedRootId) {
      setValidationError('Please select a category')
      return
    }
    // Sub-category mandatory when available
    if (subCategories.length > 0 && form.categoryId === selectedRootId) {
      setValidationError('Please select a sub-category')
      return
    }
    // Investment validation
    if (form.subType === 'INVESTMENT' && investmentMode === 'existing' && !selectedInvestmentId && existingInvestments.length > 0) {
      setValidationError('Please select an investment or switch to "Create New"')
      return
    }
    // Payment mode-driven validation
    if (paymentMode === 'CARD' && !form.cardId) {
      setValidationError('Select a card or switch the payment method'); return
    }
    if (paymentMode === 'BOTH') {
      if (!form.cardId) { setValidationError('Pick a card for the card portion'); return }
      if ((cashInput || 0) <= 0 || (cardInput || 0) <= 0) {
        setValidationError('Enter both cash and card amounts (use Card-only or Cash-only otherwise)'); return
      }
    }
    if ((form.amount || 0) <= 0) {
      setValidationError('Amount must be greater than 0'); return
    }

    // Description requirement honours the selected category's flag.
    // (FOOD's "place" semantics now flow through the description label mechanism.)
    if (descriptionRequired && !(form.description && form.description.trim())) {
      setValidationError(`Please fill in the ${descriptionLabel.toLowerCase()}`); return
    }

    // Counterparty rules — skip when the donation is anonymous (auto-filled below).
    if (form.subType && NEEDS_COUNTERPARTY.has(form.subType)
        && !isAnonymousDonation
        && !(['LOAN_REPAYMENT','LOAN_RETURNED_TO_ME'] as TransactionSubType[]).includes(form.subType)
        && !(form.counterpartyName && form.counterpartyName.trim())) {
      setValidationError(`${COUNTERPARTY_LABEL[form.subType] ?? 'Counterparty'} is required`); return
    }

    setValidationError(null)
    setSaving(true); setError(null); setIsBalanceError(false)
    try {
      // LOAN_REPAYMENT with a specific loan → atomic repay (expense + loan update)
      if (form.subType === 'LOAN_REPAYMENT' && selectedLoanId && !transaction) {
        const loan = activeLoans.find(l => l.id === selectedLoanId)
        if (loan && form.amount > loan.remainingAmount) {
          setError(`Cannot exceed remaining balance: ${formatCurrency(loan.remainingAmount, loan.currency as Currency)}`)
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
          setError(`Cannot exceed pending amount: ${formatCurrency(loan.pendingAmount, loan.currency as Currency)}`)
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
      onSaved(); onClose()
      showSuccess(transaction ? 'Transaction updated' : 'Transaction saved')
    } catch (err: unknown) {
      const msg = extractErrorMessage(err)
      setError(msg)
      setIsBalanceError(msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance'))
    } finally { setSaving(false) }
  }

  const subTypes = form.type === 'INCOME' ? INCOME_SUB_TYPES : EXPENSE_SUB_TYPES
  // CASH cards are legacy — they're migrated to CashBalance on the backend on next boot.
  // Defensively exclude them from the picker so "Card only" never offers a cash wallet.
  const filteredCards = cards.filter(c => c.currency === form.currency && c.type !== 'CASH')
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

  // Description label / requiredness flow from the most-specific selected category,
  // falling back to "Description" + required for plain transactions.
  const descriptionLabel = activeCategory?.descriptionLabel || 'Description'
  const descriptionRequired = activeCategory?.descriptionRequired ?? true

  // Donation anonymity — the selected sub-category (or its parent) declares it.
  const isAnonymousDonation =
    form.subType === 'DONATION' &&
    (Boolean(activeCategory?.anonymizes) ||
      (activeCategory?.parentId != null && Boolean(selectedRoot?.anonymizes)))

  // Total when the user types separate cash + card amounts under "Both".
  const splitTotal = (cashInput || 0) + (cardInput || 0)

  return (
    <Modal open={open} onClose={onClose} title={transaction ? 'Edit Transaction' : 'New Transaction'}>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 1. Income / Expense */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {(['INCOME', 'EXPENSE'] as TransactionType[]).map(t => (
            <button key={t} type="button" onClick={() => switchType(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                form.type === t
                  ? t === 'INCOME' ? 'bg-emerald-500 text-white shadow' : 'bg-rose-500 text-white shadow'
                  : 'text-slate-500 hover:text-slate-700'}`}>
              {t === 'INCOME' ? 'Income' : 'Expense'}
            </button>
          ))}
        </div>

        {/* 2. Sub-type (2 per row) */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Transaction Type</label>
          <div className="grid grid-cols-2 gap-1.5">
            {subTypes.map(s => (
              <button key={s.value} type="button" onClick={() => switchSubType(s.value)}
                className={`flex items-start gap-2 px-2.5 py-2 rounded-xl border text-left transition-all ${
                  form.subType === s.value ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                <div className={`w-3 h-3 rounded-full mt-1 shrink-0 border-2 ${form.subType === s.value ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-semibold leading-tight ${form.subType === s.value ? 'text-indigo-700' : 'text-slate-700'}`}>{s.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{s.hint}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 3+4. Category + Sub-category — SAME ROW when subs exist */}
        <div>
          {/* Validation error */}
          {validationError && (
            <p className="text-rose-500 text-xs mb-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
              {validationError}
            </p>
          )}

          {/* New category inline form — full width */}
          {showNewCat && (
            <>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-500">New Category</label>
                <button type="button" onClick={() => setShowNewCat(false)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
              <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-3 space-y-2">
                <input value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Category name" autoFocus />
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setNewCat(p => ({ ...p, color: c }))}
                        className={`w-5 h-5 rounded-full transition-transform ${newCat.color === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <button type="button" onClick={handleCreateCategory} disabled={creatingCat || !newCat.name.trim()}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 shrink-0">
                    {creatingCat ? <Spinner className="w-3 h-3" /> : <Plus className="w-3 h-3" />} Create
                  </button>
                </div>
              </div>
            </>
          )}

          {!showNewCat && (
            /* Category + Sub-category grid: full-width category, sub-category column appears
               once a root is picked (even when it has no children yet — user can create one). */
            <div className={`grid gap-2 ${selectedRootId ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* Category column */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-500">Category *</label>
                  <button type="button" onClick={() => setShowNewCat(true)}
                    className="flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    <Plus className="w-3 h-3" /> New
                  </button>
                </div>
                <select
                  required
                  value={selectedRootId ?? ''}
                  onChange={e => selectRoot(e.target.value ? Number(e.target.value) : undefined)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                    validationError && !selectedRootId ? 'border-rose-400' : 'border-slate-200'}`}>
                  <option value="">Select category *</option>
                  {rootCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Sub-category column — visible as soon as a root is selected. */}
              {selectedRootId && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-1 text-xs font-medium text-slate-500">
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      {hasSubs ? 'Sub-category *' : 'Sub-category'}
                    </label>
                    <button type="button" onClick={() => { setShowNewSubCat(v => !v) }}
                      className="flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      {showNewSubCat ? <><X className="w-3 h-3" /></> : <><Plus className="w-3 h-3" /> New</>}
                    </button>
                  </div>

                  {showNewSubCat ? (
                    /* Inline sub-category creation — also captures custom description label/required. */
                    <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-2.5 space-y-2">
                      <input value={newSubCat.name} onChange={e => setNewSubCat(p => ({ ...p, name: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        placeholder="Sub-category name" autoFocus />
                      <input value={newSubCat.descriptionLabel ?? ''}
                        onChange={e => setNewSubCat(p => ({ ...p, descriptionLabel: e.target.value || undefined }))}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        placeholder='Description field label (e.g. "Doctor name") — optional' />
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input type="checkbox"
                          checked={newSubCat.descriptionRequired ?? true}
                          onChange={e => setNewSubCat(p => ({ ...p, descriptionRequired: e.target.checked }))}
                          className="w-3.5 h-3.5 rounded text-emerald-600" />
                        Description required
                      </label>
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-wrap gap-1 flex-1">
                          {COLORS.map(c => (
                            <button key={c} type="button" onClick={() => setNewSubCat(p => ({ ...p, color: c }))}
                              className={`w-4 h-4 rounded-full transition-transform ${newSubCat.color === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'hover:scale-110'}`}
                              style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <button type="button" onClick={handleCreateSubCategory} disabled={creatingSubCat || !newSubCat.name.trim()}
                          className="px-2.5 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 shrink-0">
                          {creatingSubCat ? <Spinner className="w-3 h-3" /> : <Plus className="w-3 h-3" />} Add
                        </button>
                      </div>
                    </div>
                  ) : hasSubs ? (
                    <select
                      required
                      value={subCatValue}
                      onChange={e => set('categoryId', e.target.value ? Number(e.target.value) : selectedRootId)}
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                        validationError && subCategories.length > 0 && form.categoryId === selectedRootId ? 'border-rose-400' : 'border-indigo-200'}`}>
                      <option value="">Select sub-category *</option>
                      {subCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <button type="button" onClick={() => setShowNewSubCat(true)}
                      className="w-full border border-dashed border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                      + Add sub-category
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4b. Kind-specific extras — TRANSPORT shows from/to (FOOD uses descriptionLabel). */}
        {selectedRootId && showRouteFields && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                From <span className="text-slate-300">(optional)</span>
              </label>
              <input
                value={form.fromLocation ?? ''}
                onChange={e => set('fromLocation', e.target.value)}
                placeholder="e.g. Kvartira"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                To <span className="text-slate-300">(optional)</span>
              </label>
              <input
                value={form.toLocation ?? ''}
                onChange={e => set('toLocation', e.target.value)}
                placeholder="e.g. Chilonzor metro"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
        )}

        {/* 5. Counterparty / Loan selector */}
        {form.subType === 'LOAN_REPAYMENT' && !transaction ? (
          /* For LOAN_REPAYMENT: show active loans dropdown instead of free text */
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Select Loan to Repay</label>
            {activeLoans.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl px-3 py-3 text-xs text-slate-400 text-center">
                No active borrowed loans found. <br />Add a loan first from Finance → Loans tab.
              </div>
            ) : (
              <>
                <select value={selectedLoanId ?? ''}
                  onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : undefined
                    setSelectedLoanId(id)
                    const loan = activeLoans.find(l => l.id === id)
                    if (loan) {
                      set('amount', loan.remainingAmount)
                      set('currency', loan.currency as Currency)
                      set('description', `Loan repayment to ${loan.lenderName}`)
                      set('counterpartyName', loan.lenderName)
                    }
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">— Select a loan (or enter manually below) —</option>
                  {activeLoans.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.lenderName} · Remaining: {formatCurrency(l.remainingAmount, l.currency as Currency)} · {l.status}
                    </option>
                  ))}
                </select>
                {selectedLoanId && (() => {
                  const loan = activeLoans.find(l => l.id === selectedLoanId)
                  return loan ? (
                    <div className="mt-1.5 flex items-center justify-between px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700">
                      <span>Max payable: <strong>{formatCurrency(loan.remainingAmount, loan.currency as Currency)}</strong></span>
                      <span>{loan.status}</span>
                    </div>
                  ) : null
                })()}
              </>
            )}
          </div>
        ) : form.subType === 'LOAN_RETURNED_TO_ME' && !transaction ? (
          /* For LOAN_RETURNED_TO_ME: show active lent loans dropdown */
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Select Loan That Was Returned</label>
            {activeLoansGiven.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl px-3 py-3 text-xs text-slate-400 text-center">
                No active lent loans found. <br />Add a loan first from Finance → Loans tab.
              </div>
            ) : (
              <>
                <select value={selectedLoanGivenId ?? ''}
                  onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : undefined
                    setSelectedLoanGivenId(id)
                    const loan = activeLoansGiven.find(l => l.id === id)
                    if (loan) {
                      set('amount', loan.pendingAmount)
                      set('currency', loan.currency as Currency)
                      set('description', `Loan returned by ${loan.debtorName}`)
                      set('counterpartyName', loan.debtorName)
                    }
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">— Select a loan (or enter manually below) —</option>
                  {activeLoansGiven.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.debtorName} · Pending: {formatCurrency(l.pendingAmount, l.currency as Currency)} · {l.status}
                    </option>
                  ))}
                </select>
                {selectedLoanGivenId && (() => {
                  const loan = activeLoansGiven.find(l => l.id === selectedLoanGivenId)
                  return loan ? (
                    <div className="mt-1.5 flex items-center justify-between px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700">
                      <span>Max receivable: <strong>{formatCurrency(loan.pendingAmount, loan.currency as Currency)}</strong></span>
                      <span>{loan.status}</span>
                    </div>
                  ) : null
                })()}
              </>
            )}
          </div>
        ) : form.subType && NEEDS_COUNTERPARTY.has(form.subType) && !isAnonymousDonation ? (
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1">{COUNTERPARTY_LABEL[form.subType] ?? 'Name'} *</label>
            <input required value={form.counterpartyName ?? ''}
              onChange={e => set('counterpartyName', e.target.value)}
              onFocus={() => { if (form.subType === 'BANK_LOAN_PAYMENT' && bankOptions.length > 0) setShowBankPopover(true) }}
              onBlur={() => setTimeout(() => setShowBankPopover(false), 150)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Enter name..." autoComplete="off" />
            {form.subType === 'BANK_LOAN_PAYMENT' && showBankPopover && bankOptions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {bankOptions
                  .filter(b => !form.counterpartyName || b.toLowerCase().includes(form.counterpartyName.toLowerCase()))
                  .map(b => (
                    <button key={b} type="button"
                      onMouseDown={() => { set('counterpartyName', b); setShowBankPopover(false) }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">{b}</button>
                  ))}
              </div>
            )}
          </div>
        ) : isAnonymousDonation ? (
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs text-slate-500">
            Anonymous donation — recipient details are intentionally omitted.
          </div>
        ) : null}
        {form.subType === 'INVESTMENT' && (
          <div className="space-y-2">
            {/* Mode toggle */}
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              <button type="button" onClick={() => { setInvestmentMode('existing'); set('investmentId', undefined) }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${investmentMode === 'existing' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Add to Existing
              </button>
              <button type="button" onClick={() => { setInvestmentMode('new'); setSelectedInvestmentId(undefined); set('investmentId', undefined) }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${investmentMode === 'new' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Create New
              </button>
            </div>

            {investmentMode === 'existing' ? (
              existingInvestments.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-xl px-3 py-3 text-xs text-slate-400 text-center">
                  No investments yet. Switch to "Create New" to record your first investment.
                </div>
              ) : (
                <>
                  <label className="block text-xs font-medium text-slate-500">Select Investment *</label>
                  <select
                    value={selectedInvestmentId ?? ''}
                    onChange={e => {
                      const id = e.target.value ? Number(e.target.value) : undefined
                      setSelectedInvestmentId(id)
                      set('investmentId', id)
                      const inv = existingInvestments.find(i => i.id === id)
                      if (inv) {
                        set('currency', inv.currency as import('../../types').Currency)
                        set('counterpartyName', inv.name)
                        if (!form.description) set('description', `Add funds to ${inv.name}`)
                      }
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">— Select an investment —</option>
                    {existingInvestments.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} · {i.type.replace('_', ' ')} · {formatCurrency(i.investedAmount, i.currency as import('../../types').Currency)}
                      </option>
                    ))}
                  </select>
                  {selectedInvestmentId && (() => {
                    const inv = existingInvestments.find(i => i.id === selectedInvestmentId)
                    return inv ? (
                      <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-50 border border-cyan-100 rounded-lg text-xs text-cyan-700">
                        <span>Current total: <strong>{formatCurrency(inv.investedAmount, inv.currency as import('../../types').Currency)}</strong></span>
                        <span className="bg-cyan-100 px-2 py-0.5 rounded-full">{inv.type.replace('_', ' ')}</span>
                      </div>
                    ) : null
                  })()}
                </>
              )
            ) : (
              /* Create new — show investment type */
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Investment Type</label>
                <select value={form.investmentType ?? 'OTHER'} onChange={e => set('investmentType', e.target.value as InvestmentType)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {(['REAL_ESTATE','BONDS','MUTUAL_FUND','GOLD','OTHER'] as InvestmentType[]).map(t => (
                    <option key={t} value={t}>{t.replace('_',' ')}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* 6. Description — only rendered when the (sub-)category marks it required.
            When optional, the field is hidden entirely; the user can still use Note. */}
        {descriptionRequired && (
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {descriptionLabel} *
            </label>
            <input value={form.description ?? ''} onChange={e => handleDescriptionChange(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder={`e.g. ${descriptionLabel === 'Description' ? 'Monthly salary' : descriptionLabel}`}
              autoComplete="off" />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {suggestions.map(s => (
                  <button key={s} type="button" onMouseDown={() => { set('description', s); setSuggestions([]); setShowSuggestions(false) }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">{s}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Currency comes from the header switcher — no per-transaction override. */}

        {/* 8. Payment method — Card only / Cash only / Both, then matching inputs. */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Payment method</label>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {([
              { value: 'CARD', label: 'Card only' },
              { value: 'CASH', label: 'Cash only' },
              { value: 'BOTH', label: 'Both' },
            ] as { value: PaymentMode; label: string }[]).map(opt => (
              <button key={opt.value} type="button"
                onClick={() => setPaymentMode(opt.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                  paymentMode === opt.value
                    ? opt.value === 'CASH' ? 'bg-amber-500 text-white shadow' :
                      opt.value === 'CARD' ? 'bg-indigo-600 text-white shadow' :
                      'bg-slate-700 text-white shadow'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* CARD only — card selector FIRST, then amount.
            The user asked for this order so the amount input shows the currency context
            (and the available balance hint) before they enter a number. */}
        {paymentMode === 'CARD' && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Card / Wallet *</label>
              <select required value={form.cardId ?? ''} onChange={e => set('cardId', e.target.value ? Number(e.target.value) : undefined)}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 ${isBalanceError ? 'border-rose-400 focus:ring-rose-300' : 'border-slate-200 focus:ring-indigo-300'}`}>
                <option value="">— Choose a card —</option>
                {filteredCards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} •••• {c.lastFourDigits} · {formatCurrency(c.currentBalance ?? 0, c.currency)}
                  </option>
                ))}
              </select>
              {selectedCard && form.type === 'EXPENSE' && (
                <p className="text-xs text-slate-400 mt-1 pl-1">Available: {formatCurrency(selectedCard.currentBalance ?? 0, selectedCard.currency)}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Amount *</label>
              <AmountInput
                required
                value={form.amount || 0}
                currency={defaultCurrency}
                onChange={v => { set('amount', v); setCardInput(v) }}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${isBalanceError ? 'border-rose-400 focus:ring-rose-300 bg-rose-50' : 'border-slate-200 focus:ring-indigo-300'}`}
                placeholder="0"
                suffix={defaultCurrency}
              />
            </div>
          </>
        )}

        {/* CASH only — amount + current cash-balance hint. */}
        {paymentMode === 'CASH' && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Cash amount *</label>
              <AmountInput
                required
                value={form.amount || 0}
                currency={defaultCurrency}
                onChange={v => { set('amount', v); setCashInput(v) }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                placeholder="0"
                suffix={defaultCurrency}
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
              <span>
                Will adjust your <strong>{defaultCurrency} cash balance</strong>
                {cashBalance !== null && (
                  <> · current {formatCurrency(cashBalance, defaultCurrency)}</>
                )}
              </span>
            </div>
          </>
        )}

        {/* BOTH — card selector first, then cash + card amount inputs. Saved as ONE
            transaction (amount = cash + card, cashAmount = cash) so the global list shows
            a single row, the per-card view shows the card portion, and the cash view
            shows the cash portion. */}
        {paymentMode === 'BOTH' && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Card / Wallet *</label>
              <select required value={form.cardId ?? ''} onChange={e => set('cardId', e.target.value ? Number(e.target.value) : undefined)}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 ${isBalanceError ? 'border-rose-400 focus:ring-rose-300' : 'border-slate-200 focus:ring-indigo-300'}`}>
                <option value="">— Choose a card —</option>
                {filteredCards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} •••• {c.lastFourDigits} · {formatCurrency(c.currentBalance ?? 0, c.currency)}
                  </option>
                ))}
              </select>
              {selectedCard && form.type === 'EXPENSE' && (
                <p className="text-xs text-slate-400 mt-1 pl-1">Available: {formatCurrency(selectedCard.currentBalance ?? 0, selectedCard.currency)}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cash amount *</label>
                <AmountInput
                  required
                  value={cashInput || 0}
                  currency={defaultCurrency}
                  onChange={v => setCashInput(v)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Card amount *</label>
                <AmountInput
                  required
                  value={cardInput || 0}
                  currency={defaultCurrency}
                  onChange={v => setCardInput(v)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm">
              <span className="text-xs text-slate-400">Total</span>
              <span className="font-semibold text-slate-700">{formatCurrency(splitTotal, defaultCurrency)}</span>
            </div>
            <div className="text-xs text-slate-500 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
              One transaction will be saved with a split badge. The cash portion adjusts your
              <strong> {defaultCurrency} cash balance</strong>; the card portion hits the selected card.
            </div>
          </>
        )}

        {/* 9. Date */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Date *</label>
          <input required type="date" value={form.transactionDate} onChange={e => set('transactionDate', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>

        {/* 9b. Payment starts — when borrowed money begins counting toward the tier. */}
        {form.subType === 'LOAN_RECEIVED' && !transaction && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Repayments start</label>
            <input type="month"
              value={form.paymentStartDate ? form.paymentStartDate.slice(0, 7) : nextMonthStr()}
              onChange={e => set('paymentStartDate', e.target.value ? `${e.target.value}-01` : undefined)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <p className="text-[11px] text-slate-400 mt-1">
              Defaults to next month — the tier &amp; allocation guidance only count this loan from this month on.
            </p>
          </div>
        )}

        {/* 10. Note */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Note</label>
          <textarea rows={2} value={form.note ?? ''} onChange={e => set('note', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            placeholder="Optional note..." />
        </div>

        {form.subType && AUTO_CREATES.has(form.subType) && (
          form.subType === 'INVESTMENT' ? (
            investmentMode === 'existing' && selectedInvestmentId ? (
              <div className="bg-cyan-50 border border-cyan-100 rounded-xl px-3 py-2 text-xs text-cyan-700">
                Funds will be added to the selected investment in Finance.
              </div>
            ) : investmentMode === 'new' ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-xs text-indigo-700">
                A new <strong>Investment</strong> record will be created in Finance.
              </div>
            ) : null
          ) : (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-xs text-indigo-700">
              A <strong>{subTypes.find(s => s.value === form.subType)?.label}</strong> record will also be created in Finance.
            </div>
          )
        )}

        {error && (
          <div className={`px-3 py-2.5 rounded-xl text-sm border ${isBalanceError ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-rose-50 border-rose-200 text-rose-500'}`}>
            {isBalanceError && <p className="font-semibold mb-0.5">Insufficient Balance</p>}
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? 'Saving…' : transaction ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
