import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast, type ToastItem } from '../../context/ToastContext'
import { useLang } from '../../i18n/LanguageContext'

// ─── Individual toast ─────────────────────────────────────────────────────────
// One white surface for all four kinds. The tinted card the toast used to be (bg-rose-50,
// bg-emerald-50, …) is the surface tint §1 bans, and it also made the toast read as part of
// whatever tinted panel happened to be under it. The hue now lives where it costs nothing:
// the icon, the title and the countdown bar. Icons are -600 and titles -700 so both clear
// their contrast floors on white (emerald-600 3.77:1 as a graphic, emerald-700 5.48:1 as text).
const CONFIG: Record<ToastItem['type'], {
  icon: React.ReactNode
  bar: string
  titleColor: string
}> = {
  error: {
    icon: <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />,
    bar: 'bg-rose-600',
    titleColor: 'text-rose-700',
  },
  success: {
    icon: <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />,
    bar: 'bg-emerald-600',
    titleColor: 'text-emerald-700',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />,
    bar: 'bg-amber-600',
    titleColor: 'text-amber-700',
  },
  info: {
    icon: <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" aria-hidden="true" />,
    bar: 'bg-indigo-600',
    titleColor: 'text-indigo-700',
  },
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { t } = useLang()
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
        relative overflow-hidden rounded-tile border border-slate-200 bg-white shadow-tile-hover
        w-full sm:w-80 max-w-sm
        transition-all duration-300 ease-in-out
        ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
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
        {/* lucide renders a bare <svg> with no title and no role, so without aria-label this
            announced as "button". The pseudo-element buys the 20px glyph a 44px target without
            changing the card's layout — the same trick Button uses for size="sm". */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('ui.close')}
          title={t('ui.close')}
          className="focus-ring relative w-5 h-5 flex items-center justify-center rounded-full
                     text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors
                     shrink-0 mt-0.5 after:absolute after:-inset-3 after:content-['']"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
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
    // z-60 is the top of the contract's scale — above a Sheet at z-50, which is what an error
    // toast fired from inside an open dialog needs. It replaces the arbitrary five-figure
    // z-index this container used to carry, which the contract bans by name.
    //
    // Below sm the toast spans the gutters and is lifted clear of the bottom sheet's sticky
    // footer. At 390px the old fixed 320px card at bottom-5 landed exactly on top of the
    // footer's Cancel/Create row and, being pointer-events-auto, swallowed the taps meant for
    // them for the seven seconds an error toast lives.
    <div
      className="fixed z-60 flex flex-col gap-2.5 pointer-events-none
                 inset-x-4 bottom-[calc(env(safe-area-inset-bottom)_+_5rem)]
                 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto w-full sm:w-auto">
          <ToastCard toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}
