import { useState } from 'react'
import {
  ArrowDownRight, Building2, History, Pencil, Plus, ShieldAlert, Target, TrendingUp, Trash2, X,
} from 'lucide-react'
import { PageHeader, OverflowMenu } from '../components/ui/PageHeader'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Tile, TileGrid } from '../components/ui/Tile'
import type { TileSpan } from '../components/ui/Tile'
import { StatTile } from '../components/ui/StatTile'
import { ListRow, ListTile } from '../components/ui/ListRow'
import { IconChip, Badge } from '../components/ui/IconChip'
import { StatSlot, GridHeading } from '../components/ui/StatSlot'
import { ErrorTile } from '../components/ui/ErrorTile'
import { CacheBadge } from '../components/ui/CacheBadge'
import { Skeleton } from '../components/ui/Skeleton'
import { ExplainModal } from '../components/ui/ExplainModal'
import { AmountInput } from '../components/ui/AmountInput'
import { ContributeInvestmentModal } from '../components/finance/ContributeInvestmentModal'
import { UpdateValueModal } from '../components/finance/UpdateValueModal'
import { usePlanHeaderActions } from '../components/overview/PlanHeaderAction'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import { financeApi } from '../api/finance'
import { overviewApi } from '../api/overview'
import { transactionsApi } from '../api/transactions'
import { cardsApi } from '../api/cards'
import {
  formatDate, formatMonth, money, moneyFull, monthLocal, plural, snap, todayLocal,
} from '../utils/format'
import { extractErrorMessage } from '../api/client'
import type {
  BucketPayment, Currency, InvestmentRequest, InvestmentResponse, InvestmentType,
  Transaction, TransactionFilters,
} from '../types'

const INPUT = 'w-full min-h-[44px] bg-white border border-slate-200 rounded-control px-3 py-2.5 ' +
  'text-sm text-slate-900 placeholder:text-slate-500 focus-ring'

const FORM_ID = 'investment-form'

/**
 * Several dictionary labels still carry a trailing '*' from the hand-rolled forms. `Field` draws
 * the required marker itself, so the star has to come off here or the label reads "Name * *".
 */
const req = (label: string) => label.replace(/\s*\*$/, '')

/** Grid cells for `Skeleton` and `ErrorTile`, which take a className rather than a tile span. */
const SPAN_HERO = 'md:col-span-3 xl:col-span-6'
const SPAN_STAT = 'md:col-span-2 xl:col-span-3'
const SPAN_HALF = 'md:col-span-3 xl:col-span-6'
const SPAN_FULL = 'md:col-span-6 xl:col-span-12'

const INVESTMENT_TYPES: InvestmentType[] = ['REAL_ESTATE', 'BONDS', 'MUTUAL_FUND', 'GOLD', 'OTHER']

const INVESTMENT_TYPE_LABEL_KEYS: Record<InvestmentType, TKey> = {
  REAL_ESTATE:  'page.investments.typeRealEstate',
  BONDS:        'page.investments.typeBonds',
  MUTUAL_FUND:  'page.investments.typeMutualFund',
  GOLD:         'page.investments.typeGold',
  OTHER:        'page.investments.typeOther',
}

/**
 * `marked` rides on the wire but is not on the shared `BucketPayment` type yet. A marked row
 * carries a MarkPaid id rather than a transaction id, so it must never offer edit or delete.
 */
type PaymentRow = BucketPayment & { marked?: boolean }

interface Props {
  /** The month the Plan page is showing, as 'YYYY-MM'. Every scoped figure here follows it. */
  month?: string
  currency?: Currency
  /** Called after any successful write, so the Plan's bucket card can refetch alongside us. */
  onWrote?: () => void
  /**
   * NESTING CONTRACT — read before you delete this.
   *
   * Plan (`Overview.tsx`) renders this page inside its own `PageHeader` and its own `TileGrid`.
   * An embedded copy must therefore add neither: two `<h1>`s fight over the single phone app bar,
   * and a grid inside a grid is exactly the case `Tile.tsx` warns about, which is what produced
   * the five different card widths the audit found. Embedded, the page returns its tiles as a
   * fragment of DIRECT children of Plan's grid (Plan's tab panel is `display: contents`, so the
   * spans still resolve against the page grid) and moves its write verbs into a full-width action
   * row. Standalone — mounted on a route of its own — it keeps its header and its grid. Do not
   * collapse the two branches.
   */
  embedded?: boolean
}

