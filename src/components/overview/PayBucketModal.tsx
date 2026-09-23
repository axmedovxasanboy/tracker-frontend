import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ErrorTile } from '../ui/ErrorTile'
import { Field } from '../ui/Field'
import { Skeleton } from '../ui/Skeleton'
import { AmountInput } from '../ui/AmountInput'
import { useRadioGroupKeys } from '../../hooks/useRadioGroupKeys'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { emergenciesApi } from '../../api/emergencies'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, todayLocal } from '../../utils/format'
import { CompactDate, CONTROL, CONTROL_INVALID, LINK, MONEY_INPUT, MONEY_INPUT_INVALID, useOptional } from '../transactions/formParts'
import { WalletPicker } from '../transactions/WalletPicker'
import {
  defaultWallet, readLastAccount, rememberAccount, rememberWallet, useWalletChoice, useWallets,
} from '../transactions/wallets'
import type { WalletValue } from '../transactions/wallets'
import type { Bucket, Currency, InvestmentResponse, InvestmentType } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  /** Called once the payment is saved. The dialog confirms it with its own toast. */
  onSaved: () => void
  bucket: Bucket | null
  /** Currency shown to the user. Saved record uses this currency too. */
  currency: Currency
  /** What this month still asks for: the amount starts on it, and a changed amount can go back. */
  suggestedAmount?: number
  /** Start on this amount instead — one already typed elsewhere (the Add form). */
  presetAmount?: number
  /** Start on this wallet — the one the Add form had picked. */
  presetWallet?: WalletValue
  /** Default month (YYYY-MM). The date starts on today when it falls in it, else on the 1st. */
  defaultMonth: string
}

const INVESTMENT_TYPES: InvestmentType[] = ['REAL_ESTATE', 'BONDS', 'MUTUAL_FUND', 'GOLD', 'OTHER']

// The two targets that are not an existing holding's id.
/** EMERGENCY only: a plain emergency-fund contribution (an `Emergency` + its mirrored transaction). */
const FUND = 'fund'
/** Open a new holding instead of adding to one that exists. */
const NEW = 'new'

type Invalid = 'amount' | 'wallet' | 'name' | 'target' | null
type AccountsState = 'idle' | 'loading' | 'ready' | 'failed'

/** A holding's worth: its market value when one was set, else what went in. */
const valueOf = (i: InvestmentResponse) => i.currentValue ?? i.investedAmount

/**
 * The accounts that take this bucket's money — opening balances included: that flag only says the
 * first amount did not come from a wallet, and money added from a wallet counts toward the month
 * like any other. The one last used comes first, then the rest by what they are worth. A savings
 * goal is neither; it has its own "Add money".
 */
function accountsFor(bucket: Bucket, currency: Currency, all: InvestmentResponse[], last: string | null) {
  return all
    .filter(i => i.currency === currency && !i.savingsGoal
      && (bucket === 'EMERGENCY' ? i.emergencyFund : !i.emergencyFund))
    .sort((a, b) =>
      Number(String(b.id) === last) - Number(String(a.id) === last) || valueOf(b) - valueOf(a))
}

/** The last one used if it is still there, else the one worth most, else the bucket's own start. */
function defaultTarget(bucket: Bucket, accounts: InvestmentResponse[], last: string | null): string {
  if (bucket === 'EMERGENCY' && last === FUND) return FUND
  if (accounts.length > 0) return String(accounts[0].id)
  return bucket === 'EMERGENCY' ? FUND : NEW
}

/**
 * Put money into a donation, the emergency fund or investments.
 *
 * The emergency fund and investments open on where the money goes: every account that takes it,
 * as one list — the one used last already chosen — then, for the emergency fund, a contribution
 * with no account behind it, and last a new account. A donation asks for the amount, the date, the
 * wallet — and, only if the owner wants, who it went to and a note.
 */
