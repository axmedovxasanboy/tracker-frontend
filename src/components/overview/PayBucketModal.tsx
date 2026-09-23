import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { emergenciesApi } from '../../api/emergencies'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, todayLocal } from '../../utils/format'
import { CompactDate, CONTROL, CONTROL_INVALID, LINK, MONEY_INPUT, MONEY_INPUT_INVALID, useOptional } from '../transactions/formParts'
import { WalletPicker } from '../transactions/WalletPicker'
import { defaultWallet, rememberWallet, useWalletChoice, useWallets } from '../transactions/wallets'
import type { Bucket, Currency, InvestmentResponse, InvestmentType } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  bucket: Bucket | null
  /** Currency shown to the user. Saved record uses this currency too. */
  currency: Currency
  /** Pre-fill amount — what this month still asks for. */
  suggestedAmount?: number
  /** Default month (YYYY-MM). The date starts on today when it falls in it, else on the 1st. */
  defaultMonth: string
}

const INVESTMENT_TYPES: InvestmentType[] = ['REAL_ESTATE', 'BONDS', 'MUTUAL_FUND', 'GOLD', 'OTHER']

// The two non-numeric values of the target select; everything else is an existing holding's id.
/** EMERGENCY only: a plain emergency-fund contribution (an `Emergency` + its mirrored transaction). */
const FUND = 'fund'
/** Open a new holding instead of adding to one that exists. */
const NEW = 'new'

type Invalid = 'amount' | 'wallet' | 'name' | null

/**
 * Put money into a donation, the emergency fund or investments.
 *
 * A donation asks for the amount, the date, the wallet — and, only if the owner wants, who it went
 * to and a note. The emergency fund and investments first ask where it goes: an account that
 * already exists is the default, a new one is the last option.
 */
