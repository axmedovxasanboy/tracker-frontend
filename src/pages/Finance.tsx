import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { Plus, Pencil, Trash2, AlertCircle, CheckCircle, Clock, TrendingUp, TrendingDown, CreditCard, X, ArrowUpRight, History, Wallet, ArrowUp, ArrowDown, DollarSign } from 'lucide-react'
import { format, differenceInCalendarMonths } from 'date-fns'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { AmountInput } from '../components/ui/AmountInput'
import { RepaymentModal } from '../components/finance/RepaymentModal'
import { PaySubscriptionModal } from '../components/finance/PaySubscriptionModal'
import { useApi } from '../hooks/useApi'
import { financeApi } from '../api/finance'
import { categoriesApi } from '../api/categories'
import { formatCurrency, snap } from '../utils/format'
import type {
  Currency, RecordStatus,
  DebtRequest, DebtResponse, LoanGivenRequest, LoanGivenResponse,
  LoanTakenRequest, LoanTakenResponse,
  BankLoanRequest, MonthlyPaymentRequest, MonthlyPaymentResponse,
} from '../types'

type FinanceTab = 'overview' | 'debts' | 'bank-loans' | 'monthly-payments'
type DebtSubTab = 'debts' | 'loans-given' | 'loans-taken'

const TABS: { id: FinanceTab; label: string; color: string }[] = [
  { id: 'overview',         label: 'Overview',    color: 'indigo' },
  { id: 'debts',            label: 'Loans',       color: 'rose'   },
  { id: 'bank-loans',       label: 'Bank Loans',  color: 'indigo' },
  { id: 'monthly-payments', label: 'Monthly',     color: 'violet' },
]

// No "debts" sub-tab — only Lent and Borrowed
const DEBT_SUB_TABS: { id: DebtSubTab; label: string }[] = [
  { id: 'loans-given', label: 'Lented Money'   },
  { id: 'loans-taken', label: 'Borrowed Money' },
]

const STATUS_BADGE: Record<RecordStatus, { label: string; className: string }> = {
  PENDING:        { label: 'Pending',          className: 'bg-amber-100 text-amber-700' },
  PARTIALLY_PAID: { label: 'Partial',          className: 'bg-blue-100 text-blue-700' },
  PAID:           { label: 'Paid',             className: 'bg-emerald-100 text-emerald-700' },
  OVERDUE:        { label: 'Overdue',          className: 'bg-rose-100 text-rose-700' },
}

