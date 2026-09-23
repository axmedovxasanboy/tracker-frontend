import { useMemo, useState } from 'react'
import type { ComponentProps, FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import {
  Banknote, CalendarClock, Check, ChevronDown, CreditCard, HandCoins, History as HistoryIcon,
  Landmark, Pause, Pencil, Play, Plus, Receipt, Trash2, Wallet,
} from 'lucide-react'
import { PaySubscriptionModal } from '../components/finance/PaySubscriptionModal'
import { RepaymentModal } from '../components/finance/RepaymentModal'
import { PayBankInstallmentModal } from '../components/overview/PayBankInstallmentModal'
import { ActionMenu } from '../components/ui/ActionMenu'
import type { MenuAction } from '../components/ui/ActionMenu'
import { AmountInput } from '../components/ui/AmountInput'
import { Button } from '../components/ui/Button'
import { ErrorTile } from '../components/ui/ErrorTile'
import { Field } from '../components/ui/Field'
import { IncomeRequiredNotice } from '../components/ui/IncomeRequiredNotice'
import { ListRow, ListTile } from '../components/ui/ListRow'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { Sheet } from '../components/ui/Sheet'
import { Skeleton } from '../components/ui/Skeleton'
import { StatTile } from '../components/ui/StatTile'
import { Tile, TileGrid } from '../components/ui/Tile'
import { useApi } from '../hooks/useApi'
import { useRadioGroupKeys } from '../hooks/useRadioGroupKeys'
import { useConfirm } from '../context/ConfirmContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import { advisorApi } from '../api/advisor'
import { categoriesApi } from '../api/categories'
import { financeApi } from '../api/finance'
import { peopleApi } from '../api/people'
import { transactionsApi } from '../api/transactions'
import { extractErrorMessage } from '../api/client'
import {
  formatDate, formatMonth, money, moneyExact, moneyFull, monthLocal, plural, shiftMonth, snap, todayLocal,
} from '../utils/format'
import type {
  AdvisorUpcoming, BankLoanRequest, BankLoanResponse, Category, DebtRequest, DebtResponse,
  LoanGivenRequest, LoanGivenResponse, LoanTakenRequest, LoanTakenResponse, MonthlyPaymentRequest,
  MonthlyPaymentResponse, RecordStatus, RepaymentType, Transaction,
} from '../types'
import type { PersonKind, PersonSummary } from '../types/people'
import type { BillRow, Obligation, Receivable } from '../types/shell'
import { fetchMonthTransactions } from './History'

// ────────────────────────────────────────────────────────────────────────────────
// What each record costs a month — the same rules the Home advisor uses
// ────────────────────────────────────────────────────────────────────────────────

/**
 * The share of what is left the server asks for each month on money repaid as fast as possible —
 * borrowed that way, and every debt — once what is left is more than {@link ASAP_ALL_DUE_SHARE} of
 * the monthly income. Also the old default for a loan with no plan. Mirrored so this page quotes
 * the figure Home counts.
 */
const DEFAULT_MONTHLY_SHARE = 0.34
/** At or below this share of the monthly income, all that is left of a fast-repaid loan is due. */
const ASAP_ALL_DUE_SHARE = 0.7

/** Rounding slack when comparing money paid against money due. */
const EPSILON = 0.5

function takenMonthly(l: LoanTakenResponse): number {
  const left = Math.max(0, l.remainingAmount)
  if (left <= 0) return 0
  const plan = l.plannedMonthlyPayment
  const base = plan != null && plan > 0 ? plan : l.totalAmount * DEFAULT_MONTHLY_SHARE
  return snap(Math.min(base, left))
}

/**
 * What the as-fast-as-possible rule asks this month: all of what is left once that is 70% of the
 * monthly income or less, else 34% of it. Without a known income only the 34% can be said.
 */
function asapDue(left: number, income: number | null): { amount: number; allNow: boolean } {
  const rest = Math.max(0, left)
  const allNow = income != null && income > 0 && rest <= income * ASAP_ALL_DUE_SHARE
  return { amount: snap(allNow ? rest : rest * DEFAULT_MONTHLY_SHARE), allNow }
}

/** How borrowed money is repaid. An older server does not say: a plan then means monthly. */
const repaymentOf = (l: LoanTakenResponse): RepaymentType =>
  l.repaymentType ?? (l.plannedMonthlyPayment != null && l.plannedMonthlyPayment > 0 ? 'MONTHLY' : 'ASAP')

/** A saved person as a picker answer: their id when they are on the list, else a name to type. */
const personChoice = (id: number | null | undefined, people: PersonSummary[]): string =>
  id != null && people.some(p => p.id === id) ? String(id) : 'new'

/** Most-used first — the order a picker offers people in. */
const byUse = (people: PersonSummary[]) => [...people].sort((a, b) => b.times - a.times || b.total - a.total)

const REPAY_TYPES: RepaymentType[] = ['MONTHLY', 'ASAP']

const ym = (date: string | null | undefined): string | null => (date ? date.slice(0, 7) : null)

/** Whole months from `a` to `b` (both YYYY-MM); negative when `b` is earlier. */
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by * 12 + bm) - (ay * 12 + am)
}

/**
 * This month's bank instalments, per loan. The payments carry no loan id — only the bank's name
 * in their description — so with one bank loan everything is its; with several, a payment goes
 * to the loan its description names, and whatever names none covers the loans still short.
 */
function bankPaidByLoan(running: BankLoanResponse[], payments: Transaction[]): Map<number, number> {
  const paid = new Map<number, number>()
  if (running.length === 0) return paid
  const add = (id: number, amount: number) => paid.set(id, (paid.get(id) ?? 0) + amount)
  if (running.length === 1) {
    payments.forEach(tx => add(running[0].id, tx.amount))
    return paid
  }
  let unmatched = 0
  for (const tx of payments) {
    const text = (tx.description ?? '').toLocaleLowerCase()
    const named = running.filter(b => b.bankName && text.includes(b.bankName.toLocaleLowerCase()))
    const hit = named.find(b => b.loanName && text.includes(b.loanName.toLocaleLowerCase())) ?? named[0]
    if (hit) add(hit.id, tx.amount)
    else unmatched += tx.amount
  }
  for (const b of running) {
    if (unmatched <= 0) break
    const short = (b.monthlyPayment ?? 0) - (paid.get(b.id) ?? 0)
    if (short <= 0) continue
    const take = Math.min(short, unmatched)
    add(b.id, take)
    unmatched -= take
  }
  return paid
}

/** Next month, YYYY-MM — the default first repayment month for money just borrowed. */
function nextMonth(): string {
  return shiftMonth(monthLocal(), 1)
}

/**
 * A record's status from what is paid (or received) against its total — the server's own rule
 * (FinanceService.repaymentStatus). Sent with every edit, so raising the total of a record that
 * was paid off opens it again instead of leaving it marked paid.
 */
function repaymentStatus(paid: number, total: number): RecordStatus {
  if (paid <= 0) return 'PENDING'
  return paid >= total ? 'PAID' : 'PARTIALLY_PAID'
}

/**
 * A bill's next due date once its due day moves. The server keeps it as the due day in the month
 * after the last payment and moves it only when a payment is recorded, so a new due day would
 * otherwise leave the old date behind (the Telegram bot shows it). The month it names stays; with
 * none, or one already past, it is this month — next month once this month is paid.
 */
function nextDueFor(dueDay: number, stored: string | null, paidThisMonth: boolean | null): string {
  const current = monthLocal()
  let month = stored && stored.slice(0, 7) > current ? stored.slice(0, 7) : current
  if (paidThisMonth && month === current) month = shiftMonth(current, 1)
  const [y, m] = month.split('-').map(Number)
  const day = Math.min(Math.max(dueDay, 1), new Date(y, m, 0).getDate())
  return `${month}-${String(day).padStart(2, '0')}`
}

/** What the advisor's upcoming list calls each kind of record on this page. */
const UPCOMING_KIND = { bill: 'BILL', bank: 'BANK', taken: 'LOAN', debt: 'DEBT' } as const

// ────────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────────

type FormKind = 'bill' | 'bank' | 'borrowed' | 'debt' | 'lent'
type HistoryKind = 'bill' | 'bank' | 'taken' | 'debt' | 'given'
type RepayTarget = NonNullable<ComponentProps<typeof RepaymentModal>['target']>

interface HistoryTarget { kind: HistoryKind; id: number; name: string }

const FORM_ID = 'loans-record-form'
const INPUT = 'focus-ring h-11 w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500'
/** AmountInput paints its suffix at right-3; px-3 alone leaves a long figure running under it. */
const MONEY_INPUT = `${INPUT} pr-14`

