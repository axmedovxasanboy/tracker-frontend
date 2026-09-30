import { useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowDown, CheckCircle2, ChevronDown, ChevronUp, Target, Wallet } from 'lucide-react'
import { Tile } from '../ui/Tile'
import { Button } from '../ui/Button'
import { CacheBadge } from '../ui/CacheBadge'
import { useLang } from '../../i18n/LanguageContext'
import { formatDate, money, moneyFull, plural } from '../../utils/format'
import type { AdvisorDaily, AdvisorResponse, Currency } from '../../types'

/**
 * Home's one big number: how much the owner can spend each day until the money runs short, after
 * the bills, the loan payments and the savings this stretch still asks for.
 *
 * Four shapes, one tile:
 * - the daily figure, with the recent pace beside it and the arithmetic one tap away;
 * - amber, when the figure is fine on paper but the owner's own pace runs the money out before
 *   the stretch ends: then the DATE is the headline, the reason is one sentence, and the daily
 *   figure is what it would take. A big calm number over a small warning read as "all is well"
 *   when it was not — the server now says which it is (`daily.verdict`), and without that field
 *   (an older server) the tile is exactly the one it was;
 * - red, when even spending nothing leaves the owner short on some date;
 * - "You have" — the wallet total — while there is no daily figure (no monthly income set yet,
 *   or a backend that does not send one).
 */
export function SpendHero({ d, currency, cached, onSeeDue, onReviewPlans, fallback }: {
  d: AdvisorResponse
  currency: Currency
  cached: { isCached: boolean; cachedAt: string | null }
  /** Bring "Coming up" into view — the answer to "short on what?". */
  onSeeDue: () => void
  /** Open Savings, where a plan can be made a wish or given a smaller payment. */
  onReviewPlans: () => void
  /** Rendered when there is no daily figure: the wallet total and its check. */
  fallback: ReactNode
}) {
  const { t, lang } = useLang()
  const daily = d.daily ?? null

  if (!daily) return <>{fallback}</>

  const badge = <CacheBadge isCached={cached.isCached} cachedAt={cached.cachedAt} />

  if (daily.shortBy) {
    return (
      <Tile span={12} padding="hero" as="section">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-label uppercase text-expense">{t('home.hero.shortLabel')}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {badge}
            <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-rose-50 text-expense" aria-hidden="true">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
        </div>
        <p className="mt-3 text-hero tabular-nums text-expense whitespace-nowrap">{money(daily.shortBy.amount, currency)}</p>
        <p className="mt-2 text-sm text-slate-700">
          {t('home.hero.shortOn', { date: formatDate(daily.shortBy.date, lang, 'dayShort') })}
        </p>
        <div className="mt-4">
          <Button
            label={t('home.hero.seeDue')}
            icon={<ArrowDown className="h-4 w-4" aria-hidden="true" />}
            onClick={onSeeDue}
          />
        </div>
        {daily.breakdown && <HowItWorks daily={daily} currency={currency} />}
      </Tile>
    )
  }

  const pace = daily.paceDaily

  // The pace cannot be kept. Only on the server's word, and only with the date it turns on.
  if (daily.verdict === 'OVER_PACE' && daily.runsOutOn) {
    const b = daily.breakdown
    const until = formatDate(daily.until, lang, 'dayShort')
    // Each sentence needs its own figures; with one missing, the plain fact is still true.
    const why = daily.cause === 'GOALS' && b?.goals != null && (daily.safePerDayNoGoals ?? 0) > 0
      ? t('fix.hero.causeGoals', { goals: money(b.goals, currency), until, safe: money(daily.safePerDayNoGoals ?? 0, currency) })
      : daily.cause === 'SAVINGS' && b && (daily.safePerDayNoSavings ?? 0) > 0
        ? t('fix.hero.causeSavings', { savings: money(b.savings, currency), until, safe: money(daily.safePerDayNoSavings ?? 0, currency) })
        : pace == null ? null
          : daily.cause === 'PACE' && (daily.safePerDayNoSavings ?? 0) > 0
            ? t('fix.hero.causePace', { pace: money(pace, currency), safe: money(daily.safePerDayNoSavings ?? 0, currency) })
            : t('fix.hero.paceOnly', { pace: money(pace, currency) })
    // Plans are worth reviewing when they, or what is set aside, are what takes the room.
    const plansFirst = daily.cause === 'GOALS' || daily.cause === 'SAVINGS'
    return (
      <Tile span={12} padding="hero" as="section">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-label uppercase text-amber-700">{t('fix.hero.overLabel')}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {badge}
            <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-amber-50 text-amber-700" aria-hidden="true">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
        </div>
        <p className="mt-3 text-hero tabular-nums text-slate-900">
          {formatDate(daily.runsOutOn, lang, 'dayShort')}
        </p>
        {why && <p className="mt-2 text-sm text-slate-700">{why}</p>}
        <p className="mt-1 text-sm font-medium tabular-nums text-slate-900">
          {t('fix.hero.toReach', { until, safe: money(daily.safePerDay, currency) })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {plansFirst && (
            <Button
              label={t('fix.hero.reviewPlans')}
              icon={<Target className="h-4 w-4" aria-hidden="true" />}
              onClick={onReviewPlans}
            />
          )}
          <Button
            variant={plansFirst ? 'ghost' : 'secondary'}
            label={t('home.hero.seeDue')}
            icon={<ArrowDown className="h-4 w-4" aria-hidden="true" />}
            onClick={onSeeDue}
          />
          {!plansFirst && (
            <Button
              variant="ghost"
              label={t('fix.hero.reviewPlans')}
              icon={<Target className="h-4 w-4" aria-hidden="true" />}
              onClick={onReviewPlans}
            />
          )}
        </div>
        {b && <HowItWorks daily={daily} currency={currency} />}
      </Tile>
    )
  }

  return (
    <Tile span={12} padding="hero" as="section">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-label uppercase text-slate-500">{t('home.hero.label')}</h2>
        {badge}
      </div>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-hero tabular-nums text-slate-900 whitespace-nowrap">{money(daily.safePerDay, currency)}</span>
        <span className="text-title text-slate-500">{t('home.hero.perDay')}</span>
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {t('home.hero.until', { date: formatDate(daily.until, lang, 'dayShort') })}
      </p>

      {daily.runsOutOn && pace != null ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {t('home.hero.paceRunsOut', {
              pace: money(pace, currency),
              date: formatDate(daily.runsOutOn, lang, 'dayShort'),
            })}
          </span>
        </p>
      ) : pace != null && pace <= daily.safePerDay ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-income">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('home.hero.paceOk', { pace: money(pace, currency) })}</span>
        </p>
      ) : null}

      {daily.breakdown && <HowItWorks daily={daily} currency={currency} />}
    </Tile>
  )
}

