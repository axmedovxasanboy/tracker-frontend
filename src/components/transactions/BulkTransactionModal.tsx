import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { categoriesApi } from '../../api/categories'
import { cardsApi } from '../../api/cards'
import { transactionsApi } from '../../api/transactions'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency } from '../../utils/format'
import type { CardResponse, Category, Currency, TransactionRequest, TransactionType } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  preselectedCardId?: number
  defaultCurrency: Currency
}

const emptyRow = (currency: Currency): TransactionRequest => ({
  type: 'EXPENSE',
  amount: 0,
  currency,
  description: '',
  transactionDate: new Date().toISOString().split('T')[0],
})

export function BulkTransactionModal({ open, onClose, onSaved, preselectedCardId, defaultCurrency }: Props) {
  const [cardId, setCardId] = useState<number | undefined>(preselectedCardId)
  const [rows, setRows] = useState<TransactionRequest[]>([emptyRow(defaultCurrency)])
  const [cards, setCards] = useState<CardResponse[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    if (open) {
      cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
      categoriesApi.getAll().then(r => setCategories(r.data)).catch(() => {})
      setCardId(preselectedCardId)
      setRows([emptyRow(defaultCurrency)])
      setError(null)
      setSavedCount(0)
    }
  }, [open, preselectedCardId, defaultCurrency])

  const selectedCard = cards.find(c => c.id === cardId)
  // When a card is selected, the row currency is locked to the card's currency
  // (backend enforces this — see TransactionService.validateCurrencyMatchesCard).
  const lockedCurrency = selectedCard?.currency

  // Index categories by id for quick parent lookup.
  const categoryById = useMemo(() => {
    const map = new Map<number, Category>()
    categories.forEach(c => {
      map.set(c.id, c)
      c.children.forEach(ch => map.set(ch.id, ch))
    })
    return map
  }, [categories])

  const addRow = () => setRows(prev => [...prev, emptyRow(lockedCurrency ?? defaultCurrency)])

  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i))

  const updateRow = <K extends keyof TransactionRequest>(i: number, key: K, value: TransactionRequest[K]) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: value } : r))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Per-row validation
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.description.trim()) { setError(`Row ${i + 1}: description is required`); return }
      if (r.amount <= 0) { setError(`Row ${i + 1}: amount must be > 0`); return }
      if (r.categoryId != null) {
        const cat = categoryById.get(r.categoryId)
        if (cat && cat.parentId === null && cat.children && cat.children.length > 0) {
          setError(`Row ${i + 1}: pick a sub-category of "${cat.name}", not the parent`)
          return
        }
      }
      if (lockedCurrency && r.currency !== lockedCurrency) {
        setError(`Row ${i + 1}: currency must match card (${lockedCurrency})`)
        return
      }
    }

    setSaving(true); setError(null)
    try {
      const result = await transactionsApi.createBulk({
        cardId,
        transactions: rows.map(r => lockedCurrency ? { ...r, currency: lockedCurrency } : r),
      })
      setSavedCount(result.data.length)
      onSaved()
      setTimeout(() => onClose(), 1200)
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const totalsByCurrency = useMemo(() => {
    const acc: Record<string, { income: number; expense: number }> = {}
    for (const r of rows) {
      const slot = acc[r.currency] ?? (acc[r.currency] = { income: 0, expense: 0 })
      if (r.type === 'INCOME') slot.income += r.amount || 0
      else slot.expense += r.amount || 0
    }
    return acc
  }, [rows])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk Add Transactions"
      maxWidth="max-w-5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Card selector */}
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Card / Wallet <span className="text-slate-400">(optional — applies to all rows)</span></label>
            <select
              value={cardId ?? ''}
              onChange={e => setCardId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">— No card —</option>
              {cards.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} •••• {c.lastFourDigits} ({c.currency})
                </option>
              ))}
            </select>
            {lockedCurrency && (
              <p className="text-[11px] text-slate-400 mt-1">Rows are locked to {lockedCurrency} while a card is selected.</p>
            )}
          </div>
          {selectedCard && (
            <div className="shrink-0 text-right">
              <p className="text-xs text-slate-400">Current balance</p>
              <p className="text-sm font-semibold text-slate-700">
                {formatCurrency(selectedCard.currentBalance ?? 0, selectedCard.currency)}
              </p>
            </div>
          )}
        </div>

        {/* Rows */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[88px_1fr_110px_80px_180px_120px_36px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-400 uppercase tracking-wide">
            <span>Type</span>
            <span>Description</span>
            <span>Amount</span>
            <span>Curr.</span>
            <span>Category</span>
            <span>Date</span>
            <span />
          </div>

          <div className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <BulkRow
                key={i}
                row={row}
                index={i}
                canRemove={rows.length > 1}
                categories={categories}
                lockedCurrency={lockedCurrency}
                onUpdate={updateRow}
                onRemove={removeRow}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors border-t border-slate-100"
          >
            <Plus className="w-4 h-4" /> Add another row
          </button>
        </div>

        {/* Summary bar — split by currency */}
        {rows.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 rounded-xl text-sm border border-slate-100">
            <span className="text-slate-500">{rows.length} transactions</span>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {Object.entries(totalsByCurrency).map(([cur, t]) => {
                const net = t.income - t.expense
                const c = cur as Currency
                return (
                  <span key={cur} className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 mr-1">{cur}:</span>
                    <span className="text-emerald-600">+{formatCurrency(t.income, c)}</span>
                    <span className="mx-1">·</span>
                    <span className="text-rose-600">-{formatCurrency(t.expense, c)}</span>
                    <span className="mx-1">·</span>
                    <span className={net >= 0 ? 'text-indigo-600 font-semibold' : 'text-rose-600 font-semibold'}>
                      net {net >= 0 ? '+' : ''}{formatCurrency(net, c)}
                    </span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {error && (
          <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
        )}

        {savedCount > 0 && (
          <p className="text-emerald-600 text-sm bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
            ✓ {savedCount} transaction{savedCount > 1 ? 's' : ''} saved successfully
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? `Saving ${rows.length}…` : `Save ${rows.length} Transaction${rows.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface BulkRowProps {
  row: TransactionRequest
  index: number
  canRemove: boolean
  categories: Category[]
  lockedCurrency: Currency | undefined
  onUpdate: <K extends keyof TransactionRequest>(i: number, key: K, value: TransactionRequest[K]) => void
  onRemove: (i: number) => void
}

function BulkRow({ row, index, canRemove, categories, lockedCurrency, onUpdate, onRemove }: BulkRowProps) {
  const roots = categories.filter(c => c.parentId === null && (c.type === row.type || c.type === 'BOTH'))
  const selectedRoot = roots.find(r =>
    r.id === row.categoryId || r.children.some(ch => ch.id === row.categoryId))
  const subs = selectedRoot?.children ?? []

  const [rootId, setRootId] = useState<number | ''>(selectedRoot?.id ?? '')

  // Keep local rootId in sync when the row.categoryId changes externally (e.g. type change clears it).
  useEffect(() => {
    if (!row.categoryId) { setRootId(''); return }
    const root = roots.find(r => r.id === row.categoryId || r.children.some(ch => ch.id === row.categoryId))
    setRootId(root?.id ?? '')
  }, [row.categoryId, roots])

  return (
    <div className="grid grid-cols-[88px_1fr_110px_80px_180px_120px_36px] gap-2 px-3 py-2 items-center">
      {/* Type */}
      <div className="flex rounded-lg bg-slate-100 p-0.5 gap-0.5">
        <button
          type="button"
          onClick={() => { onUpdate(index, 'type', 'INCOME'); onUpdate(index, 'categoryId', undefined) }}
          className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${row.type === 'INCOME' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => { onUpdate(index, 'type', 'EXPENSE'); onUpdate(index, 'categoryId', undefined) }}
          className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-all ${row.type === 'EXPENSE' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <ArrowDownRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <input
        value={row.description}
        onChange={e => onUpdate(index, 'description', e.target.value)}
        placeholder="Description"
        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />

      <AmountInput
        value={row.amount || 0}
        currency={row.currency}
        onChange={v => onUpdate(index, 'amount', v)}
        placeholder="0"
        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right"
      />

      <select
        value={row.currency}
        disabled={!!lockedCurrency}
        onChange={e => onUpdate(index, 'currency', e.target.value as Currency)}
        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option>USD</option><option>EUR</option><option>UZS</option>
      </select>

      {/* Category: shows parent OR sub depending on availability */}
      <div className="flex gap-1">
        <select
          value={rootId}
          onChange={e => {
            const id = e.target.value ? Number(e.target.value) : ''
            setRootId(id)
            const root = roots.find(r => r.id === id)
            // If root has no children, assign root directly; otherwise wait for sub pick.
            onUpdate(index, 'categoryId', root && root.children.length === 0 ? root.id : undefined)
          }}
          className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">— Category —</option>
          {roots.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {subs.length > 0 && (
          <select
            value={row.categoryId && row.categoryId !== rootId ? row.categoryId : ''}
            onChange={e => onUpdate(index, 'categoryId', e.target.value ? Number(e.target.value) : undefined)}
            className="flex-1 min-w-0 border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">— Sub *</option>
            {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      <input
        type="date"
        value={row.transactionDate}
        onChange={e => onUpdate(index, 'transactionDate', e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />

      <button
        type="button"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-30"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