const FULL = 'md:col-span-6 xl:col-span-12'
const HALF = 'md:col-span-6 xl:col-span-6'

/** Bank loans made here no longer ask for a product name; the server still requires one. */
const DEFAULT_LOAN_NAMES = new Set(['loan', 'kredit'])

const CHOOSER: { kind: Exclude<FormKind, 'debt'>; labelKey: TKey; Icon: typeof Receipt; chip: string }[] = [
  { kind: 'bill',     labelKey: 'page.finance.optionMonthlyBill', Icon: CalendarClock, chip: 'bg-amber-100 text-amber-600' },
  { kind: 'bank',     labelKey: 'page.finance.optionBankLoan',    Icon: Landmark,      chip: 'bg-indigo-100 text-indigo-600' },
  { kind: 'borrowed', labelKey: 'page.finance.optionBorrowed',    Icon: Banknote,      chip: 'bg-pink-100 text-pink-600' },
  { kind: 'lent',     labelKey: 'page.finance.optionLent',        Icon: HandCoins,     chip: 'bg-teal-100 text-teal-600' },
]

interface BillForm { name: string; amount: number; dueDay: number; categoryId: number | '' }
interface BankForm { bankName: string; monthly: number; total: number; takenDate: string; endDate: string }
/**
 * `person` is the picked person's id, 'new' for a name typed in, or '' before a choice.
 * `firstMonth` is YYYY-MM: the server keeps only the month a loan's payments start in.
 */
interface BorrowedForm {
  person: string; name: string; amount: number; date: string; type: RepaymentType; monthly: number; firstMonth: string
}
interface DebtForm { name: string; amount: number; firstMonth: string }
interface LentForm { person: string; name: string; amount: number; date: string; expected: string }

type FieldErrors = Partial<Record<'amount' | 'monthly' | 'endDate' | 'expected' | 'person' | 'name', string>>

type PeopleList = { supported: boolean; people: PersonSummary[] }

/** A people list, or — from a server that has none (404) — word that there is none. */
const peopleQuery = (kind: 'lenders' | 'borrowers') => async () => {
  try {
    const res = await (kind === 'lenders' ? peopleApi.lenders() : peopleApi.borrowers())
    return { ...res, data: { supported: true, people: res.data } as PeopleList }
  } catch (err) {
    if ((err as AxiosError)?.response?.status === 404) return { data: { supported: false, people: [] } as PeopleList }
    throw err
  }
}

