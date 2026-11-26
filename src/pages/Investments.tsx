import { Fragment, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ArrowDownToLine, ArrowLeftRight, Check, Landmark, Pencil, PieChart, Plus, Target, Trash2, TrendingUp, Undo2 } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Tile, TileGrid } from '../components/ui/Tile'
import { ActionMenu } from '../components/ui/ActionMenu'
import type { MenuAction } from '../components/ui/ActionMenu'
import { IconChip } from '../components/ui/IconChip'
import { ErrorTile } from '../components/ui/ErrorTile'
import { ExactAmount } from '../components/ui/ExactAmount'
import { Skeleton } from '../components/ui/Skeleton'
import { ContributeInvestmentModal } from '../components/finance/ContributeInvestmentModal'
import { UpdateValueModal } from '../components/finance/UpdateValueModal'
import { WithdrawInvestmentModal } from '../components/finance/WithdrawInvestmentModal'
import { AddInvestmentSheet } from '../components/savings/AddInvestmentSheet'
import { HoldingHistorySheet } from '../components/savings/HoldingHistorySheet'
import { GrowthChip, growthOf } from '../components/savings/growth'
import { MoveInvestmentSheet, investmentIcon } from '../components/investments/MoveInvestmentSheet'
import { InvestmentGoalSheet, groupByProvider } from '../components/investments/InvestmentGoalSheet'
import { SplitSheet } from '../components/investments/SplitSheet'
import { TileHead } from '../components/home/HomeTiles'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import { financeApi } from '../api/finance'
import { extractErrorMessage } from '../api/client'
import { formatDate, formatNumber, money, moneyFull, snap } from '../utils/format'
import type {
  InvestmentGoalResponse, InvestmentResponse, InvestmentSplitResponse, InvestmentTransferResponse, InvestmentType,
} from '../types'

/** A full-width row of the twelve-column page grid. */
const FULL = 'md:col-span-6 xl:col-span-12'
/** Half a row on a wide screen, the whole row on a tablet or phone. */
const HALF = 'md:col-span-6 xl:col-span-6'
const RECENT = 10

/** A block that opens a holding's money in and out: tinted on hover, ringed on focus. */
const OPENS = 'focus-ring -m-1.5 cursor-pointer rounded-control p-1.5 transition-colors hover:bg-slate-50'

const TYPE_KEY: Record<InvestmentType, TKey> = {
  BUSINESS: 'cmp.investmentType.business',
  ISLAMIC_BANK: 'cmp.investmentType.islamicBank',
  REAL_ESTATE: 'cmp.investmentType.realEstate',
  GOLD: 'cmp.investmentType.gold',
  OTHER: 'cmp.investmentType.other',
}

/** A plain investment: not a goal, not the emergency fund, not an own saving (INVEST-SPEC.md §2). */
const isPlain = (i: InvestmentResponse) => !i.savingsGoal && !i.emergencyFund && !i.customSaving

/** What makes a block open something, as on Savings: a click, or Enter / Space on the block itself. */
function opens(onOpen: () => void, label: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: onOpen,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
    },
  }
}

/**
 * Investments: where the owner keeps money safe — a business, an Islamic bank (INVEST-SPEC.md §2).
 * The aim is keeping, not growing, so the page leads with how much is where; growth shows only
 * when a value was typed. Money moves between them like between cards, and a move is neither
 * spending nor income. Goals, the emergency fund and own savings stay on Savings.
 */
