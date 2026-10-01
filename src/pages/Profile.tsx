import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { AlertTriangle, Check, CheckCircle2, ChevronDown, CloudOff, Target } from 'lucide-react'
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
import { useLevels } from '../context/LevelsContext'
import { useSettings } from '../context/SettingsContext'
import { LevelDownNotice } from '../components/levels/LevelDownNotice'
import { LEVEL5_PAY, situationName } from '../components/levels/levelWords'
import { LEVEL_SITUATIONS } from '../types/levels'
import type { LevelSituation } from '../types/levels'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import { profileApi } from '../api/profile'
import { formatDate, formatMonth, formatNumber, money, moneyFull, shiftMonth, todayLocal } from '../utils/format'
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
 * Profile: one sentence first — what this month asks to set aside — then the owner's cards in the
 * order they chose: the level ("Level 1", never a sub-level) beside the savings rule, what to set
 * aside beside the month so far, and the working-out last. The working-out is folded closed: it is
 * there for the day the owner wonders where a percentage came from, not for every visit.
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
  // "Change" leads to Savings rules — only on a server that has them. The profile says so itself
  // (`baseLevel`), and so does the shell's one question to /levels.
  const { available } = useLevels()
  const rulesAvailable = available === true || p?.baseLevel !== undefined
  const openRules = rulesAvailable && p?.level != null
    ? () => navigate(`/settings/rules?level=${p.level}`)
    : undefined

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={t('shell.nav.profile')} subtitle={p?.username || username || undefined} />

      {p && !p.missingStableIncome && <Lead p={p} />}

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
              <LevelDownNotice />
              {/* The owner's order: the level beside its savings rule; under the level, what to set
                  aside beside this month so far; the workings last, across the whole width. */}
              <LevelHero p={p} cached={{ isCached: q.isCached, cachedAt: q.cachedAt }} onChangeRule={openRules} />
              <RuleTile p={p} onChange={openRules} />
              {/* An older server sends no "so far" figures — then "set aside" takes the row alone. */}
              <SetAsideTile p={p} full={!hasSoFar} onHome={() => navigate('/')} onSavings={() => navigate('/savings')} />
              {hasSoFar && <SoFarTile p={p} />}
              <LadderTile p={p} onChangeIncome={() => navigate('/settings')} />
            </>
          ) : null}
        </TileGrid>
      </div>
    </div>
  )
}

// ── The level ──────────────────────────────────────────────────────────────────────────────────

