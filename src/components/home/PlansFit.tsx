import { Target } from 'lucide-react'
import { Button } from '../ui/Button'
import { meansLine } from '../savings/means'
import { useLang } from '../../i18n/LanguageContext'
import { formatDate, money, moneyFull } from '../../utils/format'
import type { Currency } from '../../types'
import type { AdvisorGoal, AdvisorMeans } from '../../types/fixes'

/**
 * Under Home's figure, only when the plans ask more than a month without a bonus has: what they
 * ask, each plan with its monthly payment, and the two ways out without leaving Home — make one a
 * wish, or change it (a smaller payment, a later date). The plans are never in the figure itself;
 * this is where they speak. The verdict and its sentence are the server's (`means`), word for word
 * what Savings says.
 */
export function PlansFit({ means, goals, month, currency, busyId, onMakeWish, onChange }: {
  means: AdvisorMeans | null | undefined
  goals: AdvisorGoal[] | undefined
  /** This month, YYYY-MM: a plan starting later says from when. */
  month: string
  currency: Currency
  /** The plan whose "Make it a wish" is saving. */
  busyId: number | null
  onMakeWish: (id: number) => void
  onChange: (id: number) => void
}) {
  const { t, lang } = useLang()
  const line = meansLine(means)
  // A finished plan asks for nothing — the server leaves it out of `means` too.
  const plans = (goals ?? []).filter(g => g.kind === 'PLAN' && g.status !== 'DONE' && (g.monthly ?? 0) > 0)
  if (means?.verdict !== 'DOES_NOT_FIT' || !line || plans.length === 0) return null

  const sentence = t(line.key, Object.fromEntries(
    Object.entries(line.amounts).map(([k, v]) => [k, money(v, currency)])))

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <h3 className="flex items-center gap-2 text-label uppercase text-amber-700">
        <Target className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t('home.plans.title')}
      </h3>
      <p className="mt-2 text-sm tabular-nums text-slate-700">{sentence}</p>
      <ul className="mt-2 divide-y divide-hairline">
        {plans.map(g => {
          const nameId = `home-plan-${g.id}`
          const monthly = moneyFull(g.monthly ?? 0, currency)
          const detail = [
            g.startMonth && g.startMonth > month
              ? t('home.goals.perMonthFrom', { amount: monthly, month: formatDate(g.startMonth, lang, 'monthShort') })
              : t('home.goals.perMonth', { amount: monthly }),
            g.deadline ? t('home.goals.by', { month: formatDate(g.deadline, lang, 'monthShort') }) : null,
          ].filter(Boolean).join(' · ')
          return (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5">
              <div className="min-w-0">
                <p id={nameId} className="truncate text-sm font-medium text-slate-900">{g.name}</p>
                <p className="text-xs tabular-nums text-slate-500">{detail}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="ghost" label={t('fix.goal.makeWish')} aria-describedby={nameId}
                  loading={busyId === g.id} onClick={() => onMakeWish(g.id)} />
                <Button size="sm" variant="secondary" label={t('home.plans.change')} aria-describedby={nameId}
                  onClick={() => onChange(g.id)} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
