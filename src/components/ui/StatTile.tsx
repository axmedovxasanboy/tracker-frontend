import type { ReactNode } from 'react'
import { InfoDot } from './InfoDot'
import { Tile } from './Tile'
import type { TileSpan, TileMdSpan } from './Tile'
import { useLang } from '../../i18n/LanguageContext'

/** Colours the value only: money in is green, money out is red, everything else is ink. */
export type StatTone = 'neutral' | 'in' | 'out'

/** The one place a bucket's identity colour survives — the icon chip, never the surface. */
export type IconTone = 'neutral' | 'pink' | 'amber' | 'teal' | 'indigo'

export type PillTone = 'ok' | 'attention' | 'neutral'

const VALUE_TONE: Record<StatTone, string> = {
  neutral: 'text-slate-900',
  in:      'text-income',
  out:     'text-expense',
}

/** Exported so the one `IconChip` component draws from the same palette this tile does. */
export const ICON_TONE: Record<IconTone, string> = {
  neutral: 'bg-slate-100 text-slate-500',
  pink:    'bg-pink-100 text-pink-600',
  amber:   'bg-amber-100 text-amber-600',
  teal:    'bg-teal-100 text-teal-600',
  indigo:  'bg-indigo-100 text-indigo-600',
}

const PILL_TONE: Record<PillTone, string> = {
  ok:        'bg-emerald-50 text-emerald-700',
  attention: 'bg-amber-50 text-amber-700',
  neutral:   'bg-slate-100 text-slate-600',
}

/**
 * One number, told once: label, figure, and the line that says where the figure came from.
 *
 * Replaces the five hand-rolled stat cards the audit found. `value` is the compact form that
 * belongs in a tile ("29,5 M UZS"); `caption` carries the exact figure or the arithmetic behind
 * it, so nothing is hidden behind a hover. Anything richer — a bar, a formula chain, a chip row —
 * comes in as `children` and sits under the caption.
 */
export function StatTile({
  label, value, caption, hero = false, icon, iconTone = 'neutral', tone = 'neutral',
  pill, onInfo, onClick, span, mdSpan, rows, children,
}: {
  /** 11px caps. The scope word ("Target", "Left", "Set aside") belongs here. */
  label: string
  /** Already formatted and compact — the tile does not format. */
  value: string
  /** The exact value, or a one-line gloss. */
  caption?: string
  /** The page's single biggest number: 40px and p-6 instead of 28px and p-5. */
  hero?: boolean
  icon?: ReactNode
  iconTone?: IconTone
  tone?: StatTone
  pill?: { text: string; tone: PillTone }
  onInfo?: () => void
  onClick?: () => void
  span?: TileSpan
  /** Override the md width when ceil(span/2) is too narrow for the value. See TileMdSpan. */
  mdSpan?: TileMdSpan
  rows?: 1 | 2
  children?: ReactNode
}) {
  const { t } = useLang()

  return (
    <Tile span={span} mdSpan={mdSpan} rows={rows} padding={hero ? 'hero' : 'normal'} onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-label uppercase text-slate-500 min-w-0">{label}</p>
        {(icon || onInfo) && (
          <div className="flex items-center gap-2 shrink-0">
            {icon && (
              <div className={`w-9 h-9 rounded-chip flex items-center justify-center ${ICON_TONE[iconTone]}`}>
                {icon}
              </div>
            )}
            {/* p-3 -m-3 buys the 16px glyph a 40px target without moving anything around it. */}
            {onInfo && <InfoDot label={t('cmp.cardInfo.button', { title: label })} onClick={onInfo} className="p-3 -m-3" />}
          </div>
        )}
      </div>

      {/* No truncate: a clipped figure reads as a smaller number rather than as a clipped one. */}
      <p className={`mt-3 tabular-nums ${hero ? 'text-hero whitespace-nowrap' : 'text-stat'} ${VALUE_TONE[tone]}`}>
        {value}
      </p>

      {pill && (
        <span className={`mt-2 inline-flex items-center rounded-chip px-2 py-0.5 text-xs font-semibold tabular-nums ${PILL_TONE[pill.tone]}`}>
          {pill.text}
        </span>
      )}

      {caption && <p className="mt-2 text-sm text-slate-600 tabular-nums break-words">{caption}</p>}

      {children && <div className="mt-3">{children}</div>}
    </Tile>
  )
}
