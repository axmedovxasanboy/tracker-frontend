import { useEffect, useState } from 'react'
import { ArrowDownCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { ErrorTile } from '../ui/ErrorTile'
import { Skeleton } from '../ui/Skeleton'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useApi } from '../../hooks/useApi'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { money, moneyFull, snap, todayLocal } from '../../utils/format'
import { CompactDate, MONEY_INPUT, MONEY_INPUT_INVALID } from '../transactions/formParts'
import { WalletPicker } from '../transactions/WalletPicker'
import { rememberWallet, useWalletChoice, useWallets } from '../transactions/wallets'
import type { Currency } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  defaultMonth: string
}

type Pickable = {
  kind: 'loan-taken' | 'debt'
  id: number
  person: string
  total: number
  remaining: number
  /** The loan's own monthly repayment plan; null for a debt or a loan without one. */
  plan: number | null
  currency: Currency
}

const PAYDOWN_RATE = 0.34

const hasPlan = (p: Pickable): boolean => p.plan != null && p.plan > 0

/**
 * The monthly amount a loan asks for: its own plan when it has one, otherwise the app's usual
 * share of the original amount — capped at what is left, so the last month is never overpaid.
 */
function suggestedFor(p: Pickable): number {
  const base = hasPlan(p) ? (p.plan as number) : p.total * PAYDOWN_RATE
  return snap(Math.min(base, p.remaining))
}