export function Investments() {
  const { t, lang } = useLang()
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()

  const investments = useApi(() => financeApi.getInvestments(), [])
  // A server without moves answers 404: the page then simply has no "Recent moves".
  const transfers = useApi(
    () => financeApi.getInvestmentTransfers({ limit: RECENT })
      .catch(() => ({ data: [] as InvestmentTransferResponse[] })),
    [],
  )
  // Likewise a server without investment goals: the page then just has none.
  const goals = useApi(
    () => financeApi.getInvestmentGoals().catch(() => ({ data: [] as InvestmentGoalResponse[] })),
    [],
  )

  // Likewise the month's split (INVEST-SPEC.md §8): without it the page has no split tile.
  const split = useApi(
    () => financeApi.getInvestmentSplit().catch(() => ({ data: null as InvestmentSplitResponse | null })),
    [],
  )

  const [splitOpen, setSplitOpen] = useState(false)
  const [goalForm, setGoalForm] = useState<{ goal: InvestmentGoalResponse | null } | null>(null)
  const [form, setForm] = useState<{ investment: InvestmentResponse | null } | null>(null)
  const [moveFrom, setMoveFrom] = useState<{ fromId: number | null } | null>(null)
  const [contributeFor, setContributeFor] = useState<{ investment: InvestmentResponse; amount?: number } | null>(null)
  const [valueFor, setValueFor] = useState<InvestmentResponse | null>(null)
  const [withdrawFor, setWithdrawFor] = useState<InvestmentResponse | null>(null)
  const [historyFor, setHistoryFor] = useState<InvestmentResponse | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refetchAll = () => { investments.refetch(); transfers.refetch(); goals.refetch(); split.refetch() }
  const savedToast = () => { refetchAll(); showSuccess(t('page.investments.savedToast')) }

  const holdings = (investments.data ?? [])
    .filter(isPlain)
    .sort((a, b) => growthOf(b).value - growthOf(a).value)
  const total = snap(holdings.reduce((sum, i) => sum + growthOf(i).value, 0))
  const putIn = snap(holdings.reduce((sum, i) => sum + growthOf(i).putIn, 0))
  const totalGrowth = { putIn, value: total, growth: snap(total - putIn), percent: putIn > 0 ? Math.round(((total - putIn) / putIn) * 1000) / 10 : null }
  const canMove = holdings.length >= 2
  const recent = transfers.data ?? []
  const goalList = goals.data ?? []
  // Accounts grouped by where they are (IMAN, Open Bank…) — INVEST-SPEC.md §6.
  const groups = groupByProvider(holdings, t('invest.otherProvider'))

  const deleteGoal = async (g: InvestmentGoalResponse) => {
    if (!await confirm({ message: t('invest.goals.confirmDelete'), destructive: true })) return
    setBusy(`goal-${g.id}`)
    try {
      await financeApi.deleteInvestmentGoal(g.id)
      refetchAll()
      showSuccess(t('invest.goals.deletedToast'))
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setBusy(null) }
  }

  const openMove = (fromId: number | null) => setMoveFrom({ fromId })

  const deleteHolding = async (i: InvestmentResponse) => {
    if (!await confirm({ message: t('page.investments.confirmDelete'), destructive: true })) return
    setBusy(`inv-${i.id}`)
    try {
      await financeApi.deleteInvestment(i.id)
      refetchAll()
      showSuccess(t('page.investments.deletedToast'))
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setBusy(null) }
  }

  const undoMove = async (m: InvestmentTransferResponse) => {
    const ok = await confirm({
      message: t('invest.undoConfirm', { amount: moneyFull(m.amount, m.currency), from: m.fromName, to: m.toName }),
      destructive: true,
    })
    if (!ok) return
    setBusy(`move-${m.id}`)
    try {
      await financeApi.deleteInvestmentTransfer(m.id)
      refetchAll()
      showSuccess(t('invest.undoneToast'))
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setBusy(null) }
  }

  const holdingActions = (i: InvestmentResponse): MenuAction[] => [
    { label: t('page.investments.updateValue'), icon: <TrendingUp className="h-4 w-4" aria-hidden="true" />, onClick: () => setValueFor(i) },
    {
      label: t('cmp.withdraw.action'), icon: <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />,
      disabled: growthOf(i).value <= 0, onClick: () => setWithdrawFor(i),
    },
    { label: t('action.edit'), icon: <Pencil className="h-4 w-4" aria-hidden="true" />, onClick: () => setForm({ investment: i }) },
    {
      label: t('action.delete'), icon: <Trash2 className="h-4 w-4" aria-hidden="true" />, danger: true,
      disabled: busy === `inv-${i.id}`, onClick: () => deleteHolding(i),
    },
  ]

  const staleError = [investments, transfers, goals, split].find(q => q.error && q.data)?.error ?? null

  return (
    <div className="p-4 sm:p-6">
      <TileGrid>
        <div className={FULL}>
          <PageHeader
            title={t('invest.title')}
            primary={{ label: t('action.new'), onClick: () => setForm({ investment: null }), icon: <Plus className="h-4 w-4" aria-hidden="true" /> }}
          />
        </div>

        {staleError && <ErrorTile compact className={FULL} message={staleError} onRetry={refetchAll} />}

        {investments.loading ? (
          <>
            <Skeleton variant="stat" className={FULL} />
            <Skeleton variant="row" count={3} className={HALF} />
          </>
        ) : investments.error && !investments.data ? (
          <ErrorTile className={FULL} message={investments.error} onRetry={investments.refetch} />
        ) : holdings.length === 0 ? (
          /* ── Nothing yet ── */
          <Tile span={12} padding="hero" as="section">
            <div className="flex items-start gap-3">
              <IconChip tone="teal"><Landmark className="h-4 w-4" aria-hidden="true" /></IconChip>
              <div className="min-w-0">
                <h2 className="text-title text-slate-900">{t('invest.empty.title')}</h2>
                <p className="mt-1 text-sm text-slate-600">{t('invest.empty.body')}</p>
                <p className="mt-1 text-sm text-slate-500">{t('invest.hint')}</p>
                <Button variant="primary" className="mt-4" label={t('page.investments.addInvestment')}
                  icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setForm({ investment: null })} />
              </div>
            </div>
          </Tile>
        ) : (
          <>
            {/* ── How much, in how many places ── the page's one big number. */}
            <Tile span={12} padding="hero" as="section">
              <h2 className="text-label uppercase text-slate-500">{t('invest.total')}</h2>
              <p className="mt-3 text-hero tabular-nums text-slate-900 whitespace-nowrap">{money(total, 'UZS')}</p>
              <ExactAmount amount={total} currency="UZS" className="mt-0.5" />
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-slate-600">
                <span>{t('invest.putIn', { amount: moneyFull(putIn, 'UZS') })}</span>
                <span aria-hidden="true">·</span>
                <span>{holdings.length === 1 ? t('invest.placesOne') : t('invest.places', { count: holdings.length })}</span>
                <GrowthChip g={totalGrowth} currency="UZS" />
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button label={t('invest.move')} icon={<ArrowLeftRight className="h-4 w-4" aria-hidden="true" />}
                  disabled={!canMove} disabledReason={canMove ? undefined : t('invest.moveNeedsTwo')}
                  onClick={() => openMove(null)} />
                <Button label={t('invest.goals.new')} icon={<Target className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => setGoalForm({ goal: null })} />
              </div>
              {goalList.length === 0 && !goals.loading && (
                <p className="mt-3 text-sm text-slate-600">{t('invest.goals.prompt')}</p>
              )}
              <p className="mt-3 text-xs text-slate-500">{t('invest.hint')}</p>
            </Tile>

            {/* ── This month's split ── which account each part of the month's Investments money goes to. */}
            {split.data && (
              <SplitTile split={split.data} holdings={holdings}
                onEdit={() => setSplitOpen(true)}
                onPutIn={(i, amount) => setContributeFor({ investment: i, amount: amount > 0 ? amount : undefined })} />
            )}

            {/* ── Investment goals ── a target and the accounts saving for it; hidden while there are none. */}
            {goalList.length > 0 && (
              <div className={FULL}>
                <h2 className="text-label uppercase text-slate-500">{t('invest.goals.title')}</h2>
              </div>
            )}
            {goalList.map(g => {
              const pct = g.progressPercent ?? 0
              const titleId = `ig-${g.id}`
              return (
                <Tile key={`goal-${g.id}`} span={6} mdSpan={6} as="section">
                  <div className="flex items-start gap-3">
                    <IconChip tone="indigo"><Target className="h-4 w-4" aria-hidden="true" /></IconChip>
                    <div className="min-w-0 flex-1">
                      <h3 id={titleId} className="truncate text-sm font-semibold text-slate-900">{g.name}</h3>
                      <p className="truncate text-xs tabular-nums text-slate-500">
                        {t('invest.goals.target', { amount: moneyFull(g.targetAmount, g.currency) })}
                      </p>
                    </div>
                    <ActionMenu actions={[
                      { label: t('action.edit'), icon: <Pencil className="h-4 w-4" aria-hidden="true" />, onClick: () => setGoalForm({ goal: g }) },
                      {
                        label: t('action.delete'), icon: <Trash2 className="h-4 w-4" aria-hidden="true" />, danger: true,
                        disabled: busy === `goal-${g.id}`, onClick: () => deleteGoal(g),
                      },
                    ]} />
                  </div>
                  <p className="mt-3 text-stat tabular-nums text-slate-900">{moneyFull(g.saved, g.currency)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar"
                      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct))}
                      aria-labelledby={titleId}>
                      <div className={`h-full rounded-full ${g.reached ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">
                      {t('invest.goals.pct', { pct: formatNumber(pct, Number.isInteger(pct) ? 0 : 1) })}
                    </span>
                  </div>
                  <p className={`mt-1 text-sm tabular-nums ${g.reached ? 'font-semibold text-emerald-700' : 'text-slate-600'}`}>
                    {g.reached ? t('invest.goals.reached') : t('invest.goals.left', { amount: moneyFull(g.left, g.currency) })}
                  </p>
                  {g.investments.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-500">{t('invest.goals.noAccounts')}</p>
                  ) : (
                    <ul className="mt-3 space-y-1 border-t border-hairline pt-2">
                      {g.investments.map(a => (
                        <li key={a.id} className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-slate-600">
                            {[a.broker, a.name].filter(Boolean).join(' · ')}
                          </span>
                          <span className="shrink-0 tabular-nums text-slate-900">{moneyFull(a.value, g.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {g.note && <p className="mt-2 text-xs text-slate-500">{g.note}</p>}
                </Tile>
              )
            })}

            {/* ── One tile per account, grouped by where it is ── */}
            {groups.map(gr => (
              <Fragment key={`group-${gr.key || '—'}`}>
              <div className={`${FULL} flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5`}>
                <h2 className="text-label uppercase text-slate-500">
                  {gr.label}
                  <span className="ml-2 normal-case text-slate-400">
                    {gr.accounts.length === 1 ? t('invest.groupAccountsOne') : t('invest.groupAccounts', { count: gr.accounts.length })}
                  </span>
                </h2>
                <span className="text-sm font-semibold tabular-nums text-slate-700">{moneyFull(gr.total, 'UZS')}</span>
              </div>
            {gr.accounts.map(i => {
              const g = growthOf(i)
              const nameId = `inv-${i.id}`
              const share = total > 0 ? (g.value / total) * 100 : 0
              const sub = [t(TYPE_KEY[i.type] ?? 'cmp.investmentType.other'), i.broker].filter(Boolean).join(' · ')
              return (
                <Tile key={i.id} span={6} mdSpan={6} as="section">
                  <div {...opens(() => setHistoryFor(i), t('shell.holding.open', { name: i.name }))}
                    className={`flex items-start gap-3 ${OPENS}`}>
                    <IconChip tone="teal">{investmentIcon(i.type)}</IconChip>
                    <div className="min-w-0 flex-1">
                      <h3 id={nameId} className="truncate text-sm font-semibold text-slate-900">{i.name}</h3>
                      <p className="truncate text-xs text-slate-500">{sub}</p>
                      {i.investmentGoalName && (
                        <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-chip bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          <Target className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{t('invest.goalChip', { name: i.investmentGoalName })}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-stat tabular-nums text-slate-900">{moneyFull(g.value, i.currency)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs tabular-nums text-slate-500">
                    <span>{t('invest.putIn', { amount: moneyFull(g.putIn, i.currency) })}</span>
                    <GrowthChip g={g} currency={i.currency} />
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, share)}%` }} />
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {t('invest.share', { pct: formatNumber(Math.round(share), 0) })}
                    </span>
                  </div>
                  {i.lastMovedAt && (
                    <p className="mt-1 text-xs text-slate-500">
                      {t('invest.lastMoved', { date: formatDate(i.lastMovedAt, lang, 'dayShort') })}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" label={t('cmp.action.topUp')} aria-describedby={nameId}
                      icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                      onClick={() => setContributeFor({ investment: i })} />
                    <Button size="sm" label={t('invest.move')} aria-describedby={nameId}
                      icon={<ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />}
                      disabled={!canMove || g.value <= 0}
                      disabledReason={!canMove ? t('invest.moveNeedsTwo') : undefined}
                      onClick={() => openMove(i.id)} />
                    <div className="ml-auto">
                      <ActionMenu actions={holdingActions(i)} />
                    </div>
                  </div>
                </Tile>
              )
            })}
              </Fragment>
            ))}

            {/* ── Recent moves ── hidden while there are none. */}
            {recent.length > 0 && (
              <Tile span={12} as="section">
                <TileHead title={t('invest.recent')} />
                <ul className="mt-2 divide-y divide-hairline">
                  {recent.map(m => {
                    const actions: MenuAction[] = m.canUndo ? [{
                      label: t('invest.undo'), icon: <Undo2 className="h-4 w-4" aria-hidden="true" />,
                      disabled: busy === `move-${m.id}`, onClick: () => undoMove(m),
                    }] : []
                    return (
                      <li key={m.id} className="flex min-h-[56px] items-center gap-3 py-2">
                        <IconChip tone="neutral"><ArrowLeftRight className="h-4 w-4" aria-hidden="true" /></IconChip>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {t('invest.recentRow', { from: m.fromName, to: m.toName })}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {[formatDate(m.date, lang, 'dayShort'), m.note].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{moneyFull(m.amount, m.currency)}</p>
                        {actions.length > 0
                          ? <ActionMenu actions={actions} />
                          : <span className="w-11 shrink-0" aria-hidden="true" />}
                      </li>
                    )
                  })}
                </ul>
              </Tile>
            )}
          </>
        )}
      </TileGrid>

      <AddInvestmentSheet
        open={!!form} investment={form?.investment ?? null} defaultType="ISLAMIC_BANK"
        onClose={() => setForm(null)} onSaved={refetchAll}
      />
      <SplitSheet
        open={splitOpen} split={split.data ?? null} accounts={holdings}
        onClose={() => setSplitOpen(false)} onSaved={refetchAll}
      />
      <InvestmentGoalSheet
        open={!!goalForm} goal={goalForm?.goal ?? null} accounts={holdings}
        onClose={() => setGoalForm(null)} onSaved={refetchAll}
      />
      <MoveInvestmentSheet
        open={!!moveFrom} fromId={moveFrom?.fromId ?? null} holdings={holdings}
        onClose={() => setMoveFrom(null)} onSaved={refetchAll}
      />
      <ContributeInvestmentModal
        open={!!contributeFor} investment={contributeFor?.investment ?? null} defaultAmount={contributeFor?.amount}
        onClose={() => setContributeFor(null)} onSaved={savedToast}
      />
      <UpdateValueModal
        open={!!valueFor} investment={valueFor}
        onClose={() => setValueFor(null)} onSaved={savedToast}
        onAddMoney={() => {
          const inv = valueFor
          setValueFor(null)
          if (inv) setTimeout(() => setContributeFor({ investment: inv }), 0)
        }}
      />
      <WithdrawInvestmentModal
        open={!!withdrawFor} investment={withdrawFor}
        onClose={() => setWithdrawFor(null)} onSaved={refetchAll}
      />
      <HoldingHistorySheet investment={historyFor} onClose={() => setHistoryFor(null)} />
    </div>
  )
}

