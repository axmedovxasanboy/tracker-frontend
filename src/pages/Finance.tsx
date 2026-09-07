import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDown, ArrowUp, Banknote, CalendarClock, CheckCircle, Clock, CreditCard,
  DollarSign, HandCoins, History, Landmark, Pencil, Plus, Receipt, Trash2,
  TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react'
import { differenceInCalendarMonths } from 'date-fns'
import { useToast } from '../context/ToastContext'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import { useConfirm } from '../context/ConfirmContext'
import { Modal } from '../components/ui/Modal'
import { Tile, TileGrid } from '../components/ui/Tile'
import { StatTile } from '../components/ui/StatTile'
import { PageHeader } from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { ListRow, ListTile } from '../components/ui/ListRow'
import type { ListRowAction } from '../components/ui/ListRow'
import { ErrorTile } from '../components/ui/ErrorTile'
import { Skeleton } from '../components/ui/Skeleton'
import { ExplainModal, type ExplainRow } from '../components/ui/ExplainModal'
import { AmountInput } from '../components/ui/AmountInput'
import { RepaymentModal } from '../components/finance/RepaymentModal'
import { PersonLoanGroups } from '../components/finance/PersonLoanGroups'
import { PaySubscriptionModal } from '../components/finance/PaySubscriptionModal'
import { useApi } from '../hooks/useApi'
import { financeApi } from '../api/finance'
import { categoriesApi } from '../api/categories'
import { extractErrorMessage } from '../api/client'
import { formatDate, money, moneyExact, moneyFull, plural, snap, todayLocal } from '../utils/format'
import type {
  RecordStatus,
  DebtRequest, DebtResponse, LoanGivenRequest, LoanGivenResponse,
  LoanTakenRequest, LoanTakenResponse,
  BankLoanRequest, BankLoanResponse, MonthlyPaymentRequest, MonthlyPaymentResponse,
} from '../types'

/**
 * One tab per thing the page holds. `overview` keeps its old URL segment because it is
 * bookmarked and because App.tsx redirects `/finance` to it; the two former sub-tabs are now
 * top-level, which is what collapses the page's two stacked tab strips into one.
 */
type FinanceTab = 'overview' | 'lent' | 'borrowed' | 'bank-loans' | 'monthly-payments'

/**
 * Which record a form creates or edits. Deliberately NOT derived from the tab: the Summary tab
 * has no record type of its own, and its Add chooser has to be able to open any of the forms.
 * Keying the modals, the save dispatch and the delete dispatch off this rather than off the URL
 * is what makes "+ Add" work on Summary at all.
 */
type FormKind = 'debts' | 'loans-given' | 'loans-taken' | 'bank-loans' | 'monthly-payments'

const TAB_IDS: FinanceTab[] = ['overview', 'lent', 'borrowed', 'bank-loans', 'monthly-payments']

const TAB_LABEL: Record<FinanceTab, TKey> = {
  'overview':         'page.finance.tabSummary',
  'lent':             'page.finance.subTabLentedMoney',
  'borrowed':         'page.finance.subTabBorrowedMoney',
  'bank-loans':       'page.finance.tabBankLoans',
  'monthly-payments': 'page.finance.tabMonthly',
}

/** The record a tab's "+ Add" creates. Summary has none — it asks first. */
const TAB_FORM: Partial<Record<FinanceTab, FormKind>> = {
  'lent':             'loans-given',
  'borrowed':         'loans-taken',
  'bank-loans':       'bank-loans',
  'monthly-payments': 'monthly-payments',
}

/** The Add button names its object, so it can never read as a generic no-op. */
const ADD_LABEL: Record<FinanceTab, TKey> = {
  'overview':         'action.add',
  'lent':             'page.finance.addLent',
  'borrowed':         'page.finance.addBorrowed',
  'bank-loans':       'page.finance.addBankLoan',
  'monthly-payments': 'page.finance.addMonthlyBill',
}

/** Bookmarks and the old sidebar link pointed at these; they land on the tab that replaced them. */
const LEGACY_TAB: Record<string, FinanceTab> = {
  'debts':       'lent',
  'loans-given': 'lent',
  'loans-taken': 'borrowed',
}

/**
 * Status is a pill, never a surface. Pending is the resting state of every unpaid record, so it
 * stays neutral — amber is reserved for a record that is part-way through, and rose for one that
 * is genuinely late.
 */
const STATUS_BADGE: Record<RecordStatus, { labelKey: TKey; className: string }> = {
  PENDING:        { labelKey: 'page.finance.statusPending', className: 'bg-slate-100 text-slate-600' },
  PARTIALLY_PAID: { labelKey: 'page.finance.statusPartial', className: 'bg-amber-100 text-amber-700' },
  PAID:           { labelKey: 'page.finance.statusPaid',    className: 'bg-emerald-50 text-emerald-700' },
  OVERDUE:        { labelKey: 'page.finance.statusOverdue', className: 'bg-rose-100 text-rose-700' },
}

