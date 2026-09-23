import { useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { AlertTriangle, CheckCircle2, CloudOff, Target } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Tile, TileGrid } from '../components/ui/Tile'
import { Button } from '../components/ui/Button'
import { CacheBadge } from '../components/ui/CacheBadge'
import { ErrorTile } from '../components/ui/ErrorTile'
import { IconChip } from '../components/ui/IconChip'
import { Skeleton } from '../components/ui/Skeleton'
import { LinkButton, TileHead } from '../components/home/HomeTiles'
import { SAVINGS_ICON, SAVINGS_NAME_KEY } from '../components/savings/SavingsThisMonth'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import { profileApi } from '../api/profile'
import { formatDate, formatMonth, formatNumber, moneyFull, todayLocal } from '../utils/format'
import type { Bucket } from '../types'
import type { ProfileAllocatedLine, ProfileReason, ProfileResponse } from '../types/profile'

const FULL = 'md:col-span-6 xl:col-span-12'
const HALF = 'md:col-span-6 xl:col-span-6'

/** Why the percentages are what they are: one plain sentence per reason the server gives. */
const REASON_KEY: Record<ProfileReason, TKey> = {
  NO_DEBT: 'shell.profile.reason.noDebt',
  BANK_LOAN_COMFORTABLE: 'shell.profile.reason.bankComfortable',
  BANK_LOAN_TIGHT: 'shell.profile.reason.bankTight',
  DEBTS_COMFORTABLE: 'shell.profile.reason.debtsComfortable',
  DEBTS_TIGHT: 'shell.profile.reason.debtsTight',
  BANK_AND_DEBTS: 'shell.profile.reason.bankAndDebts',
  HEAVY_DEBT: 'shell.profile.reason.heavyDebt',
  CUSTOM: 'shell.profile.reason.custom',
  NO_RULE: 'shell.profile.reason.noRule',
}
/** The reasons whose sentence names the cutoff. */
const NAMES_CUTOFF = new Set<ProfileReason>(['BANK_LOAN_COMFORTABLE', 'BANK_LOAN_TIGHT', 'DEBTS_COMFORTABLE', 'DEBTS_TIGHT'])

/** "5", "2,5" — a percent written the way the app writes numbers. */
const percentText = (p: number) => (Number.isInteger(p) ? String(p) : formatNumber(p, 1))

/** Only the three this page knows how to name; a newer server's extra row is left out. */
const known = <T extends { bucket: Bucket }>(rows: T[] | null | undefined): T[] =>
  (rows ?? []).filter(r => r.bucket in SAVINGS_NAME_KEY)

type ProfileResult = { kind: 'ok'; profile: ProfileResponse } | { kind: 'outdated' }

/**
 * Profile: the owner's level — "Level 1", never a sub-level — how much the savings rule asks this
 * month, and every number it is worked out from, so the percentages are never a mystery.
 */
