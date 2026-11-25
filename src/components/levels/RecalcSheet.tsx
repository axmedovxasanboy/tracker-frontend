import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import { Skeleton } from '../ui/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../i18n/LanguageContext'
import { levelsApi } from '../../api/levels'
import { extractErrorMessage } from '../../api/client'
import { formatDate, formatNumber } from '../../utils/format'
import { situationName } from './levelWords'
import { RuleWhy } from './RuleWhy'
import { savingLook } from '../savings/SavingsThisMonth'
import type { RecalcResponse, RecalcRule } from '../../types/levels'

const num = (p: number) => (Number.isInteger(p) ? String(p) : formatNumber(p, 1))
const pct = (p: number) => `${num(p)}%`

type Row = { key: string; bucket: string; name?: string; now: number; today: number }

/** The three, then every own saving either side asks for — one row each, both sides' percent. */
function rowsOf(r: RecalcResponse): Row[] {
  const three: Row[] = (['DONATION', 'EMERGENCY', 'INVESTMENTS'] as const).map(b => {
    const k = b === 'DONATION' ? 'donation' : b === 'EMERGENCY' ? 'emergency' : 'investments'
    return { key: b, bucket: b, now: r.current.percents[k] ?? 0, today: r.recalculated.percents[k] ?? 0 }
  })
  const today = new Map((r.recalculated.own ?? []).map(o => [o.id, o.percent]))
  const own: Row[] = []
  const seen = new Set<number>()
  for (const o of r.current.own ?? []) {
    seen.add(o.id)
    own.push({ key: `own-${o.id}`, bucket: 'CUSTOM', name: o.name, now: o.percent, today: today.get(o.id) ?? 0 })
  }
  for (const o of r.recalculated.own ?? []) {
    if (!seen.has(o.id)) own.push({ key: `own-${o.id}`, bucket: 'CUSTOM', name: o.name, now: 0, today: o.percent })
  }
  return [...three, ...own.filter(o => o.now > 0 || o.today > 0)]
}

/**
 * "Recalculate" (RECALC-SPEC §2): this month's rule — fixed on its 1st — beside the one the owner's
 * situation today gives. Nothing changes until the owner presses Apply; the next month's 1st decides
 * the next month by itself as always.
 */
export function RecalcSheet({ open, onClose, onApplied, cutoff, whyOpen = 'today' }: {
  open: boolean
  /** Which side's "Why?" starts open: today's (Recalculate) or this month's (Profile's "Why this rule?"). */
  whyOpen?: 'now' | 'today'
  onClose: () => void
  /** After the rule was applied: reload whatever shows this month's amounts. */
  onApplied: () => void
  /** Profile's tight/comfortable line — names a split situation when the server sends none. */
  cutoff?: number | null
}) {
  const { t, lang } = useLang()
  const { showSuccess } = useToast()
  const [data, setData] = useState<RecalcResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let live = true
    setLoading(true); setError(null); setApplyError(null); setData(null)
    levelsApi.recalcPreview()
      .then(res => { if (live) setData(res.data) })
      .catch(err => { if (live) setError(extractErrorMessage(err)) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [open, attempt])

  const monthWord = data ? formatDate(data.month, lang, 'monthName') : ''
  const monthTitle = data ? formatDate(data.month, lang, 'month') : ''

  const apply = async () => {
    if (!data) return
    setApplying(true); setApplyError(null)
    try {
      const res = await levelsApi.recalculate()
      showSuccess(t('rc.applied', { month: monthWord, total: num(res.data.current.total) }))
      onApplied()
      onClose()
    } catch (err) {
      setApplyError(extractErrorMessage(err))
    } finally {
      setApplying(false)
    }
  }

  const changed = !!data?.changed
  const rows = data ? rowsOf(data) : []

  const side = (which: 'now' | 'today', rule: RecalcRule) => {
    const isToday = which === 'today'
    const totalChanged = isToday && changed && rule.total !== data!.current.total
    return (
      <section
        aria-label={t(isToday ? 'rc.today' : 'rc.now')}
        className={`min-w-0 rounded-control border p-3 ${isToday && changed ? 'border-indigo-200 bg-indigo-50/40' : 'border-hairline bg-white'}`}
      >
        <h3 className="text-label uppercase text-slate-500">{t(isToday ? 'rc.today' : 'rc.now')}</h3>
        <p className={`mt-1 text-stat tabular-nums ${totalChanged ? 'text-indigo-700' : 'text-slate-900'}`}>
          {pct(rule.total)}
        </p>
        <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">
          {t('lvl.p.ruleLine', { n: rule.level, situation: situationName(t, rule.situation, rule.cutoff ?? cutoff) })}
        </p>
        <ul className="mt-2 divide-y divide-hairline">
          {rows.map(r => {
            const value = isToday ? r.today : r.now
            const moved = isToday && r.today !== r.now
            return (
              <li key={r.key} className="flex min-h-[40px] items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate text-sm text-slate-700">{savingLook(t, r).name}</span>
                <span className={`shrink-0 text-sm tabular-nums ${moved ? 'rounded-chip bg-indigo-100 px-1.5 font-semibold text-indigo-800' : value > 0 ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                  {pct(value)}
                  {moved && <span className="sr-only"> ({t('rc.changed')})</span>}
                </span>
              </li>
            )
          })}
        </ul>
        {/* Why it came out this way — open on the side the owner came for. */}
        <RuleWhy key={`${which}-${whyOpen}`} rule={rule} defaultOpen={which === whyOpen} id={`rc-why-${which}`} />
      </section>
    )
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={data ? t('rc.title', { month: monthTitle }) : t('rc.button')}
      maxWidth="max-w-2xl"
      footer={
        changed ? (
          <div className="flex gap-3">
            <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
            <Button variant="primary" loading={applying} onClick={apply} className="flex-1"
              label={applying ? t('rc.applying') : t('rc.apply', { month: monthWord })} />
          </div>
        ) : (
          <Button label={t('action.close')} onClick={onClose} className="w-full" />
        )
      }
    >
      {loading ? (
        <Skeleton variant="row" count={4} />
      ) : error ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-expense">{error}</p>
          <Button size="sm" label={t('rc.retry')} onClick={() => setAttempt(a => a + 1)} />
        </div>
      ) : data ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{t('rc.intro', { month: monthWord })}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {side('now', data.current)}
            {side('today', data.recalculated)}
          </div>
          {changed
            ? <p className="text-xs text-slate-500">{t('rc.note')}</p>
            : <p role="status" className="text-sm font-medium text-slate-700">{t('rc.same')}</p>}
          {applyError && <p role="alert" className="text-sm text-expense">{applyError}</p>}
        </div>
      ) : null}
    </Sheet>
  )
}