export function InvestmentsPage({
  month = monthLocal(), currency = 'UZS', onWrote, embedded = false,
}: Props) {
  const { t, lang } = useLang()
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()

  const investments = useApi(() => financeApi.getInvestments(), [])
  const cards = useApi(() => cardsApi.getAll(), [])
  // The month figure comes from the endpoint the Plan reads, so the two can never disagree. It
  // counts INVESTMENT transactions only — an emergency-fund holding books an EMERGENCY
  // CONTRIBUTION and lands in the Emergency fund bucket, which is why it is excluded below too.
  const counted = useApi(
    () => overviewApi.getBucketPayments('INVESTMENTS', month, currency), [month, currency])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [info, setInfo] = useState(false)
  const [form, setForm] = useState<InvestmentRequest>({
    name: '', type: 'OTHER', investedAmount: 0, currency: 'UZS', purchaseDate: todayLocal(),
    emergencyFund: false, savingsGoal: false, targetAmount: null, currentValue: null,
  })
  // Funding source for a NEW investment: 'cash' | 'none' (already-owned / no wallet) | card id.
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

  const set = <K extends keyof InvestmentRequest>(key: K, value: InvestmentRequest[K]) => {
    setDirty(true)
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const openAdd = (asGoal = false) => {
    setEditId(null)
    setForm({
      name: '', type: 'OTHER', investedAmount: 0, currency: 'UZS', purchaseDate: todayLocal(),
      emergencyFund: false, savingsGoal: asGoal, targetAmount: null, currentValue: null,
      openingBalance: false,
    })
    setSource('cash')
    setDirty(false)
    setSheetOpen(true)
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
    setDirty(false)
    setSheetOpen(true)
  }

  const closeSheet = () => { setSheetOpen(false); setEditId(null); setDirty(false) }

  // Embedded in Plan there is no header of this page's own, so its write verbs are published to
  // Plan's — top right on a desktop, in the phone app bar on a phone, exactly where Home puts its
  // Add. The split matches the standalone header: one filled Add, the goal in the ⋯ menu, because
  // PageHeader takes exactly one primary action. The flag is false only if this page is ever
  // embedded somewhere with no header slot, and the in-body row below then still paints.
  const inPlanHeader = usePlanHeaderActions(embedded ? {
    primary: {
      label: t('page.investments.addInvestment'),
      onClick: () => openAdd(false),
      icon: <Plus className="w-4 h-4" aria-hidden="true" />,
    },
    overflow: [{
      label: t('page.investments.newGoal'),
      onClick: () => openAdd(true),
      icon: <Target className="w-4 h-4" aria-hidden="true" />,
    }],
  } : null)

  /** Holdings and the month's counted payments both move on a write, and so does the Plan. */
  const refetchAll = () => { investments.refetch(); counted.refetch(); onWrote?.() }

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
      closeSheet()
      refetchAll()
      showSuccess(editId ? t('page.investments.updatedToast') : t('page.investments.createdToast'))
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!await confirm({
      message: t('page.investments.confirmDelete'),
      destructive: true,
    })) return
    setDeleting(id)
    try {
      await financeApi.deleteInvestment(id)
      refetchAll()
      if (selectedId === id) setSelectedId(null)
      showSuccess(t('page.investments.deletedToast'))
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setDeleting(null) }
  }

  const all = investments.data ?? []
  const goals = all.filter(i => i.savingsGoal)
  // Emergency-fund holdings are split out, not hidden: the backend books their money to the
  // Emergency fund bucket, so counting them here would have this page's total contradict both the
  // Plan's card and the Emergency fund tab.
  const emergencyHoldings = all.filter(i => i.emergencyFund && !i.savingsGoal)
  const list = all.filter(i => !i.savingsGoal && !i.emergencyFund)

  const rows = (counted.data ?? []) as PaymentRow[]
  const monthLabel = formatMonth(month, lang)
  const monthTotal = snap(rows.reduce((sum, p) => sum + p.amount, 0))

  // Summed apart by currency: non-UZS rows were purged in the UZS-only pivot, so this is one
  // entry in practice, but adding two currencies together would invent a number.
  const byCurrency = list.reduce<Partial<Record<Currency, number>>>((acc, i) => {
    acc[i.currency] = (acc[i.currency] ?? 0) + i.investedAmount
    return acc
  }, {})
  const allTime = Object.entries(byCurrency) as [Currency, number][]
  const allTimeValue = allTime.length
    ? allTime.map(([ccy, sum]) => money(snap(sum), ccy)).join(' + ')
    : money(0, currency)
  const allTimeExact = allTime.length
    ? allTime.map(([ccy, sum]) => moneyFull(snap(sum), ccy)).join(' + ')
    : moneyFull(0, currency)

  const emergencyTotal = snap(emergencyHoldings.reduce((sum, i) => sum + i.investedAmount, 0))
  // The row of secondary stats is six columns wide: one figure fills it, two split it.
  const allTimeSpan: TileSpan = emergencyHoldings.length > 0 ? 3 : 6
  const allTimeSpanClass = emergencyHoldings.length > 0 ? SPAN_STAT : SPAN_HALF

  const onGoalSaved = () => {
    refetchAll()
    txs.refetch()
    showSuccess(t('page.investments.savedToast'))
  }

  const staleError = (counted.error && counted.data ? counted.error : null)
    ?? (investments.error && investments.data ? investments.error : null)

  const rowActions = (id: number) => [
    {
      label: t('action.edit'),
      icon: <Pencil className="w-4 h-4" aria-hidden="true" />,
      onClick: () => openEdit(id),
    },
    {
      label: t('action.delete'),
      icon: <Trash2 className="w-4 h-4" aria-hidden="true" />,
      onClick: () => del(id),
      danger: true,
      disabled: deleting === id,
    },
  ]

  const selected = selectedId != null ? all.find(i => i.id === selectedId) ?? null : null

  const tiles = (
    <>
      {/* The fallback for an embed with no header slot to publish into. */}
      {embedded && !inPlanHeader && (
        <div className={`flex flex-wrap items-center justify-end gap-2 ${SPAN_FULL}`}>
          <Button
            icon={<Target className="w-4 h-4" aria-hidden="true" />}
            label={t('page.investments.newGoal')}
            onClick={() => openAdd(true)}
          />
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" aria-hidden="true" />}
            label={t('page.investments.addInvestment')}
            onClick={() => openAdd(false)}
          />
        </div>
      )}

      {staleError && (
        <ErrorTile
          compact
          message={staleError}
          onRetry={() => { counted.refetch(); investments.refetch() }}
          className={SPAN_FULL}
        />
      )}

      <StatSlot query={counted} span={SPAN_HERO}>
        <StatTile
          hero
          span={6}
          rows={2}
          label={t('page.shared.setAsideIn', { month: monthLabel })}
          value={money(monthTotal, currency)}
          caption={t('ui.exactValue', { value: moneyFull(monthTotal, currency) })}
          icon={<Building2 className="w-5 h-5" aria-hidden="true" />}
          iconTone="teal"
          onInfo={() => setInfo(true)}
        >
          <p className="text-sm text-slate-600">{t('page.investments.planNote')}</p>
          {/* Cached figures are pixel-identical to live ones; only this says which. */}
          <CacheBadge isCached={counted.isCached} cachedAt={counted.cachedAt} />
        </StatTile>
      </StatSlot>

      <StatSlot query={investments} span={allTimeSpanClass}>
        <StatTile
          span={allTimeSpan}
          // Named after the list it totals: these are the holdings below. The hero beside it is
          // the plan's figure for the month, which counts the month's "already paid" marks and
          // skips opening balances — so the two are not a part and its whole, and neither may
          // be read as bounding the other.
          label={t('page.investments.allHeading')}
          value={allTimeValue}
          caption={`${t('page.shared.allTime')} · ${allTimeExact}`}
        />
      </StatSlot>

      {emergencyHoldings.length > 0 && (
        <StatTile
          span={3}
          label={t('page.investments.emergencyLabel')}
          value={money(emergencyTotal, currency)}
          // A holding total, not this month's contribution — the Emergency fund tab shows a
          // figure under the same name for the month, so this one has to say which it is.
          caption={`${t('page.shared.allTime')} · ${t('page.investments.emergencyCaption')}`}
          icon={<ShieldAlert className="w-5 h-5" aria-hidden="true" />}
          iconTone="amber"
        />
      )}

      {counted.loading ? (
        <Skeleton variant="row" count={3} className={SPAN_HALF} />
      ) : counted.error && !counted.data ? (
        <ErrorTile message={counted.error} onRetry={counted.refetch} className={SPAN_HALF} />
      ) : (
        <ListTile
          span={6}
          className={counted.refreshing ? 'opacity-60 transition-opacity' : undefined}
          header={<h2 className="text-title text-slate-900">{t('page.investments.countedIn', { month: monthLabel })}</h2>}
          empty={t('page.investments.countedEmpty', { month: monthLabel })}
        >
          {rows.map(p => (
            <ListRow
              key={`${p.marked ? 'mark' : 'row'}-${p.id}`}
              leading={<IconChip tone="teal"><Building2 className="w-4 h-4" aria-hidden="true" /></IconChip>}
              title={p.marked ? t('page.investments.markedTitle') : p.label}
              badges={p.marked && <Badge>{t('page.investments.markedBadge')}</Badge>}
              subtitle={[formatDate(p.date, lang), p.description].filter(Boolean).join(' · ')}
              amount={moneyFull(p.amount, currency)}
            />
          ))}
        </ListTile>
      )}

      {/* Holdings — the CRUD surface, all time. */}
      {investments.loading ? (
        <Skeleton variant="row" count={5} className={SPAN_FULL} />
      ) : investments.error && !investments.data ? (
        <ErrorTile message={investments.error} onRetry={investments.refetch} className={SPAN_FULL} />
      ) : (
        <ListTile
          span={12}
          className={investments.refreshing ? 'opacity-60 transition-opacity' : undefined}
          header={
            <>
              <h2 className="text-title text-slate-900">{t('page.investments.allHeading')}</h2>
              <p className="text-sm text-slate-500 tabular-nums shrink-0">
                {plural(
                  list.length,
                  t('page.investments.investment', { count: list.length }),
                  t('page.investments.investmentsCount', { count: list.length }),
                  lang,
                )}
              </p>
            </>
          }
          empty={t('page.investments.empty')}
        >
          {list.map(i => (
            <ListRow
              key={i.id}
              selected={selectedId === i.id}
              onClick={() => { setSelectedId(selectedId === i.id ? null : i.id); setTxPage(0) }}
              leading={<IconChip tone="teal"><Building2 className="w-4 h-4" aria-hidden="true" /></IconChip>}
              title={i.name}
              badges={
                <>
                  <Badge>{t(INVESTMENT_TYPE_LABEL_KEYS[i.type])}</Badge>
                  {i.openingBalance && (
                    <span title={t('page.investments.openingBadgeTitle')}>
                      <Badge>{t('page.investments.openingBadge')}</Badge>
                    </span>
                  )}
                </>
              }
              subtitle={[
                formatDate(i.purchaseDate, lang),
                i.broker ? `${t('page.investments.brokerCol')}: ${i.broker}` : '',
              ].filter(Boolean).join(' · ')}
              amount={moneyFull(i.investedAmount, i.currency)}
              actions={rowActions(i.id)}
            />
          ))}

          {/* Entered here, counted elsewhere. Grouped rather than hidden — the money is real,
              it just belongs to another bucket, and the header says which. */}
          {emergencyHoldings.length > 0 && (
            <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2">
              <p className="text-label uppercase text-slate-500">
                {t('page.investments.emergencyHoldingsHeading')}
              </p>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                {moneyFull(emergencyTotal, currency)}
              </p>
            </div>
          )}
          {emergencyHoldings.map(i => (
            <ListRow
              key={i.id}
              selected={selectedId === i.id}
              onClick={() => { setSelectedId(selectedId === i.id ? null : i.id); setTxPage(0) }}
              leading={<IconChip tone="amber"><ShieldAlert className="w-4 h-4" aria-hidden="true" /></IconChip>}
              title={i.name}
              subtitle={formatDate(i.purchaseDate, lang)}
              amount={moneyFull(i.investedAmount, i.currency)}
              actions={rowActions(i.id)}
            />
          ))}
        </ListTile>
      )}

      {/* Transaction history for the selected holding. */}
      {selected && (
        txs.loading ? (
          <Skeleton variant="row" count={4} className={SPAN_FULL} />
        ) : txs.error && !txs.data ? (
          <ErrorTile message={txs.error} onRetry={txs.refetch} className={SPAN_FULL} />
        ) : (
          <ListTile
            span={12}
            className={txs.refreshing ? 'opacity-60 transition-opacity' : undefined}
            header={
              <>
                <div className="min-w-0">
                  <h2 className="truncate text-title text-slate-900">
                    {t('page.shared.txPanelTitle', { name: selected.name })}
                  </h2>
                  <p className="text-sm text-slate-500 tabular-nums">
                    {t('page.investments.txPanelSubtitle', {
                      type: t(INVESTMENT_TYPE_LABEL_KEYS[selected.type]),
                      amount: moneyFull(selected.investedAmount, selected.currency),
                    })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={<X className="w-4 h-4" aria-hidden="true" />}
                  label={t('ui.close')}
                  onClick={() => setSelectedId(null)}
                  className="shrink-0"
                />
              </>
            }
            empty={t('page.investments.noTxYet')}
          >
            {(txs.data?.content ?? []).map((tx: Transaction) => (
              <ListRow
                key={tx.id}
                leading={<IconChip><ArrowDownRight className="w-4 h-4" aria-hidden="true" /></IconChip>}
                title={tx.description}
                subtitle={[
                  formatDate(tx.transactionDate, lang),
                  tx.card ? `${tx.card.name} ••${tx.card.lastFourDigits}` : '',
                ].filter(Boolean).join(' · ')}
                amount={`-${moneyFull(tx.amount, tx.currency)}`}
                amountTone="out"
              />
            ))}
            {(txs.data?.totalPages ?? 0) > 1 && (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-xs text-slate-500 tabular-nums">
                  {t('page.pagination.pageOfWithTotal', {
                    page: (txs.data?.page ?? 0) + 1,
                    totalPages: txs.data?.totalPages ?? 0,
                    total: txs.data?.totalElements ?? 0,
                  })}
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" label={t('page.pagination.prev')}
                    disabled={txPage === 0} onClick={() => setTxPage(p => p - 1)} />
                  <Button size="sm" label={t('page.pagination.next')}
                    disabled={txs.data?.last ?? true} onClick={() => setTxPage(p => p + 1)} />
                </div>
              </div>
            )}
          </ListTile>
        )
      )}

      {/* Savings goals — optional, and tracked apart from the monthly plan, so they come last. */}
      {goals.length > 0 && (
        <>
          <GridHeading
            title={t('page.investments.savingsGoalsHeading')}
            hint={t('page.investments.savingsGoalsHint')}
          />
          {goals.map(g => {
            const value = g.currentValue ?? g.investedAmount
            const pct = g.progressPercent != null ? Math.min(100, g.progressPercent) : null
            return (
              <Tile key={g.id} span={4}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 truncate text-title text-slate-900">{g.name}</h3>
                  <OverflowMenu
                    className="-my-2 -mr-2 shrink-0"
                    actions={[
                      {
                        label: t('action.history'),
                        icon: <History className="w-4 h-4" aria-hidden="true" />,
                        onClick: () => {
                          setSelectedId(selectedId === g.id ? null : g.id)
                          setTxPage(0)
                        },
                      },
                      ...rowActions(g.id),
                    ]}
                  />
                </div>

                <p className="mt-3 text-label uppercase text-slate-500">
                  {t('page.investments.savedLabel')}
                </p>
                <p className="mt-1 text-stat tabular-nums text-slate-900">{money(value, g.currency)}</p>
                <p className="mt-1 text-sm tabular-nums text-slate-600">
                  {g.targetAmount != null
                    ? t('page.investments.goalTarget', { target: moneyFull(g.targetAmount, g.currency) })
                    : t('page.investments.goalNoTarget')}
                </p>

                {pct != null && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-income transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-slate-500">
                      {pct >= 100
                        ? t('ui.status.done')
                        : t('page.investments.pctOfGoal', { pct: pct.toFixed(0) })}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="flex-1"
                    icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
                    label={t('page.investments.contribute')}
                    onClick={() => setContributeFor(g)} />
                  <Button size="sm" className="flex-1"
                    icon={<TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />}
                    label={t('page.investments.updateValue')}
                    onClick={() => setValueFor(g)} />
                </div>
              </Tile>
            )
          })}
        </>
      )}
    </>
  )

  const overlays = (
    <>
      <ExplainModal
        open={info} onClose={() => setInfo(false)}
        title={t('cmp.potInfo.investment.title')}
        meaning={t('cmp.potInfo.investment.meaning')}
        formula={t('cmp.potInfo.investment.formula')}
        note={t('cmp.potInfo.investment.note')}
      />

      <Sheet
        open={sheetOpen}
        onClose={closeSheet}
        dirty={dirty}
        title={editId ? t('page.investments.editTitle') : t('page.investments.newTitle')}
        footer={
          <div className="flex gap-3">
            <Button className="flex-1" label={t('action.cancel')} onClick={closeSheet} />
            <Button
              className="flex-1"
              variant="primary"
              type="submit"
              form={FORM_ID}
              loading={saving}
              label={saving ? t('action.saving') : editId ? t('action.update') : t('action.create')}
            />
          </div>
        }
      >
        <form id={FORM_ID} onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="investment-name" label={req(t('page.shared.nameLabel'))} required>
              <input required value={form.name}
                onChange={e => set('name', e.target.value)}
                className={INPUT} placeholder={t('page.investments.namePlaceholder')} />
            </Field>
            <Field id="investment-type" label={t('tx.type')} required>
              <select value={form.type}
                onChange={e => set('type', e.target.value as InvestmentType)}
                className={INPUT}>
                {INVESTMENT_TYPES.map(invType => (
                  <option key={invType} value={invType}>{t(INVESTMENT_TYPE_LABEL_KEYS[invType])}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field id="investment-amount" label={req(t('page.investments.investedAmountLabel'))} required>
            <AmountInput required value={form.investedAmount || 0} currency={form.currency}
              onChange={v => set('investedAmount', v)}
              className={INPUT} suffix={form.currency} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="investment-date" label={req(t('page.investments.purchaseDateLabel'))} required>
              <input required type="date" value={form.purchaseDate}
                onChange={e => set('purchaseDate', e.target.value)}
                className={INPUT} />
            </Field>
            <Field id="investment-broker" label={t('page.investments.brokerLabel')}>
              <input value={form.broker ?? ''}
                onChange={e => set('broker', e.target.value)}
                className={INPUT} />
            </Field>
          </div>

          <Field id="investment-description" label={t('tx.description')}>
            <textarea rows={2} value={form.description ?? ''}
              onChange={e => set('description', e.target.value)}
              className={`${INPUT} resize-none`} />
          </Field>

          {!editId && (
            <Field
              id="investment-source"
              label={req(t('page.investments.fundingSourceLabel'))}
              required
              help={source === 'none'
                ? t('page.investments.fundingNoneHint')
                : t('page.investments.fundingWalletHint')}
            >
              <select value={source} onChange={e => { setDirty(true); setSource(e.target.value) }}
                className={INPUT}>
                <option value="none">{t('page.investments.fundingSourceNone')}</option>
                <option value="cash">{t('tx.cash')}</option>
                {/* Said out loud, because an empty card list and a card list that never arrived
                    look identical here — and picking Cash instead books the contribution against
                    the wrong wallet. */}
                {cards.loading && <option disabled>{t('ui.loading')}</option>}
                {(cards.data ?? []).filter(c => c.currency === form.currency).map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} •••• {c.lastFourDigits} · {moneyFull(c.currentBalance, c.currency)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {!editId && cards.error && (
            <ErrorTile compact message={cards.error} onRetry={cards.refetch} />
          )}

          <label htmlFor="investment-emergency"
            className="flex cursor-pointer items-start gap-3 rounded-control border border-slate-200 p-3">
            <input id="investment-emergency" type="checkbox" checked={form.emergencyFund ?? false}
              onChange={e => {
                setDirty(true)
                setForm(p => ({
                  ...p,
                  emergencyFund: e.target.checked,
                  savingsGoal: e.target.checked ? false : p.savingsGoal,
                }))
              }}
              className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus-ring" />
            <span className="text-sm leading-relaxed text-slate-600">
              {t('page.investments.emergencyCheckboxPre')}{' '}
              <span className="font-semibold text-slate-900">{t('page.investments.emergencyFundBold')}</span>
              {t('page.investments.emergencyCheckboxMid')}{' '}
              <span className="font-semibold text-slate-900">{t('page.investments.emergencyBadge')}</span>{' '}
              {t('page.investments.emergencyCheckboxEnd')}
            </span>
          </label>

          <label htmlFor="investment-goal"
            className="flex cursor-pointer items-start gap-3 rounded-control border border-slate-200 p-3">
            <input id="investment-goal" type="checkbox" checked={form.savingsGoal ?? false}
              onChange={e => {
                setDirty(true)
                setForm(p => ({
                  ...p,
                  savingsGoal: e.target.checked,
                  emergencyFund: e.target.checked ? false : p.emergencyFund,
                }))
              }}
              className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus-ring" />
            <span className="text-sm leading-relaxed text-slate-600">
              {t('page.investments.savingsGoalCheckboxPre')}{' '}
              <span className="font-semibold text-slate-900">{t('page.investments.savingsGoalBold')}</span>{' '}
              {t('page.investments.savingsGoalCheckboxEnd')}
            </span>
          </label>

          {form.savingsGoal && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="investment-target" label={t('page.investments.targetAmountLabel')}>
                <AmountInput value={form.targetAmount ?? 0} currency={form.currency}
                  onChange={v => set('targetAmount', v > 0 ? v : null)}
                  className={INPUT} suffix={form.currency} />
              </Field>
              <Field id="investment-value" label={t('page.investments.currentValueLabel')}>
                <AmountInput value={form.currentValue ?? 0} currency={form.currency}
                  onChange={v => set('currentValue', v > 0 ? v : null)}
                  className={INPUT} suffix={form.currency} />
              </Field>
            </div>
          )}
        </form>
      </Sheet>

      <ContributeInvestmentModal open={!!contributeFor} onClose={() => setContributeFor(null)}
        onSaved={onGoalSaved} investment={contributeFor} />
      <UpdateValueModal open={!!valueFor} onClose={() => setValueFor(null)}
        onSaved={onGoalSaved} investment={valueFor} />
    </>
  )

  // Nested in Plan: no header, no grid — Plan owns both. See `embedded` on Props.
  if (embedded) return <>{tiles}{overlays}</>

  return (
    <div className="space-y-4 xl:space-y-5">
      <PageHeader
        title={t('page.investments')}
        subtitle={t('page.investments.subtitle')}
        info={{ label: t('cmp.cardInfo.button', { title: t('page.investments') }), onClick: () => setInfo(true) }}
        primary={{
          label: t('page.investments.addInvestment'),
          onClick: () => openAdd(false),
          icon: <Plus className="w-4 h-4" aria-hidden="true" />,
        }}
        overflow={[{
          label: t('page.investments.newGoal'),
          icon: <Target className="w-4 h-4" aria-hidden="true" />,
          onClick: () => openAdd(true),
        }]}
      />

      <TileGrid>{tiles}</TileGrid>
      {overlays}
    </div>
  )
}