export function Profile() {
  const { t } = useLang()
  const { username } = useAuth()
  const navigate = useNavigate()
  const today = todayLocal()

  // A server from before this page has no /profile. That is a 404, and it gets its own sentence.
  const q = useApi<ProfileResult>(async () => {
    try {
      const res = await profileApi.get(today)
      // Spread first: an offline answer carries its isCached / cachedAt flags on the response.
      return { ...res, data: { kind: 'ok' as const, profile: res.data } }
    } catch (err) {
      if ((err as AxiosError)?.response?.status === 404) return { data: { kind: 'outdated' as const } }
      throw err
    }
  }, [today])

  const result = q.data
  const p = result?.kind === 'ok' ? result.profile : null
  const hasSoFar = !!(p?.incomeThisMonth || p?.allocatedThisMonth)

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={t('shell.nav.profile')} subtitle={p?.username || username || undefined} />

      <div className="mt-4 xl:mt-5">
        <TileGrid className={q.refreshing ? 'opacity-60 transition-opacity' : ''}>
          {q.loading ? (
            <>
              <Skeleton variant="stat" className={HALF} />
              <Skeleton variant="row" count={4} className={HALF} />
              <Skeleton variant="row" count={6} className={HALF} />
              <Skeleton variant="row" count={4} className={HALF} />
            </>
          ) : q.error && !result ? (
            <ErrorTile className={FULL} message={q.error} onRetry={q.refetch} />
          ) : result?.kind === 'outdated' ? (
            <Tile span={12} as="section">
              <div className="flex items-start gap-3">
                <IconChip tone="neutral"><CloudOff className="h-4 w-4" aria-hidden="true" /></IconChip>
                <p className="min-w-0 pt-1.5 text-sm text-slate-700">{t('shell.profile.outdated')}</p>
              </div>
            </Tile>
          ) : p?.missingStableIncome ? (
            <Tile span={12} as="section">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <IconChip tone="amber"><AlertTriangle className="h-4 w-4" aria-hidden="true" /></IconChip>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{t('income.requiredTitle')}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{t('shell.profile.incomeUnset')}</p>
                  </div>
                </div>
                <Button variant="primary" label={t('page.advisor.btn.setIncome')}
                  onClick={() => navigate('/settings')} className="shrink-0 sm:ml-auto" />
              </div>
            </Tile>
          ) : p ? (
            <>
              {q.error && <ErrorTile compact className={FULL} message={q.error} onRetry={q.refetch} />}
              {/* The owner's order: the level beside its savings rule; under the level, this month
                  so far beside what to set aside; the workings last, across the whole width. */}
              <LevelHero p={p} cached={{ isCached: q.isCached, cachedAt: q.cachedAt }} />
              <RuleTile p={p} />
              {/* An older server sends neither figure — then "set aside" takes the row alone. */}
              {hasSoFar && <SoFarTile p={p} />}
              <SetAsideTile p={p} full={!hasSoFar} onHome={() => navigate('/')} onSavings={() => navigate('/savings')} />
              <LadderTile p={p} onChangeIncome={() => navigate('/settings')} />
            </>
          ) : null}
        </TileGrid>
      </div>
    </div>
  )
}

// ── The level ──────────────────────────────────────────────────────────────────────────────────

