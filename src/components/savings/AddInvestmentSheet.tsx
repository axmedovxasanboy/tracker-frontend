import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { todayLocal } from '../../utils/format'
import {
  CompactDate, CONTROL, CONTROL_INVALID, MONEY_INPUT, MONEY_INPUT_INVALID, TEXTAREA, useOptional,
} from '../transactions/formParts'
import { WalletPicker } from '../transactions/WalletPicker'
import { rememberWallet, useWalletChoice, useWallets } from '../transactions/wallets'
import { requestFrom } from './AddGoalSheet'
import type { InvestmentResponse, InvestmentType } from '../../types'

const FORM_ID = 'add-investment-form'
const INVESTMENT_TYPES: InvestmentType[] = ['REAL_ESTATE', 'BONDS', 'MUTUAL_FUND', 'GOLD', 'OTHER']

/**
 * A new investment: its name, how much, where the money came from, when. "I already own it"
 * records a holding bought before — no wallet is touched. Type, broker and a note are folded
 * under "More"; nothing needs them.
 *
 * Editing changes the name and those details only — money goes in with "Add money", and a new
 * market value with "Update value".
 */
export function AddInvestmentSheet({ open, onClose, onSaved, investment }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  investment?: InvestmentResponse | null
}) {
  const { t } = useLang()
  const optional = useOptional()
  const { showSuccess } = useToast()
  const TYPE_LABEL: Record<InvestmentType, string> = {
    REAL_ESTATE: t('cmp.investmentType.realEstate'),
    BONDS: t('cmp.investmentType.bonds'),
    MUTUAL_FUND: t('cmp.investmentType.mutualFund'),
    GOLD: t('cmp.investmentType.gold'),
    OTHER: t('cmp.investmentType.other'),
  }
  const editing = !!investment
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayLocal())
  const [type, setType] = useState<InvestmentType>('OTHER')
  const [broker, setBroker] = useState('')
  const [description, setDescription] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<'name' | 'amount' | 'wallet' | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const wallets = useWallets(open && !editing)
  const choice = useWalletChoice({
    open: open && !editing,
    cards: wallets.cards,
    cashBalance: wallets.cashBalance,
    loaded: wallets.loaded,
    amount,
  })

  useEffect(() => {
    if (!open) return
    setName(investment?.name ?? '')
    setAmount(0)
    setDate(todayLocal())
    setType(investment?.type ?? 'OTHER')
    setBroker(investment?.broker ?? '')
    setDescription(investment?.description ?? '')
    setMoreOpen(false)
    setError(null)
    setInvalid(null)
  }, [open, investment])

  const dirty = editing
    ? name !== investment!.name || type !== investment!.type
      || broker !== (investment!.broker ?? '') || description !== (investment!.description ?? '')
    : !!name.trim() || amount > 0 || !!broker.trim() || !!description.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setInvalid('name'); setError(t('cmp.err.investmentNameRequired')); nameRef.current?.focus(); return }
    if (!editing && amount <= 0) { setInvalid('amount'); setError(t('cmp.err.amountPositive')); return }
    const wallet = choice.value
    if (!editing && wallet == null) { setInvalid('wallet'); setError(t('cmp.err.pickCardOrCash')); return }
    setSaving(true); setError(null); setInvalid(null)
    try {
      if (investment) {
        await financeApi.updateInvestment(investment.id, requestFrom(investment, {
          name: name.trim(), type,
          broker: broker.trim() || undefined,
          description: description.trim() || undefined,
        }))
        showSuccess(t('page.investments.updatedToast'))
      } else {
        await financeApi.createInvestment({
          name: name.trim(),
          type,
          investedAmount: amount,
          currency: 'UZS',
          purchaseDate: date,
          broker: broker.trim() || undefined,
          description: description.trim() || undefined,
          emergencyFund: false,
          savingsGoal: false,
          targetAmount: null,
          currentValue: null,
          openingBalance: wallet === 'none',
          cardId: typeof wallet === 'number' ? wallet : undefined,
        })
        rememberWallet(wallet)
        showSuccess(t('home.investment.addedToast', { name: name.trim() }))
      }
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dirty={dirty && !saving}
      title={t(editing ? 'page.investments.editTitle' : 'page.investments.addInvestment')}
      initialFocusRef={nameRef}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="flex-1"
            label={saving ? t('action.saving') : editing ? t('action.save') : t('action.add')} />
        </div>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        <Field id="inv-name" label={t('cat.name')} required error={invalid === 'name' ? error ?? undefined : undefined}>
          <input ref={nameRef} value={name}
            onChange={e => { setName(e.target.value); if (invalid === 'name') { setInvalid(null); setError(null) } }}
            className={invalid === 'name' ? CONTROL_INVALID : CONTROL}
            placeholder={t('page.investments.namePlaceholder')} />
        </Field>

        {!editing && (
          <>
            <Field id="inv-amount" label={t('tx.amount')} required error={invalid === 'amount' ? error ?? undefined : undefined}>
              <AmountInput value={amount} currency="UZS" suffix="UZS"
                onChange={v => { setAmount(v); if (invalid === 'amount') { setInvalid(null); setError(null) } }}
                className={invalid === 'amount' ? MONEY_INPUT_INVALID : MONEY_INPUT} />
            </Field>
            <WalletPicker
              id="inv-wallet"
              label={t('home.wallet.from')}
              cards={wallets.cards}
              cashBalance={wallets.cashBalance}
              loaded={wallets.loaded}
              failed={wallets.failed}
              onRetry={wallets.reload}
              value={choice.value}
              onChange={v => { choice.choose(v); if (invalid === 'wallet') { setInvalid(null); setError(null) } }}
              noneLabel={t('home.wallet.alreadyOwn')}
              help={choice.value === 'none' ? t('home.wallet.alreadyOwnHelp') : undefined}
              error={invalid === 'wallet' ? error ?? undefined : undefined}
            />
            <CompactDate id="inv-date" label={t('tx.date')} value={date} onChange={setDate} />
          </>
        )}

        <div>
          <button type="button" onClick={() => setMoreOpen(v => !v)} aria-expanded={moreOpen}
            className="focus-ring flex min-h-[44px] items-center gap-1.5 rounded-control text-sm font-medium text-slate-600 hover:text-slate-900">
            {moreOpen ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            {t('ui.more')}
          </button>
          {moreOpen && (
            <div className="mt-2 space-y-4">
              <Field id="inv-type" label={t('tx.type')}>
                <select value={type} onChange={e => setType(e.target.value as InvestmentType)} className={CONTROL}>
                  {INVESTMENT_TYPES.map(it => <option key={it} value={it}>{TYPE_LABEL[it]}</option>)}
                </select>
              </Field>
              <Field id="inv-broker" label={optional(t('page.investments.brokerLabel'))}>
                <input value={broker} onChange={e => setBroker(e.target.value)} className={CONTROL} />
              </Field>
              <Field id="inv-description" label={optional(t('tx.description'))}>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className={TEXTAREA} />
              </Field>
            </div>
          )}
        </div>

        {error && !invalid && <p role="alert" className="text-sm text-expense">{error}</p>}
      </form>
    </Sheet>
  )
}
