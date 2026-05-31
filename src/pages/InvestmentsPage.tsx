import { useState } from 'react'
import {
  Plus, Pencil, Trash2, AlertCircle, X, ArrowDownRight,
  Building2,
} from 'lucide-react'
import { format } from 'date-fns'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { AmountInput } from '../components/ui/AmountInput'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { financeApi } from '../api/finance'
import { transactionsApi } from '../api/transactions'
import { formatCurrency, snap } from '../utils/format'
import { extractErrorMessage } from '../api/client'
import type {
  Currency, InvestmentRequest, InvestmentType, TransactionFilters, Transaction,
} from '../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

const INVESTMENT_TYPES: InvestmentType[] = ['STOCKS', 'CRYPTO', 'REAL_ESTATE', 'BONDS', 'MUTUAL_FUND', 'GOLD', 'OTHER']

function today() {
  return new Date().toISOString().split('T')[0]
}

export function InvestmentsPage() {
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()

  const investments = useApi(() => financeApi.getInvestments(), [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<InvestmentRequest>({
    name: '', type: 'STOCKS', investedAmount: 0, currency: 'USD', purchaseDate: today(),
  })

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

  const openAdd = () => {
    setEditId(null)
    setForm({ name: '', type: 'STOCKS', investedAmount: 0, currency: 'USD', purchaseDate: today() })
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
    })
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setEditId(null) }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId) await financeApi.updateInvestment(editId, form)
      else await financeApi.createInvestment(form)
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

  const list = investments.data ?? []
  const totalsByCurrency = list.reduce<Record<string, number>>((acc, i) => {
    acc[i.currency] = (acc[i.currency] ?? 0) + i.investedAmount
    return acc
  }, {})

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
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
          <Plus className="w-4 h-4" /> Add Investment
        </button>
      </div>

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
