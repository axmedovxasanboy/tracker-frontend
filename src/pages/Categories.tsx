import { useState } from 'react'
import { Plus, Pencil, Trash2, Tag, ChevronRight, ChevronDown, X, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { format } from 'date-fns'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { useApi } from '../hooks/useApi'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import { useConfirm } from '../context/ConfirmContext'
import { categoriesApi } from '../api/categories'
import { transactionsApi } from '../api/transactions'
import { extractErrorMessage } from '../api/client'
import { formatCurrency } from '../utils/format'
import type { Category, CategoryRequest, CategoryType, Currency, Transaction, TransactionFilters, TransactionSubType } from '../types'

const COLORS = ['#10b981','#f43f5e','#6366f1','#f59e0b','#06b6d4','#a855f7','#ec4899','#14b8a6','#3b82f6','#ef4444','#8b5cf6','#6b7280']

const SUB_TYPE_OPTIONS: { value: TransactionSubType; labelKey: TKey }[] = [
  { value: 'REGULAR_INCOME',      labelKey: 'page.categories.subtypeRegularIncome' },
  { value: 'LOAN_RECEIVED',       labelKey: 'page.categories.subtypeLoanReceived' },
  { value: 'LOAN_RETURNED_TO_ME', labelKey: 'page.categories.subtypeLoanReturnedToMe' },
  { value: 'REGULAR_EXPENSE',     labelKey: 'page.categories.subtypeRegularExpense' },
  { value: 'LOAN_GIVEN',          labelKey: 'page.categories.subtypeLoanGiven' },
  { value: 'LOAN_REPAYMENT',      labelKey: 'page.categories.subtypeLoanRepayment' },
  { value: 'BANK_LOAN_PAYMENT',   labelKey: 'page.categories.subtypeBankLoanPayment' },
  { value: 'INVESTMENT',          labelKey: 'page.categories.subtypeInvestment' },
  { value: 'DONATION',            labelKey: 'page.categories.subtypeDonation' },
]

interface ModalState {
  open: boolean
  editTarget: Category | null
  parentCategory: Category | null
}

export function Categories() {
  const { t, categoryName } = useLang()
  const confirm = useConfirm()
  const [modal, setModal] = useState<ModalState>({ open: false, editTarget: null, parentCategory: null })
  const [form, setForm] = useState<CategoryRequest>({ name: '', type: 'EXPENSE', color: '#6366f1' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [selectedCat, setSelectedCat] = useState<Category | null>(null)
  const [catTxPage, setCatTxPage] = useState(0)

  const categories = useApi(() => categoriesApi.getAll(), [])

  const CAT_TX_FILTERS: TransactionFilters = {
    page: catTxPage, size: 12, sortBy: 'transactionDate', sortDir: 'desc',
    categoryId: selectedCat?.id ?? '', type: '', currency: '', cardId: '', search: '',
  }
  const catTxs = useApi(
    () => selectedCat ? transactionsApi.getAll(CAT_TX_FILTERS) : Promise.resolve({ data: null } as never),
    [selectedCat?.id, catTxPage],
  )

  const openNew = () => {
    setForm({ name: '', type: 'EXPENSE', color: '#6366f1' })
    setError(null)
    setModal({ open: true, editTarget: null, parentCategory: null })
  }

  const openEdit = (c: Category) => {
    setForm({
      name: c.name,
      nameUz: c.nameUz ?? '', type: c.type, color: c.color, icon: c.icon,
      kind: c.kind,
      applicableSubType: c.applicableSubType ?? undefined,
      parentId: c.parentId ?? undefined,
      descriptionLabel: c.descriptionLabel ?? undefined,
      descriptionRequired: c.descriptionRequired,
      anonymizes: c.anonymizes,
      bonusIncome: c.bonusIncome,
    })
    setError(null)
    setModal({ open: true, editTarget: c, parentCategory: null })
  }

  const openAddSub = (parent: Category) => {
    setForm({
      name: '', type: parent.type, color: parent.color,
      applicableSubType: parent.applicableSubType ?? undefined,
      parentId: parent.id,
      descriptionLabel: parent.descriptionLabel ?? undefined,
      descriptionRequired: parent.descriptionRequired,
    })
    setError(null)
    setModal({ open: true, editTarget: null, parentCategory: parent })
  }

  const closeModal = () => setModal({ open: false, editTarget: null, parentCategory: null })

  const toggleExpand = (id: number) =>
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null)
    try {
      if (modal.editTarget) { await categoriesApi.update(modal.editTarget.id, form) }
      else { await categoriesApi.create(form) }
      closeModal(); categories.refetch()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: t('page.categories.deleteTitle'),
      message: t('page.categories.deleteMessage'),
      destructive: true,
    })
    if (!ok) return
    setDeleting(id)
    try { await categoriesApi.delete(id); categories.refetch() }
    finally { setDeleting(null) }
  }

  const grouped: Record<'INCOME' | 'EXPENSE', Category[]> = {
    INCOME: (categories.data ?? []).filter(c => c.type === 'INCOME' && c.parentId === null),
    EXPENSE: (categories.data ?? []).filter(c => c.type === 'EXPENSE' && c.parentId === null),
  }

  const modalTitle = modal.editTarget
    ? t('cat.edit', { name: categoryName(modal.editTarget) })
    : modal.parentCategory
      ? t('cat.addSub', { name: categoryName(modal.parentCategory) })
      : t('cat.addCategory')

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t('page.categories')}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{t('page.categories.totalCount', { count: categories.data?.length ?? 0 })}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> {t('cat.addCategory')}
        </button>
      </div>

      {categories.loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="space-y-8">
          {(['INCOME', 'EXPENSE'] as const).map(type => (
            grouped[type].length > 0 && (
              <div key={type}>
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{type === 'INCOME' ? t('tx.income') : t('tx.expense')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {grouped[type].map(cat => {
                    const expanded = expandedIds.has(cat.id)
                    const subLabelKey = cat.applicableSubType ? SUB_TYPE_OPTIONS.find(s => s.value === cat.applicableSubType)?.labelKey : null
                    return (
                      <div key={cat.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {/* Parent row */}
                        <div className="flex items-center gap-3 p-4 group">
                          <button onClick={() => toggleExpand(cat.id)}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 shrink-0">
                            {cat.children.length > 0
                              ? (expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
                              : <span className="w-4" />}
                          </button>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '20' }}>
                            <Tag className="w-4 h-4" style={{ color: cat.color }} />
                          </div>
                          <button
                            type="button"
                            onClick={() => { setSelectedCat(selectedCat?.id === cat.id ? null : cat); setCatTxPage(0) }}
                            className="flex-1 min-w-0 text-left hover:text-indigo-600 transition-colors"
                          >
                            <p className="font-medium text-slate-700 text-sm group-hover:text-indigo-700 transition-colors">{categoryName(cat)}</p>
                            <p className="text-xs text-slate-400">
                              {subLabelKey ? t(subLabelKey) : (type === 'INCOME' ? t('page.categories.allIncomeTypes') : t('page.categories.allExpenseTypes'))}
                              {cat.children.length > 0 && ` · ${cat.children.length === 1 ? t('page.categories.subCategory', { count: cat.children.length }) : t('page.categories.subCategories', { count: cat.children.length })}`}
                              {' · '}{t('page.categories.clickToView')}
                            </p>
                          </button>
                          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openAddSub(cat)} title={t('page.categories.addSubTitle')}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openEdit(cat)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(cat.id)} disabled={deleting === cat.id}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50">
                              {deleting === cat.id ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Sub-categories */}
                        {expanded && cat.children.length > 0 && (
                          <div className="border-t border-slate-50 divide-y divide-slate-50">
                            {cat.children.map(sub => (
                              <div key={sub.id} className="flex items-center gap-3 pl-10 pr-4 py-2.5 bg-slate-50/40 group/sub">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: sub.color + '20' }}>
                                  <Tag className="w-3.5 h-3.5" style={{ color: sub.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-700">{categoryName(sub)}</p>
                                  {sub.applicableSubType && (() => {
                                    const key = SUB_TYPE_OPTIONS.find(s => s.value === sub.applicableSubType)?.labelKey
                                    return key ? <p className="text-xs text-slate-400">{t(key)}</p> : null
                                  })()}
                                </div>
                                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover/sub:opacity-100 transition-opacity">
                                  <button onClick={() => openEdit(sub)}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => handleDelete(sub.id)} disabled={deleting === sub.id}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50">
                                    {deleting === sub.id ? <Spinner className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                            ))}
                            <button onClick={() => openAddSub(cat)}
                              className="w-full flex items-center gap-2 pl-10 pr-4 py-2.5 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
                              <Plus className="w-3.5 h-3.5" /> {t('cat.addSub', { name: categoryName(cat) })}
                            </button>
                          </div>
                        )}

                        {/* Collapsed but no subs — quick add link */}
                        {!expanded && cat.children.length === 0 && (
                          <div className="border-t border-slate-50 px-16 py-2">
                            <button onClick={() => openAddSub(cat)}
                              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                              <Plus className="w-3 h-3" /> {t('page.categories.addSubTitle')}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Category Transactions Panel */}
      {selectedCat && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedCat.color }} />
              <div>
                <h3 className="font-semibold text-slate-800">{t('page.shared.txPanelTitle', { name: categoryName(selectedCat) })}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedCat.type === 'INCOME' ? t('tx.income') : t('tx.expense')}</p>
              </div>
            </div>
            <button onClick={() => setSelectedCat(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {catTxs.loading ? (
            <div className="h-32 flex items-center justify-center"><Spinner /></div>
          ) : (catTxs.data?.content.length ?? 0) === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm text-slate-400">{t('page.categories.noTxYet')}</div>
          ) : (
            <div>
              <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    {[t('tx.date'), t('tx.description'), t('tx.amount'), t('tx.card')].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-slate-400 px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {catTxs.data?.content.map((tx: Transaction) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {format(new Date(tx.transactionDate), 'dd-MMM-yyyy')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${tx.type === 'INCOME' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                            {tx.type === 'INCOME' ? <ArrowUpRight className="w-3 h-3 text-emerald-600" /> : <ArrowDownRight className="w-3 h-3 text-rose-600" />}
                          </span>
                          <span className="text-slate-700 truncate max-w-48">{tx.description}</span>
                        </div>
                      </td>
                      <td className={`px-5 py-3 font-semibold whitespace-nowrap ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency as Currency)}
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{tx.card ? `${tx.card.name} ••${tx.card.lastFourDigits}` : t('common.none')}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              {(catTxs.data?.totalPages ?? 0) > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">{t('page.pagination.pageOfWithTotal', { page: (catTxs.data?.page ?? 0) + 1, totalPages: catTxs.data?.totalPages ?? 0, total: catTxs.data?.totalElements ?? 0 })}</p>
                  <div className="flex gap-1">
                    <button disabled={catTxPage === 0} onClick={() => setCatTxPage(p => p - 1)} className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">{t('page.pagination.prev')}</button>
                    <button disabled={catTxs.data?.last ?? true} onClick={() => setCatTxPage(p => p + 1)} className="px-3 py-1 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">{t('page.pagination.next')}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modal.open} onClose={closeModal} title={modalTitle} maxWidth="max-w-lg">
        <form onSubmit={handleSave} className="space-y-4">
          {modal.parentCategory && !modal.editTarget && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl text-xs text-slate-600">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: modal.parentCategory.color }} />
              {t('cat.subOf')} <strong>{categoryName(modal.parentCategory)}</strong>
            </div>
          )}

          {/* Both names are always editable, whichever language the app is in, so the
              pair can be reviewed together. English is the canonical identifier. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('cat.nameEn')} *</label>
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder={t('page.categories.namePlaceholder')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('cat.nameUz')}</label>
              <input value={form.nameUz ?? ''} onChange={e => setForm(p => ({ ...p, nameUz: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="masalan, Ovqat va ichimlik" />
            </div>
            <p className="sm:col-span-2 text-[11px] text-slate-400 -mt-1">{t('cat.nameUzHint')}</p>
          </div>

          {!modal.parentCategory && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t('tx.type')} *</label>
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                {(['INCOME', 'EXPENSE'] as CategoryType[]).map(typeOpt => (
                  <button key={typeOpt} type="button" onClick={() => setForm(p => ({ ...p, type: typeOpt }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${form.type === typeOpt ? 'bg-white text-indigo-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                    {typeOpt === 'INCOME' ? t('tx.income') : t('tx.expense')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('page.categories.shownForType')}</label>
            <select value={form.applicableSubType ?? ''}
              onChange={e => setForm(p => ({ ...p, applicableSubType: e.target.value ? e.target.value as TransactionSubType : undefined }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">{t('page.categories.allMatchingType')}</option>
              {SUB_TYPE_OPTIONS.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">{t('page.categories.color')}</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Per-category description config */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{t('page.categories.descriptionFieldHeading')}</p>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t('page.categories.fieldLabel')} <span className="text-slate-300">{t('page.categories.fieldLabelHint')}</span>
              </label>
              <input
                value={form.descriptionLabel ?? ''}
                onChange={e => setForm(p => ({ ...p, descriptionLabel: e.target.value || undefined }))}
                placeholder={t('page.categories.fieldLabelPlaceholder')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <p className="text-[11px] text-slate-400 mt-1">{t('page.categories.descLabelDefaultHint')}</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.descriptionRequired ?? true}
                onChange={e => setForm(p => ({ ...p, descriptionRequired: e.target.checked }))}
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span className="text-sm text-slate-600">{t('page.categories.descRequiredLabel')}</span>
            </label>
            {modal.parentCategory?.name === 'Donation' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.anonymizes ?? false}
                  onChange={e => setForm(p => ({ ...p, anonymizes: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <span className="text-sm text-slate-600">{t('page.categories.anonDonationLabel')}</span>
              </label>
            )}
          </div>

          {/* Bonus income — tops up the Overview allocation target */}
          {(form.type === 'INCOME' || form.type === 'BOTH') && (
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{t('page.categories.allocationHeading')}</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.bonusIncome ?? false}
                  onChange={e => setForm(p => ({ ...p, bonusIncome: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-600 mt-0.5"
                />
                <span className="text-sm text-slate-600">
                  {t('page.categories.bonusIncomeLabel')}
                  <span className="block text-[11px] text-slate-400">
                    {t('page.categories.bonusIncomeHint')}
                  </span>
                </span>
              </label>
            </div>
          )}

          {error && <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">{t('action.cancel')}</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Spinner className="w-4 h-4" />}{saving ? t('action.saving') : modal.editTarget ? t('action.update') : t('action.create')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
