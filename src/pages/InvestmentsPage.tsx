import { useState } from 'react'
import {
  Plus, Pencil, Trash2, AlertCircle, X, ArrowDownRight,
  Building2, PiggyBank, Target, TrendingUp, History,
} from 'lucide-react'
import { format } from 'date-fns'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { AmountInput } from '../components/ui/AmountInput'
import { ContributeInvestmentModal } from '../components/finance/ContributeInvestmentModal'
import { UpdateValueModal } from '../components/finance/UpdateValueModal'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { financeApi } from '../api/finance'
import { transactionsApi } from '../api/transactions'
import { cardsApi } from '../api/cards'
import { formatCurrency, snap } from '../utils/format'
import { extractErrorMessage } from '../api/client'
import type {
  Currency, InvestmentRequest, InvestmentResponse, InvestmentType, TransactionFilters, Transaction,
} from '../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

const INVESTMENT_TYPES: InvestmentType[] = ['REAL_ESTATE', 'BONDS', 'MUTUAL_FUND', 'GOLD', 'OTHER']

function today() {
  return new Date().toISOString().split('T')[0]
}

export function InvestmentsPage() {
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()

  const investments = useApi(() => financeApi.getInvestments(), [])
  const cards = useApi(() => cardsApi.getAll(), [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<InvestmentRequest>({
    name: '', type: 'OTHER', investedAmount: 0, currency: 'USD', purchaseDate: today(),
    emergencyFund: false, savingsGoal: false, targetAmount: null, currentValue: null,
  })
  // Funding source for a NEW investment: 'cash' | 'none' (already-owned / no wallet) | card id string.
  const [source, setSource] = useState<string>('cash')

  // Savings-goal action modals
  const [contributeFor, setContributeFor] = useState<InvestmentResponse | null>(null)
  const [valueFor, setValueFor] = useState<InvestmentResponse | null>(null)

  // Transaction history for a selected investment
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [txPage, setTxPage] = useState(0)
  const TX_FILTERS: TransactionFilters = {
    page: txPage, size: 12, sortBy: 'transactionDate', sortDir: 'desc',
    investmentId: selectedId ?? '', type: '', currency: '', categoryId: '', cardId: '', search: '',
  }
  const txs = useApi(
    () => selectedId
      ? transactionsApi.getAll(TX_FILTERS)
      : Promise.resolve({ data: null } as never),
    [selectedId, txPage],
  )

  const openAdd = (asGoal = false) => {
    setEditId(null)
    setForm({
      name: '', type: 'OTHER', investedAmount: 0, currency: 'USD', purchaseDate: today(),
      emergencyFund: false, savingsGoal: asGoal, targetAmount: null, currentValue: null,
      openingBalance: false,
    })
    setSource('cash')
    setModalOpen(true)
  }

  const openEdit = (id: number) => {
    const i = investments.data?.find(x => x.id === id)
    if (!i) return
    setEditId(id)
    setForm({
      name: i.name, type: i.type, investedAmount: i.investedAmount,
      currency: i.currency, purchaseDate: i.purchaseDate,
      broker: i.broker ?? undefined, description: i.description ?? undefined,
      emergencyFund: i.emergencyFund, savingsGoal: i.savingsGoal,
      targetAmount: i.targetAmount, currentValue: i.currentValue,
      openingBalance: i.openingBalance,
    })
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setEditId(null) }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    // Target/current-value are goal-only — never persist stale values for a plain investment
    // (e.g. typed as a goal, then unchecked, or a goal demoted on edit).
    const base: InvestmentRequest = form.savingsGoal
      ? form
      : { ...form, targetAmount: null, currentValue: null }
    // Funding source (create only): 'none' = already-owned opening balance (no wallet debit, no
    // transaction); 'cash' = cash wallet; a number = that card. Edits never re-book a transaction.
    const payload: InvestmentRequest = editId ? base : {
      ...base,
      cardId: /^\d+$/.test(source) ? Number(source) : undefined,
      openingBalance: source === 'none',
    }
    try {
      if (editId) await financeApi.updateInvestment(editId, payload)
      else await financeApi.createInvestment(payload)
      closeModal()
      investments.refetch()
      showSuccess(editId ? 'Investment updated' : 'Investment created')
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!await confirm({ message: 'Delete this investment?', destructive: true })) return
    setDeleting(id)
    try {
      await financeApi.deleteInvestment(id)
      investments.refetch()
      if (selectedId === id) setSelectedId(null)
      showSuccess('Investment deleted')
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setDeleting(null) }
  }

  const all = investments.data ?? []
  const goals = all.filter(i => i.savingsGoal)
  const list = all.filter(i => !i.savingsGoal)
  const totalsByCurrency = list.reduce<Record<string, number>>((acc, i) => {
    acc[i.currency] = (acc[i.currency] ?? 0) + i.investedAmount
    return acc
  }, {})

  const onGoalSaved = () => { investments.refetch(); txs.refetch(); showSuccess('Saved') }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Investments</h3>
            <p className="text-xs text-slate-400">
              {list.length} investment{list.length === 1 ? '' : 's'} ·{' '}
              {Object.entries(totalsByCurrency).map(([ccy, sum]) => formatCurrency(snap(sum), ccy as Currency)).join(' + ') || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => openAdd(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
            <Target className="w-4 h-4" /> New Goal
          </button>
          <button onClick={() => openAdd(false)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
            <Plus className="w-4 h-4" /> Add Investment
          </button>
        </div>
      </div>

      {/* Savings goals */}
      {goals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-semibold text-slate-700">Savings Goals</h4>
            <span className="text-xs text-slate-400">· optional, tracked apart from the 4 buckets</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {goals.map(g => {
              const value = g.currentValue ?? g.investedAmount
              const pct = g.progressPercent != null ? Math.min(100, g.progressPercent) : null
              const complete = pct != null && pct >= 100
              return (
                <div key={g.id} className="rounded-xl border border-slate-100 bg-white shadow-sm p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{g.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatCurrency(value, g.currency)}
                        {g.targetAmount != null && <> / {formatCurrency(g.targetAmount, g.currency)}</>}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button title="History"
                        onClick={() => { setSelectedId(selectedId === g.id ? null : g.id); setTxPage(0) }}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 ${selectedId === g.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}>
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button title="Edit" onClick={() => openEdit(g.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button title="Delete" onClick={() => del(g.id)} disabled={deleting === g.id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-50">
                        {deleting === g.id ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  {pct != null && (
                    <div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{pct.toFixed(0)}% of goal</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setContributeFor(g)}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 flex items-center justify-center gap-1">
                      <Plus className="w-3 h-3" /> Contribute
                    </button>
                    <button onClick={() => setValueFor(g)}
                      className="flex-1 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-medium hover:bg-slate-100 flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Update value
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {investments.loading && !investments.data ? (
          <div className="h-48 flex items-center justify-center"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100">
                {['Name', 'Type', 'Invested', 'Date', 'Broker', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {list.map(i => (
                <tr key={i.id}
                  className={`group hover:bg-slate-50/60 transition-colors cursor-pointer ${selectedId === i.id ? 'bg-cyan-50/60' : ''}`}
                  onClick={() => { setSelectedId(selectedId === i.id ? null : i.id); setTxPage(0) }}>
                  <td className="px-5 py-3.5 font-medium text-slate-700">{i.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-lg text-xs font-medium">
                      {i.type.replace('_', ' ')}
                    </span>
                    {i.emergencyFund && (
                      <span className="ml-1 bg-rose-100 text-rose-700 px-2 py-0.5 rounded-lg text-xs font-medium">
                        Emergency
                      </span>
                    )}
                    {i.openingBalance && (
                      <span className="ml-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-xs font-medium"
                        title="Already owned — recorded for net worth only; no transaction">
                        Opening
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-slate-700">{formatCurrency(i.investedAmount, i.currency)}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{format(new Date(i.purchaseDate), 'dd-MMM-yyyy')}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{i.broker ?? '—'}</td>
                  <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(i.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => del(i.id)} disabled={deleting === i.id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-50">
                        {deleting === i.id ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Per-investment transaction history */}
      {selectedId && (() => {
        const inv = investments.data?.find(i => i.id === selectedId)
        if (!inv) return null
        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">{inv.name} — Transactions</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {inv.type.replace('_', ' ')} · Total invested: {formatCurrency(inv.investedAmount, inv.currency)}
                </p>
              </div>
              <button onClick={() => setSelectedId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            {txs.loading ? (
              <div className="h-32 flex items-center justify-center"><Spinner /></div>
            ) : (txs.data?.content.length ?? 0) === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm text-slate-400">
                No transactions recorded for this investment yet
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Date', 'Description', 'Amount', 'Card'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {txs.data?.content.map((t: Transaction) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{format(new Date(t.transactionDate), 'dd-MMM-yyyy')}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-rose-100 flex items-center justify-center shrink-0">
                              <ArrowDownRight className="w-3 h-3 text-rose-600" />
                            </span>
                            <span className="text-slate-700 truncate max-w-48">{t.description}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-semibold text-rose-600 whitespace-nowrap">
                          -{formatCurrency(t.amount, t.currency)}
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs">
                          {t.card ? `${t.card.name} ••${t.card.lastFourDigits}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                {(txs.data?.totalPages ?? 0) > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400">
                      Page {(txs.data?.page ?? 0) + 1} of {txs.data?.totalPages} · {txs.data?.totalElements} total
                    </p>
                    <div className="flex gap-1">
                      <button disabled={txPage === 0} onClick={() => setTxPage(p => p - 1)}
                        className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Prev</button>
                      <button disabled={txs.data?.last ?? true} onClick={() => setTxPage(p => p + 1)}
                        className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editId ? 'Edit Investment' : 'New Investment'}>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <input required value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className={INPUT} placeholder="Apple Inc., BTC, etc." />
            </Field>
            <Field label="Type *">
              <select value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value as InvestmentType }))}
                className={`${INPUT} bg-white`}>
                {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invested Amount *">
              <AmountInput required value={form.investedAmount || 0} currency={form.currency}
                onChange={v => setForm(p => ({ ...p, investedAmount: v }))}
                className={INPUT} suffix={form.currency} />
            </Field>
            <Field label="Currency *">
              <select value={form.currency}
                onChange={e => setForm(p => ({ ...p, currency: e.target.value as Currency }))}
                className={`${INPUT} bg-white`}>
                <option>USD</option><option>EUR</option><option>UZS</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase Date *">
              <input required type="date" value={form.purchaseDate}
                onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))}
                className={INPUT} />
            </Field>
            <Field label="Broker / Platform">
              <input value={form.broker ?? ''}
                onChange={e => setForm(p => ({ ...p, broker: e.target.value }))}
                className={INPUT} />
            </Field>
          </div>
          <Field label="Description">
            <textarea rows={2} value={form.description ?? ''}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className={`${INPUT} resize-none`} />
          </Field>
          {!editId && (
            <Field label="Funding source *">
              <select value={source} onChange={e => setSource(e.target.value)} className={`${INPUT} bg-white`}>
                <option value="none">— I already own it (opening balance — don't move money) —</option>
                <option value="cash">Cash</option>
                {(cards.data ?? []).filter(c => c.currency === form.currency).map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} •••• {c.lastFourDigits} · {formatCurrency(c.currentBalance, c.currency)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                {source === 'none'
                  ? 'Recorded for net worth only — no wallet is debited, no transaction, and it won’t count toward this month’s allocation.'
                  : 'The invested amount is taken from this wallet and recorded as a transaction.'}
              </p>
            </Field>
          )}
          <label className="flex items-start gap-2 cursor-pointer p-3 rounded-xl bg-rose-50 border border-rose-100">
            <input type="checkbox" checked={form.emergencyFund ?? false}
              onChange={e => setForm(p => ({ ...p, emergencyFund: e.target.checked, savingsGoal: e.target.checked ? false : p.savingsGoal }))}
              className="w-4 h-4 mt-0.5 rounded text-rose-600" />
            <span className="text-xs text-rose-900 leading-relaxed">
              This is my <span className="font-semibold">emergency fund</span>. It counts toward the
              Overview <span className="font-semibold">Emergency</span> allocation bucket instead of Investments.
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <input type="checkbox" checked={form.savingsGoal ?? false}
              onChange={e => setForm(p => ({ ...p, savingsGoal: e.target.checked, emergencyFund: e.target.checked ? false : p.emergencyFund }))}
              className="w-4 h-4 mt-0.5 rounded text-emerald-600" />
            <span className="text-xs text-emerald-900 leading-relaxed">
              This is a <span className="font-semibold">savings goal</span> (home, iPhone, gold, prize…). It's
              optional and tracked apart from the 4 mandatory buckets.
            </span>
          </label>
          {form.savingsGoal && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target amount">
                <AmountInput value={form.targetAmount ?? 0} currency={form.currency}
                  onChange={v => setForm(p => ({ ...p, targetAmount: v > 0 ? v : null }))}
                  className={INPUT} suffix={form.currency} />
              </Field>
              <Field label="Current value">
                <AmountInput value={form.currentValue ?? 0} currency={form.currency}
                  onChange={v => setForm(p => ({ ...p, currentValue: v > 0 ? v : null }))}
                  className={INPUT} suffix={form.currency} />
              </Field>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={closeModal}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Spinner className="w-4 h-4" />}
              {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ContributeInvestmentModal open={!!contributeFor} onClose={() => setContributeFor(null)}
        onSaved={onGoalSaved} investment={contributeFor} />
      <UpdateValueModal open={!!valueFor} onClose={() => setValueFor(null)}
        onSaved={onGoalSaved} investment={valueFor} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-2">
      <AlertCircle className="w-10 h-10" />
      <p className="text-sm text-slate-400">No investments yet</p>
    </div>
  )
}