export function PayBucketModal({
  open, onClose, onSaved, bucket, currency, suggestedAmount, presetAmount, presetWallet, defaultMonth,
}: Props) {
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
  const [accountsState, setAccountsState] = useState<AccountsState>('idle')
  const [accountsError, setAccountsError] = useState<string | null>(null)
  /** Read once per open, so the list does not reorder under the owner while the dialog is up. */
  const [lastUsed, setLastUsed] = useState<string | null>(null)
  /** '' until the accounts are in: nothing is chosen for the owner before they can see the list. */
  const [target, setTarget] = useState('')
  /** True once the owner picked a target, so the list landing late cannot overrule them. */
  const targetTouched = useRef(false)
  const loadRun = useRef(0)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<Invalid>(null)

  const hasAccounts = bucket === 'EMERGENCY' || bucket === 'INVESTMENTS'
  const creatingNew = hasAccounts && target === NEW
  const toFund = bucket === 'EMERGENCY' && target === FUND
  const toHolding = /^\d+$/.test(target)
  // "Not from a wallet" only exists where a record can stand without a money movement.
  const allowNone = hasAccounts && !toFund

  const wallets = useWallets(open && !!bucket, currency)
  const choice = useWalletChoice({
    open: open && !!bucket,
    cards: wallets.cards,
    cashBalance: wallets.cashBalance,
    loaded: wallets.loaded,
    amount,
    fixed: presetWallet ?? undefined,
  })

  const loadAccounts = useCallback((b: Bucket, last: string | null) => {
    const run = ++loadRun.current
    setAccountsState('loading')
    setAccountsError(null)
    financeApi.getInvestments().then(r => {
      if (loadRun.current !== run) return
      const accounts = accountsFor(b, currency, r.data, last)
      setHoldings(accounts)
      setAccountsState('ready')
      if (!targetTouched.current) setTarget(defaultTarget(b, accounts, last))
    }).catch(err => {
      if (loadRun.current !== run) return
      setAccountsError(extractErrorMessage(err))
      setAccountsState('failed')
      // The fund needs no account; a new one still asks for its name first.
      if (!targetTouched.current) setTarget(b === 'EMERGENCY' ? FUND : NEW)
    })
  }, [currency])

  useEffect(() => {
    if (!open || !bucket) return
    setAmount(presetAmount ?? suggestedAmount ?? 0)
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
    setTarget('')
    targetTouched.current = false
    if (bucket === 'EMERGENCY' || bucket === 'INVESTMENTS') {
      const last = readLastAccount(bucket)
      setLastUsed(last)
      loadAccounts(bucket, last)
    } else {
      setLastUsed(null)
      setAccountsState('idle')
    }
  }, [open, bucket, suggestedAmount, presetAmount, defaultMonth, currency, loadAccounts])

  // Leaving a target that accepts "Not from a wallet" must not leave that answer standing.
  const { value: walletValue, choose: chooseWallet } = choice
  useEffect(() => {
    if (allowNone || walletValue !== 'none') return
    chooseWallet(defaultWallet(wallets.cards, wallets.cashBalance, amount) ?? 'cash')
    // Only the switch of target is the trigger; the balances are read as they stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowNone, walletValue, chooseWallet])

  // Every answer to "Pay into", in the order shown: the last one used first (the fund included),
  // the other accounts by value, the fund, then a new account.
  const targets: string[] = !hasAccounts ? [] : [
    ...(bucket === 'EMERGENCY' && lastUsed === FUND ? [FUND] : []),
    ...holdings.map(i => String(i.id)),
    ...(bucket === 'EMERGENCY' && lastUsed !== FUND ? [FUND] : []),
    NEW,
  ]
  const pickTarget = useCallback((v: string) => {
    targetTouched.current = true
    setTarget(v)
    if (invalid === 'target' || invalid === 'name') { setInvalid(null); setError(null) }
  }, [invalid])
  const targetKeys = useRadioGroupKeys(targets, target, pickTarget)

  if (!bucket) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hasAccounts && !target) { setInvalid('target'); setError(t('cmp.payBucket.pickAccount')); return }
    if (amount <= 0) { setInvalid('amount'); setError(t('cmp.err.amountPositive')); return }
    if (creatingNew && !name.trim()) {
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
      let account = ''
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
        account = holdings.find(i => String(i.id) === target)?.name ?? ''
        rememberAccount(bucket, target)
      } else if (toFund) {
        // The contribution the emergency fund lists; mirrored to the same transaction the
        // month counts, so both move together.
        await emergenciesApi.create({
          amount, currency, date,
          description: note.trim() || undefined,
          cardId,
        })
        account = NAMES.EMERGENCY
        rememberAccount(bucket, FUND)
      } else {
        const isEmergency = bucket === 'EMERGENCY'
        const res = await financeApi.createInvestment({
          name: name.trim(),
          type: isEmergency ? 'OTHER' : invType,
          investedAmount: amount, currency, purchaseDate: date,
          emergencyFund: isEmergency,
          broker: isEmergency ? undefined : broker.trim() || undefined,
          description: note.trim() || undefined,
          cardId, openingBalance: noWallet,
        })
        account = res.data.name
        rememberAccount(bucket, String(res.data.id))
      }
      rememberWallet(wallet)
      showSuccess(bucket === 'DONATION'
        ? t('cmp.payBucket.recordedToast', { bucket: NAMES[bucket], amount: moneyFull(amount, currency) })
        // Money that left no wallet is on the account, not in this month's savings.
        : noWallet
          ? t('cmp.payBucket.addedTo', { account })
          : t(bucket === 'EMERGENCY' ? 'cmp.payBucket.addedEmergency' : 'cmp.payBucket.addedInvestments', { account }))
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
        {/* Pay into: every account that takes this money, one per row, the one used last on top. */}
        {hasAccounts && (
          <div className="min-w-0">
            <p id="pb-target-label" className="mb-1 text-xs font-medium text-slate-600">
              {t('cmp.payBucket.payInto')}
              <span aria-hidden="true" className="text-expense"> *</span>
            </p>
            {accountsState === 'loading' && <Skeleton variant="row" count={2} bare className="mb-2" />}
            {accountsState === 'failed' && accountsError && (
              <ErrorTile compact className="mb-2" message={accountsError} onRetry={() => loadAccounts(bucket, lastUsed)} />
            )}
            {(accountsState === 'ready' || accountsState === 'failed') && <div
              id="pb-target"
              role="radiogroup"
              aria-labelledby="pb-target-label"
              aria-required="true"
              aria-invalid={invalid === 'target' ? true : undefined}
              aria-describedby={invalid === 'target' ? 'pb-target-error' : undefined}
              className="space-y-2"
            >
              {targets.map((v, index) => {
                const holding = holdings.find(i => String(i.id) === v)
                const checked = target === v
                const title = holding ? holding.name
                  : v === FUND ? t('cmp.payBucket.emergencyFundOption') : t('cmp.payBucket.newAccount')
                // Two accounts may share a name; the platform and the value tell them apart.
                const sub = holding
                  ? [holding.broker?.trim(), moneyFull(valueOf(holding), holding.currency)].filter(Boolean).join(' · ')
                  : undefined
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    {...targetKeys(index)}
                    onClick={() => pickTarget(v)}
                    className={`focus-ring flex min-h-[56px] w-full items-center gap-3 rounded-control border px-3 py-2 text-left transition-colors ${
                      checked
                        ? 'border-indigo-600 bg-indigo-50'
                        : invalid === 'target'
                          ? 'border-expense bg-white hover:bg-slate-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      checked ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                    }`}>
                      {checked && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{title}</span>
                      {sub && <span className="block truncate text-xs tabular-nums text-slate-500">{sub}</span>}
                    </span>
                    {v === NEW && <Plus className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>}
            {invalid === 'target' && (
              <p id="pb-target-error" role="alert" className="mt-1 text-xs leading-snug text-expense">{error}</p>
            )}
          </div>
        )}

        {creatingNew && (
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
          help={choice.value === 'none' ? t('cmp.payBucket.noWalletHint') : undefined}
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
