import { useState } from 'react'
import {
  Plus, Pencil, Trash2, AlertCircle, HeartHandshake,
} from 'lucide-react'
import { format } from 'date-fns'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { AmountInput } from '../components/ui/AmountInput'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { financeApi } from '../api/finance'
import { formatCurrency, snap } from '../utils/format'
import { extractErrorMessage } from '../api/client'
import type { Currency, DonationRequest } from '../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

function today() {
  return new Date().toISOString().split('T')[0]
}

export function DonationsPage() {
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()

  const donations = useApi(() => financeApi.getDonations(), [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<DonationRequest>({
    recipientName: '', amount: 0, currency: 'USD', donationDate: today(),
  })

  const openAdd = () => {
    setEditId(null)
    setForm({ recipientName: '', amount: 0, currency: 'USD', donationDate: today() })
    setModalOpen(true)
  }

  const openEdit = (id: number) => {
    const d = donations.data?.find(x => x.id === id)
    if (!d) return
    setEditId(id)
    setForm({
      recipientName: d.recipientName, amount: d.amount, currency: d.currency,
      donationDate: d.donationDate,
      description: d.description ?? undefined,
      anonymous: d.anonymous,
    })
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setEditId(null) }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId) await financeApi.updateDonation(editId, form)
      else await financeApi.createDonation(form)
      closeModal()
      donations.refetch()
      showSuccess(editId ? 'Donation updated' : 'Donation created')
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!await confirm({ message: 'Delete this donation?', destructive: true })) return
    setDeleting(id)
    try {
      await financeApi.deleteDonation(id)
      donations.refetch()
      showSuccess('Donation deleted')
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setDeleting(null) }
  }

  const list = donations.data ?? []
  const totalsByCurrency = list.reduce<Record<string, number>>((acc, d) => {
    acc[d.currency] = (acc[d.currency] ?? 0) + d.amount
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
            <HeartHandshake className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Donations</h3>
            <p className="text-xs text-slate-400">
              {list.length} donation{list.length === 1 ? '' : 's'} ·{' '}
              {Object.entries(totalsByCurrency).map(([ccy, sum]) => formatCurrency(snap(sum), ccy as Currency)).join(' + ') || '—'}
            </p>
          </div>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
          <Plus className="w-4 h-4" /> Add Donation
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {donations.loading && !donations.data ? (
          <div className="h-48 flex items-center justify-center"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100">
                {['Recipient', 'Amount', 'Date', 'Anonymous', 'Notes', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {list.map(d => (
                <tr key={d.id} className="group hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-700">{d.displayName}</td>
                  <td className="px-5 py-3.5 text-pink-600 font-semibold">{formatCurrency(d.amount, d.currency)}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{format(new Date(d.donationDate), 'dd-MMM-yyyy')}</td>
                  <td className="px-5 py-3.5">
                    {d.anonymous
                      ? <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-xs">Yes</span>
                      : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs max-w-40 truncate">{d.description ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(d.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => del(d.id)} disabled={deleting === d.id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-50">
                        {deleting === d.id ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editId ? 'Edit Donation' : 'New Donation'}>
        <form onSubmit={save} className="space-y-3">
          <Field label="Recipient *">
            <input required value={form.recipientName}
              onChange={e => setForm(p => ({ ...p, recipientName: e.target.value }))}
              className={INPUT} />
          </Field>
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
          <Field label="Donation Date *">
            <input required type="date" value={form.donationDate}
              onChange={e => setForm(p => ({ ...p, donationDate: e.target.value }))}
              className={INPUT} />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.anonymous ?? false}
              onChange={e => setForm(p => ({ ...p, anonymous: e.target.checked }))}
              className="w-4 h-4 rounded text-indigo-600" />
            <span className="text-sm text-slate-600">Anonymous donation</span>
          </label>
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
      <p className="text-sm text-slate-400">No donations yet</p>
    </div>
  )
}
