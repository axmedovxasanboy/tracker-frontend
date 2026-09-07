import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { cardsApi } from '../../api/cards'
import { categoriesApi } from '../../api/categories'
import { emergenciesApi } from '../../api/emergencies'
import { financeApi } from '../../api/finance'
import { extractErrorMessage } from '../../api/client'
import { money, moneyFull, todayLocal } from '../../utils/format'
import type { Bucket, CardResponse, Category, Currency, InvestmentResponse, InvestmentType, TransactionSubType } from '../../types'

const INPUT = 'w-full border border-slate-200 rounded-control px-3 py-2.5 text-sm text-slate-900 focus-ring'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  bucket: Bucket | null
  /** Currency shown to the user. Saved record uses this currency too. */
  currency: Currency
  /** Pre-fill amount (e.g. min-amount or split-share). */
  suggestedAmount?: number
  /** Default month from the picker (YYYY-MM). The date input starts at month-01. */
  defaultMonth: string
}

const INVESTMENT_TYPES: InvestmentType[] = ['REAL_ESTATE', 'BONDS', 'MUTUAL_FUND', 'GOLD', 'OTHER']

// The two non-numeric values of the Emergency target select; everything else is an investment id.
const EM_FUND = 'fund'
const EM_NEW = 'new'

// The transaction sub-type each bucket books against — drives the category filter + auto-pick.
const BUCKET_SUBTYPE: Record<Bucket, TransactionSubType> = {
  DONATION:    'DONATION',
  EMERGENCY:   'EMERGENCY_CONTRIBUTION',
  INVESTMENTS: 'INVESTMENT',
}

