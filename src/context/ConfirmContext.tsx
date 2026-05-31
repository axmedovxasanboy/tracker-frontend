import React, { createContext, useCallback, useContext, useState } from 'react'
import { Modal } from '../components/ui/Modal'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
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
  resolver: Resolver | null
}

const initial: State = {
  open: false,
  opts: { message: '' },
  resolver: null,
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initial)

  const confirm = useCallback((opts: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      setState({ open: true, opts, resolver: resolve })
    }), [])

  const settle = (value: boolean) => {
    state.resolver?.(value)
    setState(initial)
  }

  const { opts } = state
  const confirmLabel = opts.confirmLabel ?? (opts.destructive ? 'Delete' : 'Confirm')
  const cancelLabel = opts.cancelLabel ?? 'Cancel'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        open={state.open}
        onClose={() => settle(false)}
        title={opts.title ?? (opts.destructive ? 'Delete?' : 'Confirm')}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{opts.message}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => settle(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => settle(true)}
              autoFocus
              className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${
                opts.destructive
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}
