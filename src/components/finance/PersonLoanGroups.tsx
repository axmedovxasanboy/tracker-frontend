import { useState } from 'react'
import { ChevronDown, ChevronRight, User } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'
import { ListRow } from '../ui/ListRow'
import type { ListRowAction, ListRowTone } from '../ui/ListRow'
import { formatDate, moneyFull, plural } from '../../utils/format'
import type { Currency, RecordStatus } from '../../types'

/**
 * One row per PERSON rather than per loan. Someone you have lent to three times is one
 * relationship, not three unrelated rows — the number that matters is what they owe you in
 * total. Expanding a person shows each individual loan with its own actions.
 *
 * The rows are `ListRow`s, so the per-loan actions live in the 44px `⋯` menu that is always
 * painted on a touch device. The previous hand-rolled 28px pair was unlabelled and, on any
 * pointer screen wider than 640px, invisible until hovered.
 */
export interface PersonLoanItem {
  id: number
  person: string
  total: number
  settled: number
  pending: number
  currency: Currency
  status: RecordStatus
  date: string
  /** Optional extra caption, e.g. an agreed monthly repayment plan. */
  note?: string
}

function NoteBadge({ text }: { text: string }) {
  return (
    <span className="rounded-chip bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
      {text}
    </span>
  )
}

export function PersonLoanGroups({
  items, settledLabel, pendingLabel, pendingTone, actions,
}: {
  items: PersonLoanItem[]
  settledLabel: string
  pendingLabel: string
  /** Outstanding reads as money owed TO you ('in') or BY you ('out'). */
  pendingTone: ListRowTone
  /** The row's own actions, by loan id — Repay, History, Edit, Delete. */
  actions: (id: number) => ListRowAction[]
}) {
  const { t, lang } = useLang()
  const [openPeople, setOpenPeople] = useState<Set<string>>(new Set())

  // Group case-insensitively so "Aziz" and "aziz" are the same person.
  const groups = new Map<string, { person: string; loans: PersonLoanItem[] }>()
  for (const it of items) {
    const key = it.person.trim().toLowerCase()
    if (!groups.has(key)) groups.set(key, { person: it.person.trim(), loans: [] })
    groups.get(key)!.loans.push(it)
  }
  const people = [...groups.entries()]
    .map(([key, g]) => {
      const pending = g.loans.reduce((s, l) => s + l.pending, 0)
      return {
        key,
        person: g.person,
        loans: g.loans,
        total: g.loans.reduce((s, l) => s + l.total, 0),
        settled: g.loans.reduce((s, l) => s + l.settled, 0),
        pending,
        currency: g.loans[0].currency,
        allSettled: g.loans.every(l => l.status === 'PAID'),
      }
    })
    // Whoever still owes the most comes first; fully settled people sink to the bottom.
    .sort((a, b) => b.pending - a.pending || a.person.localeCompare(b.person))

  const toggle = (key: string) => setOpenPeople(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  return (
    <div className="divide-y divide-hairline">
      {people.map(p => {
        const open = openPeople.has(p.key)
        // One loan from this person IS the person row — there is nothing to expand into, and
        // burying its actions behind a disclosure made them look as though they didn't exist.
        const single = p.loans.length === 1 ? p.loans[0] : null
        const countText = plural(
          p.loans.length,
          t('cmp.personLoans.oneLoan'),
          t('cmp.personLoans.manyLoans'),
          lang,
        )

        return (
          <div key={p.key}>
            <ListRow
              leading={
                <div className="flex items-center gap-2">
                  {/* The chevron slot is held open on a single-loan row so both kinds of row
                      line their avatars up in the same column. */}
                  {single
                    ? <span className="w-4 shrink-0" aria-hidden="true" />
                    : open
                      ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                      : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />}
                  <span className={`flex h-9 w-9 items-center justify-center rounded-chip ${
                    p.allSettled ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    <User className="w-4 h-4" />
                  </span>
                </div>
              }
              title={p.person}
              badges={single?.note ? <NoteBadge text={single.note} /> : undefined}
              subtitle={single
                ? `${formatDate(single.date, lang)} · ${settledLabel} ${moneyFull(single.settled, single.currency)}`
                : `${countText} · ${settledLabel} ${moneyFull(p.settled, p.currency)}`}
              amount={moneyFull(p.pending, p.currency)}
              amountTone={p.pending > 0 ? pendingTone : 'neutral'}
              amountCaption={p.pending > 0 ? pendingLabel : t('cmp.personLoans.settled')}
              actions={single ? actions(single.id) : undefined}
              onClick={single ? undefined : () => toggle(p.key)}
            />

            {open && !single && (
              <div className="divide-y divide-hairline border-t border-hairline bg-slate-50/60">
                {p.loans
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(l => (
                    <ListRow
                      key={l.id}
                      className="pl-14"
                      title={moneyFull(l.total, l.currency)}
                      badges={l.note ? <NoteBadge text={l.note} /> : undefined}
                      subtitle={`${formatDate(l.date, lang)} · ${settledLabel} ${moneyFull(l.settled, l.currency)}`}
                      amount={moneyFull(l.pending, l.currency)}
                      amountTone={l.pending > 0 ? pendingTone : 'neutral'}
                      amountCaption={l.pending > 0 ? pendingLabel : t('cmp.personLoans.settled')}
                      actions={actions(l.id)}
                    />
                  ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
