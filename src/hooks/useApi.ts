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

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetcherRef.current()
      setState({
        data: res.data,
        loading: false,
        error: null,
        isCached: !!(res as { isCached?: boolean }).isCached,
        cachedAt: (res as { cachedAt?: string }).cachedAt ?? null,
      })
    } catch (err: unknown) {
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
  }, [execute])

  return { ...state, refetch: execute }
}
