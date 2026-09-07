import { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { cardsApi } from '../../api/cards'
import { cashBalancesApi } from '../../api/cashBalances'
import { transactionsApi } from '../../api/transactions'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, todayLocal } from '../../utils/format'
import type { BalanceTransferRequest, CardResponse, CashBalanceResponse, Currency } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  preselectedFromCardId?: number
  /** Preselect the DESTINATION instead — the "top up this card" entry point. */
  preselectedToCardId?: number
}

/**
 * Sentinel for "the cash pot" in form state. The API models cash as a null card id, but
 * null can't round-trip through a <select> (it collides with the empty "not chosen yet"
 * value), so cash is -1 here and converted back to null on submit.
 *
 * Assumes a single cash pot, which holds while the app is UZS-only. Real multi-currency
 * would need one sentinel per pot.
 */
const CASH = -1

// The one control skin the rebuilt dialogs share, so the radius and the focus ring stay in step
// with the tokens instead of being re-declared per control.
const INPUT = 'w-full rounded-control border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus-ring'

// The footer sits outside the <form>, so the submit button reaches it by id.
const FORM_ID = 'balance-transfer-form'

// Form state mirrors the request but uses CASH instead of null.
type FormState = Omit<BalanceTransferRequest, 'fromCardId' | 'toCardId'> & {
  fromCardId: number
  toCardId: number
}

const emptyForm = (): FormState => ({
  fromCardId: 0,
  toCardId: 0,
  amount: 0,
  description: '',
  // Local, not toISOString: UTC names yesterday for anyone east of Greenwich before 05:00.
  transactionDate: todayLocal(),
})

