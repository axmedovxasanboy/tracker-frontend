import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, Tag, Trash2,
} from 'lucide-react'
import { OverflowMenu, PageHeader } from '../components/ui/PageHeader'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Tile, TileGrid } from '../components/ui/Tile'
import { ListRow } from '../components/ui/ListRow'
import { ErrorTile } from '../components/ui/ErrorTile'
import { Skeleton } from '../components/ui/Skeleton'
import { useApi } from '../hooks/useApi'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { categoriesApi } from '../api/categories'
import { transactionsApi } from '../api/transactions'
import { extractErrorMessage } from '../api/client'
import { formatDate, moneyFull, plural } from '../utils/format'
import type {
  Category, CategoryRequest, CategoryType, Currency,
  PageResponse, Transaction, TransactionFilters, TransactionSubType,
} from '../types'

const COLORS = ['#10b981','#f43f5e','#6366f1','#f59e0b','#06b6d4','#a855f7','#ec4899','#14b8a6','#3b82f6','#ef4444','#8b5cf6','#6b7280']

const FORM_ID = 'category-form'

const INPUT = 'w-full min-h-[44px] bg-white border border-slate-200 rounded-control px-3 py-2.5 ' +
  'text-sm text-slate-900 placeholder:text-slate-500 focus-ring'

/**
 * The span for the things that stand in for a tile but are not one — `Skeleton` and `ErrorTile`
 * take a className rather than a span, so the cell they occupy has to be spelled out.
 */
const SPAN_FULL = 'md:col-span-6 xl:col-span-12'

/**
 * Every sub-type a category can be pinned to. `EMERGENCY_CONTRIBUTION` must stay listed: the
 * seeded Emergency Fund category is pinned to exactly that, and an edit that opened with nothing
 * selected would silently retarget where those payments land.
 */
const SUB_TYPE_OPTIONS: { value: TransactionSubType; labelKey: TKey }[] = [
  { value: 'REGULAR_INCOME',        labelKey: 'page.categories.subtypeRegularIncome' },
  { value: 'LOAN_RECEIVED',         labelKey: 'page.categories.subtypeLoanReceived' },
  { value: 'LOAN_RETURNED_TO_ME',   labelKey: 'page.categories.subtypeLoanReturnedToMe' },
  { value: 'REGULAR_EXPENSE',       labelKey: 'page.categories.subtypeRegularExpense' },
  { value: 'LOAN_GIVEN',            labelKey: 'page.categories.subtypeLoanGiven' },
  { value: 'LOAN_REPAYMENT',        labelKey: 'page.categories.subtypeLoanRepayment' },
  { value: 'BANK_LOAN_PAYMENT',     labelKey: 'page.categories.subtypeBankLoanPayment' },
  { value: 'INVESTMENT',            labelKey: 'page.categories.subtypeInvestment' },
  { value: 'DONATION',              labelKey: 'page.categories.subtypeDonation' },
  { value: 'EMERGENCY_CONTRIBUTION', labelKey: 'page.categories.subtypeEmergency' },
]

/** Everything the "Advanced" disclosure holds. Set on the record being edited => open it. */
const hasAdvanced = (f: CategoryRequest) =>
  f.applicableSubType != null
  || !!f.descriptionLabel
  || f.descriptionRequired === false
  || !!f.anonymizes
  || !!f.bonusIncome

interface ModalState {
  open: boolean
  editTarget: Category | null
  parentCategory: Category | null
}

