/**
 * One ratio against a limit, as a thin bar — the app's existing progress-bar look (a goal's
 * progress on Savings, the level on Profile). Capped at full; what runs past the limit is said in
 * words by the caller, never drawn. Decorative: the figures stand in text beside it.
 */
export function Meter({ value, max, fillClass = 'bg-slate-700', className = '' }: {
  value: number
  max: number
  /** The fill's background class. */
  fillClass?: string
  className?: string
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-100 ${className}`} aria-hidden="true">
      <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
