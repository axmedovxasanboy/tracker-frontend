import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/LanguageContext'
import { formatDate, formatNumber, moneyFull } from '../../utils/format'
import { situationName } from './levelWords'
import { savingLook } from '../savings/SavingsThisMonth'
import type { RecalcRule, RecalcWhy, RecalcWhyLoan } from '../../types/levels'

type T = (key: TKey, vars?: Record<string, string | number>) => string

const num = (p: number) => (Number.isInteger(p) ? String(p) : formatNumber(p, 1))
const SPLIT = new Set(['BANK_LOAN_COMFORTABLE', 'BANK_LOAN_TIGHT', 'DEBTS_COMFORTABLE', 'DEBTS_TIGHT'])

/** One loan's line: "Ota-onam (monthly): 4.500.000 UZS left, this month asks 500.000 UZS." + why, in words. */
function loanLine(t: T, l: RecalcWhyLoan, lang: 'en' | 'uz'): string {
  const head = t('rw.loan', {
    name: l.name, type: t(`rw.type.${l.type}` as TKey), left: moneyFull(l.left), ask: moneyFull(l.ask),
  })
  let note: string | null = null
  if (l.note === 'NASIYA_LATER') {
    note = l.dueDate
      ? t('rw.note.NASIYA_LATER', { month: formatDate(l.dueDate.slice(0, 7), lang, 'month') })
      : t('rw.note.NASIYA_LATER_NO_DATE')
  } else if (l.note) {
    note = t(`rw.note.${l.note}` as TKey)
  } else if (l.type === 'ASAP' && l.ask > 0 && l.ask < l.left) {
    // The ASAP rule asked only part of it: what is left was over 70% of the income.
    note = t('rw.note.PART')
  }
  return note ? `${head} ${note}` : head
}

/** The numbered lines of RECALC-SPEC §5, in order; each one short, with real amounts. */
export function whyLines(t: T, lang: 'en' | 'uz', rule: RecalcRule, why: RecalcWhy): string[] {
  const lines: string[] = []
  // 1. The level.
  if (why.level5Since) {
    lines.push(t('rw.level5', { month: formatDate(why.level5Since, lang, 'month') }))
  } else {
    const vars = {
      income: moneyFull(why.income), bills: moneyFull(why.bills), left: moneyFull(why.leftAfterBills),
      n: rule.level,
      // "0 – 15.000.000 UZS": the currency once, on the band's end; at the top "60.000.000 UZS or more".
      from: why.levelTo != null ? formatNumber(why.levelFrom ?? 0) : moneyFull(why.levelFrom ?? 0),
      to: why.levelTo != null ? moneyFull(why.levelTo) : '',
    }
    lines.push(t(why.levelTo != null ? 'rw.level' : 'rw.levelTop', vars))
  }
  // 2. Bank loans.
  if (why.bankLoans.length === 0) lines.push(t('rw.noBank'))
  for (const b of why.bankLoans) lines.push(t('rw.bank', { name: b.name, monthly: moneyFull(b.monthly) }))
  // 3. Money owed to people, one line each.
  if (why.loans.length === 0) lines.push(t('rw.noLoans'))
  for (const l of why.loans) lines.push(loanLine(t, l, lang))
  // 4. The 10% line for monthly loans.
  if (why.monthlyAsks > 0) {
    lines.push(t(why.smallMonthlyIgnored ? 'rw.smallIgnored' : 'rw.smallCounted', {
      monthly: moneyFull(why.monthlyAsks), limit: moneyFull(why.smallMonthlyLimit),
    }))
  }
  // 5. The heavy-loans line, whenever a loan counts.
  if (why.hasBank || why.hasPeopleDebt) {
    lines.push(t(rule.situation === 'HEAVY_DEBT' ? 'rw.heavyYes' : 'rw.heavyNo', {
      share: num(why.debtShare), line: num(why.heavyLine),
    }))
  }
  // 6. The split line, for the four situations it splits.
  if (SPLIT.has(rule.situation)) {
    const cutoff = why.cutoff ?? rule.cutoff ?? 0
    lines.push(t(rule.situation.endsWith('TIGHT') ? 'rw.splitUnder' : 'rw.splitOver', {
      left: moneyFull(why.leftAfterLoans), cutoff: moneyFull(cutoff),
    }))
  }
  // 7. The result.
  const parts = [
    `${savingLook(t, { bucket: 'DONATION' }).name} ${num(rule.percents.donation)}%`,
    `${savingLook(t, { bucket: 'EMERGENCY' }).name} ${num(rule.percents.emergency)}%`,
    `${savingLook(t, { bucket: 'INVESTMENTS' }).name} ${num(rule.percents.investments)}%`,
    ...(rule.own ?? []).filter(o => o.percent > 0).map(o => `${o.name} ${num(o.percent)}%`),
  ].join(' · ')
  lines.push(t('rw.result', {
    situation: situationName(t, rule.situation, why.cutoff ?? rule.cutoff), parts, total: num(rule.total),
  }))
  return lines
}

/**
 * "Why?" under one side of the Recalculate sheet (RECALC-SPEC §5): the figures the rule was decided
 * from, as short numbered lines. Renders nothing on a server that sends no `why`.
 */
export function RuleWhy({ rule, defaultOpen = false, id }: { rule: RecalcRule; defaultOpen?: boolean; id: string }) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(defaultOpen)
  const why = rule.why
  if (!why) return null
  const day = formatDate(why.asOf, lang, 'short')
  const panel = `${id}-panel`
  return (
    <div className="mt-2 border-t border-hairline pt-2">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls={panel}
        className="focus-ring flex min-h-[44px] items-center gap-1.5 rounded-control text-sm font-medium text-slate-600 hover:text-slate-900">
        {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        {t('rw.toggle')}
      </button>
      {open && (
        <div id={panel} className="space-y-2 pb-1">
          <p className="text-xs text-slate-500">{t(`rw.basis.${why.basis}` as TKey, { date: day })}</p>
          {!why.exact && <p className="text-xs text-slate-500">{t('rw.notExact', { date: day })}</p>}
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700 marker:text-slate-400">
            {whyLines(t, lang, rule, why).map((line, i) => (
              <li key={i} className="tabular-nums [overflow-wrap:anywhere]">{line}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
