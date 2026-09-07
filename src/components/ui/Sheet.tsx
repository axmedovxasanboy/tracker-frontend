import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { X } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /**
   * Pinned under the scroll area rather than inside it, so the submit row stays reachable on a
   * phone no matter how long the form is — the reason Create used to scroll out of sight.
   */
  footer?: ReactNode
  maxWidth?: string
  /**
   * Unsaved work. The backdrop and Escape then ask before throwing it away; every other path
   * (the caller's own Cancel button) is the caller's to guard.
   */
  dirty?: boolean
  /** Where focus lands on open. Without it the sheet picks the first field — never the close button. */
  initialFocusRef?: RefObject<HTMLElement>
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Open sheets, oldest first. Only the topmost one answers Escape or traps Tab: `ConfirmProvider`
 * renders its prompt in a second sheet stacked on the first, and with a listener each, one Escape
 * used to close both — dismissing the confirmation *and* the form behind it in a single keypress.
 */
const openSheets: string[] = []

export function Sheet({
  open, onClose, title, children, footer, maxWidth = 'max-w-xl', dirty, initialFocusRef,
}: SheetProps) {
  const { t } = useLang()
  const id = useId()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLDivElement | null>(null)
  const keepEditingRef = useRef<HTMLButtonElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Read during render, not from an effect: React applies a child's `autoFocus` in the commit
  // phase — before any effect runs — so by then document.activeElement is already a field inside
  // the sheet and the control that opened it would be lost for good.
  if (open && restoreFocusRef.current === null) {
    restoreFocusRef.current = document.activeElement as HTMLElement | null
  }

  const requestClose = useCallback(() => {
    if (dirty) setConfirming(true)
    else onClose()
  }, [dirty, onClose])

  // Backdrop and Escape while the guard is up mean "not that either" — dismiss the question,
  // keep the form.
  const dismiss = useCallback(() => {
    if (confirming) setConfirming(false)
    else requestClose()
  }, [confirming, requestClose])

  useEffect(() => {
    if (!open) return
    openSheets.push(id)
    return () => {
      const at = openSheets.lastIndexOf(id)
      if (at !== -1) openSheets.splice(at, 1)
    }
  }, [open, id])

  useEffect(() => {
    if (!open) return
    // Re-captured only when the render-phase capture was consumed by a previous cleanup — which
    // is what StrictMode's mount/unmount/mount does in development.
    if (restoreFocusRef.current === null) {
      const active = document.activeElement as HTMLElement | null
      if (active && !dialogRef.current?.contains(active)) restoreFocusRef.current = active
    }
    const timer = setTimeout(() => {
      const dialog = dialogRef.current
      if (!dialog) return
      const explicit = initialFocusRef?.current
      if (explicit && dialog.contains(explicit)) { explicit.focus(); return }
      // A child already claimed focus with its own autoFocus. The old Modal stole it back to the
      // close button here, which is why no form in the app could focus its first field.
      const active = document.activeElement as HTMLElement | null
      if (active && active !== closeRef.current && dialog.contains(active)) return
      const marked = dialog.querySelector<HTMLElement>('[data-autofocus]')
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      // Anything but the close button: landing there announced "Close" as the first thing a
      // screen reader said about every dialog, and put Enter one keypress from discarding.
      const target = marked ?? focusables.find(el => el !== closeRef.current) ?? closeRef.current ?? dialog
      target.focus()
    }, 0)
    return () => {
      clearTimeout(timer)
      restoreFocusRef.current?.focus?.()
      restoreFocusRef.current = null
      setConfirming(false)
    }
    // `open` alone on purpose: this effect both takes and gives back focus, so re-running it
    // because a caller passed a fresh ref object would drag focus out of the sheet mid-typing.
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (openSheets[openSheets.length - 1] !== id) return
      if (e.key === 'Escape') { dismiss(); return }
      if (e.key !== 'Tab') return
      // While the guard is up the form behind it is still in the DOM, so the trap narrows to the
      // prompt — otherwise Tab would walk into fields the user can no longer see or click.
      const root = confirming ? confirmRef.current : dialogRef.current
      if (!root) return
      const focusables = root.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && (active === first || !root.contains(active))) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (active === last || !root.contains(active))) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, id, confirming, dismiss])

  useEffect(() => {
    if (!confirming) return
    // The safe answer takes focus: this prompt appears unasked-for, so Enter must not discard.
    const before = document.activeElement as HTMLElement | null
    const timer = setTimeout(() => keepEditingRef.current?.focus(), 0)
    return () => {
      clearTimeout(timer)
      // Back to the field they were in — the guard is an interruption, not a navigation. Skipped
      // when the sheet itself is going away, since by then the ref is already detached.
      if (before && dialogRef.current?.contains(before)) before.focus()
    }
  }, [confirming])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={dismiss} />
      {/* A column, not one long scroller: the header and footer are siblings of the scroll area,
          which is what keeps them fixed while the body moves under them. */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative flex w-full flex-col overflow-hidden bg-white shadow-2xl outline-none rounded-t-tile sm:rounded-tile max-h-[92vh] sm:max-h-[90vh] ${maxWidth}`}
      >
        <div className="shrink-0 border-b border-hairline">
          {/* The affordance that says "drag me" on a phone; on desktop this is a centred box. */}
          <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3 px-5 py-2 sm:px-7 sm:py-4">
            {/* min-w-0 or the flex item refuses to shrink and a long title shoves the close
                button off the edge instead of ellipsing. */}
            <h2 className="text-title text-slate-900 truncate min-w-0">{title}</h2>
            <button
              ref={closeRef}
              type="button"
              onClick={requestClose}
              aria-label={t('action.close')}
              className="focus-ring shrink-0 w-11 h-11 sm:w-9 sm:h-9 -mr-2 sm:-mr-1.5 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* min-h-0 is what lets a flex child shrink below its content and scroll at all. */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 ${
            footer ? '' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5'
          }`}
        >
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-hairline bg-white px-5 py-3 sm:px-7 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
            {footer}
          </div>
        )}

        {/* Inside the dialog box but outside the scroll area, so it covers the sheet rather than
            the scrolled-to position of the content. */}
        {confirming && (
          <div
            ref={confirmRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${id}-discard`}
            className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 px-6 backdrop-blur-[2px]"
          >
            <div className="w-full max-w-sm space-y-4 text-center">
              <h3 id={`${id}-discard`} className="text-title text-slate-900">{t('ui.discard.title')}</h3>
              <p className="text-sm text-slate-600">{t('ui.discard.body')}</p>
              <div className="flex gap-3">
                <button
                  ref={keepEditingRef}
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="focus-ring flex-1 h-11 rounded-control border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {t('ui.discard.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirming(false); onClose() }}
                  className="focus-ring flex-1 h-11 rounded-control bg-expense text-sm font-semibold text-white hover:bg-rose-600 transition-colors"
                >
                  {t('ui.discard.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
