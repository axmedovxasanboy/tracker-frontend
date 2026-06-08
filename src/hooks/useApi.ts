import { useState, useEffect, useCallback, useRef } from 'react'
import { extractErrorMessage } from '../api/client'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  isCached: boolean
  cachedAt: string | null
}

export function useApi<T>(
  fetcher: () => Promise<{ data: T; isCached?: boolean; cachedAt?: string }>,
  deps: unknown[] = [],
) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
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
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetcherRef.current()
      if (runIdRef.current !== myRun) return
      setState({
        data: res.data,
        loading: false,
        error: null,
        isCached: !!(res as { isCached?: boolean }).isCached,
        cachedAt: (res as { cachedAt?: string }).cachedAt ?? null,
      })
    } catch (err: unknown) {
      if (runIdRef.current !== myRun) return
      setState((prev) => ({
        ...prev,
        loading: false,
        error: extractErrorMessage(err),
        // keep stale data if we had it
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    execute()
    return () => { runIdRef.current++ }
  }, [execute])

  return { ...state, refetch: execute }
}