function LevelHero({ p, cached, onChangeRule }: {
  p: ProfileResponse
  cached: { isCached: boolean; cachedAt: string | null }
  /** Opens Savings rules on this level; absent on a server without them. */
  onChangeRule?: () => void
}) {
  const { t, lang } = useLang()
  const next = p.nextLevelAt
  const road = p.road ?? null
  const threshold = road?.payThreshold ?? LEVEL5_PAY
  const month = (ym: string) => formatDate(ym, lang, 'monthShort')

  // Level 4 on a server with levels: the road to Level 5 instead of "the next level at …" — the
  // next step is earned by pay, not by the income in Settings.
  const towardFive = p.level === 4 && road != null && road.toward === 5
  // Level 5: since when, and what keeps it.
  const onFive = p.level === 5 && p.level5Since != null

  // The level by name, and one quiet line saying what it rests on. No progress bar: the next level
  // is a fact about the owner's income, not a target to chase, and why the rule is what it is
  // belongs with the rest of the working-out below.
  const line = towardFive
    ? t('lvl.p.road4', { amount: moneyFull(threshold) })
    : onFive
      ? `${t('lvl.p.since', { month: month(p.level5Since!) })}. ${t('lvl.p.stays', {
        amount: moneyFull(threshold), n: p.baseLevel ?? road?.toward ?? 4,
      })}`
      : p.aboveCeiling
        ? t('shell.profile.aboveCeiling')
        : next == null
          ? (p.level != null ? t('shell.profile.topLevel') : null)
          : t('fix.profile.levelLine', { amount: moneyFull(p.leftAfterBills), n: (p.level ?? 0) + 1, next: moneyFull(next) })

  return (
    <Tile span={6} mdSpan={6} as="section">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-label uppercase text-slate-500">{t('shell.profile.levelLabel')}</h2>
        <CacheBadge isCached={cached.isCached} cachedAt={cached.cachedAt} />
      </div>
      <p className="mt-2 text-stat text-slate-900">
        {p.level != null ? t('shell.profile.level', { n: p.level }) : t('shell.profile.noLevel')}
      </p>
      {line && <p className="mt-2 text-sm tabular-nums text-slate-600">{line}</p>}
      {next == null && !p.aboveCeiling && !towardFive && !onFive && (
        <p className="mt-1 text-sm tabular-nums text-slate-600">
          {t('shell.profile.leftAfterBills', { amount: moneyFull(p.leftAfterBills) })}
        </p>
      )}

      {towardFive && <RoadMarks road={road!} thisMonth={p.month} />}

      {onFive && road && road.months.length > 0 && (
        <p className="mt-1 text-sm tabular-nums text-amber-700">
          {t('lvl.p.underSoFar', { n: road.months.length, months: road.months.map(m => month(m.month)).join(', ') })}
        </p>
      )}

      {/* The first Level 5 month: its rule is new, so say where it can be changed. */}
      {onFive && p.level5Since === p.month.slice(0, 7) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-1 text-sm text-slate-700">
          {t('lvl.p.firstMonth', { month: month(p.level5Since!) })}
          {onChangeRule && <LinkButton label={t('lvl.change')} onClick={onChangeRule} />}
        </p>
      )}
    </Tile>
  )
}

/**
 * The run toward Level 5: three marks, filled for each ended month with enough pay, then the month
 * in progress ("so far" — it never counts until it ends), then empty ones. Three columns at every
 * width; each label wraps under its mark.
 */
