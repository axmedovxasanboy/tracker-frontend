import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { AlertTriangle, CloudOff } from 'lucide-react'
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
import { formatMonth, formatNumber, moneyFull, todayLocal } from '../utils/format'
import type { Bucket } from '../types'
import type { ProfileReason, ProfileResponse } from '../types/profile'

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
              <LevelHero p={p} cached={{ isCached: q.isCached, cachedAt: q.cachedAt }} />
              <RuleTile p={p} />
              <LadderTile p={p} onChangeIncome={() => navigate('/settings')} />
              <SetAsideTile p={p} onHome={() => navigate('/')} onSavings={() => navigate('/savings')} />
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
  const { t } = useLang()
  return (
    <Tile span={6} mdSpan={6} as="section">
      <TileHead
        title={t('cmp.cardInfo.howItsBuilt')}
        action={<LinkButton label={t('shell.profile.changeIncome')} onClick={onChangeIncome} />}
      />
      <dl className="mt-2">
        <Rung label={t('shell.settings.income')} amount={p.stableIncome ?? 0} />
        <Rung sign="−" label={t('shell.bills.title')} amount={p.monthlyBills} />
        <Rung sign="=" strong label={t('shell.profile.afterBills')} amount={p.leftAfterBills}
          note={t('shell.profile.setsLevel')} />
        <Rung sign="−" label={t('shell.profile.loanPayments')} amount={p.loanPayments} />
        <Rung sign="=" strong label={t('shell.profile.forSavings')} amount={p.leftForSavings} />
        {p.bonusThisMonth > 0 && <Rung sign="+" label={t('shell.profile.bonus')} amount={p.bonusThisMonth} />}
        <Rung sign="=" strong label={t('shell.profile.base')} amount={p.savingsBase} />
      </dl>
    </Tile>
  )
}

/** One step of the ladder: the sign, what it is, the figure. */
function Rung({ sign, label, amount, strong = false, note }: {
  sign?: '−' | '+' | '='
  label: string
  amount: number
  strong?: boolean
  note?: ReactNode
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 text-sm ${
      strong ? 'border-t border-hairline font-semibold text-slate-900' : 'text-slate-600'
    }`}>
      <dt className="min-w-0">
        <span className="inline-block w-4 text-slate-400">{sign ?? ''}</span>
        {label}
        {note && (
          <span className="ml-2 inline-block rounded-chip bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
            {note}
          </span>
        )}
      </dt>
      <dd className="shrink-0 tabular-nums">{moneyFull(amount)}</dd>
    </div>
  )
}

// ── To set aside ───────────────────────────────────────────────────────────────────────────────

function SetAsideTile({ p, onHome, onSavings }: { p: ProfileResponse; onHome: () => void; onSavings: () => void }) {
  const { t } = useLang()
  const rows = known(p.buckets)
  return (
    <Tile span={6} mdSpan={6} as="section">
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
      {p.bonusThisMonth > 0 && (
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