export function BalanceTransferModal({ open, onClose, onSaved, preselectedFromCardId, preselectedToCardId }: Props) {
  const { t } = useLang()
  const { showSuccess } = useToast()
  const [cards, setCards] = useState<CardResponse[]>([])
  const [cashPot, setCashPot] = useState<CashBalanceResponse | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    Promise.all([cardsApi.getAll(), cashBalancesApi.getAll()]).then(([cardRes, cashRes]) => {
      setCards(cardRes.data)
      // Only offer cash once a pot exists — transferring into a pot the Cards page
      // isn't showing would look like the money disappeared.
      setCashPot(cashRes.data[0] ?? null)
      const f = emptyForm()
      if (preselectedToCardId) {
        // Topping THIS card up: lock the destination, default the source to any other card.
        f.toCardId = preselectedToCardId
        const source = cardRes.data.find(c => c.id !== preselectedToCardId)
        if (source) f.fromCardId = source.id
        else if (cashRes.data[0]) f.fromCardId = CASH
      } else {
        if (preselectedFromCardId) {
          f.fromCardId = preselectedFromCardId
        } else if (cardRes.data.length > 0) {
          f.fromCardId = cardRes.data[0].id
        }
        if (cardRes.data.length > 1) {
          const other = cardRes.data.find(c => c.id !== f.fromCardId)
          if (other) f.toCardId = other.id
        }
      }
      setForm(f)
    }).catch(() => {})
    setError(null)
  }, [open, preselectedFromCardId, preselectedToCardId])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  // ── One accessor per side, so cash and cards are handled identically below ──
  const cardById = (id: number) => cards.find(c => c.id === id)
  const isCash = (id: number) => id === CASH
  const balanceOf = (id: number): number | undefined =>
    isCash(id) ? cashPot?.currentBalance : cardById(id)?.currentBalance
  const currencyOf = (id: number): Currency | undefined =>
    isCash(id) ? cashPot?.currency : cardById(id)?.currency

  const fromChosen = !!form.fromCardId
  const toChosen = !!form.toCardId
  const fromBalance = balanceOf(form.fromCardId)
  const toBalance = balanceOf(form.toCardId)
  // A wallet can be chosen before its balance has loaded; show a side only once there is a figure.
  const showFromBalance = fromChosen && fromBalance !== undefined
  const showToBalance = toChosen && toBalance !== undefined
  const fromCurrency = currencyOf(form.fromCardId) ?? currencyOf(form.toCardId)
  const sameWallet = fromChosen && toChosen && form.fromCardId === form.toCardId
  const bothCash = isCash(form.fromCardId) && isCash(form.toCardId)

  // Options for one side; cash is excluded from the other side's list when already picked.
  const optionsExcluding = (otherId: number) => [
    ...cards.filter(c => c.id !== otherId),
    ...(cashPot && !isCash(otherId) ? [{ id: CASH, label: `${t('tx.cash')} · ${cashPot.currency}` }] : []),
  ].map(o => 'label' in o ? o : { id: o.id, label: `${o.name} •••• ${o.lastFourDigits}` })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromChosen || !toChosen) { setError(t('cmp.err.selectBothCards')); return }
    if (bothCash) { setError(t('cmp.err.cashToCash')); return }
    if (form.fromCardId === form.toCardId) { setError(t('cmp.err.walletsMustDiffer')); return }
    if (!form.amount || form.amount <= 0) { setError(t('cmp.err.enterValidAmount')); return }
    setSaving(true); setError(null)
    try {
      const payload: BalanceTransferRequest = {
        ...form,
        fromCardId: isCash(form.fromCardId) ? null : form.fromCardId,
        toCardId: isCash(form.toCardId) ? null : form.toCardId,
      }
      await transactionsApi.transfer(payload)
      onSaved()
      onClose()
      showSuccess(t('cmp.transfer.success', { amount: form.amount }))
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Pinned under the scroll area, so the submit row is reachable on a phone without scrolling
  // the sheet to its end — the form is nine blocks tall once both balances are showing.
  const footer = (
    <div className="flex gap-3">
      <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
      <Button
        type="submit"
        form={FORM_ID}
        variant="primary"
        loading={saving}
        disabled={saving || sameWallet || bothCash}
        disabledReason={bothCash ? t('cmp.err.cashToCash') : sameWallet ? t('cmp.err.walletsMustDiffer') : undefined}
        label={saving ? t('cmp.state.transferring') : t('action.transfer')}
        className="flex-1"
      />
    </div>
  )

  return (
    <Sheet open={open} onClose={onClose} title={t('cmp.balanceTransfer.title')} maxWidth="max-w-xl" footer={footer}>
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">

        {/* Wallet selector row — either side may be a card or the cash pot. The two selects stack
            below sm: a select will not shrink past its widest option, and two of them side by side
            overflow a 390px sheet however the flex items are sized. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field id="bt-from" label={t('cmp.balanceTransfer.fromCard')} className="flex-1">
            <select
              required
              value={form.fromCardId || ''}
              onChange={e => {
                const id = Number(e.target.value)
                set('fromCardId', id)
                if (form.toCardId === id) set('toCardId', 0)
              }}
              className={`${INPUT} bg-white`}
            >
              <option value="">{t('cmp.balanceTransfer.selectCard')}</option>
              {optionsExcluding(form.toCardId).map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Field>

          {/* Direction marker. Points down while the selects are stacked, right once they are not.
              Decorative: the two labels already say which side is which. */}
          <div className="flex shrink-0 justify-center self-center sm:mt-6 sm:self-auto">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
              <ArrowRight aria-hidden="true" className="h-4 w-4 rotate-90 text-slate-600 sm:rotate-0" />
            </span>
          </div>

          <Field id="bt-to" label={t('cmp.balanceTransfer.toCard')} className="flex-1">
            <select
              required
              value={form.toCardId || ''}
              onChange={e => set('toCardId', Number(e.target.value))}
              className={`${INPUT} bg-white`}
            >
              <option value="">{t('cmp.balanceTransfer.selectCard')}</option>
              {optionsExcluding(form.fromCardId).map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Balance preview. One plain surface: the money direction is carried by the two labels,
            not by a red panel and a green one whose 10px ink was unreadable on its own tint. */}
        {(showFromBalance || showToBalance) && (
          <div className="grid grid-cols-1 gap-3 rounded-control border border-hairline px-3 py-2.5 sm:grid-cols-2">
            {showFromBalance && (
              <div className="min-w-0">
                <p className="text-label uppercase text-slate-500">{t('cmp.balanceTransfer.fromBalance')}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                  {moneyFull(fromBalance!, currencyOf(form.fromCardId))}
                </p>
              </div>
            )}
            {showToBalance && (
              <div className="min-w-0">
                <p className="text-label uppercase text-slate-500">{t('cmp.balanceTransfer.toBalance')}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                  {moneyFull(toBalance!, currencyOf(form.toCardId))}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Impossible combinations */}
        {(sameWallet || bothCash) && (
          <p role="alert" className="text-xs text-expense">
            {bothCash ? t('cmp.err.cashToCash') : t('cmp.err.walletsMustDiffer')}
          </p>
        )}

        {/* Amount */}
        <Field id="bt-amount" label={t('cmp.field.amountRequired')}>
          <AmountInput
            required
            value={form.amount || 0}
            currency={fromCurrency}
            onChange={v => set('amount', v)}
            className={INPUT}
            placeholder="0"
            suffix={fromCurrency}
          />
        </Field>
        {/* Not the Field's `error`: an overdraft is allowed here, so the input must not claim to
            be invalid — this is a warning the user is free to submit past. */}
        {fromBalance !== undefined && form.amount > 0 && form.amount > fromBalance && (
          <p className="-mt-2 text-xs tabular-nums text-expense">
            {t('cmp.balanceTransfer.exceedsBalance', { balance: moneyFull(fromBalance, currencyOf(form.fromCardId)) })}
          </p>
        )}

        {/* Date */}
        <Field id="bt-date" label={t('cmp.field.dateRequired')}>
          <input
            required
            type="date"
            value={form.transactionDate}
            onChange={e => set('transactionDate', e.target.value)}
            className={INPUT}
          />
        </Field>

        {/* Description */}
        <Field id="bt-description" label={`${t('tx.description')} (${t('common.optional')})`}>
          <input
            type="text"
            value={form.description ?? ''}
            onChange={e => set('description', e.target.value)}
            className={INPUT}
            placeholder={t('cmp.balanceTransfer.descriptionPlaceholder')}
          />
        </Field>

        {/* The side effect, stated before the user commits: a transfer is booked as two
            transactions, so both wallet balances and the Transactions page move. */}
        <p className="rounded-control border border-hairline px-3 py-2.5 text-xs leading-relaxed text-slate-600">
          {t('cmp.balanceTransfer.infoPrefix')} <strong className="font-semibold text-slate-900">{t('tx.expense')}</strong>{' '}
          {t('cmp.balanceTransfer.infoMid')} <strong className="font-semibold text-slate-900">{t('tx.income')}</strong>{' '}
          {t('cmp.balanceTransfer.infoSuffix')}
        </p>

        {error && <p role="alert" className="text-sm text-expense">{error}</p>}
      </form>
    </Sheet>
  )
}
