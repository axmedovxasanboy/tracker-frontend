import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TransactionModal } from '../components/transactions/TransactionModal'
import { INCOME_FIELD_ID } from '../components/dashboard/GetStartedHero'
import { notifyDataChanged } from '../hooks/useApi'
import { useSettings } from './SettingsContext'
import type { Transaction, TransactionType } from '../types'

interface AddFormValue {
  /** Open the Add form on a new entry — on Expense unless `type` says otherwise. */
  open: (type?: TransactionType) => void
  /** Open the same form on an existing row, to change it. */
  edit: (transaction: Transaction) => void
}

const AddFormContext = createContext<AddFormValue>({ open: () => {}, edit: () => {} })

/**
 * The one Add form, owned by the shell.
 *
 * Writing down an income or an expense is the most frequent thing the owner does, so it has to be
 * reachable from every page — the phone's ＋ button, Home, History. Each page used to mount a form
 * of its own, which is why four of the seven pages had none. Now there is one, above the routes.
 *
 * After a save it cannot know which page is on screen or which of that page's requests are now
 * stale, so it does not try: `notifyDataChanged()` makes every mounted `useApi` re-run, and the
 * page shows the new figures without being told what changed.
 *
 * The income gate lives here too: until a monthly income exists the server refuses every write,
 * so Add takes the owner to the one field that unblocks it instead of opening a form that cannot
 * be saved. Only once the answer is known — a settings read still in flight, or one that failed,
 * is not "no income".
 */
export function AddFormProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; type?: TransactionType; transaction: Transaction | null }>(
    { open: false, transaction: null },
  )
  const { hasStableIncome, ready, error } = useSettings()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const gated = ready && !error && !hasStableIncome

  const open = useCallback((type?: TransactionType) => {
    if (gated) {
      // Home's first-run tile holds the field; from anywhere else, go there.
      const field = pathname === '/' ? document.getElementById(INCOME_FIELD_ID) : null
      if (field) {
        field.scrollIntoView({ block: 'center' })
        ;(field as HTMLInputElement).focus({ preventScroll: true })
      } else {
        navigate(pathname === '/' ? '/settings' : '/')
      }
      return
    }
    setState({ open: true, type, transaction: null })
  }, [gated, pathname, navigate])

  // Changing a row that exists is not gated: it was recorded, so the income was there.
  const edit = useCallback((transaction: Transaction) => {
    setState({ open: true, transaction })
  }, [])

  const value = useMemo<AddFormValue>(() => ({ open, edit }), [open, edit])

  return (
    <AddFormContext.Provider value={value}>
      {children}
      <TransactionModal
        open={state.open}
        // The row stays in state while the sheet animates shut, so its title does not flip to
        // "Add" on the way out; the next open replaces it.
        onClose={() => setState(s => ({ ...s, open: false }))}
        onSaved={notifyDataChanged}
        transaction={state.transaction}
        defaultCurrency="UZS"
        presetType={state.type}
      />
    </AddFormContext.Provider>
  )
}

/** Open the shell's Add form. Outside the provider it does nothing. */
export function useAddForm(): AddFormValue {
  return useContext(AddFormContext)
}
