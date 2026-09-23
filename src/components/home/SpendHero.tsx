import { useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowDown, CheckCircle2, ChevronDown, ChevronUp, Wallet } from 'lucide-react'
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
 * Three shapes, one tile:
 * - the daily figure, with the recent pace beside it and the arithmetic one tap away;
 * - red, when even spending nothing leaves the owner short on some date;
 * - "You have" — the wallet total — while there is no daily figure (no monthly income set yet,
 *   or a backend that does not send one).
 */
export function SpendHero({ d, currency, cached, onSeeDue, fallback }: {
  d: AdvisorResponse
  currency: Currency
  cached: { isCached: boolean; cachedAt: string | null }
  /** Bring "Coming up" into view — the answer to "short on what?". */
  onSeeDue: () => void
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
          <div className={row}>
            <span className="text-slate-600">{t('home.how.savings')}</span>
            <span className="tabular-nums text-expense">−{moneyFull(b.savings, currency)}</span>
          </div>
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
