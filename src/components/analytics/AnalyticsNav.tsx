import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useLang } from '../../i18n/LanguageContext'
import { SECTIONS } from './sections'

/**
 * The sticky strip over every Analytics page (§2.1–2.2): six links — Totals · In · Out · Set
 * aside · Goals · 12 months — and, from `md`, the month picker at its right.
 *
 * Links, not a tablist, so Back walks the pages. Measured to fit one row at 390px in both
 * languages; when it does not (a narrower phone, a larger system font) a ResizeObserver sees the
 * labels overflow and the row becomes a scroller like `Tabs.tsx`: hidden scrollbar, a fade at the
 * right, the active tab scrolled into view and an INSET focus ring, since the scroller clips the
 * normal one. The page itself never scrolls sideways.
 *
 * Sticky under the fixed 56px app bar on a phone and at the top from `md`, in both cases below
 * the offline banner, whose height App.tsx keeps in `--offline-h`. The opaque ground and the
 * negative margins cover the page gutter, so nothing scrolls past at the sides.
 */
export function AnalyticsNav({ search, yearLocked, trailing }: {
  /** `?month=…` — every link keeps the month on screen. */
  search: string
  /** 12 months needs two tracked months; its link still navigates (to the lock panel). */
  yearLocked: boolean
  /** Drawn at the right from `md`: the month picker or the range label. */
  trailing?: ReactNode
}) {
  const { t, lang } = useLang()
  const { pathname } = useLocation()
  const rowRef = useRef<HTMLDivElement>(null)
  const [scrolls, setScrolls] = useState(false)

  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row || typeof ResizeObserver === 'undefined') return
    // The links never shrink, so their row is exactly as wide in either mode: switching cannot
    // make the comparison flip back.
    const check = () => setScrolls(row.scrollWidth > row.clientWidth + 1)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(row)
    // The labels change width on their own when the web font arrives or the language switches.
    for (const child of Array.from(row.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [lang])

  // Scrolled by hand rather than with scrollIntoView, which may move the page under a sticky row.
  useEffect(() => {
    const row = rowRef.current
    if (!scrolls || !row) return
    const active = row.querySelector<HTMLElement>('[aria-current="page"]')
    if (!active) return
    const left = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2
    row.scrollTo({ left: Math.max(0, left) })
  }, [scrolls, pathname])

  return (
    <div
      className="sticky top-[calc(3.5rem+var(--offline-h,0px))] md:top-[var(--offline-h,0px)] z-10
                 -mx-4 px-2 sm:-mx-6 sm:px-4 bg-ground border-b border-hairline
                 flex flex-wrap items-center gap-x-3"
    >
      <nav aria-label={t('an.nav.label')} className="relative min-w-0 flex-1 md:flex-none">
        <div
          ref={rowRef}
          className={`relative flex gap-1 p-1 ${
            scrolls
              ? 'justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              : 'justify-between md:justify-start'
          }`}
        >
          {SECTIONS.map(s => (
            <NavLink
              key={s.id}
              to={{ pathname: s.path, search }}
              // Without `end` the Totals link (/analytics) would stay lit on every page under it.
              end={s.id === 'totals'}
              className={({ isActive }) =>
                `relative flex shrink-0 items-center justify-center min-h-[44px] min-w-[44px] px-1.5 md:px-3
                 rounded-chip text-[13px] md:text-sm font-semibold whitespace-nowrap transition-colors focus-ring ${
                   scrolls ? 'focus-visible:ring-inset focus-visible:ring-offset-0' : ''
                 } ${isActive ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {({ isActive }) => (
                <>
                  {t(s.labelKey)}
                  {/* A bar as well as the chip: the current page is never told by colour alone. */}
                  {isActive && (
                    <span aria-hidden="true" className="absolute inset-x-1.5 bottom-1 h-0.5 rounded-full bg-indigo-600" />
                  )}
                  {/* No lock icon: with it the Uzbek row no longer fits 390px. The reason is said instead. */}
                  {s.id === '12-months' && yearLocked && (
                    <span className="sr-only">{t('analytics.tab.yearLockReason')}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
        {scrolls && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-ground to-transparent" />
        )}
      </nav>
      {trailing && <div className="hidden md:flex ml-auto py-1">{trailing}</div>}
    </div>
  )
}
