import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { settingsApi } from '../api/settings'
import type { SettingsResponse } from '../types'

interface SettingsContextValue {
  settings: SettingsResponse | null
  /** False until a positive monthly stable income is configured. */
  hasStableIncome: boolean
  loading: boolean
  refetch: () => void
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

/**
 * One shared read of the singleton Settings row. The backend refuses every money-writing
 * action until a stable income is set (SettingsService.assertStableIncomeSet), so the pages
 * that offer those actions need to know before the user fills in a whole form.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    settingsApi.get()
      .then(r => setSettings(r.data))
      .catch(() => setSettings(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const income = settings?.monthlyStableIncome
  const hasStableIncome = income != null && Number(income) > 0

  return (
    <SettingsContext.Provider value={{ settings, hasStableIncome, loading, refetch: load }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
