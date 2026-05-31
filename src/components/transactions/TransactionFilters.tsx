import { Search, X } from 'lucide-react'
import type { Category, Currency, TransactionFilters, TransactionType } from '../../types'

interface Props {
  filters: TransactionFilters
  categories: Category[]
  currency: Currency
  onChange: (f: Partial<TransactionFilters>) => void
  onReset: () => void
}

export function TransactionFilters({ filters, categories, onChange, onReset }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
      {/* Search */}
      <div className="flex-1 min-w-48">
        <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={filters.search ?? ''}
            onChange={(e) => onChange({ search: e.target.value, page: 0 })}
            placeholder="Search description…"
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>

      {/* Type */}
      <div className="w-36">
        <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
        <select
          value={filters.type ?? ''}
          onChange={(e) => onChange({ type: (e.target.value as TransactionType | ''), page: 0 })}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All types</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>
      </div>

      {/* Category */}
      <div className="w-40">
        <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
        <select
          value={filters.categoryId ?? ''}
          onChange={(e) => onChange({ categoryId: e.target.value ? Number(e.target.value) : '', page: 0 })}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
        <input
          type="date"
          value={filters.startDate ?? ''}
          onChange={(e) => onChange({ startDate: e.target.value, page: 0 })}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
        <input
          type="date"
          value={filters.endDate ?? ''}
          onChange={(e) => onChange({ endDate: e.target.value, page: 0 })}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
        Reset
      </button>
    </div>
  )
}
