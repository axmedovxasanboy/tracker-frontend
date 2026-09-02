import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { useLang } from '../../i18n/LanguageContext'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { cardsApi } from '../../api/cards'
import { categoriesApi } from '../../api/categories'
import { financeApi } from '../../api/finance'
import { transactionsApi } from '../../api/transactions'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency } from '../../utils/format'
import type { Bucket, CardResponse, Category, Currency, InvestmentResponse, InvestmentType, TransactionSubType } from '../../types'

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

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

function today() {
  return new Date().toISOString().split('T')[0]
}

const INVESTMENT_TYPES: InvestmentType[] = ['REAL_ESTATE', 'BONDS', 'MUTUAL_FUND', 'GOLD', 'OTHER']

// The transaction sub-type each bucket books against — drives the category filter + auto-pick.
const BUCKET_SUBTYPE: Record<Bucket, TransactionSubType> = {
  DONATION:    'DONATION',
  EMERGENCY:   'EMERGENCY_CONTRIBUTION',
  INVESTMENTS: 'INVESTMENT',
  STOCKS:      'STOCK_PURCHASE',
}

export function PayBucketModal({ open, onClose, onSaved, bucket, currency, suggestedAmount, defaultMonth }: Props) {
  const { t, categoryName } = useLang()
  const BUCKET_TITLES: Record<Bucket, string> = {
    DONATION:    t('cmp.payBucket.titleDonation'),
    EMERGENCY:   t('cmp.payBucket.titleEmergency'),
    INVESTMENTS: t('cmp.payBucket.titleInvestments'),
    STOCKS:      t('cmp.payBucket.titleStocks'),
  }
  const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
    REAL_ESTATE: t('cmp.investmentType.realEstate'),
    BONDS: t('cmp.investmentType.bonds'),
    MUTUAL_FUND: t('cmp.investmentType.mutualFund'),
    GOLD: t('cmp.investmentType.gold'),
    OTHER: t('cmp.investmentType.other'),
  }
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')

  // Donation-specific
  const [recipientName, setRecipientName] = useState('')
  const [anonymous, setAnonymous] = useState(false)

  // Investment-specific (also the "new emergency fund" name; type is forced for STOCKS)
  const [name, setName] = useState('')
  const [invType, setInvType] = useState<InvestmentType>('OTHER')
  const [broker, setBroker] = useState('')

  // Emergency-as-investment: pick an existing emergency-tagged investment to top up, or create one.
  const [emInvestments, setEmInvestments] = useState<InvestmentResponse[]>([])
  const [emTarget, setEmTarget] = useState<string>('new') // 'new' | investment id (string)

  // Funding source: 'cash' | 'none' (record only, no wallet) | card id string. "None" is offered
  // only for the investment / emergency-fund buckets (they record an entity that can exist without
  // a wallet movement); donation / stocks always move money from a wallet.
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
    // Default date: today if it falls in the displayed month, otherwise the 1st.
    const cur = today()
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
    // Emergency bucket: load the user's emergency-tagged investments (matching currency) to top up.
    if (bucket === 'EMERGENCY') {
      setEmInvestments([]); setEmTarget('new')
      financeApi.getInvestments().then(r => {
        const em = r.data.filter(i => i.emergencyFund && i.currency === currency)
        setEmInvestments(em)
        if (em.length > 0) setEmTarget(String(em[0].id))
      }).catch(() => {})
    }
  }, [open, bucket, suggestedAmount, defaultMonth, currency])

  const matchingCards = cards.filter(c => c.currency === currency)
  const allowNone = bucket === 'INVESTMENTS' || bucket === 'EMERGENCY'
  const sourceCardId = /^\d+$/.test(source) ? Number(source) : undefined
  const sourceNone = source === 'none'
  const emCreatingNew = bucket === 'EMERGENCY' && emTarget === 'new'

  if (!bucket) return null

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
        if (emCreatingNew) {
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
      } else if (bucket === 'STOCKS') {
        // Stocks are tracked elsewhere — record a plain expense in the Stocks category.
        await transactionsApi.create({
          type: 'EXPENSE',
          subType: 'STOCK_PURCHASE',
          amount, currency,
          categoryId,
          description: description.trim() || 'Stocks',
          transactionDate: date,
          cardId: sourceCardId,
          cashAmount: sourceCardId ? 0 : amount,
        })
      }
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const markAlreadyPaid = async () => {
    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return }
    setSaving(true); setError(null)
    try {
      await financeApi.markPaid({ kind: 'BUCKET', bucket, amount, currency, month: date.slice(0, 7) })
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={BUCKET_TITLES[bucket]} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Emergency = an investment for emergencies. Pick which one to top up, or create one. */}
        {bucket === 'EMERGENCY' && (
          <Field label={t('cmp.payBucket.emergencyFund')}>
            <select value={emTarget} onChange={e => setEmTarget(e.target.value)} className={`${INPUT} bg-white`}>
              {emInvestments.map(i => (
                <option key={i.id} value={String(i.id)}>
                  {i.name} · {formatCurrency(i.investedAmount, i.currency)}
                </option>
              ))}
              <option value="new">{t('cmp.payBucket.newEmergencyFundOption')}</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {t('cmp.payBucket.emergencyFundHint')}
            </p>
          </Field>
        )}

        {/* Amount */}
        <Field label={t('cmp.field.amountWithCurrency', { currency })}>
          <AmountInput required value={amount} currency={currency}
            onChange={v => setAmount(v)}
            className={INPUT} suffix={currency} />
          {suggestedAmount != null && suggestedAmount > 0 && (
            <p className="text-[11px] text-slate-400 mt-1">
              {t('cmp.payBucket.suggested')} {formatCurrency(suggestedAmount, currency)}
              {amount !== suggestedAmount && (
                <button type="button" onClick={() => setAmount(suggestedAmount)}
                  className="ml-2 text-indigo-600 hover:underline">{t('cmp.action.useThis')}</button>
              )}
            </p>
          )}
        </Field>

        {/* Date */}
        <Field label={t('cmp.field.dateRequired')}>
          <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
        </Field>

        {/* Payment source. "None" (record only) offered for investment / emergency buckets. */}
        <Field label={t('cmp.field.source')}>
          <select value={source}
            onChange={e => setSource(e.target.value)}
            className={`${INPUT} bg-white`}>
            {allowNone && <option value="none">{t('cmp.source.noneOption')}</option>}
            <option value="cash">{t('tx.cash')}</option>
            {matchingCards.map(c => (
              <option key={c.id} value={String(c.id)}>
                {c.name} •••• {c.lastFourDigits} · {formatCurrency(c.currentBalance, c.currency)}
              </option>
            ))}
          </select>
          {sourceNone && (
            <p className="text-[11px] text-slate-400 mt-1">
              {t(bucket === 'EMERGENCY' ? 'cmp.payBucket.noWalletHintFund' : 'cmp.payBucket.noWalletHintInvested')}
            </p>
          )}
        </Field>

        {/* Category — auto-picked for this bucket; change it if you'd rather file it elsewhere. */}
        {categories.length > 0 && !sourceNone && (
          <Field label={t('tx.category')}>
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
            <Field label={t('cmp.payBucket.recipient')}>
              <input value={recipientName} disabled={anonymous}
                onChange={e => setRecipientName(e.target.value)}
                className={`${INPUT} ${anonymous ? 'opacity-60' : ''}`}
                placeholder={anonymous ? t('cmp.payBucket.anonymous') : t('cmp.payBucket.recipientPlaceholder')} />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={anonymous}
                onChange={e => setAnonymous(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600" />
              <span className="text-sm text-slate-600">{t('cmp.payBucket.anonymous')}</span>
            </label>
          </>
        )}

        {/* New emergency fund needs a name. */}
        {emCreatingNew && (
          <Field label={t('cmp.payBucket.fundNameRequired')}>
            <input required value={name} onChange={e => setName(e.target.value)}
              className={INPUT} placeholder={t('cmp.payBucket.fundNamePlaceholder')} />
          </Field>
        )}

        {bucket === 'INVESTMENTS' && (
          <>
            <Field label={t('cmp.payBucket.nameRequired')}>
              <input required value={name} onChange={e => setName(e.target.value)}
                className={INPUT} placeholder={t('cmp.payBucket.investmentNamePlaceholder')} />
            </Field>
            <Field label={t('cmp.payBucket.typeRequired')}>
              <select value={invType} onChange={e => setInvType(e.target.value as InvestmentType)}
                className={`${INPUT} bg-white`}>
                {INVESTMENT_TYPES.map(it =>
                  <option key={it} value={it}>{INVESTMENT_TYPE_LABELS[it]}</option>
                )}
              </select>
            </Field>
            <Field label={t('cmp.payBucket.brokerPlatform')}>
              <input value={broker} onChange={e => setBroker(e.target.value)} className={INPUT} />
            </Field>
          </>
        )}

        {bucket === 'STOCKS' && (
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            {t('cmp.payBucket.stocksHintPrefix')} <span className="font-medium">{t('cmp.bucket.stocks')}</span>{t('cmp.payBucket.stocksHintSuffix')}
          </p>
        )}

        <Field label={t('tx.description')}>
          <textarea rows={2} value={description}
            onChange={e => setDescription(e.target.value)}
            className={`${INPUT} resize-none`} />
        </Field>

        {error && (
          <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
            {t('action.cancel')}
          </button>
          <button type="button" onClick={markAlreadyPaid} disabled={saving}
            title={t('cmp.hint.countBucketNoTx')}
            className="flex-1 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-60">
            {t('cmp.action.alreadyPaid')}
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? t('action.saving') : bucket === 'EMERGENCY' && !emCreatingNew ? t('cmp.action.topUp') : t('action.record')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