/**
 * This month's split (INVEST-SPEC.md §9): the month's Investments figure, what is put in so far,
 * and each account's part — grouped by provider like the account tiles — with a Put in that starts
 * on what that account still needs this month.
 */
function SplitTile({ split, holdings, onEdit, onPutIn }: {
  split: InvestmentSplitResponse
  holdings: InvestmentResponse[]
  onEdit: () => void
  onPutIn: (i: InvestmentResponse, amount: number) => void
}) {
  const { t } = useLang()
  const rows = new Map(split.rows.map(r => [r.investmentId, r]))
  const groups = groupByProvider(holdings.filter(h => rows.has(h.id)), t('invest.otherProvider'))
  const hasTarget = split.target > 0
  const pct = hasTarget ? Math.min(100, (split.paid / split.target) * 100) : 0
  const titleId = 'invest-split-title'
  return (
    <Tile span={12} as="section">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <IconChip tone="teal"><PieChart className="h-4 w-4" aria-hidden="true" /></IconChip>
          <h2 id={titleId} className="text-title text-slate-900">{t('invest.split.title')}</h2>
          <span className={`rounded-chip px-2 py-0.5 text-xs font-medium ${split.custom ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
            {split.custom ? t('invest.split.custom') : t('invest.split.equalBadge')}
          </span>
        </div>
        <Button size="sm" label={t('invest.split.edit')} icon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={onEdit} />
      </div>

      {hasTarget ? (
        <>
          <p className="mt-3 flex flex-wrap gap-x-2 gap-y-0.5 text-sm tabular-nums text-slate-700">
            <span className="font-semibold text-slate-900">{t('invest.split.target', { amount: moneyFull(split.target, 'UZS') })}</span>
            <span aria-hidden="true">·</span>
            <span>{t('invest.split.paid', { amount: moneyFull(split.paid, 'UZS') })}</span>
            <span aria-hidden="true">·</span>
            <span className={split.left > 0 ? '' : 'font-semibold text-emerald-700'}>
              {split.left > 0 ? t('invest.split.left', { amount: moneyFull(split.left, 'UZS') }) : t('invest.split.done')}
            </span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-labelledby={titleId}>
            <div className={`h-full rounded-full ${split.left > 0 ? 'bg-teal-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
          </div>
          {split.paidOutside > 0 && (
            <p className="mt-1 text-xs tabular-nums text-slate-500">
              {t('invest.split.paidOutside', { amount: moneyFull(split.paidOutside, 'UZS') })}
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{t('invest.split.noTarget')}</p>
      )}

      <div className="mt-3 space-y-3">
        {groups.map(gr => (
          <div key={gr.key || '—'}>
            <p className="truncate text-xs font-semibold uppercase text-slate-500">{gr.label}</p>
            <ul className="divide-y divide-hairline">
              {gr.accounts.map(i => {
                const r = rows.get(i.id)!
                const nameId = `split-row-${i.id}`
                return (
                  <li key={i.id} className="flex min-h-[56px] flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <div className="min-w-0 flex-1">
                      <p id={nameId} className="truncate text-sm font-medium text-slate-900">
                        {i.name}
                        <span className="ml-2 text-xs font-normal tabular-nums text-slate-500">
                          {t('invest.split.pct', { pct: formatNumber(r.percent, Number.isInteger(r.percent) ? 0 : 1) })}
                        </span>
                      </p>
                      {hasTarget && (
                        <p className="truncate text-xs tabular-nums text-slate-500">
                          {t('invest.split.rowPaid', { amount: moneyFull(r.paid, 'UZS') })}
                          {' · '}
                          {r.left > 0
                            ? <span>{t('invest.split.left', { amount: moneyFull(r.left, 'UZS') })}</span>
                            : <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700">
                                <Check className="h-3 w-3" aria-hidden="true" />{t('invest.split.rowDone')}
                              </span>}
                        </p>
                      )}
                    </div>
                    {hasTarget && (
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{moneyFull(r.amount, 'UZS')}</p>
                    )}
                    {hasTarget && r.left > 0 && (
                      <Button size="sm" label={t('cmp.action.topUp')} aria-describedby={nameId}
                        icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                        onClick={() => onPutIn(i, r.left)} />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </Tile>
  )
}
