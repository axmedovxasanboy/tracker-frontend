import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { setErrorCallback } from '../api/client'

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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const add = useCallback((type: ToastType, message: string, title?: string) => {
    const id = `toast-${++counter.current}`
    const defaults: Record<ToastType, { title: string; duration: number }> = {
      error:   { title: 'Error',   duration: 7000 },
      success: { title: 'Success', duration: 3500 },
      warning: { title: 'Warning', duration: 5000 },
      info:    { title: 'Info',    duration: 4000 },
    }
    const resolved = defaults[type]
    setToasts(prev => [...prev, {
      id, type,
      title: title ?? resolved.title,
      message,
      duration: resolved.duration,
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

  return (
    <ToastContext.Provider value={{ toasts, showError, showSuccess, showWarning, showInfo, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}
