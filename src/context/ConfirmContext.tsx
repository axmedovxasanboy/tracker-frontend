import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { useLang } from '../i18n/LanguageContext'

export interface ConfirmOptions {
  /** Defaults to "Delete?" when `destructive`, "Are you sure?" otherwise. Already translated. */
  title?: string
  /** The question itself, under the title. Already translated. */
  message: string
  /** Defaults to "Delete" when `destructive`, "Confirm" otherwise. */
  confirmLabel?: string
  /** Defaults to "Cancel". */
  cancelLabel?: string
  /** Colours the confirm button red and switches both defaults to the delete wording. */
  destructive?: boolean
}

type Resolver = (ok: boolean) => void

interface ConfirmCtx {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmCtx | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx.confirm
}

interface State {
  open: boolean
  opts: ConfirmOptions
}

const initial: State = {
  open: false,
  opts: { message: '' },
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  // Safe: App.tsx mounts LanguageProvider outside this provider, so the dialog's own defaults
  // follow the language switch like every other string.
  const { t } = useLang()
  const [state, setState] = useState<State>(initial)
  // The pending resolver is not rendered, so it stays out of state — which also lets confirm()
  // settle a prompt that is already open without reading a stale copy of it.
  const resolverRef = useRef<Resolver | null>(null)

  const settle = useCallback((value: boolean) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setState(initial)
    resolve?.(value)
  }, [])

  const confirm = useCallback((opts: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      // A second prompt raised while one is open used to drop the first resolver, leaving its
      // caller awaiting for ever — and callers await this before closing a form or deleting a row.
      resolverRef.current?.(false)
      resolverRef.current = resolve
      setState({ open: true, opts })
    }), [])

  // Stable so the dialog's Escape/backdrop handlers are not torn down and re-registered on
  // every render of this provider.
  const cancel = useCallback(() => settle(false), [settle])
  const accept = useCallback(() => settle(true), [settle])

  const value = useMemo<ConfirmCtx>(() => ({ confirm }), [confirm])

  const { opts } = state
  const confirmLabel = opts.confirmLabel ?? t(opts.destructive ? 'action.delete' : 'action.confirm')
  const cancelLabel = opts.cancelLabel ?? t('action.cancel')
  const title = opts.title ?? t(opts.destructive ? 'confirm.deleteTitle' : 'confirm.title')

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={state.open}
        onClose={cancel}
        title={title}
        maxWidth="max-w-md"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-600">{opts.message}</p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              label={cancelLabel}
              onClick={cancel}
              className="flex-1"
            />
            {/* The user asked for this dialog by clicking the action, so Enter answers it — unlike
                Sheet's unprompted discard guard, which focuses the safe side instead. */}
            <Button
              variant={opts.destructive ? 'danger' : 'primary'}
              label={confirmLabel}
              onClick={accept}
              autoFocus
              className="flex-1"
            />
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}