export function Categories() {
  const { t, lang, categoryName } = useLang()
  const confirm = useConfirm()
  const { showSuccess } = useToast()
  const [modal, setModal] = useState<ModalState>({ open: false, editTarget: null, parentCategory: null })
  const [form, setForm] = useState<CategoryRequest>({ name: '', type: 'EXPENSE', color: '#6366f1' })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
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
  // Resolving to `null` while nothing is selected clears the hook's data, so reopening the drawer
  // for a different category starts from the skeleton instead of the previous one's rows.
  const catTxs = useApi<PageResponse<Transaction> | null>(
    () => selectedCat ? transactionsApi.getAll(CAT_TX_FILTERS) : Promise.resolve({ data: null }),
    [selectedCat?.id, catTxPage],
  )

  const roots = useMemo(() => categories.data ?? [], [categories.data])

  const grouped: Record<'INCOME' | 'EXPENSE', Category[]> = useMemo(() => ({
    INCOME: roots.filter(c => c.type === 'INCOME' && c.parentId === null),
    EXPENSE: roots.filter(c => c.type === 'EXPENSE' && c.parentId === null),
  }), [roots])

  const openTx = (c: Category) => { setSelectedCat(c); setCatTxPage(0) }

  const openForm = (next: CategoryRequest, state: ModalState) => {
    setForm(next)
    setAdvancedOpen(hasAdvanced(next))
    setError(null)
    setDirty(false)
    setModal(state)
  }

  const openNew = () => openForm(
    { name: '', type: 'EXPENSE', color: '#6366f1' },
    { open: true, editTarget: null, parentCategory: null },
  )

  const openEdit = (c: Category) => openForm(
    {
      name: c.name,
      nameUz: c.nameUz ?? '', type: c.type, color: c.color, icon: c.icon,
      applicableSubType: c.applicableSubType ?? undefined,
      parentId: c.parentId ?? undefined,
      descriptionLabel: c.descriptionLabel ?? undefined,
      descriptionRequired: c.descriptionRequired,
      anonymizes: c.anonymizes,
      bonusIncome: c.bonusIncome,
    },
    { open: true, editTarget: c, parentCategory: null },
  )

  const openAddSub = (parent: Category) => openForm(
    {
      name: '', type: parent.type, color: parent.color,
      applicableSubType: parent.applicableSubType ?? undefined,
      parentId: parent.id,
      descriptionLabel: parent.descriptionLabel ?? undefined,
      descriptionRequired: parent.descriptionRequired,
    },
    { open: true, editTarget: null, parentCategory: parent },
  )

  const closeModal = () => {
    setModal({ open: false, editTarget: null, parentCategory: null })
    setDirty(false)
  }

  const set = <K extends keyof CategoryRequest>(key: K, value: CategoryRequest[K]) => {
    setDirty(true)
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const toggleExpand = (id: number) =>
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const refetchAll = () => { categories.refetch() }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null)
    try {
      if (modal.editTarget) { await categoriesApi.update(modal.editTarget.id, form) }
      else { await categoriesApi.create(form) }
      closeModal(); refetchAll()
      showSuccess(t('page.categories.savedToast'))
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (deleting !== null) return
    const ok = await confirm({
      title: t('page.categories.deleteTitle'),
      message: t('page.categories.deleteMessage'),
      destructive: true,
    })
    if (!ok) return
    setDeleting(id)
    try {
      await categoriesApi.delete(id)
      refetchAll()
      showSuccess(t('page.categories.deletedToast'))
    } finally { setDeleting(null) }
  }

  const modalTitle = modal.editTarget
    ? t('cat.edit', { name: categoryName(modal.editTarget) })
    : modal.parentCategory
      ? t('cat.addSub', { name: categoryName(modal.parentCategory) })
      : t('cat.addCategory')

  const rowActions = (c: Category) => [
    { label: t('action.edit'), icon: <Pencil className="w-4 h-4" aria-hidden="true" />, onClick: () => openEdit(c) },
    { label: t('action.delete'), icon: <Trash2 className="w-4 h-4" aria-hidden="true" />, onClick: () => handleDelete(c.id), danger: true },
  ]

  const txRows = catTxs.data?.content ?? []

  return (
    // A management page under Settings, deliberately without a hero: it holds no figure to rank,
    // and a StatTile invented to count categories would only be one more thing to read.
    <div className="p-4 sm:p-6">
      <Link
        to="/settings"
        aria-label={t('shell.categories.backLabel')}
        className="focus-ring -ml-2 mb-1 inline-flex min-h-[44px] items-center gap-1 rounded-control px-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t('shell.categories.back')}
      </Link>
      <PageHeader
        title={t('page.categories')}
        subtitle={t('page.categories.totalCount', { count: roots.length })}
        primary={{
          label: t('cat.addCategory'),
          onClick: openNew,
          icon: <Plus className="w-4 h-4" aria-hidden="true" />,
        }}
      />

      <div className="mt-4 xl:mt-5">
        <TileGrid>
          {/* ── The categories themselves ─────────────────────────────────────────── */}
          {categories.loading ? (
            // The stat variant comes in its own responsive grid, so the placeholder is a grid of
            // tiles like the one it stands in for — not a list the page never shows.
            <Skeleton variant="stat" count={6} className={SPAN_FULL} />
          ) : categories.error && !categories.data ? (
            <ErrorTile className={SPAN_FULL} message={categories.error} onRetry={categories.refetch} />
          ) : roots.length === 0 ? (
            <Tile span={12}>
              <p className="text-sm text-slate-500">{t('cat.none')}</p>
              <Button
                className="mt-3"
                label={t('cat.addCategory')}
                icon={<Plus className="w-4 h-4" aria-hidden="true" />}
                onClick={openNew}
              />
            </Tile>
          ) : (
            (['INCOME', 'EXPENSE'] as const).map(type => (
              grouped[type].length > 0 && (
                // A fragment, not a wrapper: a group's heading and its tiles are siblings in the
                // one page grid, and a <div> around them would make the whole group one cell.
                <Fragment key={type}>
                  <h2 className={`${SPAN_FULL} text-label uppercase ${
                    type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {type === 'INCOME' ? t('tx.income') : t('tx.expense')}
                  </h2>

                  {grouped[type].map(cat => {
                    const expanded = expandedIds.has(cat.id)
                    const subLabelKey = cat.applicableSubType
                      ? SUB_TYPE_OPTIONS.find(s => s.value === cat.applicableSubType)?.labelKey
                      : null
                    const subCount = cat.children.length
                    const subCountLabel = plural(
                      subCount,
                      t('page.categories.subCategory', { count: subCount }),
                      t('page.categories.subCategories', { count: subCount }),
                      lang,
                    )

                    return (
                      <Tile
                        key={cat.id}
                        span={4}
                        onClick={() => openTx(cat)}
                        className={deleting === cat.id || categories.refreshing ? 'opacity-60 transition-opacity' : ''}
                      >
                        <div className="flex items-start gap-3">
                          {/* The category's own colour, on the chip — the one place it belongs. */}
                          <span
                            className="w-9 h-9 rounded-chip flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${cat.color}1f`, color: cat.color }}
                          >
                            <Tag className="w-4 h-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{categoryName(cat)}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {subLabelKey
                                ? t(subLabelKey)
                                : type === 'INCOME'
                                  ? t('page.categories.allIncomeTypes')
                                  : t('page.categories.allExpenseTypes')}
                            </p>
                          </div>
                          {/* Stops the press reaching the tile, which would open the drawer. */}
                          <div onClick={e => e.stopPropagation()} className="shrink-0 -mr-2 -mt-2">
                            <OverflowMenu
                              actions={[
                                {
                                  label: t('page.categories.addSubTitle'),
                                  icon: <Plus className="w-4 h-4" aria-hidden="true" />,
                                  onClick: () => openAddSub(cat),
                                },
                                ...rowActions(cat),
                              ]}
                            />
                          </div>
                        </div>

                        {subCount > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); toggleExpand(cat.id) }}
                              aria-expanded={expanded}
                              aria-controls={`cat-subs-${cat.id}`}
                              className="mt-2 -mx-1 flex min-h-[44px] w-[calc(100%+0.5rem)] items-center gap-1.5 rounded-control px-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-ring"
                            >
                              {expanded
                                ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                                : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />}
                              <span className="truncate">{subCountLabel}</span>
                            </button>

                            {expanded && (
                              // The whole sub-list is fenced off from the tile's own click, so a
                              // tap on the gap between a name and its ⋯ does nothing rather than
                              // opening the PARENT's transactions.
                              <div
                                id={`cat-subs-${cat.id}`}
                                onClick={e => e.stopPropagation()}
                                className="divide-y divide-hairline border-t border-hairline"
                              >
                                {cat.children.map(sub => {
                                  const subKey = sub.applicableSubType
                                    ? SUB_TYPE_OPTIONS.find(s => s.value === sub.applicableSubType)?.labelKey
                                    : null
                                  return (
                                    <div key={sub.id} className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); openTx(sub) }}
                                        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-control px-1 text-left transition-colors hover:bg-slate-50 focus-ring"
                                      >
                                        <span
                                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                                          style={{ backgroundColor: sub.color }}
                                        />
                                        <span className="min-w-0">
                                          <span className="block truncate text-sm text-slate-900">{categoryName(sub)}</span>
                                          {subKey && (
                                            <span className="block truncate text-xs text-slate-500">{t(subKey)}</span>
                                          )}
                                        </span>
                                      </button>
                                      <div onClick={e => e.stopPropagation()} className="shrink-0 -mr-2">
                                        <OverflowMenu actions={rowActions(sub)} />
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <div onClick={e => e.stopPropagation()} className="mt-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="-ml-3"
                              label={t('page.categories.addSubTitle')}
                              icon={<Plus className="w-4 h-4" aria-hidden="true" />}
                              onClick={() => openAddSub(cat)}
                            />
                          </div>
                        )}
                      </Tile>
                    )
                  })}
                </Fragment>
              )
            ))
          )}
        </TileGrid>
      </div>

      {/* ── One category's transactions ─────────────────────────────────────────── */}
      {selectedCat && (
        <Sheet
          open
          onClose={() => setSelectedCat(null)}
          title={t('page.shared.txPanelTitle', { name: categoryName(selectedCat) })}
          maxWidth="max-w-3xl"
        >
          <p className="-mt-2 mb-4 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedCat.color }} />
            {selectedCat.type === 'INCOME' ? t('tx.income') : t('tx.expense')}
          </p>

          {catTxs.loading ? (
            <Skeleton variant="row" count={5} bare />
          ) : catTxs.error && !catTxs.data ? (
            <ErrorTile message={catTxs.error} onRetry={catTxs.refetch} />
          ) : txRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">{t('page.categories.noTxYet')}</p>
          ) : (
            <>
              {catTxs.error && (
                <ErrorTile compact className="mb-3" message={catTxs.error} onRetry={catTxs.refetch} />
              )}
              {/* A bare divider, not a ListTile: the sheet is already a surface, and framing the
                  rows again draws a white box inside a white box. */}
              <div className={catTxs.refreshing ? 'opacity-60 transition-opacity' : undefined}>
                <div className="divide-y divide-hairline">
                  {txRows.map((tx: Transaction) => {
                    const income = tx.type === 'INCOME'
                    return (
                      <ListRow
                        key={tx.id}
                        leading={
                          <span className={`flex h-9 w-9 items-center justify-center rounded-chip ${
                            income ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                          }`}>
                            {income
                              ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                              : <ArrowDownRight className="h-4 w-4" aria-hidden="true" />}
                          </span>
                        }
                        title={tx.description}
                        subtitle={[
                          formatDate(tx.transactionDate, lang),
                          tx.card ? `${tx.card.name} ••${tx.card.lastFourDigits}` : null,
                        ].filter(Boolean).join(' · ')}
                        amount={`${income ? '+' : '-'}${moneyFull(tx.amount, tx.currency as Currency)}`}
                        amountTone={income ? 'in' : 'out'}
                      />
                    )
                  })}
                </div>
              </div>

              {(catTxs.data?.totalPages ?? 0) > 1 && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs tabular-nums text-slate-500">
                    {t('page.pagination.pageOfWithTotal', {
                      page: (catTxs.data?.page ?? 0) + 1,
                      totalPages: catTxs.data?.totalPages ?? 0,
                      total: catTxs.data?.totalElements ?? 0,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      label={t('page.pagination.previous')}
                      disabled={catTxPage === 0}
                      onClick={() => setCatTxPage(p => p - 1)}
                    />
                    <Button
                      size="sm"
                      label={t('page.pagination.next')}
                      disabled={catTxs.data?.last ?? true}
                      onClick={() => setCatTxPage(p => p + 1)}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </Sheet>
      )}

      {/* ── Create / edit ───────────────────────────────────────────────────────── */}
      <Sheet
        open={modal.open}
        onClose={closeModal}
        dirty={dirty}
        title={modalTitle}
        maxWidth="max-w-lg"
        footer={
          <div className="flex gap-3">
            <Button className="flex-1" label={t('action.cancel')} onClick={closeModal} />
            <Button
              className="flex-1"
              variant="primary"
              type="submit"
              form={FORM_ID}
              loading={saving}
              label={saving ? t('action.saving') : modal.editTarget ? t('action.update') : t('action.create')}
            />
          </div>
        }
      >
        <form id={FORM_ID} onSubmit={handleSave} className="space-y-4">
          {modal.parentCategory && !modal.editTarget && (
            <div className="flex items-center gap-2 rounded-control bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: modal.parentCategory.color }} />
              {t('cat.subOf')} <strong>{categoryName(modal.parentCategory)}</strong>
            </div>
          )}

          {/* Both names are always editable, whichever language the app is in, so the
              pair can be reviewed together. English is the canonical identifier. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="cat-name-en" label={t('cat.nameEn')} required>
              <input
                required
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className={INPUT}
                placeholder={t('page.categories.namePlaceholder')}
              />
            </Field>
            <Field id="cat-name-uz" label={t('cat.nameUz')}>
              <input
                value={form.nameUz ?? ''}
                onChange={e => set('nameUz', e.target.value)}
                className={INPUT}
                placeholder="masalan, Ovqat va ichimlik"
              />
            </Field>
            {/* Under the pair rather than inside one Field, so the two inputs stay aligned. */}
            <p className="text-xs text-slate-500 sm:col-span-2">{t('cat.nameUzHint')}</p>
          </div>

          {!modal.parentCategory && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">
                {t('tx.type')}
                <span aria-hidden="true" className="text-expense"> *</span>
              </p>
              <div role="group" aria-label={t('tx.type')} className="flex gap-1 rounded-control bg-slate-100 p-1">
                {(['INCOME', 'EXPENSE'] as CategoryType[]).map(typeOpt => (
                  <button
                    key={typeOpt}
                    type="button"
                    aria-pressed={form.type === typeOpt}
                    onClick={() => set('type', typeOpt)}
                    className={`min-h-[44px] flex-1 rounded-chip text-xs font-semibold transition-colors focus-ring ${
                      form.type === typeOpt
                        ? 'bg-white text-slate-900 shadow-tile'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {typeOpt === 'INCOME' ? t('tx.income') : t('tx.expense')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">{t('page.categories.color')}</p>
            <div className="-m-1 flex flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={form.color === c}
                  aria-label={t('page.categories.colorSwatch', { color: c })}
                  title={c}
                  onClick={() => set('color', c)}
                  className="flex h-11 w-11 items-center justify-center rounded-control focus-ring"
                >
                  <span
                    className={`h-7 w-7 rounded-full transition-transform ${
                      form.color === c ? 'ring-2 ring-slate-400 ring-offset-2' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Everything past name, type and colour is configuration the common case never
              touches, so it starts folded — and unfolds by itself when the record uses it. */}
          <div className="border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen(o => !o)}
              aria-expanded={advancedOpen}
              aria-controls="cat-advanced"
              className="-mx-2 flex min-h-[44px] w-[calc(100%+1rem)] items-center gap-2 rounded-control px-2 text-left transition-colors hover:bg-slate-50 focus-ring"
            >
              {advancedOpen
                ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{t('page.categories.advanced')}</span>
                <span className="block text-xs text-slate-500">{t('page.categories.advancedHint')}</span>
              </span>
            </button>

            {advancedOpen && (
              <div id="cat-advanced" className="mt-3 space-y-4">
                <Field id="cat-subtype" label={t('page.categories.shownForType')}>
                  <select
                    value={form.applicableSubType ?? ''}
                    onChange={e => set('applicableSubType', e.target.value ? e.target.value as TransactionSubType : undefined)}
                    className={INPUT}
                  >
                    <option value="">{t('page.categories.allMatchingType')}</option>
                    {SUB_TYPE_OPTIONS.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
                  </select>
                </Field>

                <div className="space-y-3">
                  <p className="text-label uppercase text-slate-500">{t('page.categories.descriptionFieldHeading')}</p>
                  <Field
                    id="cat-desc-label"
                    label={`${t('page.categories.fieldLabel')} ${t('page.categories.fieldLabelHint')}`}
                    help={t('page.categories.descLabelDefaultHint')}
                  >
                    <input
                      value={form.descriptionLabel ?? ''}
                      onChange={e => set('descriptionLabel', e.target.value || undefined)}
                      placeholder={t('page.categories.fieldLabelPlaceholder')}
                      className={INPUT}
                    />
                  </Field>
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.descriptionRequired ?? true}
                      onChange={e => set('descriptionRequired', e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 focus-ring"
                    />
                    <span className="text-sm text-slate-600">{t('page.categories.descRequiredLabel')}</span>
                  </label>
                  {modal.parentCategory?.name === 'Donation' && (
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.anonymizes ?? false}
                        onChange={e => set('anonymizes', e.target.checked)}
                        className="h-4 w-4 rounded text-indigo-600 focus-ring"
                      />
                      <span className="text-sm text-slate-600">{t('page.categories.anonDonationLabel')}</span>
                    </label>
                  )}
                </div>

                {/* A bonus is extra money: Home does not count it as the monthly pay arriving. */}
                {(form.type === 'INCOME' || form.type === 'BOTH') && (
                  <div className="space-y-2">
                    <p className="text-label uppercase text-slate-500">{t('shell.categories.bonusHeading')}</p>
                    <label className="flex cursor-pointer items-start gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={form.bonusIncome ?? false}
                        onChange={e => set('bonusIncome', e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus-ring"
                      />
                      <span className="text-sm text-slate-600">
                        {t('page.categories.bonusIncomeLabel')}
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {t('shell.categories.bonusHint')}
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-control border border-rose-200 bg-white px-3 py-2 text-sm text-expense">
              {error}
            </p>
          )}
        </form>
      </Sheet>
    </div>
  )
}