function LevelHero({ p, cached }: { p: ProfileResponse; cached: { isCached: boolean; cachedAt: string | null } }) {
  const { t } = useLang()
  const from = p.levelFrom ?? 0
  const next = p.nextLevelAt
  const pct = next != null && next > from
    ? Math.min(100, Math.max(0, ((p.leftAfterBills - from) / (next - from)) * 100))
    : null

  return (
    <Tile span={6} mdSpan={6} padding="hero" as="section">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-label uppercase text-slate-500">{t('shell.profile.levelLabel')}</h2>
        <CacheBadge isCached={cached.isCached} cachedAt={cached.cachedAt} />
      </div>
      <p className="mt-3 text-hero text-slate-900">
        {p.level != null ? t('shell.profile.level', { n: p.level }) : t('shell.profile.noLevel')}
      </p>
      <p className="mt-2 text-sm tabular-nums text-slate-600">
        {t('shell.profile.leftAfterBills', { amount: moneyFull(p.leftAfterBills) })}
      </p>
      {p.aboveCeiling ? (
        <p className="mt-4 text-sm font-medium text-slate-700">{t('shell.profile.aboveCeiling')}</p>
      ) : next == null ? (
        p.level != null && <p className="mt-4 text-sm font-medium text-slate-700">{t('shell.profile.topLevel')}</p>
      ) : (
        <div className="mt-4">
          {/* Drawn only; the sentence under it says the same thing in words. */}
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct ?? 0}%` }} />
          </div>
          <p className="mt-2 text-xs tabular-nums text-slate-500">
            {t('shell.profile.nextLevel', { n: (p.level ?? 0) + 1, amount: moneyFull(next) })}
          </p>
        </div>
      )}
    </Tile>
  )
}

// ── This month so far ──────────────────────────────────────────────────────────────────────────

/** The order the savings rows always come in; goals, when there are any, last. */
const ALLOCATED_ORDER: ProfileAllocatedLine['bucket'][] = ['DONATION', 'EMERGENCY', 'INVESTMENTS', 'GOALS']

/** "10,9%" — one decimal, or a dash while there is nothing to measure against yet. */
const share = (p: number | null | undefined) => (p == null ? '—' : `${formatNumber(p, 1)}%`)

function SoFarTile({ p }: { p: ProfileResponse }) {
  const { t, lang, categoryName } = useLang()
  const income = p.incomeThisMonth
  const allocated = p.allocatedThisMonth
  const incomeLines = [...(income?.lines ?? [])].sort((a, b) => b.amount - a.amount)
  const notCounted = income ? [
    income.excludedBorrowed > 0 ? t('shell.profile.notCountedBorrowed', { amount: moneyFull(income.excludedBorrowed) }) : null,
    income.excludedReturned > 0 ? t('shell.profile.notCountedReturned', { amount: moneyFull(income.excludedReturned) }) : null,
  ].filter(Boolean).join(' · ') : ''
  const allocatedLines = (allocated?.lines ?? [])
    .filter(l => ALLOCATED_ORDER.includes(l.bucket))
    .sort((a, b) => ALLOCATED_ORDER.indexOf(a.bucket) - ALLOCATED_ORDER.indexOf(b.bucket))

  return (
    <Tile span={6} mdSpan={6} as="section">
      <TileHead title={t('shell.profile.soFar', { month: formatDate(p.month, lang, 'monthName') })} />

      {income && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-label uppercase text-slate-500">{t('shell.profile.incomeThisMonth')}</h3>
            <p className="shrink-0 text-title tabular-nums text-income">{moneyFull(income.total)}</p>
          </div>
          {incomeLines.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">{t('shell.profile.noIncomeYet')}</p>
          ) : (
            <ul className="mt-1">
              {incomeLines.map((l, i) => (
                <li key={`${l.categoryId ?? 'none'}-${i}`} className="flex items-baseline justify-between gap-3 py-1 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-slate-700">{categoryName({ name: l.name, nameUz: l.nameUz })}</span>
                    {l.inBase === false && <span className="block text-xs text-slate-500">{t('shell.profile.notInBase')}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-900">{moneyFull(l.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {notCounted && (
            <p className="mt-1 text-xs tabular-nums text-slate-500">{t('shell.profile.notCounted', { parts: notCounted })}</p>
          )}
        </div>
      )}

      {allocated && (
        <div className={income ? 'mt-4 border-t border-hairline pt-3' : 'mt-3'}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-label uppercase text-slate-500">{t('shell.profile.setAsideSoFar')}</h3>
            <p className="shrink-0 text-title tabular-nums text-slate-900">{moneyFull(allocated.total)}</p>
          </div>
          <p className="text-right text-xs tabular-nums text-slate-500">
            {/* Measured against what the percentages apply to; an older server only knows income. */}
            {allocated.percentOfBase !== undefined
              ? allocated.percentOfBase == null
                ? '—'
                : `= ${t('shell.profile.ofBase', { percent: formatNumber(allocated.percentOfBase, 1) })}`
              : allocated.percentOfIncome == null
                ? '—'
                : t('shell.profile.ofIncome', { percent: formatNumber(allocated.percentOfIncome, 1) })}
          </p>
          <ul className="mt-1 divide-y divide-hairline">
            {allocatedLines.map(l => {
              const icon = l.bucket === 'GOALS'
                ? { icon: <Target className="h-4 w-4" aria-hidden="true" />, tone: 'indigo' as const }
                : SAVINGS_ICON[l.bucket]
              const name = l.bucket === 'GOALS' ? t('home.goals.title') : t(SAVINGS_NAME_KEY[l.bucket])
              const met = l.target != null && l.target > 0 && l.amount >= l.target
              return (
                <li key={l.bucket} className="flex items-center gap-3 py-2">
                  <IconChip tone={icon.tone}>{icon.icon}</IconChip>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">{name}</p>
                    {l.target != null && l.target > 0 && (
                      <p className="text-xs tabular-nums text-slate-500">{t('shell.profile.ofTarget', { amount: moneyFull(l.target) })}</p>
                    )}
                    {l.over != null && l.over > 0 && (
                      <p className="text-xs font-medium tabular-nums text-amber-700">
                        {t('shell.profile.overAdvice', { amount: moneyFull(l.over) })}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="flex items-center justify-end gap-1 text-sm font-semibold tabular-nums text-slate-900">
                      {moneyFull(l.amount)}
                      {met && (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-income" aria-hidden="true" />
                          <span className="sr-only">{t('ui.status.done')}</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs tabular-nums text-slate-500">
                      {share(l.percentOfBase !== undefined ? l.percentOfBase : l.percentOfIncome)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Tile>
  )
}

// ── The rule ───────────────────────────────────────────────────────────────────────────────────

function RuleTile({ p }: { p: ProfileResponse }) {
  const { t, lang } = useLang()
  const cutoff = p.rule?.cutoff ?? null
  const reasonText = (reason: ProfileReason | undefined): string | null => {
    const key = reason ? REASON_KEY[reason] : undefined
    if (!key) return null
    // A sentence that names the cutoff is left unsaid rather than said with a hole in it.
    if (NAMES_CUTOFF.has(reason!) && cutoff == null) return null
    return t(key, { cutoff: cutoff != null ? moneyFull(cutoff) : '' })
  }
  const why = reasonText(p.rule?.reason)
  const next = p.nextMonth
  const nextWhy = next ? reasonText(next.reason) : null

  return (
    <Tile span={6} mdSpan={6} as="section">
      <TileHead title={t('shell.profile.ruleTitle')} />
      <ul className="mt-2 divide-y divide-hairline">
        {known(p.buckets).map(b => (
          <li key={b.bucket} className="flex min-h-[48px] items-center gap-3 py-2">
            <IconChip tone={SAVINGS_ICON[b.bucket].tone}>{SAVINGS_ICON[b.bucket].icon}</IconChip>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{t(SAVINGS_NAME_KEY[b.bucket])}</span>
            <span className={`shrink-0 text-sm tabular-nums ${b.percent > 0 ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
              {b.percent > 0 ? `${percentText(b.percent)}%` : t('shell.profile.notThisMonth')}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 pt-2">
          <span className="text-sm font-semibold text-slate-900">{t('page.shared.total')}</span>
          <span className="text-sm font-semibold tabular-nums text-slate-900">{percentText(p.totalPercent)}%</span>
        </li>
      </ul>
      {why && <p className="mt-3 text-sm text-slate-600">{why}</p>}
      {next && (
        <p className="mt-3 rounded-control bg-slate-50 px-3 py-2.5 text-xs leading-relaxed tabular-nums text-slate-600">
          {t(nextWhy ? 'shell.profile.fromMonth' : 'shell.profile.fromMonthShort', {
            month: formatMonth(next.month, lang),
            percents: known(next.buckets).map(b => `${percentText(b.percent)}%`).join(' · '),
            reason: nextWhy ?? '',
          })}
        </p>
      )}
    </Tile>
  )
}

// ── How it's worked out ────────────────────────────────────────────────────────────────────────

function LadderTile({ p, onChangeIncome }: { p: ProfileResponse; onChangeIncome: () => void }) {
  const { t, categoryName } = useLang()
  const parts = p.baseParts
  return (
    // Last on the page and alone in its row, so it takes the full width with the two ladders side
    // by side (stacked on a phone) rather than leaving half a row empty.
    <Tile span={12} as="section">
      <TileHead
        title={t('cmp.cardInfo.howItsBuilt')}
        action={<LinkButton label={t('shell.profile.changeIncome')} onClick={onChangeIncome} />}
      />

      <div className="grid gap-x-8 md:grid-cols-2">
        <div>
          {/* The level: what is left after bills decides it — and which percentages apply. */}
          <h3 className="mt-3 text-label uppercase text-slate-500">{t('shell.profile.levelLabel')}</h3>
          <dl className="mt-1">
            <Rung label={t('shell.settings.income')} amount={p.stableIncome ?? 0} />
            <Rung sign="−" label={t('shell.bills.title')} amount={p.monthlyBills} />
            <Rung sign="=" strong label={t('shell.profile.afterBills')} amount={p.leftAfterBills} />
          </dl>
          {p.level != null && (
            <p className="mt-1 text-sm font-medium tabular-nums text-indigo-700">
              <span aria-hidden="true">→ </span>
              {p.nextLevelAt != null && !p.aboveCeiling
                ? t('shell.profile.levelResultNext', { n: p.level, next: p.level + 1, amount: moneyFull(p.nextLevelAt) })
                : t('shell.profile.level', { n: p.level })}
            </p>
          )}
        </div>

        <div>
          {/* The savings base: what the percentages apply to — salary, avans and bonus. The divider
              only separates the two ladders while they are stacked. */}
          <h3 className="mt-4 border-t border-hairline pt-3 text-label uppercase text-slate-500 md:mt-3 md:border-t-0 md:pt-0">{t('shell.profile.baseLadder')}</h3>
          <dl className="mt-1">
            {parts ? (
              parts.usesStableIncome ? (
                // Before the salary lands, the income in Settings stands in for it; a bonus still adds.
                <>
                  <Rung label={t('shell.profile.incomeUntilSalary')} amount={parts.stableIncome} />
                  {parts.bonus > 0 && <Rung sign="+" label={t('shell.profile.bonus')} amount={parts.bonus} />}
                </>
              ) : (
                [...(parts.lines ?? [])].sort((a, b) => b.amount - a.amount).map((l, i) => (
                  <Rung key={`${l.categoryId ?? 'none'}-${i}`} sign={i === 0 ? undefined : '+'}
                    label={categoryName({ name: l.name, nameUz: l.nameUz })} amount={l.amount} />
                ))
              )
            ) : (
              // An older server still builds the base from what is left after bills and loans.
              <>
                <Rung label={t('shell.profile.afterBills')} amount={p.leftAfterBills} />
                <Rung sign="−" label={t('shell.profile.loanPayments')} amount={p.loanPayments} />
                <Rung sign="=" strong label={t('shell.profile.forSavings')} amount={p.leftForSavings} />
                {p.bonusThisMonth > 0 && <Rung sign="+" label={t('shell.profile.bonus')} amount={p.bonusThisMonth} />}
              </>
            )}
            <Rung sign="=" strong label={t('shell.profile.base')} amount={p.savingsBase} />
          </dl>
        </div>
      </div>
    </Tile>
  )
}

/** One step of a ladder: the sign, what it is, the figure. */
function Rung({ sign, label, amount, strong = false }: {
  sign?: '−' | '+' | '='
  label: string
  amount: number
  strong?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 text-sm ${
      strong ? 'border-t border-hairline font-semibold text-slate-900' : 'text-slate-600'
    }`}>
      <dt className="min-w-0">
        <span className="inline-block w-4 text-slate-400">{sign ?? ''}</span>
        {label}
      </dt>
      <dd className="shrink-0 tabular-nums">{moneyFull(amount)}</dd>
    </div>
  )
}

// ── To set aside ───────────────────────────────────────────────────────────────────────────────

function SetAsideTile({ p, full = false, onHome, onSavings }: {
  p: ProfileResponse
  /** Across the whole row, for when "so far" is not there to sit beside it. */
  full?: boolean
  onHome: () => void
  onSavings: () => void
}) {
  const { t } = useLang()
  const rows = known(p.buckets)
  const bonus = p.baseParts ? p.baseParts.bonus : p.bonusThisMonth
  return (
    <Tile span={full ? 12 : 6} mdSpan={6} as="section">
      <TileHead title={t('shell.profile.setAsideTitle')} />
      <ul className="mt-2 divide-y divide-hairline">
        {rows.map(b => (
          <li key={b.bucket} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{t(SAVINGS_NAME_KEY[b.bucket])}</p>
              <p className="text-xs tabular-nums text-slate-500">
                {b.percent > 0
                  ? t('shell.profile.percentOf', { percent: percentText(b.percent), base: moneyFull(p.savingsBase) })
                  : t('shell.profile.notThisMonth')}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{moneyFull(b.amount)}</p>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 pt-2">
          <span className="text-sm font-semibold text-slate-900">{t('page.shared.total')}</span>
          <span className="text-title tabular-nums text-slate-900">{moneyFull(p.totalAmount)}</span>
        </li>
      </ul>
      {/* A bonus month asks for more; the usual month is what to expect after it. */}
      {bonus > 0 && (
        <div className="mt-3 rounded-control bg-slate-50 px-3 py-2.5 tabular-nums">
          <p className="text-sm text-slate-700">{t('shell.profile.withoutBonus', { amount: moneyFull(p.normalMonthTotal) })}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {rows.map(b => `${t(SAVINGS_NAME_KEY[b.bucket])} ${moneyFull(b.normalMonthAmount)}`).join(' · ')}
          </p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-5">
        <LinkButton label={t('shell.profile.payOnHome')} onClick={onHome} />
        <LinkButton label={t('home.savings.open')} onClick={onSavings} />
      </div>
    </Tile>
  )
}
