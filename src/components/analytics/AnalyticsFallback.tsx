import { ErrorTile } from '../ui/ErrorTile'
import { PageHeader } from '../ui/PageHeader'
import { Skeleton } from '../ui/Skeleton'
import { TileGrid } from '../ui/Tile'
import { useLang } from '../../i18n/LanguageContext'
import { tStatic } from '../../i18n/staticT'

const FULL = 'md:col-span-6 xl:col-span-12'
const WIDE = 'md:col-span-6 xl:col-span-7'
const SIDE = 'md:col-span-6 xl:col-span-5'

/**
 * An Analytics page while its figures load: the four bullet rows' block beside the side tile, in
 * the shape of what replaces them.
 *
 * This file is part of the main bundle on purpose — it is what the shell draws while the
 * Analytics chunk is still on its way — so it stays small and draws no chart.
 */
export function AnalyticsSkeleton() {
  return (
    <>
      <Skeleton variant="text" count={8} className={WIDE} />
      <Skeleton variant="row" count={3} className={SIDE} />
    </>
  )
}

/**
 * The sticky tab strip's placeholder: the same height and gutter as the real one (§2.2), so the
 * page does not jump when the chunk arrives. Decorative.
 */
function NavSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="sticky top-[calc(3.5rem+var(--offline-h,0px))] md:top-[var(--offline-h,0px)] z-10
                 -mx-4 px-2 sm:-mx-6 sm:px-4 bg-ground border-b border-hairline"
    >
      <div className="flex justify-between gap-1 p-1 md:justify-start">
        {['w-12', 'w-8', 'w-9', 'w-16', 'w-12', 'w-16'].map((w, i) => (
          <div key={i} className="flex h-11 items-center px-1.5 md:px-3">
            <div className={`h-3 ${w} rounded-full animate-pulse bg-slate-200/70`} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The page's frame with its strip and skeleton — the Suspense fallback for the lazy chunk. */
export function AnalyticsPageFallback() {
  const { t } = useLang()
  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={t('shell.nav.analytics')} />
      <NavSkeleton />
      <div className="mt-3 xl:mt-4">
        <TileGrid><AnalyticsSkeleton /></TileGrid>
      </div>
    </div>
  )
}

/**
 * Shown when the page's chunk could not be fetched — typically a tab left open across a deploy,
 * asking for a file the new build no longer has. Reloading picks up the new build; without this
 * the failed import would take the whole app down with it.
 */
export function AnalyticsLoadFailed() {
  const { t } = useLang()
  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={t('shell.nav.analytics')} />
      <div className="mt-4 xl:mt-5">
        <TileGrid>
          <ErrorTile className={FULL} message={tStatic('error.network')} onRetry={() => window.location.reload()} />
        </TileGrid>
      </div>
    </div>
  )
}