/** Pay back money borrowed from a person, or a debt: pick who, then how much and from where. */
export function PayPersonalLoanModal({ open, onClose, onSaved, defaultMonth }: Props) {
  const { t } = useLang()
  const { showSuccess } = useToast()
  const loansTaken = useApi(() => financeApi.getLoansTaken(), [])
  const debts = useApi(() => financeApi.getDebts(), [])
  const [selected, setSelected] = useState<Pickable | null>(null)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayLocal())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'amount' | 'wallet' | null>(null)

  const wallets = useWallets(open, selected?.currency ?? 'UZS')
  const choice = useWalletChoice({
    open,
    cards: wallets.cards,
    cashBalance: wallets.cashBalance,
    loaded: wallets.loaded,
    amount,
  })

  // Stable: both hooks were given an empty dep array.
  const refetchLoans = loansTaken.refetch
  const refetchDebts = debts.refetch

  useEffect(() => {
    if (!open) return
    setSelected(null)
    setAmount(0)
    setError(null)
    setInvalid(null)
    const cur = todayLocal()
    setDate(cur.startsWith(defaultMonth) ? cur : `${defaultMonth}-01`)
    // The balances are re-read on every open, so a payment made earlier in the same visit is
    // already taken off before the next one is priced.
    refetchLoans()
    refetchDebts()
  }, [open, defaultMonth, refetchLoans, refetchDebts])

  const list: Pickable[] = [
    ...(loansTaken.data ?? [])
      .map(l => ({
        kind: 'loan-taken' as const,
        id: l.id,
        person: l.lenderName,
        total: l.totalAmount,
        remaining: l.remainingAmount,
        plan: l.plannedMonthlyPayment ?? null,
        currency: l.currency,
      }))
      .filter(p => p.remaining > 0),
    ...(debts.data ?? [])
      .map(d => ({
        kind: 'debt' as const,
        id: d.id,
        person: d.creditorName,
        total: d.totalAmount,
        remaining: d.remainingAmount,
        plan: null,
        currency: d.currency,
      }))
      .filter(p => p.remaining > 0),
  ]

  // The selection is a copy of a picker row; when fresher figures land it has to move with them,
  // or the form keeps checking the amount against the balance the row had before.
  const loansData = loansTaken.data
  const debtsData = debts.data
  useEffect(() => {
    if (!selected) return
    const fresh = list.find(p => p.kind === selected.kind && p.id === selected.id)
    if (!fresh) { setSelected(null); setAmount(0); return }
    if (fresh.remaining === selected.remaining && fresh.total === selected.total) return
    setSelected(fresh)
    setAmount(a => Math.min(a, fresh.remaining))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loansData, debtsData])

  const pick = (p: Pickable) => {
    setSelected(p)
    setAmount(suggestedFor(p))
    setInvalid(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) { setError(t('cmp.err.pickLoanToPay')); return }
    if (amount <= 0) { setInvalid('amount'); setError(t('cmp.err.amountPositive')); return }
    if (amount > selected.remaining + 0.001) {
      setInvalid('amount')
      setError(t('cmp.err.amountCannotExceedRemaining', { amount: moneyFull(selected.remaining, selected.currency) }))
      return
    }
    const wallet = choice.value
    if (wallet == null || wallet === 'none') { setInvalid('wallet'); setError(t('cmp.err.pickCardOrCash')); return }
    setSaving(true); setError(null); setInvalid(null)
    try {
      const req = { amount, paymentDate: date, cardId: typeof wallet === 'number' ? wallet : undefined }
      if (selected.kind === 'loan-taken') await financeApi.repayLoanTaken(selected.id, req)
      else await financeApi.repayDebt(selected.id, req)
      rememberWallet(wallet)
      showSuccess(t('cmp.payPersonalLoan.recordedToast', {
        name: selected.person, amount: moneyFull(amount, selected.currency),
      }))
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const loading = loansTaken.loading || debts.loading
  const refreshing = loansTaken.refreshing || debts.refreshing
  const hasData = (loansTaken.data ?? []).length + (debts.data ?? []).length > 0
  const loadError = loansTaken.error ?? debts.error
  const retry = () => { refetchLoans(); refetchDebts() }

  const footer = list.length === 0 ? (
    <Button label={t('action.close')} onClick={onClose} className="w-full" />
  ) : (
    <div className="flex gap-3">
      <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
      <Button type="submit" form="pay-personal-form" variant="primary" loading={saving}
        disabled={!selected}
        disabledReason={!selected ? t('cmp.err.pickLoanToPay') : undefined}
        label={saving ? t('action.saving') : t('page.shared.payButton')}
        className="flex-1" />
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={t('home.form.loan.title')} maxWidth="max-w-lg" footer={footer}>
      <form id="pay-personal-form" noValidate onSubmit={handleSubmit} className="space-y-4">
        {loading && !hasData ? (
          <Skeleton variant="row" count={3} bare />
        ) : loadError && !hasData ? (
          <ErrorTile message={loadError} onRetry={retry} />
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-600">{t('cmp.payPersonalLoan.noLoans')}</p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600" id="pay-personal-picker">
                {t('home.form.loan.pick')}
              </p>
              {/* Reserved height, so the picker does not jump when fresh balances land. */}
              <p role="status" className="h-4 text-xs text-slate-500">
                {refreshing ? t('ui.loading') : ''}
              </p>
              <div role="radiogroup" aria-labelledby="pay-personal-picker"
                className="space-y-1.5 max-h-64 overflow-y-auto">
                {list.map(p => {
                  const isSel = selected?.kind === p.kind && selected.id === p.id
                  return (
                    <button key={`${p.kind}-${p.id}`} type="button"
                      role="radio"
                      aria-checked={isSel}
                      onClick={() => pick(p)}
                      className={`w-full flex items-center gap-3 p-3 rounded-control border text-left
                                  cursor-pointer transition-colors focus-ring ${
                        isSel
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}>
                      <div className="w-9 h-9 shrink-0 rounded-chip bg-slate-100 text-slate-500 flex items-center justify-center">
                        <ArrowDownCircle className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{p.person}</p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {t('home.form.repay.leftToPay', { amount: money(p.remaining, p.currency) })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right whitespace-nowrap">
                        <p className="text-xs text-slate-500">{t('home.form.loan.thisMonth')}</p>
                        <p className="text-sm font-semibold text-slate-900 tabular-nums">{money(suggestedFor(p), p.currency)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {selected && (
              <>
                <Field id="ploan-amount" required label={t('tx.amount')}
                  error={invalid === 'amount' ? error ?? undefined : undefined}>
                  <AmountInput value={amount} currency={selected.currency}
                    onChange={v => { setAmount(v); if (invalid === 'amount') { setInvalid(null); setError(null) } }}
                    className={invalid === 'amount' ? MONEY_INPUT_INVALID : MONEY_INPUT} suffix={selected.currency} />
                </Field>
                <WalletPicker
                  id="ploan-wallet"
                  label={t('home.wallet.from')}
                  cards={wallets.cards}
                  cashBalance={wallets.cashBalance}
                  currency={selected.currency}
                  loaded={wallets.loaded}
                  failed={wallets.failed}
                  onRetry={wallets.reload}
                  value={choice.value}
                  onChange={v => { choice.choose(v); if (invalid === 'wallet') { setInvalid(null); setError(null) } }}
                  error={invalid === 'wallet' ? error ?? undefined : undefined}
                />
                <CompactDate id="ploan-date" label={t('tx.date')} value={date} onChange={setDate} />
              </>
            )}

            {error && !invalid && <p role="alert" className="text-sm text-expense">{error}</p>}
          </>
        )}
      </form>
    </Modal>
  )
}
