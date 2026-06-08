import { useEffect, useState } from 'react'
import { AlertTriangle, Lock } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { monthsApi } from '../../api/months'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency } from '../../utils/format'
import type {
  Currency, MonthClosePreviewResponse, MonthPreviewWallet, MonthCloseWalletEntry,
} from '../../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  month: string
  /** Display currency for the month figures (per-wallet amounts are in each wallet's own currency). */
  currency: Currency
}

function walletKey(w: { walletType: string; cardId: number | null; currency: string }) {
  return w.walletType === 'CARD' ? `CARD:${w.cardId}` : `CASH:${w.currency}`
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function CloseMonthModal({ open, onClose, onSaved, month, currency }: Props) {
  const [preview, setPreview] = useState<MonthClosePreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [entered, setEntered] = useState<Record<string, number>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPreview(null); setError(null); setConfirmed(false); setEntered({}); setLoading(true)
    monthsApi.getPreview(month, currency)
      .then(r => {
        setPreview(r.data)
        const init: Record<string, number> = {}
        r.data.wallets.forEach(w => { init[walletKey(w)] = w.computedBalance })
        setEntered(init)
      })
      .catch(e => setError(extractErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [open, month, currency])

  const everydayFor = (w: MonthPreviewWallet) =>
    w.computedBalance - (entered[walletKey(w)] ?? w.computedBalance)

  const commit = async () => {
    if (!preview) return
    setSaving(true); setError(null)
    try {
      const wallets: MonthCloseWalletEntry[] = preview.wallets.map(w => ({
        walletType: w.walletType,
        cardId: w.cardId,
        currency: w.currency,
        enteredBalance: entered[walletKey(w)] ?? w.computedBalance,
      }))
      await monthsApi.close({ month, wallets })
      onSaved()
      onClose()
    } catch (e) {
      setError(extractErrorMessage(e))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Close ${monthLabel(month)}`} maxWidth="max-w-2xl">
      {loading ? (
        <div className="h-40 flex items-center justify-center"><Spinner /></div>
      ) : !preview ? (
        <p className="text-sm text-rose-500 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          {error ?? 'Could not load the month preview.'}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Blocked / already-closed banner */}
          {!preview.closeable && (
            <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{preview.blockedReason ?? 'This month cannot be closed right now.'}</span>
            </div>
          )}

          <p className="text-sm text-slate-500">
            Enter the <span className="font-medium text-slate-700">real balance of each wallet</span> at month-end.
            Whatever the app can't account for becomes your <span className="font-medium">everyday spending</span>,
            and the balance you enter carries into next month.
          </p>

          {/* Month figures */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Start" value={formatCurrency(preview.startBalance, currency, true)} />
            <Stat label="Earned" value={formatCurrency(preview.income, currency, true)} />
            <Stat label="Tagged out" value={formatCurrency(preview.taggedTotal, currency, true)} />
          </div>

          {/* Per-wallet reconciliation */}
          <div className="space-y-2">
            {preview.wallets.length === 0 && (
              <p className="text-sm text-slate-400">No wallets to reconcile.</p>
            )}
            {preview.wallets.map(w => {
              const ev = everydayFor(w)
              return (
                <div key={walletKey(w)} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{w.label}</p>
                      <p className="text-[11px] text-slate-400">
                        App thinks: {formatCurrency(w.computedBalance, w.currency)}
                      </p>
                    </div>
                    <p className={`text-xs font-medium ${ev > 0 ? 'text-rose-600' : ev < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {ev > 0 ? 'Spent ' : ev < 0 ? 'Surplus ' : ''}{formatCurrency(Math.abs(ev), w.currency)}
                    </p>
                  </div>
                  <AmountInput
                    value={entered[walletKey(w)] ?? 0}
                    currency={w.currency}
                    onChange={v => setEntered(p => ({ ...p, [walletKey(w)]: v }))}
                    className={INPUT}
                    suffix={w.currency}
                    disabled={!preview.closeable}
                  />
                </div>
              )
            })}
          </div>

          {error && (
            <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
          )}

          {preview.closeable && (
            <label className="flex items-start gap-2 cursor-pointer p-3 rounded-xl bg-slate-50 border border-slate-200">
              <input type="checkbox" checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-indigo-600" />
              <span className="text-xs text-slate-600 leading-relaxed flex items-center gap-1">
                <Lock className="w-3 h-3 shrink-0" />
                I understand closing <span className="font-semibold">{monthLabel(month)}</span> is permanent — it
                can't be reopened and its transactions become locked.
              </span>
            </label>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={commit}
              disabled={saving || !preview.closeable || !confirmed}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Spinner className="w-4 h-4" />}
              {saving ? 'Closing…' : 'Close month'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-2 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-700 truncate">{value}</p>
    </div>
  )
}
