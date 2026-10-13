import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Sheet } from '../ui/Sheet'
import { useLang } from '../../i18n/LanguageContext'
import { moneyFull } from '../../utils/format'

/**
 * The "!" in a tile's top corner (owner, 2026-10-13: "a lot of text — reduce it, and put what
 * matters behind a ! button"). A tile shows its figure; this opens everything said about it — the
 * expected figure, what is still to come, where it came from — in a dialog, with `footer` (the
 * page's basis line: what "expected" rests on, the day of the month, the unit) under it.
 *
 * The dialog is portalled to the body: a tile, or the grid faded while newer figures load, must
 * never be its stacking context.
 */
export function InfoButton({ title, children, footer }: {
  /** The dialog's title — and, for a screen reader, what the button is about. */
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t('an.info.open', { title })}
        title={t('an.info.open', { title })}
        className="focus-ring group -m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 transition-colors group-hover:bg-slate-200 group-hover:text-slate-800"
        >
          !
        </span>
      </button>
      {open && createPortal(
        <Sheet
          open
          onClose={() => setOpen(false)}
          title={title}
          maxWidth="max-w-md"
          titleRef={headingRef}
          initialFocusRef={headingRef}
        >
          {children}
          {footer && <p className="mt-5 border-t border-hairline pt-3 text-xs leading-snug text-slate-500 tabular-nums">{footer}</p>}
        </Sheet>,
        document.body,
      )}
    </>
  )
}

/**
 * A figure's dialog: the exact amount, then each thing said about it on a line of its own —
 * the same sentences the tile used to carry under it.
 */
export function FigureInfo({ amount, lines }: { amount: number; lines: ReactNode[] }) {
  const shown = lines.filter(l => l != null && l !== false && l !== '')
  return (
    <>
      <p className="text-stat text-slate-900">{moneyFull(amount)}</p>
      {shown.length > 0 && (
        <ul className="mt-3 space-y-2">
          {shown.map((l, i) => (
            <li key={i} className="text-sm leading-snug text-slate-700 tabular-nums [overflow-wrap:anywhere]">{l}</li>
          ))}
        </ul>
      )}
    </>
  )
}

/** One line of a list's dialog: its name and amount, and the notes its row used to carry. */
export interface InfoListItem {
  key: string
  name: ReactNode
  amount: string
  notes: ReactNode[]
  /** A child under its root: indented. */
  child?: boolean
}

/** A list tile's dialog: every line with what is expected of it, what is to come, and its notes. */
export function InfoList({ items, intro }: { items: InfoListItem[]; intro?: ReactNode }) {
  return (
    <>
      {intro && <p className="mb-3 text-sm leading-snug text-slate-700">{intro}</p>}
      <ul className="divide-y divide-hairline">
        {items.map(it => {
          const notes = it.notes.filter(n => n != null && n !== false && n !== '')
          return (
            <li key={it.key} className={`py-2.5 ${it.child ? 'pl-4' : ''}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className={`min-w-0 [overflow-wrap:anywhere] ${it.child ? 'text-sm text-slate-700' : 'text-sm font-medium text-slate-900'}`}>{it.name}</span>
                <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">{it.amount}</span>
              </div>
              {notes.map((n, i) => (
                <p key={i} className="mt-0.5 text-xs leading-snug text-slate-600 tabular-nums [overflow-wrap:anywhere]">{n}</p>
              ))}
            </li>
          )
        })}
      </ul>
    </>
  )
}