function RoadMarks({ road, thisMonth }: { road: NonNullable<ProfileResponse['road']>; thisMonth: string }) {
  const { t, lang } = useLang()
  const needed = road.monthsNeeded || 3
  const counted = road.months.slice(-needed)
  const cells: Array<{ key: string; kind: 'done' | 'now' | 'empty'; month?: string; pay?: number }> = [
    ...counted.map(m => ({ key: m.month, kind: 'done' as const, month: m.month, pay: m.pay })),
  ]
  if (cells.length < needed) cells.push({ key: 'now', kind: 'now', month: thisMonth.slice(0, 7), pay: road.thisMonthSoFar })
  while (cells.length < needed) cells.push({ key: `empty-${cells.length}`, kind: 'empty' })

  return (
    <div className="mt-3">
      <p className="sr-only">{t('lvl.p.soFar', { n: counted.length })}</p>
      <ol aria-hidden="true" className="grid grid-cols-3 gap-2">
        {cells.map(c => (
          <li key={c.key} className="min-w-0">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${
              c.kind === 'done' ? 'bg-indigo-600 text-white'
                : c.kind === 'now' ? 'border-2 border-indigo-300 bg-white'
                  : 'border-2 border-slate-200 bg-white'
            }`}>
              {c.kind === 'done' && <Check className="h-3.5 w-3.5" />}
            </span>
            {c.month && (
              <span className="mt-1 block text-xs tabular-nums text-slate-600 [overflow-wrap:anywhere]">
                {formatDate(c.month, lang, 'monthShort')}
                <span className="block text-slate-500">
                  {c.kind === 'now' ? t('lvl.p.monthSoFar', { amount: money(c.pay ?? 0) }) : money(c.pay ?? 0)}
                </span>
              </span>
            )}
          </li>
        ))}
      </ol>
      {counted.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {t('lvl.p.restart', { month: formatDate(thisMonth.slice(0, 7), lang, 'monthShort') })}
        </p>
      )}
    </div>
  )
}

/**
 * The page's first line, as plain text above the cards: what this month asks to set aside, and of
 * what. Everything under it is detail.
 */
function Lead({ p }: { p: ProfileResponse }) {
  const { t } = useLang()
  const carried = known(p.buckets).reduce((sum, b) => sum + Math.max(0, b.carried ?? 0), 0)
  return (
    <p className="mt-3 text-base leading-snug text-slate-900 tabular-nums">
      {p.totalAmount > 0
        ? t('fix.profile.lead', {
          total: moneyFull(p.totalAmount), percent: percentText(p.totalPercent), base: moneyFull(p.savingsBase),
        })
        : t('fix.profile.leadNone')}
      {carried >= 1 && <> {t('fix.profile.leadCarried', { amount: moneyFull(carried) })}</>}
    </p>
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
  // The owner's pay — salary, avans, bonus (the server's `inBase`). Other income, and the
  // borrowed or paid-back money the server already leaves out, are not listed (owner's call).
  const incomeLines = (income?.lines ?? [])
    .filter(l => l.inBase !== false)
    .sort((a, b) => b.amount - a.amount)
  const incomeTotal = incomeLines.reduce((sum, l) => sum + l.amount, 0)
  const allocatedLines = (allocated?.lines ?? [])
    .filter(l => ALLOCATED_ORDER.includes(l.bucket))
    .sort((a, b) => ALLOCATED_ORDER.indexOf(a.bucket) - ALLOCATED_ORDER.indexOf(b.bucket))
  const given = allocatedLines.find(l => l.bucket === 'DONATION')?.amount ?? 0

  return (
    <Tile span={6} mdSpan={6} as="section">
      <TileHead title={t('shell.profile.soFar', { month: formatDate(p.month, lang, 'monthName') })} />

      {income && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-label uppercase text-slate-500">
              {t('fix.profile.payFor', { month: formatDate(p.month, lang, 'monthName') })}
            </h3>
            <p className="shrink-0 text-title tabular-nums text-income">{moneyFull(incomeTotal)}</p>
          </div>
          {incomeLines.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">{t('shell.profile.noIncomeYet')}</p>
          ) : (
            <ul className="mt-1">
              {incomeLines.map((l, i) => (
                <li key={`${l.categoryId ?? 'none'}-${i}`} className="flex items-baseline justify-between gap-3 py-1 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{categoryName({ name: l.name, nameUz: l.nameUz })}</span>
                  <span className="shrink-0 tabular-nums text-slate-900">{moneyFull(l.amount)}</span>
                </li>
              ))}
            </ul>
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
          {/* Set aside is saved and given together; a donation is never called saved. */}
          {given > 0 && (
            <p className="text-right text-xs tabular-nums text-slate-500">
              {t('fix.savedGiven', { saved: moneyFull(Math.max(0, allocated.total - given)), given: moneyFull(given) })}
            </p>
          )}
          <ul className="mt-1 divide-y divide-hairline">
            {allocatedLines.map(l => {
              const icon = l.bucket === 'GOALS'
                ? { icon: <Target className="h-4 w-4" aria-hidden="true" />, tone: 'indigo' as const }
                : SAVINGS_ICON[l.bucket]
              const name = l.bucket === 'GOALS' ? t('home.goals.title') : t(SAVINGS_NAME_KEY[l.bucket])
              // This month's advice plus what earlier months left unpaid — the server's `over` is
              // measured against the same sum.
              const due = (l.target ?? 0) + Math.max(0, l.carried ?? 0)
              const met = due > 0 && l.amount >= due
              return (
                <li key={l.bucket} className="flex items-center gap-3 py-2">
                  <IconChip tone={icon.tone}>{icon.icon}</IconChip>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">{name}</p>
                    {due > 0 && (
                      <p className="text-xs tabular-nums text-slate-500">{t('shell.profile.ofTarget', { amount: moneyFull(due) })}</p>
                    )}
                    {l.over != null && l.over > 0 && (
                      <p className="text-xs tabular-nums text-slate-500">
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

/** The seven situations are the reasons a server with levels sends; anything else is not named. */
const isSituation = (r: ProfileReason | undefined): r is LevelSituation =>
  !!r && (LEVEL_SITUATIONS as readonly string[]).includes(r)

function RuleTile({ p, onChange }: { p: ProfileResponse; onChange?: () => void }) {
  const { t } = useLang()
  const reason = p.rule?.reason
  // Why these percentages (and next month's) is said in "How it is worked out"; here only which
  // situation they are for, in words — and, on a server with levels, where to change them.
  return (
    <Tile span={6} mdSpan={6} as="section">
      <TileHead
        title={t('shell.profile.ruleTitle')}
        action={onChange ? <LinkButton label={t('lvl.change')} onClick={onChange} /> : undefined}
      />
      {/* Only on a server with levels: an older one keeps the tile exactly as it was. */}
      {onChange && p.level != null && isSituation(reason) && (
        <p className="mt-1 text-sm text-slate-600 tabular-nums [overflow-wrap:anywhere]">
          {t('lvl.p.ruleLine', { n: p.level, situation: situationName(t, reason, p.rule?.cutoff) })}
        </p>
      )}
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
    </Tile>
  )
}

/**
 * Why the percentages are what they are this month — and what they become next month when that
 * changes. The first thing inside "How it is worked out".
 */
function RuleReasons({ p }: { p: ProfileResponse }) {
  const { t, lang } = useLang()
  const { settings } = useSettings()
  const cutoff = p.rule?.cutoff ?? null
  // A rules version that started after tracking did: say from when these percentages hold.
  const trackingStart = settings?.allocationTrackingStartMonth?.slice(0, 7) ?? null
  const ruleFrom = p.ruleFrom && trackingStart && p.ruleFrom > trackingStart
    ? t('lvl.p.ruleFrom', { month: formatDate(p.ruleFrom, lang, 'monthShort') })
    : null
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
  // Monthly loan payments under 10% of the income do not lighten the rule — said, so a loan the
  // owner knows they pay is not silently missing from the reason above.
  const smallLoans = (flag: boolean | undefined, limit: number | undefined): string | null =>
    !flag ? null
      : limit != null ? t('shell.profile.smallLoans', { limit: moneyFull(limit) }) : t('shell.profile.smallLoansNoLimit')
  const small = smallLoans(p.rule?.smallMonthlyLoans, p.rule?.monthlyLoanLimit)
  const nextSmall = next ? smallLoans(next.smallMonthlyLoans, next.monthlyLoanLimit ?? p.rule?.monthlyLoanLimit) : null
  if (!why && !small && !next && !ruleFrom) return null

  return (
    <div className="mt-2 border-b border-hairline pb-4">
      {why && <p className="text-sm text-slate-600">{why}</p>}
      {ruleFrom && <p className={`${why ? 'mt-1 ' : ''}text-sm text-slate-600`}>{ruleFrom}</p>}
      {small && <p className={`${why ? 'mt-1 ' : ''}text-xs leading-snug tabular-nums text-slate-500`}>{small}</p>}
      {next && (
        <div className={`${why || small ? 'mt-3 ' : ''}rounded-control bg-slate-50 px-3 py-2.5 text-xs leading-relaxed tabular-nums text-slate-600`}>
          <p>
            {t(nextWhy ? 'shell.profile.fromMonth' : 'shell.profile.fromMonthShort', {
              month: formatMonth(next.month, lang),
              percents: known(next.buckets).map(b => `${percentText(b.percent)}%`).join(' · '),
              reason: nextWhy ?? '',
            })}
          </p>
          {nextSmall && <p className="mt-1 text-slate-500">{nextSmall}</p>}
        </div>
      )}
    </div>
  )
}

// ── How it's worked out ────────────────────────────────────────────────────────────────────────

function LadderTile({ p, onChangeIncome }: { p: ProfileResponse; onChangeIncome: () => void }) {
  const { t, categoryName } = useLang()
  const [open, setOpen] = useState(false)
  const panelId = 'profile-worked-out'
  const parts = p.baseParts
  // The base is the monthly income from Settings plus this month's bonus: recording salary or
  // avans never moves the targets. The server then lists the bonus lines only; when the lines do
  // not add up to the bonus (none sent, or an older server's salary lines), one rung carries it.
  const bonusLines = [...(parts?.lines ?? [])].sort((a, b) => b.amount - a.amount)
  const bonusLinesAddUp = !!parts && bonusLines.length > 0
    && Math.abs(bonusLines.reduce((sum, l) => sum + l.amount, 0) - parts.bonus) < 1
  return (
    // Last on the page and alone in its row, so it takes the full width with the two ladders side
    // by side (stacked on a phone) rather than leaving half a row empty.
    <Tile span={12} as="section">
      {/* Closed until asked for: the whole row is the button. */}
      <h2>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className="focus-ring flex min-h-[44px] w-full items-center justify-between gap-3 rounded-control text-left text-title text-slate-900"
        >
          {t('cmp.cardInfo.howItsBuilt')}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h2>

      {open && (
      <div id={panelId}>
      <RuleReasons p={p} />

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
          {/* The savings base: what the percentages apply to — the monthly income and any bonus. The
              divider only separates the two ladders while they are stacked. */}
          <h3 className="mt-4 border-t border-hairline pt-3 text-label uppercase text-slate-500 md:mt-3 md:border-t-0 md:pt-0">{t('shell.profile.baseLadder')}</h3>
          <dl className="mt-1">
            {parts ? (
              parts.usesStableIncome ? (
                <>
                  <Rung label={t('shell.profile.incomeFromSettings')} amount={parts.stableIncome} />
                  {bonusLinesAddUp
                    ? bonusLines.map((l, i) => (
                      <Rung key={`${l.categoryId ?? 'none'}-${i}`} sign="+"
                        label={categoryName({ name: l.name, nameUz: l.nameUz })} amount={l.amount} />
                    ))
                    : parts.bonus > 0 && <Rung sign="+" label={t('shell.profile.bonus')} amount={parts.bonus} />}
                </>
              ) : (
                // An older server builds the base from the salary, avans and bonus it received.
                bonusLines.map((l, i) => (
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
          {parts?.usesStableIncome && (
            <p className="mt-1 text-xs leading-snug text-slate-500">{t('shell.profile.baseNote')}</p>
          )}
        </div>
      </div>
      <div className="mt-2">
        <LinkButton label={t('shell.profile.changeIncome')} onClick={onChangeIncome} />
      </div>
      </div>
      )}
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
  const { t, lang } = useLang()
  const rows = known(p.buckets)
  const bonus = p.baseParts ? p.baseParts.bonus : p.bonusThisMonth
  // What earlier months left unpaid rides on top of this month's rule — shown per bucket, and in
  // the total. An overpayment never carries, so this is never negative.
  const carriedOf = (b: { carried?: number }) => Math.max(0, b.carried ?? 0)
  const carriedTotal = rows.reduce((sum, b) => sum + carriedOf(b), 0)
  const previousMonth = formatDate(shiftMonth(p.month.slice(0, 7), -1), lang, 'monthName')
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
              {carriedOf(b) >= 1 && (
                <p className="text-xs tabular-nums text-slate-600">
                  {t('shell.profile.carried', { amount: moneyFull(carriedOf(b)), month: previousMonth })}
                </p>
              )}
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{moneyFull(b.amount)}</p>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 pt-2">
          <span className="text-sm font-semibold text-slate-900">{t('page.shared.total')}</span>
          <span className="text-title tabular-nums text-slate-900">{moneyFull(p.totalAmount + carriedTotal)}</span>
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
