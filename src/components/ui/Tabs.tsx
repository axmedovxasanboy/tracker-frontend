import { useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Lock } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'

export interface TabItem<T extends string> {
  id: T
  label: string
  /** A locked tab stays visible and clickable — the panel explains why, the strip never lies. */
  locked?: boolean
  lockReason?: string
  count?: number
}

// Built from a static map: Tailwind scans source text, so a template-built `grid-cols-${n}`
// would never be generated.
const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
}

/**
 * The one segmented control in the app — it replaces the underline strip on Plan and the pill
 * strip on Finance, which looked like two different controls doing the same job.
 *
 * Up to four tabs share the width as a grid, which is what makes four items fit at 390 px
 * without a horizontal scroll; beyond four the strip scrolls and the active tab is kept in view.
 *
 * Tabs never disappear. A locked tab is rendered, focusable and clickable, and carries its
 * `lockReason` as its tooltip and as text for a screen reader; the caller renders that same
 * reason in place of the panel. Hiding it instead is what made the Plan tabs appear and vanish
 * as the month's payments changed.
 */
export function Tabs<T extends string>({ tabs, active, onChange, className = '' }: {
  tabs: Array<TabItem<T>>
  active: T
  onChange: (id: T) => void
  className?: string
}) {
  const { t } = useLang()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const scrolls = tabs.length > 4

  useEffect(() => {
    if (!scrolls) return
    const index = tabs.findIndex(tab => tab.id === active)
    refs.current[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    // `tabs` is rebuilt on every render by most callers; the active id is the real trigger.
  }, [active, scrolls])

  // Automatic activation: moving with the arrows selects, which is the expected behaviour for a
  // segmented control where the panel is the whole point of the move.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    else return
    e.preventDefault()
    refs.current[next]?.focus()
    onChange(tabs[next].id)
  }

  return (
    <div className={`relative ${className}`}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={`bg-slate-100 rounded-control p-1 gap-1 ${
          scrolls
            ? 'flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : `grid ${COLS[tabs.length] ?? 'grid-cols-4'}`
        }`}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === active
          const reason = tab.locked ? (tab.lockReason ?? t('ui.locked')) : undefined
          return (
            <button
              key={tab.id}
              ref={el => { refs.current[index] = el }}
              // The half of the tab/panel relationship this component can own. A panel that wants
              // an accessible name points `aria-labelledby` here; there is deliberately no
              // `aria-controls` in return, because Tabs cannot know the panel's id and a
              // dangling IDREF is worse for a screen reader than none at all.
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              title={reason ?? tab.label}
              onClick={() => onChange(tab.id)}
              onKeyDown={e => onKeyDown(e, index)}
              className={`flex items-center justify-center gap-1.5 min-h-[44px] md:min-h-[38px]
                          px-2 rounded-chip text-sm font-semibold whitespace-nowrap
                          transition-colors focus-ring ${
                            scrolls ? 'shrink-0' : 'min-w-0'
                          } ${
                            isActive
                              ? 'bg-white text-slate-900 shadow-tile'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
            >
              {/* slate-500, not slate-400: this glyph is the only VISUAL sign that a tab is
                  locked, so it owes 3:1 — slate-400 is 2.34:1 on the slate-100 strip. */}
              {tab.locked && <Lock className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden="true" />}
              <span className="truncate">{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`shrink-0 px-1.5 rounded-chip text-[11px] leading-[18px] font-semibold
                                  tabular-nums ${
                                    isActive ? 'bg-slate-100 text-slate-600' : 'bg-white text-slate-600'
                                  }`}>
                  {tab.count}
                </span>
              )}
              {reason && <span className="sr-only">{reason}</span>}
            </button>
          )
        })}
      </div>

      {/* Only a scrolling strip needs the hint that there is more to the right. */}
      {scrolls && (
        <div className="pointer-events-none absolute inset-y-1 right-1 w-8 rounded-r-chip
                        bg-gradient-to-l from-slate-100 to-transparent" />
      )}
    </div>
  )
}