export function PayBucketModal({ open, onClose, onSaved, bucket, currency, suggestedAmount, defaultMonth }: Props) {
  const { t, categoryName } = useLang()
  const { showSuccess } = useToast()
  const BUCKET_TITLES: Record<Bucket, string> = {
    DONATION:    t('cmp.payBucket.titleDonation'),
    EMERGENCY:   t('cmp.payBucket.titleEmergency'),
    INVESTMENTS: t('cmp.payBucket.titleInvestments'),
  }
  // The short name for the confirmation — the dialog title is a sentence, a toast is not.
  const BUCKET_NAMES: Record<Bucket, string> = {
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
  const [description, setDescription] = useState('')

  // Donation-specific
  const [recipientName, setRecipientName] = useState('')
  const [anonymous, setAnonymous] = useState(false)

  // Investment-specific (also the "new emergency fund" name)
  const [name, setName] = useState('')
  const [invType, setInvType] = useState<InvestmentType>('OTHER')
  const [broker, setBroker] = useState('')

  // Where an Emergency payment lands. 'fund' is the emergency fund itself — an `Emergency` row
  // plus its mirrored EMERGENCY_CONTRIBUTION transaction, which is the record the Emergency fund
  // tab lists and the only one the user can later edit or delete there. The other two options
  // write an emergency-tagged *investment* instead; that also counts toward the bucket (same
  // transaction sub-type) but is owned by the Investments tab, so it is now an explicit choice
  // rather than the default. Paying the bucket used to always take the investment path, which is
  // why "Set aside in September 500.000" could sit beside "All time · 0 UZS" on the same screen.
  const [emInvestments, setEmInvestments] = useState<InvestmentResponse[]>([])
  const [emTarget, setEmTarget] = useState<string>(EM_FUND) // EM_FUND | EM_NEW | investment id

  // Funding source: 'cash' | 'none' (record only, no wallet) | card id string. "None" is offered
  // only for the investment / emergency-fund buckets (they record an entity that can exist without
  // a wallet movement); donations always move money from a wallet.
  const [source, setSource] = useState<string>('cash')
  const [cards, setCards] = useState<CardResponse[]>([])

  // Category — auto-picked to the bucket's matching category, overridable by the user.
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<number | undefined>()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !bucket) return
    setAmount(suggestedAmount ?? 0)
    // Default date: today if it falls in the displayed month, otherwise the 1st. `todayLocal`
    // reads the viewer's clock — toISOString() named yesterday before 05:00 in Tashkent, which
    // filed a late-night payment into the previous month's bucket.
    const cur = todayLocal()
    setDate(cur.startsWith(defaultMonth) ? cur : `${defaultMonth}-01`)
    setDescription('')
    setRecipientName('')
    setAnonymous(false)
    setName('')
    setInvType('OTHER')
    setBroker('')
    setSource('cash')
    setError(null)
    cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
    // Load categories matching this bucket's sub-type; default to the first (the seeded one).
    setCategories([]); setCategoryId(undefined)
    categoriesApi.getAll('EXPENSE', BUCKET_SUBTYPE[bucket]).then(r => {
      setCategories(r.data)
      if (r.data.length > 0) setCategoryId(r.data[0].id)
    }).catch(() => {})
    // Emergency bucket: the fund itself is the default; the user's emergency-tagged investments
    // are loaded so an existing holding can still be topped up from here.
    if (bucket === 'EMERGENCY') {
      setEmInvestments([]); setEmTarget(EM_FUND)
      financeApi.getInvestments().then(r => {
        setEmInvestments(r.data.filter(i => i.emergencyFund && i.currency === currency))
      }).catch(() => {})
    }
  }, [open, bucket, suggestedAmount, defaultMonth, currency])

  const matchingCards = cards.filter(c => c.currency === currency)
  const emCreatingNew = bucket === 'EMERGENCY' && emTarget === EM_NEW
  const emToFund = bucket === 'EMERGENCY' && emTarget === EM_FUND
  // "None" records the entity without moving money, which only the investment endpoints support.
  // A contribution to the fund itself is always a real wallet movement, so the option is not
  // offered there — and offering it would be a trap anyway: with no transaction behind it the
  // payment would not count toward the Emergency bucket the dialog was opened to satisfy.
  const allowNone = bucket === 'INVESTMENTS' || (bucket === 'EMERGENCY' && !emToFund)
  const sourceCardId = /^\d+$/.test(source) ? Number(source) : undefined
  const sourceNone = allowNone && source === 'none'

  if (!bucket) return null

  /** One confirmation for both write paths, so neither can be added without the other. */
  const confirmSaved = () => {
    showSuccess(t('cmp.payBucket.recordedToast', {
      bucket: BUCKET_NAMES[bucket], amount: moneyFull(amount, currency),
    }))
    onSaved(); onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return }
    setSaving(true); setError(null)
    try {
      if (bucket === 'DONATION') {
        if (!anonymous && !recipientName.trim()) {
          setError(t('cmp.err.recipientRequired'))
          setSaving(false); return
        }
        await financeApi.createDonation({
          recipientName: anonymous ? 'Anonymous' : recipientName.trim(),
          amount, currency, donationDate: date,
          description: description || undefined,
          anonymous, cardId: sourceCardId, categoryId,
        })
      } else if (bucket === 'EMERGENCY') {
        if (emToFund) {
          // The record the Emergency fund tab lists, edits and deletes. The backend mirrors it to
          // the same EMERGENCY_CONTRIBUTION transaction the bucket counts, so the plan tile and
          // the tab move together instead of quoting two totals for the same money.
          await emergenciesApi.create({
            amount, currency, date,
            description: description || undefined,
            cardId: sourceCardId, categoryId,
          })
        } else if (emCreatingNew) {
          if (!name.trim()) { setError(t('cmp.err.nameFund')); setSaving(false); return }
          await financeApi.createInvestment({
            name: name.trim(), type: 'OTHER',
            investedAmount: amount, currency, purchaseDate: date,
            emergencyFund: true,
            description: description || undefined,
            cardId: sourceCardId, openingBalance: sourceNone, categoryId,
          })
        } else {
          await financeApi.contributeInvestment(Number(emTarget), {
            amount, currency, date,
            cardId: sourceCardId, noWallet: sourceNone, categoryId,
            description: description || undefined,
          })
        }
      } else if (bucket === 'INVESTMENTS') {
        if (!name.trim()) {
          setError(t('cmp.err.investmentNameRequired'))
          setSaving(false); return
        }
        await financeApi.createInvestment({
          name: name.trim(),
          type: invType,
          investedAmount: amount, currency,
          purchaseDate: date,
          broker: broker || undefined,
          description: description || undefined,
          cardId: sourceCardId, openingBalance: sourceNone, categoryId,
        })
      }
      confirmSaved()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const markAlreadyPaid = async () => {
    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return }
    setSaving(true); setError(null)
    try {
      await financeApi.markPaid({ kind: 'BUCKET', bucket, amount, currency, month: date.slice(0, 7) })
      confirmSaved()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const footer = (
    <div className="space-y-2">
      {/* Was a `title` on the "Already paid" button — a tooltip no touch user could reach. */}
      <p className="text-xs text-slate-500">{t('cmp.hint.countBucketNoTx')}</p>
      <div className="flex flex-wrap gap-3">
        <Button label={t('action.cancel')} onClick={onClose} className="flex-1 min-w-[8rem]" />
        <Button label={t('cmp.action.alreadyPaid')} onClick={markAlreadyPaid} disabled={saving}
          className="flex-1 min-w-[8rem]" />
        <Button type="submit" form="pay-bucket-form" variant="primary" loading={saving}
          label={saving
            ? t('action.saving')
            // "Add money" is the top-up verb; adding to the fund itself, or opening a new holding,
            // is the app's one write verb.
            : bucket === 'EMERGENCY' && !emCreatingNew && !emToFund
              ? t('cmp.action.topUp')
              : t('action.record')}
          className="flex-1 min-w-[8rem]" />
      </div>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={BUCKET_TITLES[bucket]} maxWidth="max-w-lg" footer={footer}>
      <form id="pay-bucket-form" onSubmit={handleSubmit} className="space-y-3">
        {/* Where the money is recorded. The fund itself is first and default; an emergency-tagged
            investment is a deliberate second choice, because it is owned by the Investments tab. */}
        {bucket === 'EMERGENCY' && (
          <Field id="pb-em-target" label={t('cmp.payBucket.emergencyTarget')}
            help={emToFund
              ? t('cmp.payBucket.emergencyTargetFundHint')
              : t('cmp.payBucket.emergencyTargetHoldingHint')}>
            <select value={emTarget}
              onChange={e => {
                const next = e.target.value
                setEmTarget(next)
                // "None" only exists on the investment paths; leaving it selected after a switch
                // back to the fund would silently fall through to cash.
                if (next === EM_FUND && source === 'none') setSource('cash')
              }}
              className={`${INPUT} bg-white`}>
              <option value={EM_FUND}>{t('cmp.payBucket.emergencyFundOption')}</option>
              {emInvestments.map(i => (
                <option key={i.id} value={String(i.id)}>
                  {t('cmp.payBucket.emergencyHoldingOption', {
                    name: i.name, amount: moneyFull(i.investedAmount, i.currency),
                  })}
                </option>
              ))}
              <option value={EM_NEW}>{t('cmp.payBucket.newEmergencyFundOption')}</option>
            </select>
          </Field>
        )}

        {/* Amount */}
        <Field id="pb-amount" required label={t('cmp.field.amountWithCurrency', { currency })}>
          <AmountInput required value={amount} currency={currency}
            onChange={v => setAmount(v)}
            className={INPUT} suffix={currency} />
        </Field>
        {suggestedAmount != null && suggestedAmount > 0 && (
          <p className="-mt-2 text-xs text-slate-500 tabular-nums">
            {t('cmp.payBucket.suggested')} {moneyFull(suggestedAmount, currency)}
            {amount !== suggestedAmount && (
              <button type="button" onClick={() => setAmount(suggestedAmount)}
                className="ml-2 font-semibold text-indigo-600 hover:underline rounded-chip focus-ring">
                {t('cmp.action.useThis')}
              </button>
            )}
          </p>
        )}

        {/* Date */}
        <Field id="pb-date" required label={t('cmp.field.dateRequired')}>
          <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
        </Field>

        {/* Payment source. "None" (record only) offered for investment / emergency buckets. */}
        <Field id="pb-source" label={t('cmp.field.source')}
          help={sourceNone
            ? t(bucket === 'EMERGENCY' ? 'cmp.payBucket.noWalletHintFund' : 'cmp.payBucket.noWalletHintInvested')
            : undefined}>
          <select value={source}
            onChange={e => setSource(e.target.value)}
            className={`${INPUT} bg-white`}>
            {allowNone && <option value="none">{t('cmp.source.noneOption')}</option>}
            <option value="cash">{t('tx.cash')}</option>
            {matchingCards.map(c => (
              <option key={c.id} value={String(c.id)}>
                {c.name} •••• {c.lastFourDigits} · {moneyFull(c.currentBalance, c.currency)}
              </option>
            ))}
          </select>
        </Field>

        {/* Category — auto-picked for this bucket; change it if you'd rather file it elsewhere. */}
        {categories.length > 0 && !sourceNone && (
          <Field id="pb-category" label={t('tx.category')}>
            <select value={categoryId ?? ''}
              onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
              className={`${INPUT} bg-white`}>
              {categories.map(c => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}
            </select>
          </Field>
        )}

        {/* Bucket-specific fields */}
        {bucket === 'DONATION' && (
          <>
            <Field id="pb-recipient" label={t('cmp.payBucket.recipient')}>
              <input value={recipientName} disabled={anonymous}
                onChange={e => setRecipientName(e.target.value)}
                className={`${INPUT} ${anonymous ? 'opacity-60' : ''}`}
                placeholder={anonymous ? t('cmp.payBucket.anonymous') : t('cmp.payBucket.recipientPlaceholder')} />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={anonymous}
                onChange={e => setAnonymous(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus-ring" />
              <span className="text-sm text-slate-600">{t('cmp.payBucket.anonymous')}</span>
            </label>
          </>
        )}

        {/* New emergency fund needs a name. */}
        {emCreatingNew && (
          <Field id="pb-fund-name" required label={t('cmp.payBucket.fundNameRequired')}>
            <input required value={name} onChange={e => setName(e.target.value)}
              className={INPUT} placeholder={t('cmp.payBucket.fundNamePlaceholder')} />
          </Field>
        )}

        {bucket === 'INVESTMENTS' && (
          <>
            <Field id="pb-inv-name" required label={t('cmp.payBucket.nameRequired')}>
              <input required value={name} onChange={e => setName(e.target.value)}
                className={INPUT} placeholder={t('cmp.payBucket.investmentNamePlaceholder')} />
            </Field>
            <Field id="pb-inv-type" required label={t('cmp.payBucket.typeRequired')}>
              <select value={invType} onChange={e => setInvType(e.target.value as InvestmentType)}
                className={`${INPUT} bg-white`}>
                {INVESTMENT_TYPES.map(it =>
                  <option key={it} value={it}>{INVESTMENT_TYPE_LABELS[it]}</option>
                )}
              </select>
            </Field>
            <Field id="pb-broker" label={t('cmp.payBucket.brokerPlatform')}>
              <input value={broker} onChange={e => setBroker(e.target.value)} className={INPUT} />
            </Field>
          </>
        )}

        <Field id="pb-description" label={t('tx.description')}>
          <textarea rows={2} value={description}
            onChange={e => setDescription(e.target.value)}
            className={`${INPUT} resize-none`} />
        </Field>

        {error && <p role="alert" className="text-sm text-expense">{error}</p>}
      </form>
    </Modal>
  )
}