/** "How is this worked out?" — the window from today to the tightest day, in plain words. */
function HowItWorks({ daily, currency }: { daily: AdvisorDaily; currency: Currency }) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const b = daily.breakdown
  // Defensive: the backend ships separately, and a missing list must not blank the page. Only the
  // incomes up to the tightest day are in "Coming in"; later ones would not add up to it.
  const incomes = (daily.incomes ?? []).filter(inc => inc.date <= daily.tightestOn)
  const row = 'flex items-baseline justify-between gap-3 py-1.5 text-sm'
  const panelId = 'home-how-panel'

  return (
    <div className="mt-4 border-t border-hairline pt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="focus-ring flex min-h-[44px] w-full items-center justify-between gap-3 rounded-control text-left text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        {t('home.how.toggle')}
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
      </button>
      {open && (
        <div id={panelId} className="pb-1">
          <div className={row}>
            <span className="text-slate-600">{t('home.how.have')}</span>
            <span className="tabular-nums text-slate-900">{moneyFull(b.have, currency)}</span>
          </div>
          <div className={row}>
            <span className="text-slate-600">
              {t('home.how.comingIn', { date: formatDate(daily.tightestOn, lang, 'dayShort') })}
            </span>
            <span className="tabular-nums text-income">+{moneyFull(b.comingIn, currency)}</span>
          </div>
          {incomes.length > 0 && (
            <ul className="-mt-1 pb-1 pl-3">
              {incomes.map((inc, i) => (
                <li key={`${inc.date}-${i}`} className="flex items-baseline justify-between gap-3 text-xs text-slate-500">
                  <span className="min-w-0 truncate">{inc.name} · {formatDate(inc.date, lang, 'dayShort')}</span>
                  <span className="shrink-0 tabular-nums">{moneyFull(inc.amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className={row}>
            <span className="text-slate-600">{t('home.how.goingOut')}</span>
            <span className="tabular-nums text-expense">−{moneyFull(b.goingOut, currency)}</span>
          </div>
          {/* One line, or its two halves when the server tells them apart and there are plans. */}
          {b.setAside != null && b.goals != null && b.goals > 0 ? (
            <>
              <div className={row}>
                <span className="text-slate-600">{t('home.how.savings')}</span>
                <span className="tabular-nums text-expense">−{moneyFull(b.setAside, currency)}</span>
              </div>
              <div className={row}>
                <span className="text-slate-600">{t('fix.goals.plans')}</span>
                <span className="tabular-nums text-expense">−{moneyFull(b.goals, currency)}</span>
              </div>
            </>
          ) : (
            <div className={row}>
              <span className="text-slate-600">{t('home.how.savings')}</span>
              <span className="tabular-nums text-expense">−{moneyFull(b.savings, currency)}</span>
            </div>
          )}
          <p className="mt-1 rounded-control bg-slate-50 px-3 py-2.5 text-sm tabular-nums text-slate-900">
            {t('home.how.result', {
              net: moneyFull(b.net, currency),
              days: plural(b.days, t('home.how.dayOne', { count: b.days }), t('home.how.dayMany', { count: b.days }), lang),
              perDay: moneyFull(daily.safePerDay, currency),
            })}
          </p>
          <p className="mt-2 flex items-start gap-2 text-xs text-slate-500">
            <Wallet className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('home.how.salaryNote')}</span>
          </p>
        </div>
      )}
    </div>
  )
}
