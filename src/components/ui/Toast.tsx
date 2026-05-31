import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast, type ToastItem } from '../../context/ToastContext'

// ─── Individual toast ─────────────────────────────────────────────────────────
const CONFIG: Record<ToastItem['type'], {
  icon: React.ReactNode
  bar: string
  border: string
  bg: string
  titleColor: string
}> = {
  error: {
    icon: <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />,
    bar: 'bg-rose-500',
    border: 'border-rose-200',
    bg: 'bg-rose-50',
    titleColor: 'text-rose-700',
  },
  success: {
    icon: <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />,
    bar: 'bg-emerald-500',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    titleColor: 'text-emerald-700',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
    bar: 'bg-amber-500',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    titleColor: 'text-amber-700',
  },
  info: {
    icon: <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />,
    bar: 'bg-indigo-500',
    border: 'border-indigo-200',
    bg: 'bg-indigo-50',
    titleColor: 'text-indigo-700',
  },
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const startRef = useRef(Date.now())
  const cfg = CONFIG[toast.type]

  useEffect(() => {
    // Trigger enter animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true))

    // Progress bar ticker
    const ticker = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      setProgress(Math.max(0, 100 - (elapsed / toast.duration) * 100))
    }, 40)

    // Auto dismiss
    const auto = setTimeout(handleDismiss, toast.duration)

    return () => { cancelAnimationFrame(raf); clearInterval(ticker); clearTimeout(auto) }
  }, [])

  function handleDismiss() {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <div
      role="alert"
      className={`
        relative overflow-hidden rounded-2xl border shadow-lg w-80 max-w-sm
        transition-all duration-300 ease-in-out
        ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${cfg.border} ${cfg.bg}
      `}
    >
      {/* Body */}
      <div className="flex items-start gap-3 px-4 py-3.5">
        {cfg.icon}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${cfg.titleColor}`}>{toast.title}</p>
          {toast.message && (
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">{toast.message}</p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors shrink-0 mt-0.5"
        >
          <X className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-0.5 w-full bg-black/5">
        <div
          className={`h-full ${cfg.bar} transition-none rounded-full`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// ─── Toast container (rendered once in App) ───────────────────────────────────
export function ToastContainer() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}
