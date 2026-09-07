import { useId } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Spinner } from '../ui/Spinner'
import { useLang } from '../../i18n/LanguageContext'
import { formatDate } from '../../utils/format'
import type { Category, TransactionFilters as Filters, TransactionType } from '../../types'

interface Props {
  filters: Filters
  categories: Category[]
  /** What the user is typing. The page commits it into `filters.search` 300ms later. */
  searchDraft: string
  onSearchDraftChange: (value: string) => void
  /** True while the debounce timer is still running, i.e. the list is one keystroke behind. */
  searching?: boolean
  expanded: boolean
  onExpandedChange: (value: boolean) => void
  onChange: (partial: Partial<Filters>) => void
  onReset: () => void
}

/** One shape for every control in the panel, so the four of them line up on any row. */
const CONTROL =
  'h-11 w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-ring'

/** One active filter, as a chip that clears exactly itself. */
interface Chip {
  key: string
  label: string
  clear: () => void
}

/**
 * Search inline, everything else behind one button.
 *
 * The panel used to be six controls in a permanent white band that stacked into five rows on a
 * phone and pushed the first record ~670px down the page — on a screen where the whole point is
 * to read records. Collapsed, this is one search field and a `Filters` button; whatever is
 * actually filtering is stated as chips, each of which clears only itself, so the state of the
 * list is legible without opening anything.
 *
 * It draws no surface of its own: the page frames it as a tile, the way every other block is
 * framed.
 */
export function TransactionFilters({
  filters, categories, searchDraft, onSearchDraftChange, searching = false,
  expanded, onExpandedChange, onChange, onReset,
}: Props) {
  const { t, lang, categoryName } = useLang()
  const searchId = useId()
  const typeId = useId()
  const categoryId = useId()
  const fromId = useId()
  const toId = useId()
  const panelId = useId()

  const chips: Chip[] = []
  if (filters.type) {
    chips.push({
      key: 'type',
      label: t('cmp.txFilters.chipType', {
        value: filters.type === 'INCOME' ? t('tx.income') : t('tx.expense'),
      }),
      clear: () => onChange({ type: '', page: 0 }),
    })
  }
  if (filters.categoryId) {
    const category = categories.find(c => c.id === filters.categoryId)
    chips.push({
      key: 'category',
      label: t('cmp.txFilters.chipCategory', {
        value: category ? categoryName(category) : String(filters.categoryId),
      }),
      clear: () => onChange({ categoryId: '', page: 0 }),
    })
  }
  // Arrived via a link rather than the panel, so without a chip the list would look filtered
  // for no visible reason and there would be no way back to everything.
  if (filters.cardId) {
    chips.push({
      key: 'card',
      label: t('cmp.txFilters.chipCard'),
      clear: () => onChange({ cardId: '', page: 0 }),
    })
  }
  if (filters.investmentId) {
    chips.push({
      key: 'investment',
      label: t('cmp.txFilters.chipInvestment'),
      clear: () => onChange({ investmentId: '', page: 0 }),
    })
  }
  if (filters.startDate) {
    chips.push({
      key: 'from',
      label: t('cmp.txFilters.chipFrom', { date: formatDate(filters.startDate, lang) }),
      clear: () => onChange({ startDate: '', page: 0 }),
    })
  }
  if (filters.endDate) {
    chips.push({
      key: 'to',
      label: t('cmp.txFilters.chipTo', { date: formatDate(filters.endDate, lang) }),
      clear: () => onChange({ endDate: '', page: 0 }),
    })
  }

  const anythingSet = chips.length > 0 || searchDraft !== ''

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={searchId} className="sr-only">{t('cmp.txFilters.search')}</label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={searchDraft}
            onChange={e => onSearchDraftChange(e.target.value)}
            placeholder={t('cmp.txFilters.searchPlaceholder')}
            // The webkit cancel button sits exactly where the pending-search spinner goes, and
            // it only appears once there is text — i.e. precisely when the two would collide.
            className="focus-ring h-11 w-full rounded-control border border-slate-200 bg-white pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-500 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {searching && (
            <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2">
              <Spinner className="h-4 w-4" />
            </span>
          )}
          {/* Mounted at all times: a live region added to the DOM already populated is not
              reliably announced. */}
          <span role="status" className="sr-only">
            {searching ? t('cmp.txFilters.searching') : ''}
          </span>
        </div>

        <Button
          variant={expanded ? 'primary' : 'secondary'}
          icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
          label={chips.length > 0
            ? t('cmp.txFilters.filtersWithCount', { count: chips.length })
            : t('cmp.txFilters.filters')}
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          // Only while the panel exists: pointing at an absent id is worse than not pointing.
          aria-controls={expanded ? panelId : undefined}
          className="shrink-0"
        />
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(chip => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              aria-label={t('cmp.txFilters.removeFilter', { label: chip.label })}
              title={t('cmp.txFilters.removeFilter', { label: chip.label })}
              // `after:-inset-1` is the same trick the small Button uses: a 44px hit area around
              // a 36px chip, without the chip itself growing and re-wrapping the row.
              className="focus-ring relative inline-flex min-h-[36px] items-center gap-1.5 rounded-chip bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 after:absolute after:-inset-1 after:content-['']"
            >
              <span className="max-w-[12rem] truncate">{chip.label}</span>
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            icon={<X className="h-3.5 w-3.5" aria-hidden="true" />}
            label={t('cmp.txFilters.clearAll')}
            onClick={onReset}
          />
        </div>
      )}

      {expanded && (
        <div id={panelId} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field id={typeId} label={t('tx.type')}>
            <select
              value={filters.type ?? ''}
              onChange={e => onChange({ type: e.target.value as TransactionType | '', page: 0 })}
              className={CONTROL}
            >
              <option value="">{t('cmp.txFilters.allTypes')}</option>
              <option value="INCOME">{t('tx.income')}</option>
              <option value="EXPENSE">{t('tx.expense')}</option>
            </select>
          </Field>

          <Field id={categoryId} label={t('tx.category')}>
            <select
              value={filters.categoryId ?? ''}
              onChange={e => onChange({ categoryId: e.target.value ? Number(e.target.value) : '', page: 0 })}
              className={CONTROL}
            >
              <option value="">{t('cmp.txFilters.allCategories')}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{categoryName(c)}</option>
              ))}
            </select>
          </Field>

          <Field id={fromId} label={t('cmp.txFilters.from')}>
            <input
              type="date"
              value={filters.startDate ?? ''}
              onChange={e => onChange({ startDate: e.target.value, page: 0 })}
              className={CONTROL}
            />
          </Field>

          <Field id={toId} label={t('cmp.txFilters.to')}>
            <input
              type="date"
              value={filters.endDate ?? ''}
              onChange={e => onChange({ endDate: e.target.value, page: 0 })}
              className={CONTROL}
            />
          </Field>

          {anythingSet && (
            <div className="flex justify-end sm:col-span-2 xl:col-span-4">
              <Button
                variant="ghost"
                icon={<X className="h-4 w-4" aria-hidden="true" />}
                label={t('cmp.txFilters.reset')}
                onClick={onReset}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