export function PayBucketModal({ open, onClose, onSaved, bucket, currency, suggestedAmount, defaultMonth }: Props) {
  const { t } = useLang()
  const optional = useOptional()
  const { showSuccess } = useToast()
  const TITLES: Record<Bucket, string> = {
    DONATION:    t('cmp.payBucket.titleDonation'),
    EMERGENCY:   t('cmp.payBucket.titleEmergency'),
    INVESTMENTS: t('cmp.payBucket.titleInvestments'),
  }
  const NAMES: Record<Bucket, string> = {
    DONATION:    t('cmp.bucket.donation'),
    EMERGENCY:   t('cmp.bucket.emergency'),
    INVESTMENTS: t('cmp.bucket.investments'),
  }
  const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
    REAL_ESTATE: t('cmp.investmentType.realEstate'),
    BONDS: t('cmp.investmentType.bonds'),
    MUTUAL_FUND: t('cmp.investmentType.mutualFund'),
    GOLD: t('cmp.investmentType.gold'),
    OTHER: t('cmp.investmentType.other'),
  }
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayLocal())
  const [note, setNote] = useState('')
  const [recipientName, setRecipientName] = useState('')

  // Only for a NEW holding (the name doubles as the new account's name).
  const [name, setName] = useState('')
  const [invType, setInvType] = useState<InvestmentType>('OTHER')
  const [broker, setBroker] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)

  const [holdings, setHoldings] = useState<InvestmentResponse[]>([])
  const [target, setTarget] = useState<string>(NEW)
  /** True once the owner picked a target, so the list landing late cannot overrule them. */
  const targetTouched = useRef(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<Invalid>(null)

  const creatingNew = target === NEW
  const toFund = bucket === 'EMERGENCY' && target === FUND
  const toHolding = /^\d+$/.test(target)
  // "Not from a wallet" only exists where a record can stand without a money movement.
  const allowNone = bucket !== 'DONATION' && !toFund

  const wallets = useWallets(open && !!bucket, currency)
  const choice = useWalletChoice({
    open: open && !!bucket,
    cards: wallets.cards,
    cashBalance: wallets.cashBalance,
    loaded: wallets.loaded,
    amount,
  })

  useEffect(() => {
    if (!open || !bucket) return
    setAmount(suggestedAmount ?? 0)
    const cur = todayLocal()
    setDate(cur.startsWith(defaultMonth) ? cur : `${defaultMonth}-01`)
    setNote('')
    setRecipientName('')
    setName('')
    setInvType('OTHER')
    setBroker('')
    setMoreOpen(false)
    setError(null)
    setInvalid(null)
    setHoldings([])
    setTarget(bucket === 'EMERGENCY' ? FUND : NEW)
    targetTouched.current = false
    if (bucket === 'EMERGENCY' || bucket === 'INVESTMENTS') {
      financeApi.getInvestments().then(r => {
        const mine = r.data.filter(i =>
          i.currency === currency && !i.openingBalance
          // An emergency-flagged holding takes emergency money; a goal takes neither here.
          && (bucket === 'EMERGENCY' ? i.emergencyFund : !i.emergencyFund && !i.savingsGoal))
        setHoldings(mine)
        // Newest first from the API — the account most likely meant.
        if (mine.length > 0 && !targetTouched.current) setTarget(String(mine[0].id))
      }).catch(() => {})
    }
  }, [open, bucket, suggestedAmount, defaultMonth, currency])

  // Leaving a target that accepts "Not from a wallet" must not leave that answer standing.
  const { value: walletValue, choose: chooseWallet } = choice
  useEffect(() => {
    if (allowNone || walletValue !== 'none') return
    chooseWallet(defaultWallet(wallets.cards, wallets.cashBalance, amount) ?? 'cash')
    // Only the switch of target is the trigger; the balances are read as they stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowNone, walletValue, chooseWallet])

  if (!bucket) return null

  const showTarget = bucket === 'EMERGENCY' || (bucket === 'INVESTMENTS' && holdings.length > 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) { setInvalid('amount'); setError(t('cmp.err.amountPositive')); return }
    if (creatingNew && bucket !== 'DONATION' && !name.trim()) {
      setInvalid('name')
      setError(t(bucket === 'EMERGENCY' ? 'cmp.err.nameFund' : 'cmp.err.investmentNameRequired'))
      return
    }
    const wallet = choice.value
    if (wallet == null || (wallet === 'none' && !allowNone)) {
      setInvalid('wallet'); setError(t('cmp.err.pickCardOrCash')); return
    }
    const cardId = typeof wallet === 'number' ? wallet : undefined
    const noWallet = wallet === 'none'
    setSaving(true); setError(null); setInvalid(null)
    // No category is sent: the server files each one under the category made for its kind
    // (donation, emergency fund, investment), which is what the owner would expect to see.
    try {
      if (bucket === 'DONATION') {
        const recipient = recipientName.trim()
        await financeApi.createDonation({
          // The recipient is optional; left blank, the donation is saved without one.
          recipientName: recipient || 'Anonymous',
          anonymous: !recipient,
          amount, currency, donationDate: date,
          description: note.trim() || undefined,
          cardId,
        })
      } else if (toHolding) {
        await financeApi.contributeInvestment(Number(target), {
          amount, currency, date,
          cardId, noWallet,
          description: note.trim() || undefined,
        })
      } else if (toFund) {
        // The contribution the emergency fund lists; mirrored to the same transaction the
        // month counts, so both move together.
        await emergenciesApi.create({
          amount, currency, date,
          description: note.trim() || undefined,
          cardId,
        })
      } else {
        const isEmergency = bucket === 'EMERGENCY'
        await financeApi.createInvestment({
          name: name.trim(),
          type: isEmergency ? 'OTHER' : invType,
          investedAmount: amount, currency, purchaseDate: date,
          emergencyFund: isEmergency,
          broker: isEmergency ? undefined : broker.trim() || undefined,
          description: note.trim() || undefined,
          cardId, openingBalance: noWallet,
        })
      }
      rememberWallet(wallet)
      showSuccess(t('cmp.payBucket.recordedToast', { bucket: NAMES[bucket], amount: moneyFull(amount, currency) }))
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const fieldError = (f: Exclude<Invalid, null>) => (invalid === f ? error ?? undefined : undefined)

  const footer = (
    <div className="flex gap-3">
      <Button label={t('action.cancel')} onClick={onClose} className="flex-1" />
      <Button type="submit" form="pay-bucket-form" variant="primary" loading={saving}
        label={saving ? t('action.saving') : t('action.add')}
        className="flex-1" />
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={TITLES[bucket]} maxWidth="max-w-lg" footer={footer}>
      <form id="pay-bucket-form" noValidate onSubmit={handleSubmit} className="space-y-4">
        {/* Where it goes: existing accounts first (one already chosen), a new one last. */}
        {showTarget && (
          <Field id="pb-target" label={t('home.form.addTo')}>
            <select value={target}
              onChange={e => { targetTouched.current = true; setTarget(e.target.value); setInvalid(null); setError(null) }}
              className={CONTROL}>
              {holdings.map(i => (
                <option key={i.id} value={String(i.id)}>
                  {i.name} · {moneyFull(i.currentValue ?? i.investedAmount, i.currency)}
                </option>
              ))}
              {bucket === 'EMERGENCY' && (
                <option value={FUND}>{t('cmp.payBucket.emergencyFundOption')}</option>
              )}
              <option value={NEW}>
                {t(bucket === 'EMERGENCY' ? 'cmp.payBucket.newEmergencyFundOption' : 'cmp.payBucket.newInvestmentOption')}
              </option>
            </select>
          </Field>
        )}

        {creatingNew && bucket !== 'DONATION' && (
          <Field id="pb-name" required error={fieldError('name')}
            label={t(bucket === 'EMERGENCY' ? 'home.form.fundName' : 'cat.name')}>
            <input value={name}
              onChange={e => { setName(e.target.value); if (invalid === 'name') { setInvalid(null); setError(null) } }}
              className={invalid === 'name' ? CONTROL_INVALID : CONTROL}
              placeholder={t(bucket === 'EMERGENCY' ? 'cmp.payBucket.fundNamePlaceholder' : 'cmp.payBucket.investmentNamePlaceholder')} />
          </Field>
        )}

        <Field id="pb-amount" required label={t('tx.amount')} error={fieldError('amount')}>
          <AmountInput value={amount} currency={currency}
            onChange={v => { setAmount(v); if (invalid === 'amount') { setInvalid(null); setError(null) } }}
            className={invalid === 'amount' ? MONEY_INPUT_INVALID : MONEY_INPUT} suffix={currency} />
        </Field>
        {suggestedAmount != null && suggestedAmount > 0 && Math.abs(amount - suggestedAmount) > 0.001 && (
          <p className="-mt-2 text-xs tabular-nums text-slate-500">
            {t('home.form.suggested', { amount: moneyFull(suggestedAmount, currency) })}{' '}
            <button type="button" onClick={() => setAmount(suggestedAmount)} className={LINK}>
              {t('cmp.action.useThis')}
            </button>
          </p>
        )}

        <WalletPicker
          id="pb-wallet"
          label={t('home.wallet.from')}
          cards={wallets.cards}
          cashBalance={wallets.cashBalance}
          currency={currency}
          loaded={wallets.loaded}
          failed={wallets.failed}
          onRetry={wallets.reload}
          value={choice.value}
          onChange={v => { choice.choose(v); if (invalid === 'wallet') { setInvalid(null); setError(null) } }}
          noneLabel={allowNone ? t(creatingNew ? 'home.wallet.alreadyOwn' : 'home.wallet.none') : undefined}
          help={choice.value === 'none' ? t('home.wallet.noneHelp') : undefined}
          error={fieldError('wallet')}
        />

        <CompactDate id="pb-date" label={t('tx.date')} value={date} onChange={setDate} />

        {bucket === 'DONATION' && (
          <Field id="pb-recipient" label={optional(t('cmp.payBucket.recipient'))}>
            <input value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              className={CONTROL}
              placeholder={t('cmp.payBucket.recipientPlaceholder')} />
          </Field>
        )}

        <Field id="pb-note" label={optional(t('tx.note'))}>
          <input value={note} onChange={e => setNote(e.target.value)} className={CONTROL} />
        </Field>

        {/* A new investment's extra details — rarely needed, so folded away. */}
        {creatingNew && bucket === 'INVESTMENTS' && (
          <div>
            <button type="button" onClick={() => setMoreOpen(v => !v)} aria-expanded={moreOpen}
              className="focus-ring flex min-h-[44px] items-center gap-1.5 rounded-control text-sm font-medium text-slate-600 hover:text-slate-900">
              {moreOpen ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              {t('ui.more')}
            </button>
            {moreOpen && (
              <div className="mt-2 space-y-4">
                <Field id="pb-inv-type" label={t('tx.type')}>
                  <select value={invType} onChange={e => setInvType(e.target.value as InvestmentType)} className={CONTROL}>
                    {INVESTMENT_TYPES.map(it => <option key={it} value={it}>{INVESTMENT_TYPE_LABELS[it]}</option>)}
                  </select>
                </Field>
                <Field id="pb-broker" label={optional(t('cmp.payBucket.brokerPlatform'))}>
                  <input value={broker} onChange={e => setBroker(e.target.value)} className={CONTROL} />
                </Field>
              </div>
            )}
          </div>
        )}

        {error && !invalid && <p role="alert" className="text-sm text-expense">{error}</p>}
      </form>
    </Modal>
  )
}
