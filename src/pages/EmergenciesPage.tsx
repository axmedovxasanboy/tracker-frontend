import { useState } from 'react'
import {
  Plus, Pencil, Trash2, AlertCircle, ShieldAlert,
} from 'lucide-react'
import { format } from 'date-fns'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { AmountInput } from '../components/ui/AmountInput'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { emergenciesApi } from '../api/emergencies'
import { formatCurrency, snap } from '../utils/format'
import { extractErrorMessage } from '../api/client'
import type { Currency, EmergencyRequest } from '../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

function today() {
  return new Date().toISOString().split('T')[0]
}

export function EmergenciesPage() {
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()

  const emergencies = useApi(() => emergenciesApi.getAll(), [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<EmergencyRequest>({
    amount: 0, currency: 'USD', date: today(),
  })

  const openAdd = () => {
    setEditId(null)
    setForm({ amount: 0, currency: 'USD', date: today() })
    setModalOpen(true)
  }

  const openEdit = (id: number) => {
    const e = emergencies.data?.find(x => x.id === id)
    if (!e) return
    setEditId(id)
    setForm({
      amount: e.amount, currency: e.currency, date: e.date,
      description: e.description ?? undefined,
    })
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setEditId(null) }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (editId) await emergenciesApi.update(editId, form)
      else await emergenciesApi.create(form)
      closeModal()
      emergencies.refetch()
      showSuccess(editId ? 'Emergency record updated' : 'Emergency contribution added')
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!await confirm({ message: 'Delete this emergency record?', destructive: true })) return
    setDeleting(id)
    try {
      await emergenciesApi.delete(id)
      emergencies.refetch()
      showSuccess('Emergency record deleted')
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setDeleting(null) }
  }

  const list = emergencies.data ?? []
  const totalsByCurrency = list.reduce<Record<string, number>>((acc, e) => {
    acc[e.currency] = (acc[e.currency] ?? 0) + e.amount
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Emergency Fund</h3>
            <p className="text-xs text-slate-400">
              {list.length} contribution{list.length === 1 ? '' : 's'} ·{' '}
              {Object.entries(totalsByCurrency).map(([ccy, sum]) => formatCurrency(snap(sum), ccy as Currency)).join(' + ') || '—'}
            </p>
          </div>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
          <Plus className="w-4 h-4" /> Add contribution
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {emergencies.loading && !emergencies.data ? (
          <div className="h-48 flex items-center justify-center"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100">
                {['Date', 'Amount', 'Notes', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {list.map(e => (
                <tr key={e.id} className="group hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 text-slate-600 text-xs">{format(new Date(e.date), 'dd-MMM-yyyy')}</td>
                  <td className="px-5 py-3.5 text-amber-700 font-semibold">{formatCurrency(e.amount, e.currency)}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs max-w-64 truncate">{e.description ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(e.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => del(e.id)} disabled={deleting === e.id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-50">
                        {deleting === e.id ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editId ? 'Edit emergency contribution' : 'New emergency contribution'}>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount *">
              <AmountInput required value={form.amount || 0} currency={form.currency}
                onChange={v => setForm(p => ({ ...p, amount: v }))}
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
          <Field label="Date *">
            <input required type="date" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className={INPUT} />
          </Field>
          <Field label="Description">
            <textarea rows={2} value={form.description ?? ''}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className={`${INPUT} resize-none`} placeholder="e.g. car repair, dentist visit, sudden fee…" />
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
      <p className="text-sm text-slate-400">No emergency contributions yet</p>
    </div>
  )
}
