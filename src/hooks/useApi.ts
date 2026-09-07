import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import { extractErrorMessage } from '../api/client'
import { getOnlineGeneration, subscribeOnlineRecovery } from '../context/BackendStatusContext'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  refreshing: boolean
  hasLoaded: boolean
  error: string | null
  isCached: boolean
  cachedAt: string | null
}

/**
 * One GET, with the four states a screen actually has to draw.
 *
 * `loading` and `refreshing` split what used to be one flag, because a refetch is not a load:
 *
 * | state | meaning | render |
 * |---|---|---|
 * | `loading` | first fetch, nothing on screen yet (`data === null`) | `<Skeleton />` |
 * | `refreshing` | a later fetch while `data` is still shown | keep the content, cue it subtly |
 * | `error` && `!data` | nothing to show and it failed | `<ErrorTile onRetry={refetch} />` |
 * | `error` && `data` | stale but readable | keep it, `<ErrorTile compact onRetry={refetch} />` |
 *
 * `loading` used to go true on *every* execute, so fifteen list branches written as
 * `loading ? <Spinner/> : <list/>` blanked a list the user was reading — once per keystroke on
 * Transactions, whose deps include the search box. The two flags are mutually exclusive, so the
 * old branch now does the right thing on its own: it only fires when there is genuinely nothing
 * to keep. `hasLoaded` is the same question asked from the other side ("has any attempt finished
 * yet"), and unlike `loading` it stays true after a failure.
 *
 * Note what does NOT reset when `deps` change: `data`. A new page, filter or month keeps the
 * previous payload on screen until the new one lands — which is the point. A component that must
 * never show the previous key's rows (a modal reused for a different card) should be given a
 * `key`, so React remounts it and the hook starts from null.
 */
export function useApi<T>(
  fetcher: () => Promise<{ data: T; isCached?: boolean; cachedAt?: string }>,
  deps: unknown[] = [],
) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    refreshing: false,
    hasLoaded: false,
    error: null,
    isCached: false,
    cachedAt: null,
  })

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  // Monotonic run id: only the latest in-flight call may write state, so a slower
  // older response can't clobber a newer one when deps change rapidly (e.g. typing
  // in a filter, switching currency/month). The effect cleanup bumps it on
  // deps-change / unmount to invalidate any prior in-flight run.
  const runIdRef = useRef(0)

  const execute = useCallback(async () => {
    const myRun = ++runIdRef.current
    setState((prev) => ({
      ...prev,
      // Which of the two flags depends entirely on whether there is anything to keep.
      loading: prev.data === null,
      refreshing: prev.data !== null,
      error: null,
    }))
    try {
      const res = await fetcherRef.current()
      if (runIdRef.current !== myRun) return
      setState({
        data: res.data,
        loading: false,
        refreshing: false,
        hasLoaded: true,
        error: null,
        isCached: !!(res as { isCached?: boolean }).isCached,
        cachedAt: (res as { cachedAt?: string }).cachedAt ?? null,
      })
    } catch (err: unknown) {
      if (runIdRef.current !== myRun) return
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        hasLoaded: true,
        error: extractErrorMessage(err),
        // keep stale data if we had it
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // A reconnect re-runs the query. Without this the page keeps whatever the outage handed it —
  // `api/client.ts` substitutes a localStorage payload up to seven days old for a failed GET, and
  // resolves it as a success — so the figures survived the recovery that was supposed to fix them.
  const onlineGeneration = useSyncExternalStore(subscribeOnlineRecovery, getOnlineGeneration)

  useEffect(() => {
    execute()
    return () => { runIdRef.current++ }
  }, [execute, onlineGeneration])

  return { ...state, refetch: execute }
}
