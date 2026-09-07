import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { setErrorCallback } from '../api/client'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'

export type ToastType = 'error' | 'success' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  duration: number
}

interface ToastCtx {
  toasts: ToastItem[]
  showError: (message: string, title?: string) => void
  showSuccess: (message: string, title?: string) => void
  showWarning: (message: string, title?: string) => void
  showInfo: (message: string, title?: string) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastCtx>({
  toasts: [],
  showError: () => {},
  showSuccess: () => {},
  showWarning: () => {},
  showInfo: () => {},
  dismiss: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

/**
 * The heading a toast gets when the caller does not pass one — which is all but one call site.
 * Keys rather than strings: these used to be the literals 'Error' / 'Success' / 'Warning' /
 * 'Info', the only part of a toast the language switch could not reach.
 */
const DEFAULTS: Record<ToastType, { titleKey: TKey; duration: number }> = {
  error:   { titleKey: 'toast.error',   duration: 7000 },
  success: { titleKey: 'toast.success', duration: 3500 },
  warning: { titleKey: 'toast.warning', duration: 5000 },
  info:    { titleKey: 'toast.info',    duration: 4000 },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // Safe: App.tsx mounts LanguageProvider outside this provider.
  const { t } = useLang()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)
  // `t` is a fresh function after every language switch, and `showError` is handed to the axios
  // interceptor once (below). Reading `t` through a ref keeps all four show* callbacks free of
  // dependencies, so the interceptor is never re-registered, while a toast raised after the
  // switch still comes out in the new language.
  const tRef = useRef(t)
  useEffect(() => { tRef.current = t }, [t])

  const add = useCallback((type: ToastType, message: string, title?: string) => {
    const id = `toast-${++counter.current}`
    const { titleKey, duration } = DEFAULTS[type]
    setToasts(prev => [...prev, {
      id, type,
      title: title ?? tRef.current(titleKey),
      message,
      duration,
    }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showError   = useCallback((msg: string, title?: string) => add('error',   msg, title), [add])
  const showSuccess = useCallback((msg: string, title?: string) => add('success', msg, title), [add])
  const showWarning = useCallback((msg: string, title?: string) => add('warning', msg, title), [add])
  const showInfo    = useCallback((msg: string, title?: string) => add('info',    msg, title), [add])

  // Wire axios interceptor → global error toast
  useEffect(() => {
    setErrorCallback(showError)
  }, [showError])

  const value = useMemo<ToastCtx>(
    () => ({ toasts, showError, showSuccess, showWarning, showInfo, dismiss }),
    [toasts, showError, showSuccess, showWarning, showInfo, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  )
}
