import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { DeltaBadge } from '../analytics/DeltaBadge'
import { FigureTile } from '../analytics/FigureTile'
import { monthWord } from '../analytics/figures'
import { SECTION_PATH } from '../analytics/sections'
import { ErrorTile } from '../ui/ErrorTile'
import { Skeleton } from '../ui/Skeleton'
import { useApi } from '../../hooks/useApi'
import { useLang } from '../../i18n/LanguageContext'
import { analyticsApi } from '../../api/analytics'
import { money, shiftMonth } from '../../utils/format'
import { withBreakdownDefaults } from '../../types/analyticsBreakdown'

/**
 * Home's first row (owner, 2026-10-13: "show how much earned this month and spent, with two
 * cards, instead of Free to spend"): what came in this month and what went out — Analytics' own In
 * and Out (a salary counts in the month it is for; Out is everyday spending, bills and loan
 * payments), so Home and Analytics never show two figures for one thing. Each has its badge
 * against last month and leads to its Analytics page.
 *
 * Two requests of `GET /analytics/breakdown` — this month and the one before; the second only
 * feeds the badges, and a failure there costs nothing else.
 */
export function MonthTiles({ today }: { today: string }) {
  const { t, lang } = useLang()
  const month = today.slice(0, 7)
  const prevMonth = shiftMonth(month, -1)

  const cur = useApi(async () => {
    const res = await analyticsApi.breakdown(month, month, today)
    return { ...res, data: withBreakdownDefaults(res.data) }
  }, [month, today])
  const before = useApi(async () => {
    try {
      const res = await analyticsApi.breakdown(prevMonth, prevMonth, today)
      return { ...res, data: withBreakdownDefaults(res.data) }
    } catch {
      return { data: null }
    }
  }, [prevMonth, today])

  if (cur.loading) {
    return (
      <>
        <Skeleton variant="stat" className="md:col-span-3 xl:col-span-6" />
        <Skeleton variant="stat" className="md:col-span-3 xl:col-span-6" />
      </>
    )
  }
  const f = cur.data?.months[cur.data.months.length - 1]
  if (!f) {
    return cur.error
      ? <ErrorTile compact className="md:col-span-6 xl:col-span-12" message={cur.error} onRetry={cur.refetch} />
      : null
  }
  const p = before.data?.months[before.data.months.length - 1]
  const previous = p?.tracked ? p : null
  const open = !f.complete
  const name = monthWord(month, lang)

  return (
    <>
      <FigureTile
        span={6}
        stretch
        label={t('home.month.earned', { month: name })}
        icon={<ArrowDownLeft className="h-4 w-4" aria-hidden="true" />}
        iconTone="teal"
        amount={money(f.earned)}
        value={f.earned}
        badge={previous ? <DeltaBadge value={f.earned} previous={previous.earned} prevMonth={prevMonth} open={open} /> : null}
        to={SECTION_PATH.in}
      />
      <FigureTile
        span={6}
        stretch
        label={t('home.month.spent', { month: name })}
        icon={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
        iconTone="amber"
        amount={money(f.out)}
        value={f.out}
        badge={previous ? <DeltaBadge value={f.out} previous={previous.out} prevMonth={prevMonth} open={open} upIsGood={false} /> : null}
        to={SECTION_PATH.out}
      />
    </>
  )
}
