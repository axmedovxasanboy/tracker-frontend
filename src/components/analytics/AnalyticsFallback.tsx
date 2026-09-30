import { ErrorTile } from '../ui/ErrorTile'
import { PageHeader } from '../ui/PageHeader'
import { Skeleton } from '../ui/Skeleton'
import { Tile, TileGrid } from '../ui/Tile'
import { useLang } from '../../i18n/LanguageContext'
import { tStatic } from '../../i18n/staticT'

const FULL = 'md:col-span-6 xl:col-span-12'
const HALF = 'md:col-span-6 xl:col-span-6'

/**
 * The Analytics grid while its figures load: the hero, then the two rows of half-width tiles,
 * each in the shape of what replaces it.
 *
 * This file is part of the main bundle on purpose — it is what the shell draws while the
 * Analytics page's own chunk (the only one that carries the chart library) is still on its way —
 * so it must never import anything from recharts.
 */
export function AnalyticsSkeleton() {
  return (
    <>
      <Tile span={12} padding="none"><Skeleton variant="stat" bare className="p-6" /></Tile>
      <Skeleton variant="row" count={4} className={HALF} />
      <Skeleton variant="chart" className={HALF} />
      <Skeleton variant="row" count={3} className={HALF} />
      <Skeleton variant="row" count={3} className={HALF} />
    </>
  )
}

/** The page's frame with its skeleton — the Suspense fallback for the lazily loaded route. */
export function AnalyticsPageFallback() {
  const { t } = useLang()
  return (
    <div className="p-4 sm:p-6">
      <PageHeader title={t('shell.nav.analytics')} />
      <div className="mt-4 xl:mt-5">
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