function StatusBadge({ status }: { status: RecordStatus }) {
  const { label, className } = STATUS_BADGE[status]
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>{label}</span>
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-2">
      <AlertCircle className="w-10 h-10" />
      <p className="text-sm text-slate-400">No {label} yet</p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Generic action row helpers
// ──────────────────────────────────────────────────────────────────────────────
function ActionButtons({ onEdit, onDelete, deleting }: { onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  return (
    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
      <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button onClick={onDelete} disabled={deleting} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50">
        {deleting ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

export function Finance() {
  const { tab = 'debts' } = useParams<{ tab: FinanceTab }>()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const activeTab = tab as FinanceTab

  // Sub-tab within the "Loans" main tab — default to Lented Money
  const [debtSubTab, setDebtSubTab] = useState<DebtSubTab>('loans-given')
  const eff = activeTab === 'debts' ? debtSubTab : activeTab

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  // Repayment modal state
  type RepayTarget =
    | { kind: 'loan-taken'; record: LoanTakenResponse }
    | { kind: 'debt';       record: DebtResponse }
    | { kind: 'loan-given'; record: LoanGivenResponse }
  const [repayTarget, setRepayTarget] = useState<RepayTarget | null>(null)

  // Loan / debt payment history
  type HistoryTarget =
    | { kind: 'loan-taken'; record: LoanTakenResponse }
    | { kind: 'debt';       record: DebtResponse }
    | { kind: 'loan-given'; record: LoanGivenResponse }
  const [history, setHistory] = useState<HistoryTarget | null>(null)
  const [historySortAsc, setHistorySortAsc] = useState(false)

  const historyApi = useApi(
    () => {
      if (!history) return Promise.resolve({ data: null } as never)
      if (history.kind === 'loan-taken') return financeApi.getLoanTakenRepayments(history.record.id)
      if (history.kind === 'loan-given') return financeApi.getLoanGivenRepayments(history.record.id)
      return financeApi.getDebtRepayments(history.record.id)
    },
    [history?.kind, history?.record.id],
  )

  // Subscription payment flow + history
  const [payTarget, setPayTarget] = useState<MonthlyPaymentResponse | null>(null)
  const [subHistory, setSubHistory] = useState<MonthlyPaymentResponse | null>(null)
  const [subHistorySortAsc, setSubHistorySortAsc] = useState(false)
  const subHistoryApi = useApi(
    () => subHistory
      ? financeApi.getMonthlyPaymentPayments(subHistory.id)
      : Promise.resolve({ data: null } as never),
    [subHistory?.id],
  )

  // All data fetches
  const debts = useApi(() => financeApi.getDebts(), [])
  const loansGiven = useApi(() => financeApi.getLoansGiven(), [])
  const loansTaken = useApi(() => financeApi.getLoansTaken(), [])
  const bankLoans = useApi(() => financeApi.getBankLoans(), [])
  const monthly = useApi(() => financeApi.getMonthlyPayments(), [])
  const categories = useApi(() => categoriesApi.getAll(), [])

  const { showSuccess } = useToast()
  const setTab = (t: FinanceTab) => navigate(`/finance/${t}`)

  const refetchAll = () => {
    const map: Partial<Record<string, () => void>> = {
      'debts': debts.refetch,
      'loans-given': loansGiven.refetch,
      'loans-taken': loansTaken.refetch,
      'bank-loans': bankLoans.refetch,
      'monthly-payments': monthly.refetch,
    }
    // Use effective section so sub-tab refetches work correctly
    map[eff]?.()
  }

  // ── DEBT FORM ──────────────────────────────────────────────────────────────
  const [debtForm, setDebtForm] = useState<DebtRequest>({ creditorName: '', totalAmount: 0, currency: 'USD', borrowedDate: today() })
  const DebtModal = () => {
    const existing = editId ? debts.data?.find(d => d.id === editId) : null
    return (
      <Modal open={modalOpen && eff === 'debts'} onClose={closeModal} title={editId ? 'Edit Debt' : 'New Debt'}>
        <form onSubmit={save} className="space-y-3">
          <Field label="Creditor Name *"><input required value={debtForm.creditorName} onChange={e => setDebtForm(p => ({ ...p, creditorName: e.target.value }))} className={INPUT} placeholder="Who you owe" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Amount *">
              <AmountInput required value={debtForm.totalAmount || 0} currency={debtForm.currency}
                onChange={v => setDebtForm(p => ({ ...p, totalAmount: v }))} className={INPUT} suffix={debtForm.currency} />
            </Field>
            <Field label="Paid Amount">
              <AmountInput value={debtForm.paidAmount || 0} currency={debtForm.currency}
                onChange={v => setDebtForm(p => ({ ...p, paidAmount: v }))} className={INPUT} suffix={debtForm.currency} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency *"><CurrencySelect value={debtForm.currency} onChange={v => setDebtForm(p => ({ ...p, currency: v }))} /></Field>
            <Field label="Status"><StatusSelect value={debtForm.status ?? 'PENDING'} onChange={v => setDebtForm(p => ({ ...p, status: v }))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Borrowed Date *"><input required type="date" value={debtForm.borrowedDate} onChange={e => setDebtForm(p => ({ ...p, borrowedDate: e.target.value }))} className={INPUT} /></Field>
            <Field label="Due Date"><input type="date" value={debtForm.dueDate ?? ''} onChange={e => setDebtForm(p => ({ ...p, dueDate: e.target.value }))} className={INPUT} /></Field>
          </div>
          <Field label="Payment starts">
            <input type="month" value={(debtForm.paymentStartDate ?? '').slice(0, 7)}
              onChange={e => setDebtForm(p => ({ ...p, paymentStartDate: e.target.value ? `${e.target.value}-01` : undefined }))} className={INPUT} />
            <p className="text-[11px] text-slate-400 mt-1">Month this debt starts counting toward the Overview tier. Defaults to next month.</p>
          </Field>
          <Field label="Description"><textarea rows={2} value={debtForm.description ?? ''} onChange={e => setDebtForm(p => ({ ...p, description: e.target.value }))} className={`${INPUT} resize-none`} /></Field>
          <ModalActions onClose={closeModal} saving={saving} isEdit={!!editId} />
        </form>
      </Modal>
    )
  }

  // ── LOAN GIVEN FORM ────────────────────────────────────────────────────────
  const [lgForm, setLgForm] = useState<LoanGivenRequest>({ debtorName: '', totalAmount: 0, currency: 'USD', lentDate: today() })
  const LoanGivenModal = () => (
    <Modal open={modalOpen && eff === 'loans-given'} onClose={closeModal} title={editId ? 'Edit Loan Lent' : 'New Loan Lent'}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Debtor Name *"><input required value={lgForm.debtorName} onChange={e => setLgForm(p => ({ ...p, debtorName: e.target.value }))} className={INPUT} placeholder="Who owes you" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount Lent *">
            <AmountInput required value={lgForm.totalAmount || 0} currency={lgForm.currency}
              onChange={v => setLgForm(p => ({ ...p, totalAmount: v }))} className={INPUT} suffix={lgForm.currency} />
          </Field>
          <Field label="Received Back">
            <AmountInput value={lgForm.receivedAmount || 0} currency={lgForm.currency}
              onChange={v => setLgForm(p => ({ ...p, receivedAmount: v }))} className={INPUT} suffix={lgForm.currency} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency *"><CurrencySelect value={lgForm.currency} onChange={v => setLgForm(p => ({ ...p, currency: v }))} /></Field>
          <Field label="Status"><StatusSelect value={lgForm.status ?? 'PENDING'} onChange={v => setLgForm(p => ({ ...p, status: v }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lent Date *"><input required type="date" value={lgForm.lentDate} onChange={e => setLgForm(p => ({ ...p, lentDate: e.target.value }))} className={INPUT} /></Field>
          <Field label="Expected Return"><input type="date" value={lgForm.expectedReturnDate ?? ''} onChange={e => setLgForm(p => ({ ...p, expectedReturnDate: e.target.value }))} className={INPUT} /></Field>
        </div>
        <Field label="Description"><textarea rows={2} value={lgForm.description ?? ''} onChange={e => setLgForm(p => ({ ...p, description: e.target.value }))} className={`${INPUT} resize-none`} /></Field>
        <ModalActions onClose={closeModal} saving={saving} isEdit={!!editId} />
      </form>
    </Modal>
  )

  // ── LOAN TAKEN FORM ────────────────────────────────────────────────────────
  const [ltForm, setLtForm] = useState<LoanTakenRequest>({ lenderName: '', totalAmount: 0, currency: 'USD', borrowedDate: today() })
  const LoanTakenModal = () => (
    <Modal open={modalOpen && eff === 'loans-taken'} onClose={closeModal} title={editId ? 'Edit Loan Borrowed' : 'New Loan Borrowed'}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Lender Name *"><input required value={ltForm.lenderName} onChange={e => setLtForm(p => ({ ...p, lenderName: e.target.value }))} className={INPUT} placeholder="Who lent you money" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total Amount *">
            <AmountInput required value={ltForm.totalAmount || 0} currency={ltForm.currency}
              onChange={v => setLtForm(p => ({ ...p, totalAmount: v }))} className={INPUT} suffix={ltForm.currency} />
          </Field>
          <Field label="Paid Back">
            <AmountInput value={ltForm.paidAmount || 0} currency={ltForm.currency}
              onChange={v => setLtForm(p => ({ ...p, paidAmount: v }))} className={INPUT} suffix={ltForm.currency} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency *"><CurrencySelect value={ltForm.currency} onChange={v => setLtForm(p => ({ ...p, currency: v }))} /></Field>
          <Field label="Status"><StatusSelect value={ltForm.status ?? 'PENDING'} onChange={v => setLtForm(p => ({ ...p, status: v }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Borrowed Date *"><input required type="date" value={ltForm.borrowedDate} onChange={e => setLtForm(p => ({ ...p, borrowedDate: e.target.value }))} className={INPUT} /></Field>
          <Field label="Due Date"><input type="date" value={ltForm.dueDate ?? ''} onChange={e => setLtForm(p => ({ ...p, dueDate: e.target.value }))} className={INPUT} /></Field>
        </div>
        <Field label="Payment starts">
          <input type="month" value={(ltForm.paymentStartDate ?? '').slice(0, 7)}
            onChange={e => setLtForm(p => ({ ...p, paymentStartDate: e.target.value ? `${e.target.value}-01` : undefined }))} className={INPUT} />
          <p className="text-[11px] text-slate-400 mt-1">Month repayments start counting toward the Overview tier. Defaults to next month.</p>
        </Field>
        <Field label="Description"><textarea rows={2} value={ltForm.description ?? ''} onChange={e => setLtForm(p => ({ ...p, description: e.target.value }))} className={`${INPUT} resize-none`} /></Field>
        <ModalActions onClose={closeModal} saving={saving} isEdit={!!editId} />
      </form>
    </Modal>
  )

  // ── BANK LOAN FORM ─────────────────────────────────────────────────────────
  const [blForm, setBlForm] = useState<BankLoanRequest>({ bankName: '', loanName: '', totalAmount: 0, currency: 'USD', takenDate: today() })
  const BankLoanModal = () => (
    <Modal open={modalOpen && eff === 'bank-loans'} onClose={closeModal} title={editId ? 'Edit Bank Loan' : 'New Bank Loan'}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bank Name *"><input required value={blForm.bankName} onChange={e => setBlForm(p => ({ ...p, bankName: e.target.value }))} className={INPUT} placeholder="e.g. Kapitalbank" /></Field>
          <Field label="Loan Type *">
            <select required value={blForm.loanName} onChange={e => setBlForm(p => ({ ...p, loanName: e.target.value }))} className={`${INPUT} bg-white`}>
              <option value="">Select type *</option>
              <option value="Talim kredit">Talim kredit</option>
              <option value="Avtokredit">Avtokredit</option>
              <option value="Ipoteka / Uy kredit">Ipoteka / Uy kredit</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total Amount *">
            <AmountInput required value={blForm.totalAmount || 0} currency={blForm.currency}
              onChange={v => setBlForm(p => ({ ...p, totalAmount: v }))} className={INPUT} suffix={blForm.currency} />
          </Field>
          <Field label="Currency *"><CurrencySelect value={blForm.currency} onChange={v => setBlForm(p => ({ ...p, currency: v }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Taken Date *"><input required type="date" value={blForm.takenDate} onChange={e => setBlForm(p => ({ ...p, takenDate: e.target.value }))} className={INPUT} /></Field>
          <Field label="End Date"><input type="date" value={blForm.endDate ?? ''} onChange={e => setBlForm(p => ({ ...p, endDate: e.target.value }))} className={INPUT} /></Field>
        </div>
        <Field label="Monthly Payment">
          <AmountInput value={blForm.monthlyPayment ?? 0} currency={blForm.currency}
            onChange={v => setBlForm(p => ({ ...p, monthlyPayment: v > 0 ? v : undefined }))}
            className={INPUT} suffix={blForm.currency} />
          <p className="text-[11px] text-slate-400 mt-1">Average installment — counted as a mandatory debt payment in the Overview dashboard.</p>
        </Field>
        <ModalActions onClose={closeModal} saving={saving} isEdit={!!editId} />
      </form>
    </Modal>
  )

  // ── MONTHLY PAYMENT FORM ───────────────────────────────────────────────────
  const [mpForm, setMpForm] = useState<MonthlyPaymentRequest>({ name: '', amount: 0, currency: 'USD', dueDay: 1, active: true })
  const MonthlyModal = () => (
    <Modal open={modalOpen && eff === 'monthly-payments'} onClose={closeModal} title={editId ? 'Edit Monthly Payment' : 'New Monthly Payment'}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Name *"><input required value={mpForm.name} onChange={e => setMpForm(p => ({ ...p, name: e.target.value }))} className={INPUT} placeholder="Netflix, Rent, etc." /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Amount *">
            <AmountInput required value={mpForm.amount || 0} currency={mpForm.currency}
              onChange={v => setMpForm(p => ({ ...p, amount: v }))} className={INPUT} suffix={mpForm.currency} />
          </Field>
          <Field label="Currency *"><CurrencySelect value={mpForm.currency} onChange={v => setMpForm(p => ({ ...p, currency: v }))} /></Field>
          <Field label="Due Day *"><input required type="number" min="1" max="31" value={mpForm.dueDay} onChange={e => setMpForm(p => ({ ...p, dueDay: +e.target.value }))} className={INPUT} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={mpForm.categoryId ?? ''} onChange={e => setMpForm(p => ({ ...p, categoryId: e.target.value ? +e.target.value : undefined }))} className={`${INPUT} bg-white`}>
              <option value="">— None —</option>
              {(categories.data ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Next Due Date"><input type="date" value={mpForm.nextDueDate ?? ''} onChange={e => setMpForm(p => ({ ...p, nextDueDate: e.target.value }))} className={INPUT} /></Field>
        </div>
        <Field label="Subscribed since">
          <input type="date" value={mpForm.subscribedSince ?? ''}
            onChange={e => setMpForm(p => ({ ...p, subscribedSince: e.target.value || undefined }))}
            className={INPUT} />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={mpForm.active ?? true} onChange={e => setMpForm(p => ({ ...p, active: e.target.checked }))} className="w-4 h-4 rounded text-indigo-600" />
          <span className="text-sm text-slate-600">Active</span>
        </label>
        <Field label="Description"><textarea rows={2} value={mpForm.description ?? ''} onChange={e => setMpForm(p => ({ ...p, description: e.target.value }))} className={`${INPUT} resize-none`} /></Field>
        <ModalActions onClose={closeModal} saving={saving} isEdit={!!editId} />
      </form>
    </Modal>
  )

  // ── Save / Delete logic ────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)

  const closeModal = () => { setModalOpen(false); setEditId(null) }

  const openAdd = () => {
    setEditId(null)
    resetForms()
    setModalOpen(true)
  }

  const resetForms = () => {
    setDebtForm({ creditorName: '', totalAmount: 0, currency: 'USD', borrowedDate: today(), paymentStartDate: nextMonthFirst() })
    setLgForm({ debtorName: '', totalAmount: 0, currency: 'USD', lentDate: today() })
    setLtForm({ lenderName: '', totalAmount: 0, currency: 'USD', borrowedDate: today(), paymentStartDate: nextMonthFirst() })
    setBlForm({ bankName: '', loanName: '', totalAmount: 0, currency: 'USD', takenDate: today() })
    setMpForm({ name: '', amount: 0, currency: 'USD', dueDay: 1, active: true })
  }

  const openEdit = (id: number) => {
    setEditId(id)
    if (eff === 'debts') {
      const d = debts.data?.find(x => x.id === id)!
      setDebtForm({ creditorName: d.creditorName, totalAmount: d.totalAmount, paidAmount: d.paidAmount, currency: d.currency, borrowedDate: d.borrowedDate, dueDate: d.dueDate ?? undefined, paymentStartDate: d.paymentStartDate ?? undefined, status: d.status, description: d.description ?? undefined })
    } else if (eff === 'loans-given') {
      const l = loansGiven.data?.find(x => x.id === id)!
      setLgForm({ debtorName: l.debtorName, totalAmount: l.totalAmount, receivedAmount: l.receivedAmount, currency: l.currency, lentDate: l.lentDate, expectedReturnDate: l.expectedReturnDate ?? undefined, status: l.status, description: l.description ?? undefined })
    } else if (eff === 'loans-taken') {
      const l = loansTaken.data?.find(x => x.id === id)!
      setLtForm({ lenderName: l.lenderName, totalAmount: l.totalAmount, paidAmount: l.paidAmount, currency: l.currency, borrowedDate: l.borrowedDate, dueDate: l.dueDate ?? undefined, paymentStartDate: l.paymentStartDate ?? undefined, status: l.status, description: l.description ?? undefined })
    } else if (eff === 'bank-loans') {
      const b = bankLoans.data?.find(x => x.id === id)!
      setBlForm({ bankName: b.bankName, loanName: b.loanName, totalAmount: b.totalAmount, currency: b.currency, takenDate: b.takenDate, endDate: b.endDate ?? undefined, monthlyPayment: b.monthlyPayment ?? undefined })
    } else if (eff === 'monthly-payments') {
      const m = monthly.data?.find(x => x.id === id)!
      setMpForm({ name: m.name, amount: m.amount, currency: m.currency, dueDay: m.dueDay, active: m.active, description: m.description ?? undefined, nextDueDate: m.nextDueDate ?? undefined, subscribedSince: m.subscribedSince ?? undefined, categoryId: m.category?.id })
    }
    setModalOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (eff === 'debts') { editId ? await financeApi.updateDebt(editId, debtForm) : await financeApi.createDebt(debtForm) }
      else if (eff === 'loans-given') { editId ? await financeApi.updateLoanGiven(editId, lgForm) : await financeApi.createLoanGiven(lgForm) }
      else if (eff === 'loans-taken') { editId ? await financeApi.updateLoanTaken(editId, ltForm) : await financeApi.createLoanTaken(ltForm) }
      else if (eff === 'bank-loans') { editId ? await financeApi.updateBankLoan(editId, blForm) : await financeApi.createBankLoan(blForm) }
      else if (eff === 'monthly-payments') { editId ? await financeApi.updateMonthlyPayment(editId, mpForm) : await financeApi.createMonthlyPayment(mpForm) }
      closeModal()
      refetchAll()
      showSuccess(editId ? 'Record updated successfully' : 'Record created successfully')
    } finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!await confirm({ message: 'Delete this record?', destructive: true })) return
    setDeleting(id)
    try {
      if (eff === 'debts') await financeApi.deleteDebt(id)
      else if (eff === 'loans-given') await financeApi.deleteLoanGiven(id)
      else if (eff === 'loans-taken') await financeApi.deleteLoanTaken(id)
      else if (eff === 'bank-loans') await financeApi.deleteBankLoan(id)
      else if (eff === 'monthly-payments') await financeApi.deleteMonthlyPayment(id)
      refetchAll()
    } finally { setDeleting(null) }
  }

  const tabColor = TABS.find(t => t.id === activeTab)?.color ?? 'indigo'

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Finance</h2>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Tabs */}
      {/* Main tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tabs for Debts & Loans */}
      {activeTab === 'debts' && (
        <div className="flex gap-1 bg-rose-50 border border-rose-100 rounded-xl p-1">
          {DEBT_SUB_TABS.map(s => (
            <button
              key={s.id}
              onClick={() => setDebtSubTab(s.id)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                debtSubTab === s.id ? 'bg-white text-rose-700 shadow-sm' : 'text-rose-400 hover:text-rose-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Totals strip — only on non-overview tabs; pass eff so debt sub-tabs work */}
      {activeTab !== 'overview' && (
        <FinanceTotals
          tab={eff as FinanceTab}
          debts={debts.data ?? []}
          loansGiven={loansGiven.data ?? []}
          loansTaken={loansTaken.data ?? []}
          bankLoans={bankLoans.data ?? []}
          monthly={monthly.data ?? []}
        />
      )}

      {/* Overview dashboard */}
      {activeTab === 'overview' && (
        <FinanceOverview
          debts={debts.data ?? []}
          loansGiven={loansGiven.data ?? []}
          loansTaken={loansTaken.data ?? []}
          bankLoans={bankLoans.data ?? []}
          monthly={monthly.data ?? []}
          onNavigate={setTab}
        />
      )}

      {/* Content */}
      <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${activeTab === 'overview' ? 'hidden' : ''}`}>
        {/* Debts sub-tabs content */}
        {activeTab === 'debts' && eff === 'debts' && (
          debts.loading ? <Loading /> : (debts.data?.length ?? 0) === 0 ? <EmptyState label="debts" /> : (
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
              <THead cols={['Creditor', 'Total', 'Paid', 'Remaining', 'Due Date', 'Status', '']} />
              <tbody className="divide-y divide-slate-50">
                {debts.data?.map(d => (
                  <tr key={d.id} className="group hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-700">{d.creditorName}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatCurrency(d.totalAmount, d.currency)}</td>
                    <td className="px-5 py-3.5 text-emerald-600">{formatCurrency(d.paidAmount, d.currency)}</td>
                    <td className="px-5 py-3.5 text-rose-600 font-medium">{formatCurrency(d.remainingAmount, d.currency)}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{d.dueDate ? format(new Date(d.dueDate), 'dd-MMM-yyyy') : '—'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={d.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {d.status !== 'PAID' && (
                          <button onClick={() => setRepayTarget({ kind: 'debt', record: d })}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-medium transition-colors" title="Repay">
                            <CreditCard className="w-3 h-3" /> Repay
                          </button>
                        )}
                        <button onClick={() => { setHistory({ kind: 'debt', record: d }); setHistorySortAsc(false) }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors" title="Payment history">
                          <History className="w-3 h-3" /> History
                        </button>
                        <ActionButtons onEdit={() => openEdit(d.id)} onDelete={() => del(d.id)} deleting={deleting === d.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )
        )}

        {activeTab === 'debts' && eff === 'loans-given' && (
          loansGiven.loading ? <Loading /> : (loansGiven.data?.length ?? 0) === 0 ? <EmptyState label="loans lent" /> : (
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
              <THead cols={['Debtor', 'Lent', 'Received', 'Pending', 'Expected Return', 'Status', '']} />
              <tbody className="divide-y divide-slate-50">
                {loansGiven.data?.map(l => (
                  <tr key={l.id} className="group hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-700">{l.debtorName}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatCurrency(l.totalAmount, l.currency)}</td>
                    <td className="px-5 py-3.5 text-emerald-600">{formatCurrency(l.receivedAmount, l.currency)}</td>
                    <td className="px-5 py-3.5 text-amber-600 font-medium">{formatCurrency(l.pendingAmount, l.currency)}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{l.expectedReturnDate ? format(new Date(l.expectedReturnDate), 'dd-MMM-yyyy') : '—'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={l.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {l.status !== 'PAID' && (
                          <button onClick={() => setRepayTarget({ kind: 'loan-given', record: l })}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs font-medium transition-colors" title="Mark returned">
                            <CreditCard className="w-3 h-3" /> Returned
                          </button>
                        )}
                        <button onClick={() => { setHistory({ kind: 'loan-given', record: l }); setHistorySortAsc(false) }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors" title="Payment history">
                          <History className="w-3 h-3" /> History
                        </button>
                        <ActionButtons onEdit={() => openEdit(l.id)} onDelete={() => del(l.id)} deleting={deleting === l.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )
        )}

        {activeTab === 'debts' && eff === 'loans-taken' && (
          loansTaken.loading ? <Loading /> : (loansTaken.data?.length ?? 0) === 0 ? <EmptyState label="loans borrowed" /> : (
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
              <THead cols={['Lender', 'Total', 'Paid', 'Remaining', 'Due Date', 'Status', '']} />
              <tbody className="divide-y divide-slate-50">
                {loansTaken.data?.map(l => (
                  <tr key={l.id} className="group hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-700">{l.lenderName}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatCurrency(l.totalAmount, l.currency)}</td>
                    <td className="px-5 py-3.5 text-emerald-600">{formatCurrency(l.paidAmount, l.currency)}</td>
                    <td className="px-5 py-3.5 text-rose-600 font-medium">{formatCurrency(l.remainingAmount, l.currency)}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{l.dueDate ? format(new Date(l.dueDate), 'dd-MMM-yyyy') : '—'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={l.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {l.status !== 'PAID' && (
                          <button onClick={() => setRepayTarget({ kind: 'loan-taken', record: l })}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-medium transition-colors" title="Repay">
                            <CreditCard className="w-3 h-3" /> Repay
                          </button>
                        )}
                        <button onClick={() => { setHistory({ kind: 'loan-taken', record: l }); setHistorySortAsc(false) }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors" title="Payment history">
                          <History className="w-3 h-3" /> History
                        </button>
                        <ActionButtons onEdit={() => openEdit(l.id)} onDelete={() => del(l.id)} deleting={deleting === l.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )
        )}

        {activeTab === 'bank-loans' && (
          bankLoans.loading ? <Loading /> : (bankLoans.data?.length ?? 0) === 0 ? <EmptyState label="bank loans" /> : (
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
              <THead cols={['Bank', 'Loan Type', 'Total Amount', 'Taken Date', 'End Date', '']} />
              <tbody className="divide-y divide-slate-50">
                {bankLoans.data?.map(b => (
                  <tr key={b.id} className="group hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-700">{b.bankName}</td>
                    <td className="px-5 py-3.5"><span className="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-xs font-medium">{b.loanName}</span></td>
                    <td className="px-5 py-3.5 font-semibold text-rose-600">{formatCurrency(b.totalAmount, b.currency)}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{format(new Date(b.takenDate), 'dd-MMM-yyyy')}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{b.endDate ? format(new Date(b.endDate), 'dd-MMM-yyyy') : '—'}</td>
                    <td className="px-5 py-3.5"><ActionButtons onEdit={() => openEdit(b.id)} onDelete={() => del(b.id)} deleting={deleting === b.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )
        )}

        {activeTab === 'monthly-payments' && (
          monthly.loading ? <Loading /> : (monthly.data?.length ?? 0) === 0 ? <EmptyState label="monthly payments" /> : (
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
              <THead cols={['Name', 'Amount', 'Due Day', 'Next Due', 'Subscribed', 'Total paid', 'Category', 'Active', '']} />
              <tbody className="divide-y divide-slate-50">
                {monthly.data?.map(m => {
                  const subSince = m.subscribedSince ? new Date(m.subscribedSince) : null
                  const months = subSince ? Math.max(0, differenceInCalendarMonths(new Date(), subSince)) : null
                  return (
                  <tr key={m.id} className="group hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-700">{m.name}</td>
                    <td className="px-5 py-3.5 text-indigo-600 font-semibold">{formatCurrency(m.amount, m.currency)}</td>
                    <td className="px-5 py-3.5 text-slate-500">Day {m.dueDay}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{m.nextDueDate ? format(new Date(m.nextDueDate), 'dd-MMM') : '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {subSince ? (
                        <span title={format(subSince, 'dd-MMM-yyyy')}>
                          {months === 0 ? 'This month' : `${months} mo${months === 1 ? '' : 's'}`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-emerald-600 text-xs font-semibold">
                      {m.paymentCount > 0
                        ? <span title={`${m.paymentCount} payment${m.paymentCount === 1 ? '' : 's'}`}>{formatCurrency(m.totalPaid, m.currency)}</span>
                        : <span className="text-slate-400 font-normal">—</span>}
                    </td>
                    <td className="px-5 py-3.5">{m.category ? <span className="px-2 py-0.5 rounded-lg text-xs font-medium" style={{ backgroundColor: m.category.color + '20', color: m.category.color }}>{m.category.name}</span> : '—'}</td>
                    <td className="px-5 py-3.5">{m.active ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-slate-300" />}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPayTarget(m)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 text-xs font-medium transition-colors"
                          title="Record a payment">
                          <DollarSign className="w-3.5 h-3.5" /> Pay
                        </button>
                        <button onClick={() => setSubHistory(m)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                          title="Payment history">
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <ActionButtons onEdit={() => openEdit(m.id)} onDelete={() => del(m.id)} deleting={deleting === m.id} />
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table></div>
          )
        )}

      </div>

      {/* Loan / Debt payment history panel */}
      {history && (() => {
        const r = history.record
        const personName =
          history.kind === 'debt' ? (r as DebtResponse).creditorName
          : history.kind === 'loan-given' ? (r as LoanGivenResponse).debtorName
          : (r as LoanTakenResponse).lenderName
        const totalAmount = (r as { totalAmount: number }).totalAmount
        const paidSoFar = history.kind === 'loan-given'
          ? (r as LoanGivenResponse).receivedAmount
          : (r as { paidAmount: number }).paidAmount
        const allRows = historyApi.data ?? []
        const rows = [...allRows].sort((a, b) => {
          const cmp = a.transactionDate.localeCompare(b.transactionDate)
          return historySortAsc ? cmp : -cmp
        })
        const label = history.kind === 'loan-given' ? 'Received' : 'Paid'
        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">{personName} — Payment History</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {label} so far {formatCurrency(paidSoFar, r.currency)} of {formatCurrency(totalAmount, r.currency)} · {rows.length} payment{rows.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setHistorySortAsc(s => !s)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors">
                  {historySortAsc
                    ? <><ArrowUp className="w-3 h-3" /> Oldest first</>
                    : <><ArrowDown className="w-3 h-3" /> Newest first</>}
                </button>
                <button onClick={() => setHistory(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {historyApi.loading ? (
              <div className="h-32 flex items-center justify-center"><Spinner /></div>
            ) : rows.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center gap-2 text-slate-400">
                <p className="text-sm">No payments recorded yet</p>
                <p className="text-xs">Use the Repay / Returned button to log a payment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Date', 'Amount', 'Paid via', 'Note'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 text-slate-600 text-xs whitespace-nowrap">{format(new Date(t.transactionDate), 'dd-MMM-yyyy')}</td>
                      <td className={`px-5 py-3 font-semibold whitespace-nowrap ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount, t.currency)}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">
                        {t.card ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                            {t.card.name} •••• {t.card.lastFourDigits}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-700">
                            <Wallet className="w-3.5 h-3.5" /> Cash
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs max-w-64 truncate">{t.note || t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        )
      })()}

      {/* Subscription payment history panel */}
      {subHistory && (() => {
        const m = subHistory
        const subSince = m.subscribedSince ? new Date(m.subscribedSince) : null
        const months = subSince ? Math.max(0, differenceInCalendarMonths(new Date(), subSince)) : null
        const allRows = subHistoryApi.data ?? []
        const rows = [...allRows].sort((a, b) => {
          const cmp = a.transactionDate.localeCompare(b.transactionDate)
          return subHistorySortAsc ? cmp : -cmp
        })
        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">{m.name} — Payment History</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {subSince
                    ? <>Subscribed {months === 0 ? 'this month' : `${months} month${months === 1 ? '' : 's'} ago`} ({format(subSince, 'dd-MMM-yyyy')}) · </>
                    : null}
                  Paid {formatCurrency(m.totalPaid, m.currency)} across {m.paymentCount} payment{m.paymentCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSubHistorySortAsc(s => !s)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors">
                  {subHistorySortAsc
                    ? <><ArrowUp className="w-3 h-3" /> Oldest first</>
                    : <><ArrowDown className="w-3 h-3" /> Newest first</>}
                </button>
                <button onClick={() => setSubHistory(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {subHistoryApi.loading ? (
              <div className="h-32 flex items-center justify-center"><Spinner /></div>
            ) : rows.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center gap-2 text-slate-400">
                <p className="text-sm">No payments recorded yet</p>
                <p className="text-xs">Click Pay to log this month's payment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Date', 'Amount', 'Paid via', 'Note'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 text-slate-600 text-xs whitespace-nowrap">{format(new Date(t.transactionDate), 'dd-MMM-yyyy')}</td>
                      <td className="px-5 py-3 font-semibold text-rose-600 whitespace-nowrap">
                        -{formatCurrency(t.amount, t.currency)}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">
                        {t.card ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                            {t.card.name} •••• {t.card.lastFourDigits}
                            {t.cashAmount != null && t.cashAmount > 0 && <span className="ml-1 text-amber-600">(+cash {formatCurrency(t.cashAmount, t.currency)})</span>}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-700">
                            <Wallet className="w-3.5 h-3.5" /> Cash
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs max-w-64 truncate">{t.note || t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        )
      })()}

      {/* Modals — called as plain functions (NOT as JSX elements) to prevent
          inner-component remount on every keystroke */}
      {DebtModal()}
      {LoanGivenModal()}
      {LoanTakenModal()}
      {BankLoanModal()}
      {MonthlyModal()}

      {/* Repayment modal */}
      <RepaymentModal
        open={!!repayTarget}
        onClose={() => setRepayTarget(null)}
        onSaved={() => { refetchAll(); setRepayTarget(null) }}
        target={repayTarget}
      />

      {/* Subscription payment modal */}
      <PaySubscriptionModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        onSaved={() => { monthly.refetch(); setPayTarget(null); showSuccess('Payment recorded') }}
        subscription={payTarget}
      />
    </div>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

function CurrencySelect({ value, onChange }: { value: Currency; onChange: (v: Currency) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as Currency)} className={`${INPUT} bg-white`}>
      <option>USD</option><option>EUR</option><option>UZS</option>
    </select>
  )
}

function StatusSelect({ value, onChange }: { value: RecordStatus; onChange: (v: RecordStatus) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as RecordStatus)} className={`${INPUT} bg-white`}>
      <option value="PENDING">Pending</option>
      <option value="PARTIALLY_PAID">Partially Paid</option>
      <option value="PAID">Paid</option>
      <option value="OVERDUE">Overdue</option>
    </select>
  )
}

function ModalActions({ onClose, saving, isEdit }: { onClose: () => void; saving: boolean; isEdit: boolean }) {
  return (
    <div className="flex gap-3 pt-1">
      <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
      <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
        {saving && <Spinner className="w-4 h-4" />}{saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
      </button>
    </div>
  )
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-slate-100">
        {cols.map(c => <th key={c} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{c}</th>)}
      </tr>
    </thead>
  )
}

function Loading() {
  return <div className="h-48 flex items-center justify-center"><Spinner /></div>
}

function today() {
  return new Date().toISOString().split('T')[0]
}

/** First day of next month as YYYY-MM-01 — default "payment starts" for borrowed money. */
function nextMonthFirst() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ── Finance totals strip ────────────────────────────────────────────────────────
import type { BankLoanResponse } from '../types'

function FinanceTotals({ tab, debts, loansGiven, loansTaken, bankLoans, monthly }: {
  tab: FinanceTab | DebtSubTab
  debts: DebtResponse[]
  loansGiven: LoanGivenResponse[]
  loansTaken: LoanTakenResponse[]
  bankLoans: BankLoanResponse[]
  monthly: MonthlyPaymentResponse[]
}) {
  if (tab === 'debts' && debts.length > 0) {
    const total     = snap(debts.reduce((s, d) => s + d.totalAmount, 0))
    const remaining = snap(debts.reduce((s, d) => s + d.remainingAmount, 0))
    const paid      = snap(debts.reduce((s, d) => s + d.paidAmount, 0))
    return <TotalsRow items={[
      { label: 'Total Borrowed', value: total.toFixed(2),     color: 'text-slate-700' },
      { label: 'Remaining',      value: remaining.toFixed(2), color: 'text-rose-600' },
      { label: 'Paid Back',      value: paid.toFixed(2),      color: 'text-emerald-600' },
    ]} />
  }
  if (tab === 'loans-given' && loansGiven.length > 0) {
    const total    = snap(loansGiven.reduce((s, l) => s + l.totalAmount, 0))
    const pending  = snap(loansGiven.reduce((s, l) => s + l.pendingAmount, 0))
    const received = snap(loansGiven.reduce((s, l) => s + l.receivedAmount, 0))
    return <TotalsRow items={[
      { label: 'Total Lent',      value: total.toFixed(2),    color: 'text-slate-700' },
      { label: 'Pending Return',  value: pending.toFixed(2),  color: 'text-amber-600' },
      { label: 'Received Back',   value: received.toFixed(2), color: 'text-emerald-600' },
    ]} />
  }
  if (tab === 'loans-taken' && loansTaken.length > 0) {
    const total     = snap(loansTaken.reduce((s, l) => s + l.totalAmount, 0))
    const remaining = snap(loansTaken.reduce((s, l) => s + l.remainingAmount, 0))
    const paid      = snap(loansTaken.reduce((s, l) => s + l.paidAmount, 0))
    return <TotalsRow items={[
      { label: 'Total Borrowed', value: total.toFixed(2),     color: 'text-slate-700' },
      { label: 'Remaining',      value: remaining.toFixed(2), color: 'text-rose-600' },
      { label: 'Paid Back',      value: paid.toFixed(2),      color: 'text-emerald-600' },
    ]} />
  }
  if (tab === 'bank-loans' && bankLoans.length > 0) {
    const total = snap(bankLoans.reduce((s, b) => s + b.totalAmount, 0))
    return <TotalsRow items={[
      { label: 'Total Bank Loans', value: String(bankLoans.length), color: 'text-slate-700' },
      { label: 'Total Committed',  value: total.toFixed(2),         color: 'text-rose-600' },
    ]} />
  }
  if (tab === 'monthly-payments' && monthly.length > 0) {
    const active = monthly.filter(m => m.active)
    const total  = snap(active.reduce((s, m) => s + m.amount, 0))
    return <TotalsRow items={[
      { label: 'Active Subscriptions', value: String(active.length), color: 'text-slate-700' },
      { label: 'Total / Month',        value: total.toFixed(2),      color: 'text-violet-600' },
    ]} />
  }
  return null
}

function TotalsRow({ items }: { items: { label: string; value: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
      {items.map(item => (
        <div key={item.label}>
          <p className="text-xs text-slate-400">{item.label}</p>
          <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}

// ── Finance Overview Dashboard ─────────────────────────────────────────────────
function FinanceOverview({
  debts, loansGiven, loansTaken, bankLoans, monthly, onNavigate,
}: {
  debts: DebtResponse[]; loansGiven: LoanGivenResponse[]; loansTaken: LoanTakenResponse[]
  bankLoans: BankLoanResponse[]; monthly: MonthlyPaymentResponse[]
  onNavigate: (tab: FinanceTab) => void
}) {
  const lentPending       = snap(loansGiven.reduce((s, l) => s + l.pendingAmount, 0))
  const borrowedRemaining = snap(loansTaken.reduce((s, l) => s + l.remainingAmount, 0))
  const bankTotal         = snap(bankLoans.reduce((s, b) => s + b.totalAmount, 0))
  const monthlyTotal      = snap(monthly.filter(m => m.active).reduce((s, m) => s + m.amount, 0))

  const cards: { tab: FinanceTab; title: string; value: string; sub: string; bg: string; text: string }[] = [
    { tab: 'debts',            title: 'Loans Lent Pending',  value: lentPending.toFixed(2),        sub: `${loansGiven.length} loans given`,             bg: 'bg-emerald-50', text: 'text-emerald-700' },
    { tab: 'debts',            title: 'Loans Borrowed Owed', value: borrowedRemaining.toFixed(2),  sub: `${loansTaken.length} loans taken`,             bg: 'bg-amber-50',   text: 'text-amber-700' },
    { tab: 'bank-loans',       title: 'Bank Loans',          value: bankTotal.toFixed(2),          sub: `${bankLoans.length} loans`,                    bg: 'bg-indigo-50',  text: 'text-indigo-700' },
    { tab: 'monthly-payments', title: 'Monthly Commitments', value: monthlyTotal.toFixed(2),       sub: `${monthly.filter(m=>m.active).length} active`, bg: 'bg-violet-50',  text: 'text-violet-700' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map(c => (
          <button key={c.tab} onClick={() => onNavigate(c.tab)}
            className={`${c.bg} rounded-2xl p-5 text-left hover:shadow-md transition-all active:scale-[0.98] border border-white`}>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{c.title}</p>
            <p className={`text-2xl font-bold ${c.text}`}>{c.value}</p>
            <p className="text-xs text-slate-400 mt-1">{c.sub}</p>
          </button>
        ))}
      </div>

      {/* Net loan position */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Net Loan Position</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-400 mb-1">You Owe (Borrowed)</p>
            <p className="text-xl font-bold text-rose-600">{borrowedRemaining.toFixed(2)}</p>
          </div>
          <div className="border-x border-slate-100">
            <p className="text-xs text-slate-400 mb-1">Net (Lent − Borrowed)</p>
            <p className={`text-xl font-bold ${lentPending - borrowedRemaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {(lentPending - borrowedRemaining).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Owed to You (Lent)</p>
            <p className="text-xl font-bold text-emerald-600">{lentPending.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
