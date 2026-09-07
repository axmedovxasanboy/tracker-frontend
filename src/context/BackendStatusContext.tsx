import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { setStatusCallbacks } from '../api/client'

interface BackendStatus {
  isOnline: boolean
  lastOnline: string | null    // ISO timestamp of last successful request
  lastChecked: string | null
}

interface BackendStatusContextValue extends BackendStatus {
  forceCheck: () => Promise<void>
}

// When VITE_API_BASE_URL points the SPA at a remote backend (no Caddy/nginx
// reverse-proxy of /api), the health ping must hit that origin too. Derive it by
// stripping the /api/v1 suffix off the configured base URL; otherwise use the
// proxied relative path.
const HEALTH_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace('/api/v1', '')}/actuator/health`
  : '/actuator/health'

const BackendStatusContext = createContext<BackendStatusContextValue | null>(null)

/**
 * The offline→online transition, published outside React's context so `useApi` can listen to it
 * without needing this provider as an ancestor.
 *
 * Coming back online used to hide the banner and nothing else: `api/client.ts` answers a failed
 * GET with a localStorage entry up to seven days old, so the page kept rendering the outage's
 * figures after the server returned, with no request in flight to correct them. Every mounted
 * query re-runs on the transition instead — which is also what makes the banner's Retry button do
 * something to the page, rather than only to the banner.
 */
let onlineGeneration = 0
const onlineListeners = new Set<() => void>()

export function subscribeOnlineRecovery(listener: () => void) {
  onlineListeners.add(listener)
  return () => { onlineListeners.delete(listener) }
}

/** A counter, so `useSyncExternalStore` sees a new snapshot on every recovery. */
export function getOnlineGeneration() {
  return onlineGeneration
}

export function BackendStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BackendStatus>({
    isOnline: true,
    lastOnline: null,
    lastChecked: null,
  })

  useEffect(() => {
    setStatusCallbacks(
      () => {
        const now = new Date().toISOString()
        setStatus({ isOnline: true, lastOnline: now, lastChecked: now })
      },
      () => {
        setStatus((prev) => ({
          ...prev,
          isOnline: false,
          lastChecked: new Date().toISOString(),
        }))
      },
    )
  }, [])

  // Periodic health-check ping every 15 seconds when offline
  useEffect(() => {
    if (status.isOnline) return
    const interval = setInterval(async () => {
      try {
        // fetch only rejects on network failure, not on HTTP error status — so a 503 DOWN
        // from /actuator/health or a proxy 502/504 must be treated as still-offline.
        const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(3000) })
        if (!res.ok) throw new Error('backend unhealthy')
        setStatus((prev) => {
          const now = new Date().toISOString()
          return { ...prev, isOnline: true, lastOnline: now, lastChecked: now }
        })
      } catch {
        setStatus((prev) => ({ ...prev, lastChecked: new Date().toISOString() }))
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [status.isOnline])

  // Bumped from an effect rather than from inside the state updaters: the success callback fires
  // on EVERY successful request, and announcing recovery there would refetch on every response.
  const wasOnlineRef = useRef(status.isOnline)
  useEffect(() => {
    if (status.isOnline && !wasOnlineRef.current) {
      onlineGeneration++
      onlineListeners.forEach(l => l())
    }
    wasOnlineRef.current = status.isOnline
  }, [status.isOnline])

  const forceCheck = async () => {
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) throw new Error('backend unhealthy')
      const now = new Date().toISOString()
      setStatus({ isOnline: true, lastOnline: now, lastChecked: now })
    } catch {
      setStatus((prev) => ({ ...prev, isOnline: false, lastChecked: new Date().toISOString() }))
    }
  }

  return (
    <BackendStatusContext.Provider value={{ ...status, forceCheck }}>
      {children}
    </BackendStatusContext.Provider>
  )
}

export function useBackendStatus() {
  const ctx = useContext(BackendStatusContext)
  if (!ctx) throw new Error('useBackendStatus must be inside BackendStatusProvider')
  return ctx
}