function StatusBadge({ status }: { status: RecordStatus }) {
  const { t } = useLang()
  const { labelKey, className } = STATUS_BADGE[status]
  return (
    <span className={`inline-flex items-center rounded-chip px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {t(labelKey)}
    </span>
  )
}

/** A full-width row of the twelve-column page grid. */
const FULL = 'md:col-span-6 xl:col-span-12'

/** One shared id, because only one record form is ever open at a time. */
const FORM_ID = 'finance-record-form'

/**
 * One control shape for the whole page. The bare `px-3 py-2.5` this used to be came out 42px
 * tall, so a field in a dialog opened from a row sat 2px short of the same field on a standalone
 * page and under the 44px touch floor.
 */
const CONTROL = 'focus-ring w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500'
/** Inputs and selects: a fixed 44px. */
const INPUT = `${CONTROL} h-11`
/** A textarea takes its height from `rows`, so it needs the padding an input gets from `h-11`. */
const TEXTAREA = `${CONTROL} py-2.5`
/** `AmountInput` paints its `suffix` over the field at `right-3`; 12px of padding is not enough
 *  room for "UZS", so a long figure runs under it in the narrow two-column money rows. */
const MONEY_INPUT = `${INPUT} pr-14`

export function Finance() {
  const { t, lang, categoryName } = useLang()
  const { tab } = useParams<{ tab: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()

  const isKnownTab = (TAB_IDS as string[]).includes(tab ?? '')
  const activeTab = (isKnownTab ? tab : 'overview') as FinanceTab

  const [modalOpen, setModalOpen] = useState(false)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [formKind, setFormKind] = useState<FormKind | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Repayment modal state
  type RepayTarget =
    | { kind: 'loan-taken'; record: LoanTakenResponse }
    | { kind: 'debt';       record: DebtResponse }
    | { kind: 'loan-given'; record: LoanGivenResponse }
  const [repayTarget, setRepayTarget] = useState<RepayTarget | null>(null)

  // Loan / debt payment history.
  //
  // Only the record's IDENTITY is held, never the record itself. A history panel and the Repay
  // button sit in the same row menu, so the user's next move after opening one is often to record
  // a payment — and a panel holding the object it was opened with would keep quoting the balance
  // from before that write, contradicting the row directly above it. The record is re-derived
  // from the live list on every render instead.
  type HistoryTarget = { kind: RepayTarget['kind']; id: number }
  const [history, setHistory] = useState<HistoryTarget | null>(null)
  const [historySortAsc, setHistorySortAsc] = useState(false)

  const historyApi = useApi(
    () => {
      if (!history) return Promise.resolve({ data: null } as never)
      if (history.kind === 'loan-taken') return financeApi.getLoanTakenRepayments(history.id)
      if (history.kind === 'loan-given') return financeApi.getLoanGivenRepayments(history.id)
      return financeApi.getDebtRepayments(history.id)
    },
    [history?.kind, history?.id],
  )

  // Monthly-bill payment flow + history. `subHistoryId` is an id for the same reason.
  const [payTarget, setPayTarget] = useState<MonthlyPaymentResponse | null>(null)
  const [subHistoryId, setSubHistoryId] = useState<number | null>(null)
  const [subHistorySortAsc, setSubHistorySortAsc] = useState(false)
  const subHistoryApi = useApi(
    () => subHistoryId !== null
      ? financeApi.getMonthlyPaymentPayments(subHistoryId)
      : Promise.resolve({ data: null } as never),
    [subHistoryId],
  )

  // All data fetches
  const debts = useApi(() => financeApi.getDebts(), [])
  const loansGiven = useApi(() => financeApi.getLoansGiven(), [])
  const loansTaken = useApi(() => financeApi.getLoansTaken(), [])
  const bankLoans = useApi(() => financeApi.getBankLoans(), [])
  const monthly = useApi(() => financeApi.getMonthlyPayments(), [])
  const categories = useApi(() => categoriesApi.getAll(), [])

  // ── Forms ──────────────────────────────────────────────────────────────────
  const [debtForm, setDebtForm] = useState<DebtRequest>({ creditorName: '', totalAmount: 0, currency: 'UZS', borrowedDate: todayLocal() })
  const [lgForm, setLgForm] = useState<LoanGivenRequest>({ debtorName: '', totalAmount: 0, currency: 'UZS', lentDate: todayLocal() })
  const [ltForm, setLtForm] = useState<LoanTakenRequest>({ lenderName: '', totalAmount: 0, currency: 'UZS', borrowedDate: todayLocal() })
  const [blForm, setBlForm] = useState<BankLoanRequest>({ bankName: '', loanName: '', totalAmount: 0, currency: 'UZS', takenDate: todayLocal() })
  const [mpForm, setMpForm] = useState<MonthlyPaymentRequest>({ name: '', amount: 0, currency: 'UZS', dueDay: 1, active: true })

  // Edit just the repayment plan, without opening the whole loan form.
  const [planTarget, setPlanTarget] = useState<LoanTakenResponse | null>(null)
  const [planAmount, setPlanAmount] = useState(0)
  const [savingPlan, setSavingPlan] = useState(false)

  const setTab = (id: FinanceTab) => navigate(`/finance/${id}`)

  const refetchFor = (kind: FormKind) => {
    const map: Record<FormKind, () => void> = {
      'debts':            debts.refetch,
      'loans-given':      loansGiven.refetch,
      'loans-taken':      loansTaken.refetch,
      'bank-loans':       bankLoans.refetch,
      'monthly-payments': monthly.refetch,
    }
    map[kind]()
  }

  const resetForms = () => {
    setDebtForm({ creditorName: '', totalAmount: 0, currency: 'UZS', borrowedDate: todayLocal(), paymentStartDate: nextMonthFirst() })
    setLgForm({ debtorName: '', totalAmount: 0, currency: 'UZS', lentDate: todayLocal() })
    setLtForm({ lenderName: '', totalAmount: 0, currency: 'UZS', borrowedDate: todayLocal(), paymentStartDate: nextMonthFirst() })
    setBlForm({ bankName: '', loanName: '', totalAmount: 0, currency: 'UZS', takenDate: todayLocal() })
    setMpForm({ name: '', amount: 0, currency: 'UZS', dueDay: 1, active: true })
  }

  const closeModal = () => { setModalOpen(false); setEditId(null) }

  /** The one entry point for creating anything. On Summary it asks which kind first. */
  const openAdd = () => {
    const kind = TAB_FORM[activeTab]
    if (!kind) { setChooserOpen(true); return }
    startAdd(kind)
  }

  const startAdd = (kind: FormKind) => {
    setChooserOpen(false)
    setEditId(null)
    resetForms()
    setFormKind(kind)
    setModalOpen(true)
  }

  const openEdit = (kind: FormKind, id: number) => {
    setFormKind(kind)
    setEditId(id)
    if (kind === 'debts') {
      const d = debts.data?.find(x => x.id === id)
      if (!d) return
      setDebtForm({ creditorName: d.creditorName, totalAmount: d.totalAmount, paidAmount: d.paidAmount, currency: d.currency, borrowedDate: d.borrowedDate, dueDate: d.dueDate ?? undefined, paymentStartDate: d.paymentStartDate ?? undefined, status: d.status, description: d.description ?? undefined })
    } else if (kind === 'loans-given') {
      const l = loansGiven.data?.find(x => x.id === id)
      if (!l) return
      setLgForm({ debtorName: l.debtorName, totalAmount: l.totalAmount, receivedAmount: l.receivedAmount, currency: l.currency, lentDate: l.lentDate, expectedReturnDate: l.expectedReturnDate ?? undefined, status: l.status, description: l.description ?? undefined })
    } else if (kind === 'loans-taken') {
      const l = loansTaken.data?.find(x => x.id === id)
      if (!l) return
      setLtForm({ lenderName: l.lenderName, totalAmount: l.totalAmount, paidAmount: l.paidAmount, currency: l.currency, borrowedDate: l.borrowedDate, dueDate: l.dueDate ?? undefined, paymentStartDate: l.paymentStartDate ?? undefined, status: l.status, description: l.description ?? undefined, plannedMonthlyPayment: l.plannedMonthlyPayment ?? undefined })
    } else if (kind === 'bank-loans') {
      const b = bankLoans.data?.find(x => x.id === id)
      if (!b) return
      setBlForm({ bankName: b.bankName, loanName: b.loanName, totalAmount: b.totalAmount, currency: b.currency, takenDate: b.takenDate, endDate: b.endDate ?? undefined, monthlyPayment: b.monthlyPayment ?? undefined })
    } else {
      const m = monthly.data?.find(x => x.id === id)
      if (!m) return
      setMpForm({ name: m.name, amount: m.amount, currency: m.currency, dueDay: m.dueDay, active: m.active, description: m.description ?? undefined, nextDueDate: m.nextDueDate ?? undefined, subscribedSince: m.subscribedSince ?? undefined, categoryId: m.category?.id })
    }
    setModalOpen(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formKind) return
    setSaving(true)
    try {
      if (formKind === 'debts') { editId ? await financeApi.updateDebt(editId, debtForm) : await financeApi.createDebt(debtForm) }
      else if (formKind === 'loans-given') { editId ? await financeApi.updateLoanGiven(editId, lgForm) : await financeApi.createLoanGiven(lgForm) }
      else if (formKind === 'loans-taken') { editId ? await financeApi.updateLoanTaken(editId, ltForm) : await financeApi.createLoanTaken(ltForm) }
      else if (formKind === 'bank-loans') { editId ? await financeApi.updateBankLoan(editId, blForm) : await financeApi.createBankLoan(blForm) }
      else { editId ? await financeApi.updateMonthlyPayment(editId, mpForm) : await financeApi.createMonthlyPayment(mpForm) }
      closeModal()
      refetchFor(formKind)
      showSuccess(editId ? t('page.finance.recordUpdatedToast') : t('page.finance.recordCreatedToast'))
    } catch (err: unknown) {
      // Without this the dialog closed on a rejected save and the record silently never existed.
      showError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const del = async (kind: FormKind, id: number) => {
    if (!await confirm({ message: t('page.finance.confirmDeleteRecord'), destructive: true })) return
    setDeleting(id)
    try {
      if (kind === 'debts') await financeApi.deleteDebt(id)
      else if (kind === 'loans-given') await financeApi.deleteLoanGiven(id)
      else if (kind === 'loans-taken') await financeApi.deleteLoanTaken(id)
      else if (kind === 'bank-loans') await financeApi.deleteBankLoan(id)
      else await financeApi.deleteMonthlyPayment(id)
      refetchFor(kind)
      showSuccess(t('page.finance.recordDeletedToast'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err))
    } finally { setDeleting(null) }
  }

  const savePlan = async () => {
    if (!planTarget) return
    setSavingPlan(true)
    try {
      await financeApi.setLoanTakenPlan(planTarget.id, planAmount > 0 ? planAmount : null)
      setPlanTarget(null)
      loansTaken.refetch()
      showSuccess(t('page.finance.recordUpdatedToast'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err))
    } finally { setSavingPlan(false) }
  }

  // ── Row actions ────────────────────────────────────────────────────────────
  const editAction = (kind: FormKind, id: number): ListRowAction => ({
    label: t('action.edit'),
    icon: <Pencil className="w-4 h-4" />,
    onClick: () => openEdit(kind, id),
  })
  const deleteAction = (kind: FormKind, id: number): ListRowAction => ({
    label: t('action.delete'),
    icon: <Trash2 className="w-4 h-4" />,
    onClick: () => del(kind, id),
    danger: true,
    disabled: deleting === id,
  })
  const historyAction = (target: HistoryTarget): ListRowAction => ({
    label: t('action.history'),
    icon: <History className="w-4 h-4" />,
    onClick: () => { setHistory(target); setHistorySortAsc(false) },
  })

  const lentActions = (id: number): ListRowAction[] => {
    const l = loansGiven.data?.find(x => x.id === id)
    if (!l) return []
    return [
      ...(l.status !== 'PAID' ? [{
        label: t('page.finance.returnedButton'),
        icon: <CreditCard className="w-4 h-4" />,
        onClick: () => setRepayTarget({ kind: 'loan-given', record: l }),
      }] : []),
      historyAction({ kind: 'loan-given', id: l.id }),
      editAction('loans-given', id),
      deleteAction('loans-given', id),
    ]
  }

  const borrowedActions = (id: number): ListRowAction[] => {
    const l = loansTaken.data?.find(x => x.id === id)
    if (!l) return []
    return [
      ...(l.status !== 'PAID' ? [
        {
          label: t('page.finance.repayButton'),
          icon: <CreditCard className="w-4 h-4" />,
          onClick: () => setRepayTarget({ kind: 'loan-taken', record: l }),
        },
        {
          label: t('page.finance.planButton'),
          icon: <CalendarClock className="w-4 h-4" />,
          onClick: () => { setPlanTarget(l); setPlanAmount(l.plannedMonthlyPayment ?? 0) },
        },
      ] : []),
      historyAction({ kind: 'loan-taken', id: l.id }),
      editAction('loans-taken', id),
      deleteAction('loans-taken', id),
    ]
  }

  const debtActions = (d: DebtResponse): ListRowAction[] => [
    ...(d.status !== 'PAID' ? [{
      label: t('page.finance.repayButton'),
      icon: <CreditCard className="w-4 h-4" />,
      onClick: () => setRepayTarget({ kind: 'debt', record: d }),
    }] : []),
    historyAction({ kind: 'debt', id: d.id }),
    editAction('debts', d.id),
    deleteAction('debts', d.id),
  ]

  // A tab id that is not one of ours renders nothing at all today; send it somewhere real.
  // Placed after every hook so the hook order never changes between renders.
  if (!isKnownTab) {
    return <Navigate to={`/finance/${LEGACY_TAB[tab ?? ''] ?? 'overview'}`} replace />
  }

  const addLabel = t(ADD_LABEL[activeTab])

  return (
    <div className="p-4 sm:p-6">
      <TileGrid>
        <div className={FULL}>
          <PageHeader
            title={t('page.finance')}
            subtitle={t('page.finance.pageSubtitle')}
            primary={{ label: addLabel, onClick: openAdd, icon: <Plus className="w-4 h-4" /> }}
          />
        </div>

        <div className={FULL}>
          <Tabs
            tabs={TAB_IDS.map(id => ({ id, label: t(TAB_LABEL[id]) }))}
            active={activeTab}
            onChange={setTab}
          />
        </div>

        {/* `contents` keeps the panel a real element for assistive tech while letting the tiles
            inside it stay direct children of the one page grid. */}
        <div role="tabpanel" aria-label={t(TAB_LABEL[activeTab])} className="contents">
          {activeTab === 'overview' && (
            <SummaryPanel
              debts={debts.data ?? []}
              loansGiven={loansGiven.data ?? []}
              loansTaken={loansTaken.data ?? []}
              bankLoans={bankLoans.data ?? []}
              monthly={monthly.data ?? []}
              loading={debts.loading || loansGiven.loading || loansTaken.loading || bankLoans.loading || monthly.loading}
              error={debts.error ?? loansGiven.error ?? loansTaken.error ?? bankLoans.error ?? monthly.error}
              onRetry={() => { debts.refetch(); loansGiven.refetch(); loansTaken.refetch(); bankLoans.refetch(); monthly.refetch() }}
              onNavigate={setTab}
            />
          )}

          {activeTab === 'lent' && (
            <>
              <TabHero
                loading={loansGiven.loading}
                error={loansGiven.error}
                hasData={loansGiven.data !== null}
                label={t('page.finance.cardLoansLentPending')}
                value={snap((loansGiven.data ?? []).reduce((sum, l) => sum + l.pendingAmount, 0))}
                tone="in"
                caption={plural(loansGiven.data?.length ?? 0, t('page.finance.loansGivenCountOne'), t('page.finance.loansGivenCount'), lang)}
              />
              <ListPanel q={loansGiven}>
                <ListTile empty={t('page.finance.noItemsYet', { label: t('page.finance.loansLentNoun') })}>
                  {(loansGiven.data?.length ?? 0) > 0 && (
                    <PersonLoanGroups
                      settledLabel={t('page.finance.receivedCol')}
                      pendingLabel={t('page.finance.pendingCol')}
                      pendingTone="in"
                      actions={lentActions}
                      items={(loansGiven.data ?? []).map(l => ({
                        id: l.id, person: l.debtorName, total: l.totalAmount, settled: l.receivedAmount,
                        pending: l.pendingAmount, currency: l.currency, status: l.status, date: l.lentDate,
                      }))}
                    />
                  )}
                </ListTile>
              </ListPanel>
            </>
          )}

          {activeTab === 'borrowed' && (
            <>
              <TabHero
                loading={loansTaken.loading}
                error={loansTaken.error}
                hasData={loansTaken.data !== null}
                label={t('page.finance.cardLoansBorrowedOwed')}
                value={snap((loansTaken.data ?? []).reduce((sum, l) => sum + l.remainingAmount, 0))}
                tone="out"
                caption={plural(loansTaken.data?.length ?? 0, t('page.finance.loansTakenCountOne'), t('page.finance.loansTakenCount'), lang)}
              />
              <ListPanel q={loansTaken}>
                <ListTile
                  header={<h2 className="text-sm font-semibold text-slate-900">{t('page.finance.borrowedHeading')}</h2>}
                  empty={t('page.finance.noItemsYet', { label: t('page.finance.loansBorrowedNoun') })}
                >
                  {(loansTaken.data?.length ?? 0) > 0 && (
                    <PersonLoanGroups
                      settledLabel={t('page.shared.paid')}
                      pendingLabel={t('page.shared.remaining')}
                      pendingTone="out"
                      actions={borrowedActions}
                      items={(loansTaken.data ?? []).map(l => ({
                        id: l.id, person: l.lenderName, total: l.totalAmount, settled: l.paidAmount,
                        pending: l.remainingAmount, currency: l.currency, status: l.status, date: l.borrowedDate,
                        note: l.plannedMonthlyPayment
                          ? t('page.finance.planBadge', { amount: moneyFull(l.plannedMonthlyPayment, l.currency) })
                          : undefined,
                      }))}
                    />
                  )}
                </ListTile>
              </ListPanel>

              {/* Creditor debts had no reachable UI at all, yet they are charged by the plan just
                  like borrowed money — so they live beside it, with their own Add. */}
              <ListPanel q={debts}>
                <ListTile
                  header={
                    <>
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-slate-900">{t('page.finance.debtsHeading')}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">{t('page.finance.debtsHelp')}</p>
                      </div>
                      <Button
                        size="sm"
                        icon={<Plus className="w-4 h-4" />}
                        label={t('page.finance.addDebt')}
                        onClick={() => startAdd('debts')}
                        className="shrink-0"
                      />
                    </>
                  }
                  empty={t('page.finance.noItemsYet', { label: t('page.finance.debtsNoun') })}
                >
                  {(debts.data ?? []).map(d => (
                    <ListRow
                      key={d.id}
                      leading={
                        <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-slate-100 text-slate-500">
                          <Receipt className="w-4 h-4" />
                        </span>
                      }
                      title={d.creditorName}
                      badges={<StatusBadge status={d.status} />}
                      subtitle={`${t('page.shared.total')} ${moneyFull(d.totalAmount, d.currency)} · ${t('page.shared.paid')} ${moneyFull(d.paidAmount, d.currency)}`}
                      amount={moneyFull(d.remainingAmount, d.currency)}
                      amountTone={d.remainingAmount > 0 ? 'out' : 'neutral'}
                      amountCaption={t('page.shared.remaining')}
                      actions={debtActions(d)}
                    />
                  ))}
                </ListTile>
              </ListPanel>
            </>
          )}

          {activeTab === 'bank-loans' && (
            <>
              <TabHero
                loading={bankLoans.loading}
                error={bankLoans.error}
                hasData={bankLoans.data !== null}
                label={t('page.finance.cardBankLoansTotal')}
                value={snap((bankLoans.data ?? []).reduce((sum, b) => sum + b.totalAmount, 0))}
                caption={plural(bankLoans.data?.length ?? 0, t('page.finance.loansCountGenericOne'), t('page.finance.loansCountGeneric'), lang)}
              />
              <ListPanel q={bankLoans}>
                <ListTile empty={t('page.finance.noItemsYet', { label: t('page.finance.bankLoansNoun') })}>
                  {(bankLoans.data ?? []).map(b => (
                    <ListRow
                      key={b.id}
                      leading={
                        <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-indigo-100 text-indigo-600">
                          <Landmark className="w-4 h-4" />
                        </span>
                      }
                      title={b.bankName}
                      badges={
                        <span className="rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {b.loanName}
                        </span>
                      }
                      subtitle={bankLoanDetail(b, lang, t)}
                      // The instalment is what leaves the wallet each month, so it leads; the sum
                      // borrowed sits in the detail line beside it.
                      amount={moneyFull(b.monthlyPayment ?? b.totalAmount, b.currency)}
                      amountTone="out"
                      amountCaption={b.monthlyPayment != null
                        ? t('page.finance.perMonthCaption')
                        : t('page.shared.total')}
                      actions={[editAction('bank-loans', b.id), deleteAction('bank-loans', b.id)]}
                    />
                  ))}
                </ListTile>
              </ListPanel>
            </>
          )}

          {activeTab === 'monthly-payments' && (
            <>
              <TabHero
                loading={monthly.loading}
                error={monthly.error}
                hasData={monthly.data !== null}
                label={t('page.finance.cardMonthlyPerMonth')}
                value={snap((monthly.data ?? []).filter(m => m.active).reduce((sum, m) => sum + m.amount, 0))}
                caption={t('page.finance.activeCount', { count: (monthly.data ?? []).filter(m => m.active).length })}
              />
              <ListPanel q={monthly}>
                <ListTile empty={t('page.finance.noItemsYet', { label: t('page.finance.monthlyPaymentsNoun') })}>
                  {(monthly.data ?? []).map(m => (
                    <ListRow
                      key={m.id}
                      leading={
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-chip ${
                            m.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          }`}
                          title={m.active ? t('page.finance.activeLabel') : t('page.finance.inactiveLabel')}
                        >
                          {m.active ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </span>
                      }
                      title={m.name}
                      badges={m.category
                        ? <span className="rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {categoryName(m.category)}
                          </span>
                        : undefined}
                      subtitle={m.paymentCount > 0
                        ? `${t('page.finance.totalPaidCol')} ${moneyFull(m.totalPaid, m.currency)} · ${plural(m.paymentCount, t('page.finance.paymentSingular'), t('page.finance.paymentPlural'), lang)}`
                        : undefined}
                      amount={moneyFull(m.amount, m.currency)}
                      amountCaption={t('page.finance.perMonthCaption')}
                      actions={[
                        {
                          label: t('page.shared.payButton'),
                          icon: <DollarSign className="w-4 h-4" />,
                          onClick: () => setPayTarget(m),
                        },
                        {
                          label: t('action.history'),
                          icon: <History className="w-4 h-4" />,
                          onClick: () => { setSubHistoryId(m.id); setSubHistorySortAsc(false) },
                        },
                        editAction('monthly-payments', m.id),
                        deleteAction('monthly-payments', m.id),
                      ]}
                    />
                  ))}
                </ListTile>
              </ListPanel>
            </>
          )}
        </div>

        {/* Loan / debt payment history panel */}
        {history && (() => {
          // Read from the list the row itself renders from, so the caption and the row can never
          // disagree: one refetch moves both.
          const r =
            history.kind === 'debt' ? debts.data?.find(x => x.id === history.id)
            : history.kind === 'loan-given' ? loansGiven.data?.find(x => x.id === history.id)
            : loansTaken.data?.find(x => x.id === history.id)
          // Delete lives in the same row menu as History. Once the record is gone there is
          // nothing left to caption, so the panel goes with it rather than outliving its subject.
          if (!r) return null
          const personName =
            'creditorName' in r ? r.creditorName
            : 'debtorName' in r ? r.debtorName
            : r.lenderName
          const totalAmount = r.totalAmount
          const paidSoFar = 'receivedAmount' in r ? r.receivedAmount : r.paidAmount
          const rows = [...(historyApi.data ?? [])].sort((a, b) => {
            const cmp = a.transactionDate.localeCompare(b.transactionDate)
            return historySortAsc ? cmp : -cmp
          })
          const label = history.kind === 'loan-given' ? t('page.finance.receivedLabel') : t('page.finance.paidCol')
          return (
            <div className={FULL}>
              <HistoryPanel
                title={t('page.finance.paymentHistoryPanelTitle', { name: personName })}
                caption={`${t('page.finance.soFarOfTotal', { label, paidSoFar: moneyFull(paidSoFar, r.currency), total: moneyFull(totalAmount, r.currency) })} · ${plural(rows.length, t('page.finance.paymentSingular'), t('page.finance.paymentPlural'), lang)}`}
                sortAsc={historySortAsc}
                onToggleSort={() => setHistorySortAsc(s => !s)}
                onClose={() => setHistory(null)}
                q={historyApi}
                emptyHint={t('page.finance.noPaymentsHintDebt')}
              >
                {rows.map(row => (
                  <ListRow
                    key={row.id}
                    title={formatDate(row.transactionDate, lang)}
                    subtitle={row.note || row.description || undefined}
                    badges={<SourceChip
                      card={row.card ? `${row.card.name} •••• ${row.card.lastFourDigits}` : null}
                      cashLabel={t('tx.cash')}
                    />}
                    amount={`${row.type === 'INCOME' ? '+' : '−'}${moneyFull(row.amount, row.currency)}`}
                    amountTone={row.type === 'INCOME' ? 'in' : 'out'}
                  />
                ))}
              </HistoryPanel>
            </div>
          )
        })()}

        {/* Monthly-bill payment history panel */}
        {subHistoryId !== null && (() => {
          const m = monthly.data?.find(x => x.id === subHistoryId)
          // Same contract as the loan panel: derived live, and it closes with its record.
          if (!m) return null
          const subSince = m.subscribedSince ? new Date(m.subscribedSince) : null
          const months = subSince ? Math.max(0, differenceInCalendarMonths(new Date(), subSince)) : null
          const rows = [...(subHistoryApi.data ?? [])].sort((a, b) => {
            const cmp = a.transactionDate.localeCompare(b.transactionDate)
            return subHistorySortAsc ? cmp : -cmp
          })
          const when = subSince
            ? (months === 0 ? t('page.finance.subscribedThisMonth') : t(months === 1 ? 'page.finance.monthAgo' : 'page.finance.monthsAgo', { months: months ?? 0 }))
            : null
          const since = subSince && when
            ? `${t('page.finance.subscribedPrefix', { when, date: formatDate(subSince, lang) })} · `
            : ''
          return (
            <div className={FULL}>
              <HistoryPanel
                title={t('page.finance.paymentHistoryPanelTitle', { name: m.name })}
                caption={`${since}${t('page.finance.paidAcross', { amount: moneyFull(m.totalPaid, m.currency) })} ${plural(m.paymentCount, t('page.finance.paymentSingular'), t('page.finance.paymentPlural'), lang)}`}
                sortAsc={subHistorySortAsc}
                onToggleSort={() => setSubHistorySortAsc(s => !s)}
                onClose={() => setSubHistoryId(null)}
                q={subHistoryApi}
                emptyHint={t('page.finance.noPaymentsHintSub')}
              >
                {rows.map(row => (
                  <ListRow
                    key={row.id}
                    title={formatDate(row.transactionDate, lang)}
                    subtitle={row.note || row.description || undefined}
                    badges={<SourceChip
                      card={row.card ? `${row.card.name} •••• ${row.card.lastFourDigits}` : null}
                      cashLabel={t('tx.cash')}
                      extra={row.cashAmount != null && row.cashAmount > 0
                        ? t('page.finance.plusCash', { amount: moneyFull(row.cashAmount, row.currency) })
                        : undefined}
                    />}
                    amount={`−${moneyFull(row.amount, row.currency)}`}
                    amountTone="out"
                  />
                ))}
              </HistoryPanel>
            </div>
          )
        })()}
      </TileGrid>

      {/* ── Add chooser — the Summary tab's "+ Add" names its four objects ───── */}
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
                <o.Icon className="w-4 h-4" />
              </span>
              <span className="text-sm font-medium text-slate-900">{t(o.labelKey)}</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* ── Record forms — keyed off the form kind, never off the URL tab ────── */}
      <Modal open={modalOpen && formKind === 'debts'} onClose={closeModal}
        title={editId ? t('page.finance.editDebtTitle') : t('page.finance.newDebtTitle')}
        footer={<ModalActions onClose={closeModal} saving={saving} isEdit={!!editId} />}>
        <form id={FORM_ID} onSubmit={save} className="space-y-3">
          <Field id="fin-debt-creditor" label={t('page.finance.creditorNameLabel')}>
            <input required value={debtForm.creditorName} onChange={e => setDebtForm(p => ({ ...p, creditorName: e.target.value }))} className={INPUT} placeholder={t('page.finance.whoYouOwePlaceholder')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="fin-debt-total" label={t('page.finance.totalAmountLabel')}>
              <AmountInput required value={debtForm.totalAmount || 0} currency={debtForm.currency}
                onChange={v => setDebtForm(p => ({ ...p, totalAmount: v }))} className={MONEY_INPUT} suffix={debtForm.currency} />
            </Field>
            <Field id="fin-debt-paid" label={t('page.finance.paidAmountLabel')}>
              <AmountInput value={debtForm.paidAmount || 0} currency={debtForm.currency}
                onChange={v => setDebtForm(p => ({ ...p, paidAmount: v }))} className={MONEY_INPUT} suffix={debtForm.currency} />
            </Field>
          </div>
          <Field id="fin-debt-status" label={t('page.finance.statusLabel')}>
            <StatusSelect value={debtForm.status ?? 'PENDING'} onChange={v => setDebtForm(p => ({ ...p, status: v }))} />
          </Field>
          <Field id="fin-debt-borrowed" label={t('page.finance.borrowedDateLabel')}>
            <input required type="date" value={debtForm.borrowedDate} onChange={e => setDebtForm(p => ({ ...p, borrowedDate: e.target.value }))} className={INPUT} />
          </Field>
          <Field id="fin-debt-start" label={t('page.finance.paymentStartsLabel')} help={t('page.finance.paymentStartsHintDebt')}>
            <input type="month" value={(debtForm.paymentStartDate ?? '').slice(0, 7)}
              onChange={e => setDebtForm(p => ({ ...p, paymentStartDate: e.target.value ? `${e.target.value}-01` : undefined }))} className={INPUT} />
          </Field>
          <Field id="fin-debt-desc" label={t('tx.description')}>
            <textarea rows={2} value={debtForm.description ?? ''} onChange={e => setDebtForm(p => ({ ...p, description: e.target.value }))} className={`${TEXTAREA} resize-none`} />
          </Field>
        </form>
      </Modal>

      <Modal open={modalOpen && formKind === 'loans-given'} onClose={closeModal}
        title={editId ? t('page.finance.editLoanLentTitle') : t('page.finance.newLoanLentTitle')}
        footer={<ModalActions onClose={closeModal} saving={saving} isEdit={!!editId} />}>
        <form id={FORM_ID} onSubmit={save} className="space-y-3">
          <Field id="fin-lg-debtor" label={t('page.finance.debtorNameLabel')}>
            <input required value={lgForm.debtorName} onChange={e => setLgForm(p => ({ ...p, debtorName: e.target.value }))} className={INPUT} placeholder={t('page.finance.whoOwesYouPlaceholder')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="fin-lg-total" label={t('page.finance.amountLentLabel')}>
              <AmountInput required value={lgForm.totalAmount || 0} currency={lgForm.currency}
                onChange={v => setLgForm(p => ({ ...p, totalAmount: v }))} className={MONEY_INPUT} suffix={lgForm.currency} />
            </Field>
            <Field id="fin-lg-received" label={t('page.finance.receivedBackLabel')}>
              <AmountInput value={lgForm.receivedAmount || 0} currency={lgForm.currency}
                onChange={v => setLgForm(p => ({ ...p, receivedAmount: v }))} className={MONEY_INPUT} suffix={lgForm.currency} />
            </Field>
          </div>
          <Field id="fin-lg-status" label={t('page.finance.statusLabel')}>
            <StatusSelect value={lgForm.status ?? 'PENDING'} onChange={v => setLgForm(p => ({ ...p, status: v }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="fin-lg-lent" label={t('page.finance.lentDateLabel')}>
              <input required type="date" value={lgForm.lentDate} onChange={e => setLgForm(p => ({ ...p, lentDate: e.target.value }))} className={INPUT} />
            </Field>
            <Field id="fin-lg-return" label={t('page.finance.expectedReturnLabel')}>
              <input type="date" value={lgForm.expectedReturnDate ?? ''} onChange={e => setLgForm(p => ({ ...p, expectedReturnDate: e.target.value }))} className={INPUT} />
            </Field>
          </div>
          <Field id="fin-lg-desc" label={t('tx.description')}>
            <textarea rows={2} value={lgForm.description ?? ''} onChange={e => setLgForm(p => ({ ...p, description: e.target.value }))} className={`${TEXTAREA} resize-none`} />
          </Field>
        </form>
      </Modal>

      <Modal open={modalOpen && formKind === 'loans-taken'} onClose={closeModal}
        title={editId ? t('page.finance.editLoanBorrowedTitle') : t('page.finance.newLoanBorrowedTitle')}
        footer={<ModalActions onClose={closeModal} saving={saving} isEdit={!!editId} />}>
        <form id={FORM_ID} onSubmit={save} className="space-y-3">
          <Field id="fin-lt-lender" label={t('page.finance.lenderNameLabel')}>
            <input required value={ltForm.lenderName} onChange={e => setLtForm(p => ({ ...p, lenderName: e.target.value }))} className={INPUT} placeholder={t('page.finance.whoLentYouPlaceholder')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="fin-lt-total" label={t('page.finance.totalAmountLabel')}>
              <AmountInput required value={ltForm.totalAmount || 0} currency={ltForm.currency}
                onChange={v => setLtForm(p => ({ ...p, totalAmount: v }))} className={MONEY_INPUT} suffix={ltForm.currency} />
            </Field>
            <Field id="fin-lt-paid" label={t('page.finance.paidBackLabel')}>
              <AmountInput value={ltForm.paidAmount || 0} currency={ltForm.currency}
                onChange={v => setLtForm(p => ({ ...p, paidAmount: v }))} className={MONEY_INPUT} suffix={ltForm.currency} />
            </Field>
          </div>
          <Field id="fin-lt-status" label={t('page.finance.statusLabel')}>
            <StatusSelect value={ltForm.status ?? 'PENDING'} onChange={v => setLtForm(p => ({ ...p, status: v }))} />
          </Field>
          <Field id="fin-lt-borrowed" label={t('page.finance.borrowedDateLabel')}>
            <input required type="date" value={ltForm.borrowedDate} onChange={e => setLtForm(p => ({ ...p, borrowedDate: e.target.value }))} className={INPUT} />
          </Field>
          <Field id="fin-lt-start" label={t('page.finance.paymentStartsLabel')} help={t('page.finance.paymentStartsHintLoanTaken')}>
            <input type="month" value={(ltForm.paymentStartDate ?? '').slice(0, 7)}
              onChange={e => setLtForm(p => ({ ...p, paymentStartDate: e.target.value ? `${e.target.value}-01` : undefined }))} className={INPUT} />
          </Field>
          <Field id="fin-lt-plan" label={t('page.finance.planLabel')} help={t('page.finance.planHint')}>
            <AmountInput value={ltForm.plannedMonthlyPayment ?? 0} currency={ltForm.currency}
              onChange={v => setLtForm(p => ({ ...p, plannedMonthlyPayment: v > 0 ? v : undefined }))}
              className={MONEY_INPUT} suffix={ltForm.currency} placeholder="0" />
          </Field>
          <Field id="fin-lt-desc" label={t('tx.description')}>
            <textarea rows={2} value={ltForm.description ?? ''} onChange={e => setLtForm(p => ({ ...p, description: e.target.value }))} className={`${TEXTAREA} resize-none`} />
          </Field>
        </form>
      </Modal>

      <Modal open={modalOpen && formKind === 'bank-loans'} onClose={closeModal}
        title={editId ? t('page.finance.editBankLoanTitle') : t('page.finance.newBankLoanTitle')}
        footer={<ModalActions onClose={closeModal} saving={saving} isEdit={!!editId} />}>
        <form id={FORM_ID} onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field id="fin-bl-bank" label={t('page.shared.bankNameLabel')}>
              <input required value={blForm.bankName} onChange={e => setBlForm(p => ({ ...p, bankName: e.target.value }))} className={INPUT} placeholder={t('page.finance.bankNamePlaceholder')} />
            </Field>
            <Field id="fin-bl-type" label={t('page.finance.loanTypeLabel')}>
              <select required value={blForm.loanName} onChange={e => setBlForm(p => ({ ...p, loanName: e.target.value }))} className={INPUT}>
                <option value="">{t('page.finance.selectTypePlaceholder')}</option>
                <option value="Talim kredit">Talim kredit</option>
                <option value="Avtokredit">Avtokredit</option>
                <option value="Ipoteka / Uy kredit">Ipoteka / Uy kredit</option>
              </select>
            </Field>
          </div>
          <Field id="fin-bl-total" label={t('page.finance.totalAmountLabel')}>
            <AmountInput required value={blForm.totalAmount || 0} currency={blForm.currency}
              onChange={v => setBlForm(p => ({ ...p, totalAmount: v }))} className={MONEY_INPUT} suffix={blForm.currency} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="fin-bl-taken" label={t('page.finance.takenDateLabel')}>
              <input required type="date" value={blForm.takenDate} onChange={e => setBlForm(p => ({ ...p, takenDate: e.target.value }))} className={INPUT} />
            </Field>
            <Field id="fin-bl-end" label={t('page.finance.endDateLabel')}>
              <input type="date" value={blForm.endDate ?? ''} onChange={e => setBlForm(p => ({ ...p, endDate: e.target.value }))} className={INPUT} />
            </Field>
          </div>
          <Field id="fin-bl-monthly" label={t('page.finance.monthlyPaymentLabel')} help={t('page.finance.monthlyPaymentHint')}>
            <AmountInput value={blForm.monthlyPayment ?? 0} currency={blForm.currency}
              onChange={v => setBlForm(p => ({ ...p, monthlyPayment: v > 0 ? v : undefined }))}
              className={MONEY_INPUT} suffix={blForm.currency} />
          </Field>
        </form>
      </Modal>

      <Modal open={modalOpen && formKind === 'monthly-payments'} onClose={closeModal}
        title={editId ? t('page.finance.editMonthlyTitle') : t('page.finance.newMonthlyTitle')}
        footer={<ModalActions onClose={closeModal} saving={saving} isEdit={!!editId} />}>
        <form id={FORM_ID} onSubmit={save} className="space-y-3">
          <Field id="fin-mp-name" label={t('page.shared.nameLabel')}>
            <input required value={mpForm.name} onChange={e => setMpForm(p => ({ ...p, name: e.target.value }))} className={INPUT} placeholder={t('page.finance.monthlyNamePlaceholder')} />
          </Field>
          <Field id="fin-mp-amount" label={`${t('tx.amount')} *`}>
            <AmountInput required value={mpForm.amount || 0} currency={mpForm.currency}
              onChange={v => setMpForm(p => ({ ...p, amount: v }))} className={MONEY_INPUT} suffix={mpForm.currency} />
          </Field>
          <Field id="fin-mp-category" label={t('tx.category')}>
            <select value={mpForm.categoryId ?? ''} onChange={e => setMpForm(p => ({ ...p, categoryId: e.target.value ? +e.target.value : undefined }))} className={INPUT}>
              <option value="">{t('page.finance.noneOption')}</option>
              {(categories.data ?? []).map(c => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}
            </select>
          </Field>
          {/* A category list that failed to load leaves the select empty; say so rather than
              letting it read as "you have no categories". */}
          {categories.error && <ErrorTile compact message={categories.error} onRetry={categories.refetch} />}
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
            {/* focus-ring, because index.css removes the native :focus-visible outline app-wide;
                accent-color rather than text-indigo-600, which a native checkbox ignores without
                @tailwindcss/forms. Space on an unseen checkbox silently deactivates a bill. */}
            <input type="checkbox" checked={mpForm.active ?? true} onChange={e => setMpForm(p => ({ ...p, active: e.target.checked }))} className="focus-ring h-4 w-4 rounded border-slate-300 accent-indigo-600" />
            <span className="text-sm text-slate-600">{t('page.finance.activeLabel')}</span>
          </label>
          <Field id="fin-mp-desc" label={t('tx.description')}>
            <textarea rows={2} value={mpForm.description ?? ''} onChange={e => setMpForm(p => ({ ...p, description: e.target.value }))} className={`${TEXTAREA} resize-none`} />
          </Field>
        </form>
      </Modal>

      {/* Repayment plan — a single field, so changing it can't disturb the loan's terms */}
      <Modal open={!!planTarget} onClose={() => setPlanTarget(null)}
        title={t('page.finance.planEditTitle', { name: planTarget?.lenderName ?? '' })} maxWidth="max-w-md"
        footer={
          <div className="flex gap-3">
            <Button label={t('action.cancel')} onClick={() => setPlanTarget(null)} className="flex-1" />
            <Button type="submit" form="finance-plan-form" variant="primary" loading={savingPlan}
              label={savingPlan ? t('action.saving') : t('action.save')} className="flex-1" />
          </div>
        }>
        {planTarget && (
          <form id="finance-plan-form" onSubmit={e => { e.preventDefault(); savePlan() }} className="space-y-4">
            <Field id="fin-plan-amount" label={t('page.finance.planLabel')} help={t('page.finance.planClear')}>
              <AmountInput autoFocus value={planAmount} currency={planTarget.currency}
                onChange={setPlanAmount} className={MONEY_INPUT} suffix={planTarget.currency} placeholder="0" />
            </Field>
            <div className="flex items-center justify-between rounded-control border border-hairline px-3 py-2 text-xs text-slate-500">
              <span>{t('page.shared.remaining')}</span>
              <strong className="tabular-nums text-slate-900">{moneyFull(planTarget.remainingAmount, planTarget.currency)}</strong>
            </div>
          </form>
        )}
      </Modal>

      <RepaymentModal
        open={!!repayTarget}
        onClose={() => setRepayTarget(null)}
        onSaved={() => {
          // A repayment moves the figures on two lists at once, so refetch both sides.
          if (repayTarget?.kind === 'loan-given') loansGiven.refetch()
          else if (repayTarget?.kind === 'loan-taken') loansTaken.refetch()
          else debts.refetch()
          // Repay and History are neighbours in the same row menu. When the panel below is
          // showing the record just paid, the payment must appear in it — the list refetch
          // above only carries the balance.
          if (history && repayTarget && history.kind === repayTarget.kind && history.id === repayTarget.record.id) {
            historyApi.refetch()
          }
          setRepayTarget(null)
        }}
        target={repayTarget}
      />

      <PaySubscriptionModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        onSaved={() => {
          monthly.refetch()
          if (payTarget && subHistoryId === payTarget.id) subHistoryApi.refetch()
          setPayTarget(null)
          showSuccess(t('page.finance.paymentRecordedToast'))
        }}
        subscription={payTarget}
      />
    </div>
  )
}

// ── Add chooser options ───────────────────────────────────────────────────────
const CHOOSER: { kind: FormKind; labelKey: TKey; Icon: typeof HandCoins; chip: string }[] = [
  { kind: 'loans-given',      labelKey: 'page.finance.optionLent',        Icon: HandCoins,     chip: 'bg-teal-100 text-teal-600' },
  { kind: 'loans-taken',      labelKey: 'page.finance.optionBorrowed',    Icon: Banknote,      chip: 'bg-pink-100 text-pink-600' },
  { kind: 'bank-loans',       labelKey: 'page.finance.optionBankLoan',    Icon: Landmark,      chip: 'bg-indigo-100 text-indigo-600' },
  { kind: 'monthly-payments', labelKey: 'page.finance.optionMonthlyBill', Icon: CalendarClock, chip: 'bg-amber-100 text-amber-600' },
]

// ── Shared pieces ─────────────────────────────────────────────────────────────

/**
 * The three states every list on this page owes the user: nothing yet, a failure it can retry,
 * and stale data it should keep rather than blank. Before this, a 500 looked exactly like an
 * empty account.
 */
/**
 * The hero for a record tab.
 *
 * Only Summary had one, so switching to Lent / Borrowed / Bank loans / Monthly bills dropped the
 * page's 40px anchor and the four record tabs read as a different, unranked screen. Each tab
 * already knows the figure the matching Summary tile shows; this is that figure at hero weight,
 * above its list.
 */
function TabHero({ loading, error, hasData, label, value, tone, caption }: {
  loading: boolean
  /** The tab query's error, so the hero can decline to state a figure it does not have. */
  error: string | null
  /** Whether `value` was reduced from a real payload rather than from a `?? []` fallback. */
  hasData: boolean
  label: string
  value: number
  tone?: 'neutral' | 'in' | 'out'
  caption: string
}) {
  const { t } = useLang()
  // Same box as the tile it becomes, so the panel does not jump when the fetch lands.
  if (loading) return <div className="md:col-span-3 xl:col-span-6"><Skeleton variant="stat" count={1} /></div>
  // A failed fetch reduces to 0 through the call site's `?? []`, and "0 UZS" at 40px reads as
  // "nobody owes you anything" — the exact failure ErrorTile exists to end. The ListPanel
  // directly below already carries the full ErrorTile and its Retry for this same query, so a
  // second one here would only duplicate the alert; the hero just has to stop asserting.
  if (error && !hasData) {
    return (
      <StatTile
        span={6}
        hero
        label={label}
        value="—"
        pill={{ text: t('page.finance.figureUnavailable'), tone: 'attention' }}
      />
    )
  }
  return (
    <StatTile
      span={6}
      hero
      label={label}
      value={money(value)}
      tone={tone}
      caption={t('ui.exactValue', { value: moneyExact(value) })}
    >
      <p className="text-xs text-slate-500 tabular-nums">{caption}</p>
    </StatTile>
  )
}

function ListPanel({ q, children }: {
  q: {
    data: unknown
    loading: boolean
    refreshing: boolean
    error: string | null
    refetch: () => Promise<void>
  }
  children: React.ReactNode
}) {
  if (q.loading) return <div className={FULL}><Skeleton variant="row" count={5} /></div>
  if (q.error && !q.data) {
    return <div className={FULL}><ErrorTile message={q.error} onRetry={q.refetch} /></div>
  }
  return (
    <div className={`${FULL} space-y-3`}>
      {q.error && <ErrorTile compact message={q.error} onRetry={q.refetch} />}
      <div className={q.refreshing ? 'opacity-60 transition-opacity' : undefined}>{children}</div>
    </div>
  )
}

function HistoryPanel({ title, caption, sortAsc, onToggleSort, onClose, q, emptyHint, children }: {
  title: string
  caption: string
  sortAsc: boolean
  onToggleSort: () => void
  onClose: () => void
  q: { data: unknown; loading: boolean; error: string | null; refetch: () => Promise<void> }
  emptyHint: string
  children: React.ReactNode
}) {
  const { t } = useLang()
  const rows = Array.isArray(q.data) ? q.data.length : 0
  return (
    <Tile as="section" padding="none" className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{caption}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={sortAsc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            label={sortAsc ? t('page.finance.oldestFirst') : t('page.finance.newestFirst')}
            onClick={onToggleSort}
          />
          <Button size="sm" variant="ghost" iconOnly icon={<X className="w-4 h-4" />}
            label={t('action.close')} onClick={onClose} />
        </div>
      </div>
      {q.loading ? (
        <Skeleton variant="row" count={3} bare />
      ) : q.error && !q.data ? (
        <ErrorTile message={q.error} onRetry={q.refetch} className="m-4" />
      ) : rows === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-slate-600">{t('page.finance.noPaymentsYet')}</p>
          <p className="mt-1 text-xs text-slate-500">{emptyHint}</p>
        </div>
      ) : (
        <div className="divide-y divide-hairline">{children}</div>
      )}
    </Tile>
  )
}

/** Where a payment came from — a card, cash, or a card topped up with cash. */
function SourceChip({ card, cashLabel, extra }: { card: string | null; cashLabel: string; extra?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      {card
        ? <><CreditCard className="w-3.5 h-3.5 text-slate-400" />{card}</>
        : <><Wallet className="w-3.5 h-3.5 text-slate-400" />{cashLabel}</>}
      {extra && <span className="text-slate-600">{extra}</span>}
    </span>
  )
}

function ModalActions({ onClose, saving, isEdit }: { onClose: () => void; saving: boolean; isEdit: boolean }) {
  const { t } = useLang()
  return (
    <div className="flex gap-3">
      <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
      <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
        label={saving ? t('action.saving') : isEdit ? t('action.update') : t('action.create')} />
    </div>
  )
}

/** `rest` is what `Field` injects — id and the aria wiring — so the label actually binds. */
function StatusSelect({ value, onChange, ...rest }: {
  value: RecordStatus
  onChange: (v: RecordStatus) => void
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>) {
  const { t } = useLang()
  return (
    <select {...rest} value={value} onChange={e => onChange(e.target.value as RecordStatus)} className={INPUT}>
      <option value="PENDING">{t('page.finance.statusPending')}</option>
      <option value="PARTIALLY_PAID">{t('page.finance.statusPartiallyPaid')}</option>
      <option value="PAID">{t('page.finance.statusPaid')}</option>
      <option value="OVERDUE">{t('page.finance.statusOverdue')}</option>
    </select>
  )
}

/** First day of next month as YYYY-MM-01 — default "payment starts" for borrowed money. */
function nextMonthFirst() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** The detail line under a bank loan: what was borrowed, when it started and when it ends. */
function bankLoanDetail(b: BankLoanResponse, lang: 'en' | 'uz', t: (k: TKey, v?: Record<string, string | number>) => string) {
  const parts = [`${t('page.shared.total')} ${moneyFull(b.totalAmount, b.currency)}`]
  parts.push(`${t('page.finance.takenDateCol')} ${formatDate(b.takenDate, lang)}`)
  if (b.endDate) parts.push(`${t('page.finance.endDateLabel')} ${formatDate(b.endDate, lang)}`)
  return parts.join(' · ')
}

// ── Summary ───────────────────────────────────────────────────────────────────

type FinCardKey = 'lent' | 'borrowed' | 'bank' | 'monthly'

/**
 * The page's one hero plus the four figures that make Finance worth opening. Every one of them
 * used to render as a raw `toFixed(2)` — "29500000.00", no separators, no unit — inside a pastel
 * tile, with the net position repeated underneath in a third shape.
 */
function SummaryPanel({
  debts, loansGiven, loansTaken, bankLoans, monthly, loading, error, onRetry, onNavigate,
}: {
  debts: DebtResponse[]
  loansGiven: LoanGivenResponse[]
  loansTaken: LoanTakenResponse[]
  bankLoans: BankLoanResponse[]
  monthly: MonthlyPaymentResponse[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onNavigate: (tab: FinanceTab) => void
}) {
  const { t, lang } = useLang()
  const [info, setInfo] = useState<FinCardKey | 'net' | null>(null)

  const lentPending       = snap(loansGiven.reduce((s, l) => s + l.pendingAmount, 0))
  const borrowedRemaining = snap(loansTaken.reduce((s, l) => s + l.remainingAmount, 0))
  const bankTotal         = snap(bankLoans.reduce((s, b) => s + b.totalAmount, 0))
  const activeBills       = monthly.filter(m => m.active)
  const monthlyTotal      = snap(activeBills.reduce((s, m) => s + m.amount, 0))
  const net               = snap(lentPending - borrowedRemaining)
  // Creditor debts are a separate record type with their own endpoint. They are NOT folded into
  // "Borrowed" or into the net position — both of those figures would change meaning — so they
  // get a line of their own beside the borrowed tile that leads to them.
  const debtsRemaining    = snap(debts.reduce((s, d) => s + d.remainingAmount, 0))

  const n = (v: number) => moneyFull(v)
  const infoRows: Record<FinCardKey | 'net', ExplainRow[]> = {
    lent: loansGiven.map((l): ExplainRow => ({ label: l.debtorName, value: n(l.pendingAmount) }))
      .concat({ label: t('cmp.cardInfo.total'), value: n(lentPending), strong: true }),
    borrowed: loansTaken.map((l): ExplainRow => ({ label: l.lenderName, value: n(l.remainingAmount) }))
      .concat({ label: t('cmp.cardInfo.total'), value: n(borrowedRemaining), strong: true }),
    bank: bankLoans.map((b): ExplainRow => ({ label: `${b.bankName} · ${b.loanName}`, value: n(b.totalAmount) }))
      .concat({ label: t('cmp.cardInfo.total'), value: n(bankTotal), strong: true }),
    monthly: activeBills.map((m): ExplainRow => ({ label: m.name, value: n(m.amount) }))
      .concat({ label: t('cmp.cardInfo.total'), value: n(monthlyTotal), strong: true }),
    net: [
      { label: t('page.finance.owedToYouLabel'), value: n(lentPending) },
      { label: t('page.finance.youOweLabel'), value: `− ${n(borrowedRemaining)}` },
      { label: t('page.finance.netLentBorrowedLabel'), value: n(net), strong: true },
    ],
  }

  if (loading) {
    return (
      <>
        <div className="md:col-span-3 xl:col-span-6"><Skeleton variant="stat" count={1} /></div>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="md:col-span-2 xl:col-span-3"><Skeleton variant="stat" count={1} /></div>
        ))}
      </>
    )
  }

  // Every list arrives here as `?? []`, so a failed fetch and an empty account look identical by
  // the time the tiles are drawn — five tiles of "0 UZS" under a one-line strip is a total outage
  // reported as a settled account. With nothing loaded there is no figure worth keeping on
  // screen, so the whole board becomes the failure and its retry.
  const nothingLoaded = debts.length === 0 && loansGiven.length === 0
    && loansTaken.length === 0 && bankLoans.length === 0 && monthly.length === 0
  if (error && nothingLoaded) {
    return <div className={FULL}><ErrorTile message={error} onRetry={onRetry} /></div>
  }

  const side = lentPending + borrowedRemaining
  const lentShare = side > 0 ? Math.round((lentPending / side) * 100) : 50

  return (
    <>
      {error && <div className={FULL}><ErrorTile compact message={error} onRetry={onRetry} /></div>}

      <StatTile
        span={6}
        rows={2}
        hero
        label={t('page.finance.netLentBorrowedLabel')}
        value={money(net)}
        tone={net >= 0 ? 'in' : 'out'}
        caption={t('ui.exactValue', { value: moneyExact(net) })}
        onInfo={() => setInfo('net')}
      >
        {/* The balance of the two sides, without repeating either figure — both already have a
            tile of their own beside this one. */}
        <div>
          <div className="flex h-2 overflow-hidden rounded-chip bg-slate-100" aria-hidden="true">
            <div className="bg-income" style={{ width: `${lentShare}%` }} />
            <div className="bg-expense" style={{ width: `${100 - lentShare}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-income" aria-hidden="true" />
              {t('page.finance.owedToYouLabel')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {t('page.finance.youOweLabel')}
              <span className="h-2 w-2 rounded-full bg-expense" aria-hidden="true" />
            </span>
          </div>
        </div>
      </StatTile>

      <StatTile
        span={3}
        label={t('page.finance.cardLoansLentPending')}
        value={money(lentPending)}
        tone="in"
        icon={<TrendingUp className="w-4 h-4" />}
        iconTone="teal"
        caption={t('ui.exactValue', { value: moneyExact(lentPending) })}
        onInfo={() => setInfo('lent')}
        onClick={() => onNavigate('lent')}
      >
        <p className="text-xs text-slate-500 tabular-nums">
          {plural(loansGiven.length, t('page.finance.loansGivenCountOne'), t('page.finance.loansGivenCount'), lang)}
        </p>
      </StatTile>

      <StatTile
        span={3}
        label={t('page.finance.cardLoansBorrowedOwed')}
        value={money(borrowedRemaining)}
        tone="out"
        icon={<TrendingDown className="w-4 h-4" />}
        iconTone="pink"
        caption={t('ui.exactValue', { value: moneyExact(borrowedRemaining) })}
        onInfo={() => setInfo('borrowed')}
        onClick={() => onNavigate('borrowed')}
      >
        <p className="text-xs text-slate-500 tabular-nums">
          {plural(loansTaken.length, t('page.finance.loansTakenCountOne'), t('page.finance.loansTakenCount'), lang)}
        </p>
        {debtsRemaining > 0 && (
          <p className="text-xs text-slate-500 tabular-nums">
            {t('page.finance.debtsHeading')} · {t('page.shared.remaining')} {money(debtsRemaining)}
          </p>
        )}
      </StatTile>

      <StatTile
        span={3}
        label={t('page.finance.cardBankLoansTotal')}
        value={money(bankTotal)}
        icon={<Landmark className="w-4 h-4" />}
        iconTone="indigo"
        caption={t('ui.exactValue', { value: moneyExact(bankTotal) })}
        onInfo={() => setInfo('bank')}
        onClick={() => onNavigate('bank-loans')}
      >
        <p className="text-xs text-slate-500 tabular-nums">
          {plural(bankLoans.length, t('page.finance.loansCountGenericOne'), t('page.finance.loansCountGeneric'), lang)}
        </p>
      </StatTile>

      <StatTile
        span={3}
        label={t('page.finance.cardMonthlyPerMonth')}
        value={money(monthlyTotal)}
        icon={<CalendarClock className="w-4 h-4" />}
        iconTone="amber"
        caption={t('ui.exactValue', { value: moneyExact(monthlyTotal) })}
        onInfo={() => setInfo('monthly')}
        onClick={() => onNavigate('monthly-payments')}
      >
        <p className="text-xs text-slate-500 tabular-nums">
          {t('page.finance.activeCount', { count: activeBills.length })}
        </p>
      </StatTile>

      {info && (
        <ExplainModal
          open onClose={() => setInfo(null)}
          title={t(`cmp.finInfo.${info}.title`)}
          meaning={t(`cmp.finInfo.${info}.meaning`)}
          formula={t(`cmp.finInfo.${info}.formula`)}
          rows={infoRows[info]}
          note={t(`cmp.finInfo.${info}.note`)}
        />
      )}
    </>
  )
}
