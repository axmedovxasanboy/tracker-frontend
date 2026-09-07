import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { settingsApi } from '../api/settings'
import { extractErrorMessage } from '../api/client'
import type { SettingsResponse } from '../types'

interface SettingsContextValue {
  settings: SettingsResponse | null
  /** False until a positive monthly stable income is configured. */
  hasStableIncome: boolean
  loading: boolean
  /**
   * True once the settings row has actually been answered for the signed-in session.
   *
   * `hasStableIncome` is false both when the income is genuinely unset and when nobody has
   * asked yet, and a gated button cannot tell those apart — which is why an established
   * account flashes its Add buttons disabled on every load. Branch on this first.
   */
  ready: boolean
  /**
   * Why the row is missing, when it is missing because the read failed.
   *
   * A failed GET /settings used to be indistinguishable from "no income configured": the payload
   * was dropped, `hasStableIncome` went false and three pages told an established account that it
   * had never entered its pay. A 4xx is not even toasted (`api/client.ts` auto-toasts 5xx only),
   * so nothing else said otherwise. When this is set, `hasStableIncome` is not an answer — treat
   * the gate as unknown, keep the write controls live and let the server refuse if it must.
   */
  error: string | null
  refetch: () => void
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

/**
 * One shared read of the singleton Settings row. The backend refuses every money-writing
 * action until a stable income is set (SettingsService.assertStableIncomeSet), so the pages
 * that offer those actions need to know before the user fills in a whole form.
 *
 * The read is keyed on auth. It used to run exactly once, at provider mount — which happens
 * before the user has signed in: the request went out with no token, 401'd, cleared the token
 * store and left `settings` null for the rest of the session. A returning user with income
 * configured therefore saw the whole app gated until they reloaded the page by hand.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [settings, setSettings] = useState<SettingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Monotonic run id: a load in flight when the user signs out must not land afterwards and
  // hand the next session the previous account's gate.
  const runIdRef = useRef(0)

  const load = useCallback(() => {
    const run = ++runIdRef.current
    setLoading(true)
    settingsApi.get()
      .then(r => {
        if (runIdRef.current !== run) return
        setSettings(r.data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (runIdRef.current !== run) return
        setSettings(null)
        setError(extractErrorMessage(err))
      })
      .finally(() => {
        if (runIdRef.current !== run) return
        setLoading(false)
        setReady(true)
      })
  }, [])

  useEffect(() => {
    if (status === 'authenticated') { load(); return }
    // Signed out, or still bootstrapping: there is nothing to show and nobody to ask. Dropping
    // the row here is what stops a post-factory-reset signup inheriting the old account's gate.
    runIdRef.current++
    setSettings(null)
    setError(null)
    setLoading(status === 'loading')
    setReady(status === 'unauthenticated')
  }, [status, load])

  const income = settings?.monthlyStableIncome
  const hasStableIncome = income != null && Number(income) > 0

  return (
    <SettingsContext.Provider value={{ settings, hasStableIncome, loading, ready, error, refetch: load }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