export function Loans() {
  const { t, lang, categoryName } = useLang()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()
  const { settings, hasStableIncome, ready: settingsReady, error: settingsError } = useSettings()
  // The as-fast-as-possible rule measures what is left against the monthly income.
  const income = settings?.monthlyStableIncome ?? null
  // A failed settings read is not an answer about the income; only a known "unset" gates.
  const incomeGated = settingsReady && !settingsError && !hasStableIncome

  const today = todayLocal()
  const month = today.slice(0, 7)

  const bills = useApi(() => financeApi.getMonthlyPayments(), [])
  const bankLoans = useApi(() => financeApi.getBankLoans(), [])
  const loansTaken = useApi(() => financeApi.getLoansTaken(), [])
  const debts = useApi(() => financeApi.getDebts(), [])
  const loansGiven = useApi(() => financeApi.getLoansGiven(), [])
  // What Home says is still to pay this month — the one source for a bill's "Paid", so this page
  // and Home can never disagree about it — and the day each bill and loan is next due.
  const advisor = useApi(() => advisorApi.get(today), [today])
  // This month's payments, for which loans are already paid for the month.
  const monthTx = useApi(() => fetchMonthTransactions(month), [month])
  const categories = useApi(() => categoriesApi.getAll('EXPENSE'), [])
  // Who the owner borrows from and lends to. On an older server there are no such lists: the forms
  // then ask for a name as they always did, and the people tiles stay away.
  const lenders = useApi(peopleQuery('lenders'), [])
  const borrowers = useApi(peopleQuery('borrowers'), [])
  const lendersOn = lenders.data?.supported === true
  const borrowersOn = borrowers.data?.supported === true
  const lenderPeople = useMemo(() => byUse(lenders.data?.people ?? []), [lenders.data])
  const borrowerPeople = useMemo(() => byUse(borrowers.data?.people ?? []), [borrowers.data])

  const refetchAll = () => {
    bills.refetch(); bankLoans.refetch(); loansTaken.refetch(); debts.refetch(); loansGiven.refetch()
    advisor.refetch(); monthTx.refetch(); lenders.refetch(); borrowers.refetch()
  }

  // ── Bills ────────────────────────────────────────────────────────────────────
  const beforeTracking = (() => {
    const start = ym(settings?.allocationTrackingStartMonth)
    return !!start && start > month
  })()
  const billRows: BillRow[] = useMemo(() => {
    const a = advisor.data
    // The advisor only lists bills while it can plan the month: with no income set (or before
    // the month counting starts) it lists none, and "none listed" must not read as "all paid".
    const knows = !!a && !a.missingStableIncome && !beforeTracking
    const left = new Map<number, number>()
    for (const b of a?.bills ?? []) {
      if (b.kind === 'SUBSCRIPTION' && b.refId != null) left.set(b.refId, b.amount)
    }
    return (bills.data ?? []).map(record => ({
      record,
      paidThisMonth: knows ? !left.has(record.id) : null,
      left: knows ? left.get(record.id) ?? null : null,
    }))
  }, [bills.data, advisor.data, beforeTracking])

  // ── Next payment, to the day ─────────────────────────────────────────────────
  // The advisor lists every bill and loan payment due in the next five weeks. A record with no
  // entry (an older server, or nothing due that soon) keeps its month-level wording.
  const nextDue = useMemo(() => {
    const byRecord = new Map<string, AdvisorUpcoming>()
    for (const u of advisor.data?.daily?.upcoming ?? []) {
      // A payment already recorded for a later day is not one still to make.
      if (u.recorded) continue
      const key = `${u.kind}-${u.refId}`
      const seen = byRecord.get(key)
      if (!seen || u.date < seen.date) byRecord.set(key, u)
    }
    return byRecord
  }, [advisor.data])
  const upcomingFor = (kind: keyof typeof UPCOMING_KIND, id: number) =>
    nextDue.get(`${UPCOMING_KIND[kind]}-${id}`)

  // ── Loans you're paying ──────────────────────────────────────────────────────
  const obligations: Obligation[] = useMemo(() => {
    const txs = (monthTx.data?.month === month ? monthTx.data.rows : [])
    const repaidTaken = new Map<number, number>()
    const repaidDebt = new Map<number, number>()
    const bankPayments: Transaction[] = []
    for (const tx of txs) {
      const sub: string | null = tx.subType
      if (sub === 'LOAN_REPAYMENT') {
        if (tx.repaidLoanTakenId != null) {
          repaidTaken.set(tx.repaidLoanTakenId, (repaidTaken.get(tx.repaidLoanTakenId) ?? 0) + tx.amount)
        } else if (tx.repaidDebtId != null) {
          repaidDebt.set(tx.repaidDebtId, (repaidDebt.get(tx.repaidDebtId) ?? 0) + tx.amount)
        }
      } else if (sub === 'BANK_LOAN_PAYMENT') {
        bankPayments.push(tx)
      }
    }

    const out: Obligation[] = []

    // A bank loan counts in a month from the one it was taken in to the one it ends in — the
    // same window the server charges it in.
    const banks = bankLoans.data ?? []
    const running = banks.filter(b => {
      const taken = ym(b.takenDate)
      const end = ym(b.endDate)
      return (!taken || taken <= month) && (!end || end >= month)
    })
    const bankPaid = bankPaidByLoan(running, bankPayments)
    for (const b of banks) {
      const monthly = b.monthlyPayment != null && b.monthlyPayment > 0 ? b.monthlyPayment : null
      const taken = ym(b.takenDate) ?? month
      const end = ym(b.endDate)
      const notStarted = taken > month
      const paidThisMonth = !notStarted && monthly != null && (bankPaid.get(b.id) ?? 0) >= monthly - EPSILON
      const nextMonth = notStarted ? taken : paidThisMonth ? shiftMonth(month, 1) : month
      const paidOff = !!end && nextMonth > end
      // The server keeps no balance for a bank loan, so what is left is the instalments still to
      // come — known only when the loan has an end date.
      const left = !paidOff && monthly != null && end ? (monthsBetween(nextMonth, end) + 1) * monthly : null
      out.push({
        kind: 'bank', record: b, key: `bank-${b.id}`, id: b.id, name: b.bankName, currency: b.currency,
        monthly, remaining: paidOff ? 0 : left, remainingEstimated: left != null, paidOff, paidThisMonth,
        next: paidOff ? null : { month: nextMonth, first: notStarted }, asap: false,
      })
    }

    const personal = <R extends LoanTakenResponse | DebtResponse>(
      kind: 'taken' | 'debt', record: R, name: string, monthly: number, paidSoFar: number, asap: boolean,
    ): Obligation => {
      const paidOff = record.status === 'PAID' || record.remainingAmount <= EPSILON
      const start = ym(record.paymentStartDate)
      const notStarted = !!start && start > month
      const paidThisMonth = !paidOff && !notStarted && monthly > 0 && paidSoFar >= monthly - EPSILON
      const base = { key: `${kind}-${record.id}`, id: record.id, name, currency: record.currency }
      const shared = {
        monthly: paidOff ? null : monthly,
        remaining: paidOff ? 0 : Math.max(0, record.remainingAmount),
        remainingEstimated: false,
        paidOff,
        paidThisMonth,
        asap,
        next: paidOff
          ? null
          : notStarted
            ? { month: start as string, first: true }
            : { month: paidThisMonth ? shiftMonth(month, 1) : month, first: false },
      }
      return kind === 'taken'
        ? { kind: 'taken', record: record as LoanTakenResponse, ...base, ...shared }
        : { kind: 'debt', record: record as DebtResponse, ...base, ...shared }
    }
    for (const l of loansTaken.data ?? []) {
      const asap = repaymentOf(l) === 'ASAP'
      const monthly = asap ? asapDue(l.remainingAmount, income).amount : takenMonthly(l)
      out.push(personal('taken', l, l.lenderName, monthly, repaidTaken.get(l.id) ?? 0, asap))
    }
    // Every debt is repaid as fast as possible.
    for (const d of debts.data ?? []) {
      out.push(personal('debt', d, d.creditorName, asapDue(d.remainingAmount, income).amount, repaidDebt.get(d.id) ?? 0, true))
    }

    // Soonest payment first; a name breaks the tie so the order never shuffles on a refetch.
    return out.sort((a, b) =>
      (a.next?.month ?? '9999-99').localeCompare(b.next?.month ?? '9999-99') || a.name.localeCompare(b.name))
  }, [bankLoans.data, loansTaken.data, debts.data, monthTx.data, month, income])

  // Two ways of paying back: by a monthly plan (bank loans too), or as fast as possible.
  const activeMonthly = obligations.filter(o => !o.asap && !o.paidOff)
  const paidOffMonthly = obligations.filter(o => !o.asap && o.paidOff)
  const activeAsap = obligations.filter(o => o.asap && !o.paidOff)
  const paidOffAsap = obligations.filter(o => o.asap && o.paidOff)

  // ── Owed to you ──────────────────────────────────────────────────────────────
  const receivables: Receivable[] = (loansGiven.data ?? []).map(record => ({
    record,
    returned: record.status === 'PAID' || record.pendingAmount <= EPSILON,
  }))
  const waitingFor = receivables.filter(r => !r.returned)
  const returned = receivables.filter(r => r.returned)

  // ── The top line ─────────────────────────────────────────────────────────────
  const billsMonthly = snap((bills.data ?? []).filter(m => m.active).reduce((s, m) => s + m.amount, 0))
  // "Every month": the bills and the loans on a monthly plan — bank loans among them.
  const loansMonthly = snap(activeMonthly.reduce((s, o) => s + (o.monthly ?? 0), 0))
  // "You owe" is only what is to be repaid as fast as possible; a monthly loan is not in it.
  const youOwe = snap(activeAsap.reduce((s, o) => s + (o.remaining ?? 0), 0))
  const owedToYou = snap(waitingFor.reduce((s, r) => s + r.record.pendingAmount, 0))

  const core = [bills, bankLoans, loansTaken, debts, loansGiven]
  const coreLoading = core.some(q => q.loading)
  const coreFailed = core.find(q => q.error && !q.data)?.error ?? null
  const coreStale = core.find(q => q.error && q.data)?.error ?? null
  const refreshing = core.some(q => q.refreshing)

  // ── Paying ───────────────────────────────────────────────────────────────────
  // Pay on a bill starts on what is still to pay this month, so a part-paid bill is not paid twice.
  const [payBill, setPayBill] = useState<{ record: MonthlyPaymentResponse; amount?: number } | null>(null)
  // Pay opens on the loan it sits beside, starting on this month's payment.
  const [payBank, setPayBank] = useState<{ id: number; amount?: number } | null>(null)
  const [repay, setRepay] = useState<{ target: RepayTarget; amount?: number } | null>(null)
  const [history, setHistory] = useState<HistoryTarget | null>(null)
  const [showPaidOffMonthly, setShowPaidOffMonthly] = useState(false)
  const [showPaidOffAsap, setShowPaidOffAsap] = useState(false)
  const [showReturned, setShowReturned] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  /** Every payment is refused until a monthly income is set; take the owner to it instead. */
  const gate = (open: () => void) => () => {
    if (incomeGated) { navigate('/'); return }
    open()
  }

  const payObligation = (o: Obligation, amount = o.monthly ?? undefined) => {
    if (o.kind === 'bank') setPayBank({ id: o.id, amount })
    else if (o.kind === 'taken') setRepay({ target: { kind: 'loan-taken', record: o.record }, amount })
    else setRepay({ target: { kind: 'debt', record: o.record }, amount })
  }

  // ── Record forms ─────────────────────────────────────────────────────────────
  const [chooserOpen, setChooserOpen] = useState(false)
  const [form, setForm] = useState<{ kind: FormKind; editId: number | null; name: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [bankNames, setBankNames] = useState<string[]>([])

  const todayDay = Number(today.slice(8, 10))
  const [bill, setBill] = useState<BillForm>({ name: '', amount: 0, dueDay: todayDay, categoryId: '' })
  const [bank, setBank] = useState<BankForm>({ bankName: '', monthly: 0, total: 0, takenDate: today, endDate: '' })
  const [borrowed, setBorrowed] = useState<BorrowedForm>({
    person: '', name: '', amount: 0, date: today, type: 'MONTHLY', monthly: 0, firstMonth: nextMonth(),
  })
  const [debt, setDebt] = useState<DebtForm>({ name: '', amount: 0, firstMonth: '' })
  const [lent, setLent] = useState<LentForm>({ person: '', name: '', amount: 0, date: today, expected: '' })

  /** One setter per form that also marks the sheet dirty, so a stray tap cannot lose the typing. */
  const edit = <T,>(setter: (fn: (prev: T) => T) => void) => (patch: Partial<T>) => {
    setDirty(true)
    setErrors({})
    setter(prev => ({ ...prev, ...patch }))
  }
  const editBill = edit<BillForm>(setBill)
  const editBank = edit<BankForm>(setBank)
  const editBorrowed = edit<BorrowedForm>(setBorrowed)
  const editDebt = edit<DebtForm>(setDebt)
  const editLent = edit<LentForm>(setLent)
  // "How will you repay?" is a radiogroup: arrow keys move and pick, one tab stop.
  const repayKeys = useRadioGroupKeys(REPAY_TYPES, borrowed.type, v => editBorrowed({ type: v }))

  const openForm = (kind: FormKind, editId: number | null = null, name = '') => {
    setChooserOpen(false)
    setDirty(false); setSaving(false); setFormError(null); setErrors({})
    if (kind === 'bank') {
      // Suggestions from the banks already on file — a datalist, so typing a new one still works.
      financeApi.getBankNameSuggestions('').then(r => setBankNames(r.data)).catch(() => {})
    }
    setForm({ kind, editId, name })
  }

  const startAdd = (kind: Exclude<FormKind, 'debt'>) => {
    const day = Number(todayLocal().slice(8, 10))
    if (kind === 'bill') setBill({ name: '', amount: 0, dueDay: day, categoryId: '' })
    if (kind === 'bank') setBank({ bankName: '', monthly: 0, total: 0, takenDate: todayLocal(), endDate: '' })
    // A person is picked from the list; with nobody on it yet, the name is typed straight in.
    if (kind === 'borrowed') {
      setBorrowed({
        person: lenderPeople.length > 0 ? '' : 'new', name: '', amount: 0, date: todayLocal(),
        type: 'MONTHLY', monthly: 0, firstMonth: nextMonth(),
      })
    }
    if (kind === 'lent') {
      setLent({ person: borrowerPeople.length > 0 ? '' : 'new', name: '', amount: 0, date: todayLocal(), expected: '' })
    }
    openForm(kind)
  }

  const startEditBill = (m: MonthlyPaymentResponse) => {
    setBill({ name: m.name, amount: m.amount, dueDay: m.dueDay || 1, categoryId: m.category?.id ?? '' })
    openForm('bill', m.id, m.name)
  }
  const startEditObligation = (o: Obligation) => {
    if (o.kind === 'bank') {
      const b = o.record
      setBank({ bankName: b.bankName, monthly: b.monthlyPayment ?? 0, total: b.totalAmount, takenDate: b.takenDate, endDate: b.endDate ?? '' })
      openForm('bank', b.id, b.bankName)
    } else if (o.kind === 'taken') {
      const l = o.record
      // An edit keeps who lent it and how it is repaid.
      setBorrowed({
        person: personChoice(l.lenderId, lenderPeople), name: l.lenderName, amount: l.totalAmount,
        date: l.borrowedDate, type: repaymentOf(l), monthly: l.plannedMonthlyPayment ?? 0,
        firstMonth: ym(l.paymentStartDate) ?? nextMonth(),
      })
      openForm('borrowed', l.id, l.lenderName)
    } else {
      const d = o.record
      setDebt({ name: d.creditorName, amount: d.totalAmount, firstMonth: ym(d.paymentStartDate) ?? '' })
      openForm('debt', d.id, d.creditorName)
    }
  }
  const startEditLent = (l: LoanGivenResponse) => {
    setLent({
      person: personChoice(l.borrowerId, borrowerPeople), name: l.debtorName, amount: l.totalAmount,
      date: l.lentDate, expected: l.expectedReturnDate ?? '',
    })
    openForm('lent', l.id, l.debtorName)
  }

  const closeForm = () => { setForm(null); setDirty(false) }

  const validate = (): FieldErrors => {
    const e: FieldErrors = {}
    const positive = (n: number) => Number.isFinite(n) && n > 0
    if (!form) return e
    if (form.kind === 'bill' && !positive(bill.amount)) e.amount = t('shell.form.errAmount')
    if (form.kind === 'bank') {
      if (!positive(bank.monthly)) e.monthly = t('shell.form.errAmount')
      if (!positive(bank.total)) e.amount = t('shell.form.errAmount')
      if (bank.endDate && bank.endDate < bank.takenDate) {
        e.endDate = t('shell.form.errDateBefore', { date: formatDate(bank.takenDate, lang) })
      }
    }
    if (form.kind === 'borrowed') {
      if (lendersOn && !borrowed.person) e.person = t('shell.form.errPerson')
      else if ((!lendersOn || borrowed.person === 'new') && !borrowed.name.trim()) e.name = t('shell.form.errName')
      if (!positive(borrowed.amount)) e.amount = t('shell.form.errAmount')
      if (borrowed.type === 'MONTHLY') {
        if (!positive(borrowed.monthly)) e.monthly = t('shell.form.errAmount')
        else if (positive(borrowed.amount) && borrowed.monthly > borrowed.amount) e.monthly = t('shell.form.errMonthlyTooBig')
      }
    }
    if (form.kind === 'debt' && !positive(debt.amount)) e.amount = t('shell.form.errAmount')
    if (form.kind === 'lent') {
      if (borrowersOn && !lent.person) e.person = t('shell.form.errPerson')
      else if ((!borrowersOn || lent.person === 'new') && !lent.name.trim()) e.name = t('shell.form.errName')
      if (!positive(lent.amount)) e.amount = t('shell.form.errAmount')
      if (lent.expected && lent.expected < lent.date) {
        e.expected = t('shell.form.errDateBefore', { date: formatDate(lent.date, lang) })
      }
    }
    return e
  }

  /**
   * The person a form names: the one picked, or — for a name typed in — the one the server files it
   * under (a name already on file comes back as that same person). An older server keeps no people,
   * and then the name alone is sent.
   */
  const personFor = async (kind: PersonKind, choice: string, typed: string, people: PersonSummary[], on: boolean) => {
    const picked = on && choice && choice !== 'new' ? people.find(p => String(p.id) === choice) : undefined
    if (picked) return { id: picked.id as number | undefined, name: picked.name }
    const name = typed.trim()
    if (!on) return { id: undefined, name }
    try {
      const res = await peopleApi.create(name, kind)
      return { id: res.data.id as number | undefined, name: res.data.name }
    } catch (err) {
      if ((err as AxiosError)?.response?.status === 404) return { id: undefined, name }
      throw err
    }
  }

  const save = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!form) return
    const found = validate()
    if (Object.keys(found).length > 0) { setErrors(found); return }
    setSaving(true); setFormError(null)
    const { kind, editId } = form
    try {
      if (kind === 'bill') {
        const existing = editId != null ? bills.data?.find(m => m.id === editId) : undefined
        const req: MonthlyPaymentRequest = {
          name: bill.name.trim(),
          amount: bill.amount,
          currency: existing?.currency ?? 'UZS',
          dueDay: bill.dueDay,
          active: existing?.active ?? true,
          // Everything the form no longer asks for is carried over untouched.
          description: existing?.description ?? undefined,
          nextDueDate: existing && existing.dueDay !== bill.dueDay
            ? nextDueFor(bill.dueDay, existing.nextDueDate,
                billRows.find(r => r.record.id === existing.id)?.paidThisMonth ?? null)
            : existing?.nextDueDate ?? undefined,
          subscribedSince: existing?.subscribedSince ?? undefined,
          categoryId: bill.categoryId === '' ? undefined : bill.categoryId,
        }
        if (editId != null) await financeApi.updateMonthlyPayment(editId, req)
        else await financeApi.createMonthlyPayment(req)
      } else if (kind === 'bank') {
        const existing = editId != null ? bankLoans.data?.find(b => b.id === editId) : undefined
        const req: BankLoanRequest = {
          bankName: bank.bankName.trim(),
          loanName: existing?.loanName || t('shell.form.defaultLoanName'),
          totalAmount: bank.total,
          currency: existing?.currency ?? 'UZS',
          takenDate: bank.takenDate,
          endDate: bank.endDate || undefined,
          monthlyPayment: bank.monthly,
        }
        if (editId != null) await financeApi.updateBankLoan(editId, req)
        else await financeApi.createBankLoan(req)
      } else if (kind === 'borrowed') {
        const existing = editId != null ? loansTaken.data?.find(l => l.id === editId) : undefined
        const who = await personFor('LENDER', borrowed.person, borrowed.name, lenderPeople, lendersOn)
        const monthlyPlan = borrowed.type === 'MONTHLY'
        // What has been paid back is left out on purpose: the server keeps it as it is when a
        // request does not carry it. Repaid as fast as possible, the loan has no plan.
        const req: LoanTakenRequest = {
          lenderName: who.name,
          lenderId: who.id,
          totalAmount: borrowed.amount,
          currency: existing?.currency ?? 'UZS',
          borrowedDate: borrowed.date,
          dueDate: existing?.dueDate ?? undefined,
          description: existing?.description ?? undefined,
          repaymentType: borrowed.type,
          paymentStartDate: monthlyPlan && borrowed.firstMonth ? `${borrowed.firstMonth}-01` : undefined,
          plannedMonthlyPayment: monthlyPlan ? borrowed.monthly : null,
          status: existing ? repaymentStatus(existing.paidAmount, borrowed.amount) : undefined,
        }
        if (editId != null) await financeApi.updateLoanTaken(editId, req)
        else await financeApi.createLoanTaken(req)
      } else if (kind === 'debt') {
        const existing = editId != null ? debts.data?.find(d => d.id === editId) : undefined
        if (!existing) throw new Error(t('shell.form.missingRecord'))
        const req: DebtRequest = {
          creditorName: debt.name.trim(),
          totalAmount: debt.amount,
          currency: existing.currency,
          borrowedDate: existing.borrowedDate,
          dueDate: existing.dueDate ?? undefined,
          description: existing.description ?? undefined,
          paymentStartDate: debt.firstMonth ? `${debt.firstMonth}-01` : undefined,
          status: repaymentStatus(existing.paidAmount, debt.amount),
          // The person it is owed to stays linked.
          lenderId: existing.lenderId ?? undefined,
        }
        await financeApi.updateDebt(existing.id, req)
      } else {
        const existing = editId != null ? loansGiven.data?.find(l => l.id === editId) : undefined
        const who = await personFor('BORROWER', lent.person, lent.name, borrowerPeople, borrowersOn)
        const req: LoanGivenRequest = {
          debtorName: who.name,
          borrowerId: who.id,
          totalAmount: lent.amount,
          currency: existing?.currency ?? 'UZS',
          lentDate: lent.date,
          expectedReturnDate: lent.expected || undefined,
          description: existing?.description ?? undefined,
          status: existing ? repaymentStatus(existing.receivedAmount, lent.amount) : undefined,
        }
        if (editId != null) await financeApi.updateLoanGiven(editId, req)
        else await financeApi.createLoanGiven(req)
      }
      closeForm()
      refetchAll()
      showSuccess(editId != null ? t('shell.loans.savedToast') : t('shell.loans.addedToast'))
    } catch (err: unknown) {
      setFormError(err instanceof Error && !('isAxiosError' in err) ? err.message : extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (key: string, run: () => Promise<unknown>) => {
    if (!await confirm({ message: t('page.finance.confirmDeleteRecord'), destructive: true })) return
    setDeleting(key)
    try {
      await run()
      refetchAll()
      showSuccess(t('page.finance.recordDeletedToast'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  const setBillActive = async (m: MonthlyPaymentResponse, active: boolean) => {
    try {
      await financeApi.updateMonthlyPayment(m.id, {
        name: m.name, amount: m.amount, currency: m.currency, dueDay: m.dueDay, active,
        description: m.description ?? undefined, nextDueDate: m.nextDueDate ?? undefined,
        subscribedSince: m.subscribedSince ?? undefined, categoryId: m.category?.id,
      })
      bills.refetch(); advisor.refetch()
      showSuccess(active ? t('shell.bills.resumedToast') : t('shell.bills.pausedToast'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err))
    }
  }

  // ── Row pieces ───────────────────────────────────────────────────────────────
  const menuFor = (key: string, onEdit: () => void, onHistory: () => void, onDelete: () => void,
    extra: MenuAction[] = []): MenuAction[] => [
    ...extra,
    { label: t('action.edit'), icon: <Pencil className="h-4 w-4" aria-hidden="true" />, onClick: onEdit },
    { label: t('action.history'), icon: <HistoryIcon className="h-4 w-4" aria-hidden="true" />, onClick: onHistory },
    { label: t('action.delete'), icon: <Trash2 className="h-4 w-4" aria-hidden="true" />, onClick: onDelete, danger: true, disabled: deleting === key },
  ]

  const deleteObligation = (o: Obligation) => remove(o.key, () =>
    o.kind === 'bank' ? financeApi.deleteBankLoan(o.id)
      : o.kind === 'taken' ? financeApi.deleteLoanTaken(o.id)
        : financeApi.deleteDebt(o.id))

  const nextLine = (o: Obligation): string | null => {
    if (!o.next) return null
    const due = upcomingFor(o.kind, o.id)
    if (due) {
      // An overdue payment is due today: the advisor moves it there once its day has passed.
      if (due.date === today) return t('shell.loans.nextToday')
      const when = formatDate(due.date, lang, 'dayShort')
      return t(o.next.first ? 'shell.loans.firstOn' : 'shell.loans.nextOn', { when })
    }
    const when = formatMonth(o.next.month, lang)
    if (o.next.first) return t('shell.loans.firstOn', { when })
    return o.next.month === month ? t('shell.loans.nextThisMonth') : t('shell.loans.nextOn', { when })
  }

  const billDueLine = (m: MonthlyPaymentResponse): string => {
    const due = m.active ? upcomingFor('bill', m.id) : undefined
    if (!due) return t('shell.bills.dueOn', { day: m.dueDay })
    return due.date === today
      ? t('shell.bills.dueToday')
      : t('shell.bills.dueDate', { date: formatDate(due.date, lang, 'dayShort') })
  }

  const leftLine = (o: Obligation): string => {
    // Only a bank loan with no end date has no known balance: say what was borrowed instead.
    if (o.remaining == null) return t('shell.loans.borrowedTotal', { amount: moneyFull(o.record.totalAmount, o.currency) })
    const amount = moneyFull(o.remaining, o.currency)
    return o.remainingEstimated ? t('shell.loans.leftToRepayAbout', { amount }) : t('shell.loans.leftToRepay', { amount })
  }

  /** A loan on a monthly plan: what a month costs, when the next one is due, what is left. */
  const monthlyRow = (o: Obligation) => {
    const Icon = o.kind === 'bank' ? Landmark : o.kind === 'taken' ? Banknote : Receipt
    const loanName = o.kind === 'bank' ? o.record.loanName : ''
    const showLoanName = !!loanName && loanName !== o.name && !DEFAULT_LOAN_NAMES.has(loanName.trim().toLocaleLowerCase())
    const canPay = !o.paidOff && (o.kind !== 'bank' || o.monthly != null)
    const overdue = !o.paidOff && !!upcomingFor(o.kind, o.id)?.overdue
    return (
      <MoneyRow
        key={o.key}
        icon={<Icon className="h-4 w-4" aria-hidden="true" />}
        chip={o.kind === 'bank' ? 'bg-indigo-100 text-indigo-600' : o.kind === 'taken' ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-500'}
        title={o.name}
        badge={showLoanName || overdue ? (
          <>
            {showLoanName && <Chip>{loanName}</Chip>}
            {overdue && <OverdueChip />}
          </>
        ) : undefined}
        detail={o.paidOff ? t('shell.loans.paidOff') : [leftLine(o), nextLine(o)].filter(Boolean).join(' · ')}
        amount={o.paidOff
          ? moneyFull(o.record.totalAmount, o.currency)
          : o.monthly != null ? moneyFull(o.monthly, o.currency) : '—'}
        caption={o.paidOff ? t('page.shared.total') : t('shell.bills.aMonth')}
        action={canPay ? (
          <Button size="sm" label={t('page.shared.payButton')} onClick={gate(() => payObligation(o))} />
        ) : undefined}
        menu={menuFor(o.key, () => startEditObligation(o), () => setHistory({ kind: o.kind, id: o.id, name: o.name }),
          () => deleteObligation(o))}
      />
    )
  }

  /** Repaid as fast as possible: what is left, and what this month asks of it. */
  const asapRow = (o: Obligation) => {
    const Icon = o.kind === 'taken' ? Banknote : Receipt
    const left = o.remaining ?? 0
    const rule = asapDue(left, income)
    // This month's due, as the advisor places it (dated today): it knows what this month already
    // paid. Without one — an older server — the rule says it.
    const due = o.kind === 'bank' ? undefined : upcomingFor(o.kind, o.id)
    const dueAmount = due?.amount ?? rule.amount
    const allNow = due ? due.amount >= left - EPSILON : rule.allNow
    return (
      <MoneyRow
        key={o.key}
        icon={<Icon className="h-4 w-4" aria-hidden="true" />}
        chip={o.kind === 'taken' ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-500'}
        title={o.name}
        badge={!o.paidOff && due?.overdue ? <OverdueChip /> : undefined}
        detail={o.paidOff ? t('shell.loans.paidOff')
          : allNow ? t('shell.loans.allDueNow')
            : t('shell.loans.dueThisMonth', { amount: moneyFull(dueAmount, o.currency) })}
        amount={moneyFull(o.paidOff ? o.record.totalAmount : left, o.currency)}
        caption={o.paidOff ? t('page.shared.total') : t('shell.loans.leftCaption')}
        action={o.paidOff ? undefined : (
          <Button size="sm" label={t('page.shared.payButton')} onClick={gate(() => payObligation(o, dueAmount))} />
        )}
        menu={menuFor(o.key, () => startEditObligation(o), () => setHistory({ kind: o.kind, id: o.id, name: o.name }),
          () => deleteObligation(o))}
      />
    )
  }

  const billRow = ({ record: m, paidThisMonth, left }: BillRow) => {
    const key = `bill-${m.id}`
    return (
      <MoneyRow
        key={key}
        icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
        chip={m.active ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}
        title={m.name}
        badge={!m.active ? <Chip>{t('shell.bills.paused')}</Chip>
          : upcomingFor('bill', m.id)?.overdue ? <OverdueChip /> : undefined}
        detail={billDueLine(m)}
        amount={moneyFull(m.amount, m.currency)}
        caption={t('shell.bills.aMonth')}
        action={!m.active ? undefined : paidThisMonth ? (
          <span className="inline-flex h-9 items-center gap-1 rounded-chip bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {t('shell.bills.paid')}
          </span>
        ) : (
          <Button size="sm" label={t('page.shared.payButton')}
            onClick={gate(() => setPayBill({ record: m, amount: left ?? undefined }))} />
        )}
        menu={menuFor(key, () => startEditBill(m), () => setHistory({ kind: 'bill', id: m.id, name: m.name }),
          () => remove(key, () => financeApi.deleteMonthlyPayment(m.id)),
          [m.active
            ? { label: t('shell.bills.pause'), icon: <Pause className="h-4 w-4" aria-hidden="true" />, onClick: () => setBillActive(m, false) }
            : { label: t('shell.bills.resume'), icon: <Play className="h-4 w-4" aria-hidden="true" />, onClick: () => setBillActive(m, true) }])}
      />
    )
  }

  const receivableRow = ({ record: l, returned: done }: Receivable) => {
    const key = `given-${l.id}`
    const detail = [
      t('shell.owed.lentOn', { amount: moneyFull(l.totalAmount, l.currency), date: formatDate(l.lentDate, lang) }),
      !done && l.expectedReturnDate ? t('shell.owed.backBy', { date: formatDate(l.expectedReturnDate, lang) }) : null,
    ].filter(Boolean).join(' · ')
    return (
      <MoneyRow
        key={key}
        icon={<HandCoins className="h-4 w-4" aria-hidden="true" />}
        chip="bg-teal-100 text-teal-600"
        title={l.debtorName}
        detail={detail}
        amount={moneyFull(done ? l.totalAmount : l.pendingAmount, l.currency)}
        amountTone={done ? 'neutral' : 'in'}
        caption={done ? t('shell.owed.returned') : t('shell.owed.stillOwed')}
        action={done ? undefined : (
          <Button size="sm" label={t('shell.owed.gotBack')}
            onClick={gate(() => setRepay({ target: { kind: 'loan-given', record: l } }))} />
        )}
        menu={menuFor(key, () => startEditLent(l), () => setHistory({ kind: 'given', id: l.id, name: l.debtorName }),
          () => remove(key, () => financeApi.deleteLoanGiven(l.id)))}
      />
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const expenseCategories = useMemo(() => {
    const list: { id: number; label: string }[] = []
    const roots: Category[] = (categories.data ?? []).filter(c => c.parentId === null)
    for (const root of roots) {
      list.push({ id: root.id, label: categoryName(root) })
      for (const child of root.children ?? []) {
        list.push({ id: child.id, label: `${categoryName(root)} › ${categoryName(child)}` })
      }
    }
    return list
  }, [categories.data, categoryName])

  const formTitle = !form ? ''
    : form.editId != null ? t('shell.loans.editTitle', { name: form.name })
      : t(CHOOSER.find(c => c.kind === form.kind)?.labelKey ?? 'action.add')

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={t('shell.nav.loans')}
        primary={{
          label: t('action.add'),
          onClick: () => setChooserOpen(true),
          icon: <Plus className="h-4 w-4" aria-hidden="true" />,
        }}
      />

      <div className="mt-4 xl:mt-5">
        <TileGrid className={refreshing ? 'opacity-60 transition-opacity' : ''}>
          <IncomeRequiredNotice className={FULL} />

          {coreLoading ? (
            <>
              <Skeleton variant="stat" className={HALF} />
              <Skeleton variant="stat" className={HALF} />
              <Skeleton variant="row" count={3} className={FULL} />
              <Skeleton variant="row" count={3} className={FULL} />
            </>
          ) : coreFailed ? (
            <ErrorTile className={FULL} message={coreFailed} onRetry={refetchAll} />
          ) : (
            <>
              {coreStale && <ErrorTile compact className={FULL} message={coreStale} onRetry={refetchAll} />}

              {/* The page's hero: what leaves every month. */}
              <StatTile
                hero
                span={6}
                mdSpan={6}
                label={t('shell.loans.everyMonth')}
                value={money(billsMonthly + loansMonthly)}
                caption={t('shell.loans.everyMonthSplit', { bills: money(billsMonthly), loans: money(loansMonthly) })}
                icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
              />

              <Tile span={6} mdSpan={6} as="section">
                <div className="grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <p className="text-label uppercase text-slate-500">{t('shell.loans.youOweFast')}</p>
                    <p className="mt-3 text-title tabular-nums text-expense sm:text-stat" title={moneyExact(youOwe)}>
                      {money(youOwe)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-label uppercase text-slate-500">{t('shell.loans.owedToYou')}</p>
                    <p className="mt-3 text-title tabular-nums text-income sm:text-stat" title={moneyExact(owedToYou)}>
                      {money(owedToYou)}
                    </p>
                  </div>
                </div>
              </Tile>

              <ListTile
                span={12}
                header={<h2 className="text-sm font-semibold text-slate-900">{t('shell.bills.title')}</h2>}
                empty={
                  <div className="flex flex-col items-center gap-3">
                    <p>{t('shell.bills.none')}</p>
                    <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                      label={t('shell.bills.add')} onClick={() => startAdd('bill')} />
                  </div>
                }
              >
                {billRows.map(billRow)}
              </ListTile>

              <ListTile
                span={12}
                header={<h2 className="text-sm font-semibold text-slate-900">{t('shell.loans.monthlyTitle')}</h2>}
                empty={
                  <div className="flex flex-col items-center gap-3">
                    <p>{t('shell.loans.monthlyNone')}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="ghost" size="sm" icon={<Landmark className="h-4 w-4" aria-hidden="true" />}
                        label={t('page.finance.optionBankLoan')} onClick={() => startAdd('bank')} />
                      <Button variant="ghost" size="sm" icon={<Banknote className="h-4 w-4" aria-hidden="true" />}
                        label={t('page.finance.optionBorrowed')} onClick={() => startAdd('borrowed')} />
                    </div>
                  </div>
                }
              >
                {activeMonthly.map(monthlyRow)}
                {paidOffMonthly.length > 0 && (
                  <Disclosure
                    open={showPaidOffMonthly}
                    onToggle={() => setShowPaidOffMonthly(o => !o)}
                    label={t('shell.loans.paidOffCount', { count: paidOffMonthly.length })}
                  />
                )}
                {showPaidOffMonthly && paidOffMonthly.map(monthlyRow)}
              </ListTile>

              <ListTile
                span={12}
                header={<h2 className="text-sm font-semibold text-slate-900">{t('shell.loans.asapTitle')}</h2>}
                empty={<p>{t('shell.loans.asapNone')}</p>}
              >
                {activeAsap.map(asapRow)}
                {paidOffAsap.length > 0 && (
                  <Disclosure
                    open={showPaidOffAsap}
                    onToggle={() => setShowPaidOffAsap(o => !o)}
                    label={t('shell.loans.paidOffCount', { count: paidOffAsap.length })}
                  />
                )}
                {showPaidOffAsap && paidOffAsap.map(asapRow)}
              </ListTile>

              <ListTile
                span={12}
                header={<h2 className="text-sm font-semibold text-slate-900">{t('shell.owed.title')}</h2>}
                empty={
                  <div className="flex flex-col items-center gap-3">
                    <p>{t('shell.owed.none')}</p>
                    <Button variant="ghost" size="sm" icon={<HandCoins className="h-4 w-4" aria-hidden="true" />}
                      label={t('page.finance.optionLent')} onClick={() => startAdd('lent')} />
                  </div>
                }
              >
                {waitingFor.map(receivableRow)}
                {returned.length > 0 && (
                  <Disclosure
                    open={showReturned}
                    onToggle={() => setShowReturned(o => !o)}
                    label={t('shell.owed.returnedCount', { count: returned.length })}
                  />
                )}
                {showReturned && returned.map(receivableRow)}
              </ListTile>

              {/* Who money goes back and forth with — only on a server that keeps people. */}
              {lendersOn && <PeopleTile title={t('shell.people.lendersTitle')} people={lenders.data?.people ?? []} />}
              {borrowersOn && <PeopleTile title={t('shell.people.borrowersTitle')} people={borrowers.data?.people ?? []} />}
            </>
          )}
        </TileGrid>
      </div>

      {/* ── Add: one button, four things ───────────────────────────────────────── */}
      <Modal open={chooserOpen} onClose={() => setChooserOpen(false)}
        title={t('page.finance.addChooserTitle')} maxWidth="max-w-md">
        <div className="grid gap-2">
          {CHOOSER.map(o => (
            <button
              key={o.kind}
              type="button"
              onClick={() => startAdd(o.kind)}
              className="focus-ring flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-control
                         border border-slate-200 bg-white px-4 text-left transition
                         hover:bg-slate-50 active:scale-[.98] motion-reduce:transform-none"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-chip ${o.chip}`}>
                <o.Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-slate-900">{t(o.labelKey)}</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* ── The record forms ──────────────────────────────────────────────────── */}
      <Sheet
        open={!!form}
        onClose={closeForm}
        title={formTitle}
        maxWidth="max-w-md"
        dirty={dirty && !saving}
        footer={
          <div className="flex gap-3">
            <Button label={t('action.cancel')} onClick={closeForm} className="flex-1" />
            <Button
              type="submit"
              form={FORM_ID}
              variant="primary"
              loading={saving}
              label={saving ? t('action.saving') : form?.editId != null ? t('action.save') : t('action.add')}
              className="flex-1"
            />
          </div>
        }
      >
        <form id={FORM_ID} onSubmit={save} className="space-y-4">
          {form?.kind === 'bill' && (
            <>
              <Field id="loans-bill-name" label={t('shell.form.name')} required>
                <input required value={bill.name} onChange={e => editBill({ name: e.target.value })}
                  className={INPUT} placeholder={t('shell.form.billNamePlaceholder')} />
              </Field>
              <Field id="loans-bill-amount" label={t('shell.form.amount')} required error={errors.amount}>
                <AmountInput required value={bill.amount} currency="UZS" suffix="UZS"
                  onChange={v => editBill({ amount: v })} className={MONEY_INPUT} />
              </Field>
              <Field id="loans-bill-day" label={t('shell.form.dueDay')} required help={t('shell.form.dueDayHelp')}>
                <select required value={bill.dueDay} onChange={e => editBill({ dueDay: Number(e.target.value) })} className={INPUT}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field id="loans-bill-category" label={t('tx.category')}>
                <select value={bill.categoryId}
                  onChange={e => editBill({ categoryId: e.target.value ? Number(e.target.value) : '' })} className={INPUT}>
                  <option value="">{t('shell.form.noCategory')}</option>
                  {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              {categories.error && !categories.data && (
                <ErrorTile compact message={categories.error} onRetry={categories.refetch} />
              )}
            </>
          )}

          {form?.kind === 'bank' && (
            <>
              <Field id="loans-bank-name" label={t('shell.form.bank')} required>
                <input required list="loans-bank-names" value={bank.bankName} autoComplete="off"
                  onChange={e => editBank({ bankName: e.target.value })}
                  className={INPUT} placeholder={t('shell.form.bankPlaceholder')} />
              </Field>
              <datalist id="loans-bank-names">
                {bankNames.map(n => <option key={n} value={n} />)}
              </datalist>
              <Field id="loans-bank-monthly" label={t('shell.form.monthlyPayment')} required error={errors.monthly}>
                <AmountInput required value={bank.monthly} currency="UZS" suffix="UZS"
                  onChange={v => editBank({ monthly: v })} className={MONEY_INPUT} />
              </Field>
              <Field id="loans-bank-total" label={t('shell.form.totalBorrowed')} required error={errors.amount}>
                <AmountInput required value={bank.total} currency="UZS" suffix="UZS"
                  onChange={v => editBank({ total: v })} className={MONEY_INPUT} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="loans-bank-taken" label={t('shell.form.takenOn')} required>
                  <input required type="date" value={bank.takenDate}
                    onChange={e => editBank({ takenDate: e.target.value })} className={INPUT} />
                </Field>
                <Field id="loans-bank-end" label={t('shell.form.endDate')} error={errors.endDate}>
                  <input type="date" value={bank.endDate}
                    onChange={e => editBank({ endDate: e.target.value })} className={INPUT} />
                </Field>
              </div>
            </>
          )}

          {form?.kind === 'borrowed' && (
            <>
              <PersonField
                id="loans-borrowed-person"
                on={lendersOn}
                label={t(lendersOn ? 'shell.form.lender' : 'shell.form.fromWhom')}
                newLabel={t('shell.form.newLender')}
                people={lenderPeople}
                value={borrowed.person}
                name={borrowed.name}
                onPick={v => editBorrowed({ person: v })}
                onName={v => editBorrowed({ name: v })}
                personError={errors.person}
                nameError={errors.name}
              />
              <Field id="loans-borrowed-amount" label={t('shell.form.amount')} required error={errors.amount}>
                <AmountInput required value={borrowed.amount} currency="UZS" suffix="UZS"
                  onChange={v => editBorrowed({ amount: v })} className={MONEY_INPUT} />
              </Field>
              <Field id="loans-borrowed-date" label={t('shell.form.date')} required>
                <input required type="date" value={borrowed.date}
                  onChange={e => editBorrowed({ date: e.target.value })} className={INPUT} />
              </Field>
              <div>
                <p id="loans-borrowed-type-label" className="mb-1 text-xs font-medium text-slate-600">
                  {t('shell.form.howRepay')}
                </p>
                <div role="radiogroup" aria-labelledby="loans-borrowed-type-label" className="flex gap-1 rounded-control bg-slate-100 p-1">
                  {REPAY_TYPES.map((v, i) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={borrowed.type === v}
                      {...repayKeys(i)}
                      onClick={() => editBorrowed({ type: v })}
                      className={`focus-ring min-h-[44px] flex-1 rounded-chip px-2 text-xs font-semibold transition-colors focus-visible:ring-offset-slate-100 ${
                        borrowed.type === v ? 'bg-white text-indigo-600 shadow-tile' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t(v === 'MONTHLY' ? 'shell.form.repayMonthly' : 'shell.form.repayAsap')}
                    </button>
                  ))}
                </div>
              </div>
              {borrowed.type === 'MONTHLY' ? (
                <>
                  <Field id="loans-borrowed-monthly" label={t('shell.form.monthlyPayment')} required
                    help={t('shell.form.monthlyHelp')} error={errors.monthly}>
                    <AmountInput required value={borrowed.monthly} currency="UZS" suffix="UZS"
                      onChange={v => editBorrowed({ monthly: v })} className={MONEY_INPUT} />
                  </Field>
                  <Field id="loans-borrowed-first" label={t('shell.form.firstPaymentMonth')} required>
                    <input required type="month" value={borrowed.firstMonth}
                      onChange={e => editBorrowed({ firstMonth: e.target.value })} className={INPUT} />
                  </Field>
                </>
              ) : (
                <p className="text-xs leading-snug tabular-nums text-slate-600">
                  {income != null && income > 0
                    ? t('shell.form.asapRule', { limit: moneyFull(snap(income * ASAP_ALL_DUE_SHARE)) })
                    : t('shell.form.asapRuleNoIncome')}
                </p>
              )}
            </>
          )}

          {form?.kind === 'debt' && (
            <>
              <Field id="loans-debt-name" label={t('shell.form.whoYouOwe')} required>
                <input required value={debt.name} onChange={e => editDebt({ name: e.target.value })}
                  className={INPUT} autoComplete="off" />
              </Field>
              <Field id="loans-debt-amount" label={t('shell.form.amount')} required error={errors.amount}>
                <AmountInput required value={debt.amount} currency="UZS" suffix="UZS"
                  onChange={v => editDebt({ amount: v })} className={MONEY_INPUT} />
              </Field>
              <Field id="loans-debt-first" label={t('shell.form.firstPaymentMonth')}>
                <input type="month" value={debt.firstMonth}
                  onChange={e => editDebt({ firstMonth: e.target.value })} className={INPUT} />
              </Field>
            </>
          )}

          {form?.kind === 'lent' && (
            <>
              <PersonField
                id="loans-lent-person"
                on={borrowersOn}
                label={t(borrowersOn ? 'shell.form.borrower' : 'shell.form.toWhom')}
                newLabel={t('shell.form.newPerson')}
                people={borrowerPeople}
                value={lent.person}
                name={lent.name}
                onPick={v => editLent({ person: v })}
                onName={v => editLent({ name: v })}
                personError={errors.person}
                nameError={errors.name}
              />
              <Field id="loans-lent-amount" label={t('shell.form.amount')} required error={errors.amount}>
                <AmountInput required value={lent.amount} currency="UZS" suffix="UZS"
                  onChange={v => editLent({ amount: v })} className={MONEY_INPUT} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="loans-lent-date" label={t('shell.form.date')} required>
                  <input required type="date" value={lent.date}
                    onChange={e => editLent({ date: e.target.value })} className={INPUT} />
                </Field>
                <Field id="loans-lent-expected" label={t('shell.form.expectedBack')} error={errors.expected}>
                  <input type="date" value={lent.expected}
                    onChange={e => editLent({ expected: e.target.value })} className={INPUT} />
                </Field>
              </div>
            </>
          )}

          {formError && <p role="alert" className="text-sm text-expense">{formError}</p>}
        </form>
      </Sheet>

      {/* ── Paying ────────────────────────────────────────────────────────────── */}
      <PaySubscriptionModal
        open={!!payBill}
        subscription={payBill?.record ?? null}
        defaultAmount={payBill?.amount}
        onClose={() => setPayBill(null)}
        onSaved={() => {
          bills.refetch(); advisor.refetch(); monthTx.refetch()
          setPayBill(null)
          showSuccess(t('page.finance.paymentRecordedToast'))
        }}
      />
      <PayBankInstallmentModal
        open={!!payBank}
        defaultMonth={month}
        bankLoanId={payBank?.id}
        defaultAmount={payBank?.amount}
        onClose={() => setPayBank(null)}
        onSaved={() => { bankLoans.refetch(); advisor.refetch(); monthTx.refetch() }}
      />
      <RepaymentModal
        open={!!repay}
        target={repay?.target ?? null}
        defaultAmount={repay?.amount}
        onClose={() => setRepay(null)}
        onSaved={() => {
          loansTaken.refetch(); debts.refetch(); loansGiven.refetch(); advisor.refetch(); monthTx.refetch()
          setRepay(null)
        }}
      />

      {history && (
        <PaymentsSheet key={`${history.kind}-${history.id}`} target={history} onClose={() => setHistory(null)} />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Pieces
// ────────────────────────────────────────────────────────────────────────────────

const TONE = { neutral: 'text-slate-900', in: 'text-income', out: 'text-expense' } as const

/**
 * One bill, loan or loan-to-someone. On a phone it is two blocks — what it is, then the amount
 * with its one action — because a Pay button beside the amount leaves the name 40px to live in
 * at 390px. From `sm` up it is a single line.
 */
function MoneyRow({ icon, chip, title, badge, detail, amount, amountTone = 'neutral', caption, action, menu }: {
  icon: ReactNode
  /** The icon chip's colours. */
  chip: string
  title: string
  badge?: ReactNode
  detail?: string
  amount: string
  amountTone?: keyof typeof TONE
  caption?: string
  action?: ReactNode
  menu: MenuAction[]
}) {
  return (
    <div className="group/row flex items-start gap-3 px-4 py-3 sm:items-center">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-chip sm:mt-0 ${chip}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-medium text-slate-900">{title}</p>
            {badge}
          </div>
          {detail && <p className="mt-0.5 text-xs tabular-nums text-slate-500">{detail}</p>}
        </div>
        {/* Wraps rather than overflows: "Got money back" beside a long amount does not fit 390px. */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:mt-0 sm:shrink-0 sm:flex-nowrap">
          <div className="min-w-0 sm:text-right">
            <p className={`whitespace-nowrap text-sm font-semibold tabular-nums ${TONE[amountTone]}`}>{amount}</p>
            {caption && <p className="text-[11px] text-slate-500">{caption}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
      <ActionMenu actions={menu} revealOnHover />
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {children}
    </span>
  )
}

/** The payment's day has passed and it is still unpaid — the same word Home's "Coming up" uses. */
function OverdueChip() {
  const { t } = useLang()
  return (
    <span className="shrink-0 rounded-chip bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-expense">
      {t('home.upcoming.overdue')}
    </span>
  )
}

/**
 * Who the money came from or went to: picked from the people on file, most-used first, or typed in
 * as someone new. An older server keeps no people, and then it is the plain name field it always was.
 */
function PersonField({ id, on, label, newLabel, people, value, name, onPick, onName, personError, nameError }: {
  id: string
  on: boolean
  label: string
  newLabel: string
  people: PersonSummary[]
  value: string
  name: string
  onPick: (v: string) => void
  onName: (v: string) => void
  personError?: string
  nameError?: string
}) {
  const { t } = useLang()
  const nameInput = (
    <input required value={name} onChange={e => onName(e.target.value)} className={INPUT} autoComplete="off" />
  )
  if (!on) {
    return <Field id={`${id}-name`} label={label} required error={nameError}>{nameInput}</Field>
  }
  return (
    <>
      <Field id={id} label={label} required error={personError}>
        <select required value={value} onChange={e => onPick(e.target.value)} className={INPUT}>
          <option value="" disabled>{t('shell.form.choosePerson')}</option>
          {people.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          <option value="new">{newLabel}</option>
        </select>
      </Field>
      {value === 'new' && (
        <Field id={`${id}-name`} label={t('shell.form.name')} required error={nameError}>{nameInput}</Field>
      )}
    </>
  )
}

const PEOPLE_SHOWN = 5

/** The people money goes back and forth with, by how much, largest first — five, then "Show all". */
function PeopleTile({ title, people }: { title: string; people: PersonSummary[] }) {
  const { t, lang } = useLang()
  const [all, setAll] = useState(false)
  const list = [...people].sort((a, b) => b.total - a.total)
  const shown = all ? list : list.slice(0, PEOPLE_SHOWN)
  return (
    <Tile span={6} mdSpan={6} as="section">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('shell.people.none')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-hairline">
          {shown.map(p => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                <p className="text-xs tabular-nums text-slate-500">
                  {[
                    plural(p.times, t('shell.people.timesOne', { count: p.times }), t('shell.people.timesMany', { count: p.times }), lang),
                    p.open > 0 ? t('shell.people.open', { amount: moneyFull(p.open) }) : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{moneyFull(p.total)}</p>
            </li>
          ))}
        </ul>
      )}
      {list.length > PEOPLE_SHOWN && (
        <button type="button" onClick={() => setAll(v => !v)} aria-expanded={all}
          className="focus-ring mt-1 inline-flex min-h-[44px] items-center rounded-control text-sm font-semibold text-indigo-600 hover:underline">
          {all ? t('home.list.showLess') : t('home.list.showAll', { count: list.length })}
        </button>
      )}
    </Tile>
  )
}

/** "Paid off (3)" — the rows that need nothing more, folded away under the ones that do. */
function Disclosure({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      // Inset ring: ListTile clips its corners, and an outside ring would lose its side bands.
      className="focus-ring focus-visible:ring-inset focus-visible:ring-offset-0 flex min-h-[44px] w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
    >
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      {label}
    </button>
  )
}

/**
 * Every payment made against one record. Keyed by record, so opening another one starts from
 * nothing rather than flashing the last record's payments.
 */
function PaymentsSheet({ target, onClose }: { target: HistoryTarget; onClose: () => void }) {
  const { t, lang } = useLang()
  const q = useApi<Transaction[]>(async () => {
    switch (target.kind) {
      case 'bill': return financeApi.getMonthlyPaymentPayments(target.id)
      case 'taken': return financeApi.getLoanTakenRepayments(target.id)
      case 'debt': return financeApi.getDebtRepayments(target.id)
      case 'given': return financeApi.getLoanGivenRepayments(target.id)
      default: {
        // A bank instalment carries no loan id, only the bank's name in its description.
        const res = await transactionsApi.getAll({
          page: 0, size: 100, sortBy: 'transactionDate', sortDir: 'desc', search: target.name,
        })
        return { data: res.data.content.filter(tx => (tx.subType as string | null) === 'BANK_LOAN_PAYMENT') }
      }
    }
  }, [target.kind, target.id])

  const rows = [...(q.data ?? [])].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))

  return (
    <Sheet open onClose={onClose} title={t('page.finance.paymentHistoryPanelTitle', { name: target.name })} maxWidth="max-w-2xl">
      {q.loading ? (
        <Skeleton variant="row" count={4} bare />
      ) : q.error && !q.data ? (
        <ErrorTile message={q.error} onRetry={q.refetch} />
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">{t('page.finance.noPaymentsYet')}</p>
      ) : (
        <div className="-mx-5 divide-y divide-hairline border-y border-hairline sm:-mx-7">
          {rows.map(tx => (
            <ListRow
              key={tx.id}
              leading={
                <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-slate-100 text-slate-500">
                  {tx.card ? <CreditCard className="h-4 w-4" aria-hidden="true" /> : <Wallet className="h-4 w-4" aria-hidden="true" />}
                </span>
              }
              title={formatDate(tx.transactionDate, lang)}
              subtitle={tx.card ? `${tx.card.name} •••• ${tx.card.lastFourDigits}` : t('tx.cash')}
              amount={`${tx.type === 'INCOME' ? '+' : '−'}${moneyFull(tx.amount, tx.currency)}`}
              amountTone={tx.type === 'INCOME' ? 'in' : 'out'}
            />
          ))}
        </div>
      )}
    </Sheet>
  )
}
