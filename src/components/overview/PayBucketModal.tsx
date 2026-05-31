import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { AmountInput } from '../ui/AmountInput'
import { cardsApi } from '../../api/cards'
import { financeApi } from '../../api/finance'
import { emergenciesApi } from '../../api/emergencies'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency } from '../../utils/format'
import type { Bucket, CardResponse, Currency, InvestmentType } from '../../types'

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

const BUCKET_TITLES: Record<Bucket, string> = {
  DONATION:    'Record a donation',
  EMERGENCY:   'Contribute to emergency fund',
  INVESTMENTS: 'Record an investment',
  STOCKS:      'Record a stock purchase',
}

const INVESTMENT_TYPES: InvestmentType[] = ['STOCKS', 'CRYPTO', 'REAL_ESTATE', 'BONDS', 'MUTUAL_FUND', 'GOLD', 'OTHER']

export function PayBucketModal({ open, onClose, onSaved, bucket, currency, suggestedAmount, defaultMonth }: Props) {
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')

  // Donation-specific
  const [recipientName, setRecipientName] = useState('')
  const [anonymous, setAnonymous] = useState(false)

  // Investment-specific (also used for STOCKS bucket — type is forced to STOCKS there)
  const [name, setName] = useState('')
  const [invType, setInvType] = useState<InvestmentType>('OTHER')
  const [broker, setBroker] = useState('')

  // Card selection — defaults to cash (cardId = undefined). Loaded once when modal opens.
  const [cardId, setCardId] = useState<number | undefined>()
  const [cards, setCards] = useState<CardResponse[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmount(suggestedAmount ?? 0)
    // Default date: today if it falls in the displayed month, otherwise the 1st.
    const cur = today()
    setDate(cur.startsWith(defaultMonth) ? cur : `${defaultMonth}-01`)
    setDescription('')
    setRecipientName('')
    setAnonymous(false)
    setName('')
    setInvType(bucket === 'STOCKS' ? 'STOCKS' : 'OTHER')
    setBroker('')
    setCardId(undefined)
    setError(null)
    cardsApi.getAll().then(r => setCards(r.data)).catch(() => {})
  }, [open, bucket, suggestedAmount, defaultMonth])

  const matchingCards = cards.filter(c => c.currency === currency)

  if (!bucket) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) { setError('Amount must be greater than 0.'); return }
    setSaving(true); setError(null)
    try {
      if (bucket === 'DONATION') {
        if (!anonymous && !recipientName.trim()) {
          setError('Recipient name is required (or mark as anonymous).')
          setSaving(false); return
        }
        await financeApi.createDonation({
          recipientName: anonymous ? 'Anonymous' : recipientName.trim(),
          amount, currency, donationDate: date,
          description: description || undefined,
          anonymous, cardId,
        })
      } else if (bucket === 'EMERGENCY') {
        await emergenciesApi.create({
          amount, currency, date,
          description: description || undefined,
          cardId,
        })
      } else if (bucket === 'INVESTMENTS' || bucket === 'STOCKS') {
        if (!name.trim()) {
          setError('Investment name is required.')
          setSaving(false); return
        }
        await financeApi.createInvestment({
          name: name.trim(),
          type: bucket === 'STOCKS' ? 'STOCKS' : invType,
          investedAmount: amount, currency,
          purchaseDate: date,
          broker: broker || undefined,
          description: description || undefined,
          cardId,
        })
      }
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={BUCKET_TITLES[bucket]} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Amount */}
        <Field label={`Amount * (${currency})`}>
          <AmountInput required value={amount} currency={currency}
            onChange={v => setAmount(v)}
            className={INPUT} suffix={currency} />
          {suggestedAmount != null && suggestedAmount > 0 && (
            <p className="text-[11px] text-slate-400 mt-1">
              Suggested: {formatCurrency(suggestedAmount, currency)}
              {amount !== suggestedAmount && (
                <button type="button" onClick={() => setAmount(suggestedAmount)}
                  className="ml-2 text-indigo-600 hover:underline">use this</button>
              )}
            </p>
          )}
        </Field>

        {/* Date */}
        <Field label="Date *">
          <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
        </Field>

        {/* Payment source — default cash. Card option only when one is available in this currency. */}
        <Field label={`Source ${matchingCards.length === 0 ? '(cash — no matching cards)' : ''}`}>
          <select value={cardId ?? ''}
            onChange={e => setCardId(e.target.value ? Number(e.target.value) : undefined)}
            className={`${INPUT} bg-white`}>
            <option value="">— Cash —</option>
            {matchingCards.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} •••• {c.lastFourDigits} · {formatCurrency(c.currentBalance, c.currency)}
              </option>
            ))}
          </select>
        </Field>

        {/* Bucket-specific fields */}
        {bucket === 'DONATION' && (
          <>
            <Field label="Recipient">
              <input value={recipientName} disabled={anonymous}
                onChange={e => setRecipientName(e.target.value)}
                className={`${INPUT} ${anonymous ? 'opacity-60' : ''}`}
                placeholder={anonymous ? 'Anonymous' : 'Who you donated to'} />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={anonymous}
                onChange={e => setAnonymous(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600" />
              <span className="text-sm text-slate-600">Anonymous</span>
            </label>
          </>
        )}

        {bucket === 'INVESTMENTS' && (
          <>
            <Field label="Name *">
              <input required value={name} onChange={e => setName(e.target.value)}
                className={INPUT} placeholder="Apple Inc., Real Estate, etc." />
            </Field>
            <Field label="Type *">
              <select value={invType} onChange={e => setInvType(e.target.value as InvestmentType)}
                className={`${INPUT} bg-white`}>
                {INVESTMENT_TYPES.filter(t => t !== 'STOCKS').map(t =>
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                )}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Stock-type purchases go under the Stocks bucket.</p>
            </Field>
            <Field label="Broker / Platform">
              <input value={broker} onChange={e => setBroker(e.target.value)} className={INPUT} />
            </Field>
          </>
        )}

        {bucket === 'STOCKS' && (
          <>
            <Field label="Stock name *">
              <input required value={name} onChange={e => setName(e.target.value)}
                className={INPUT} placeholder="e.g. NVDA, AAPL" />
            </Field>
            <Field label="Broker / Platform">
              <input value={broker} onChange={e => setBroker(e.target.value)} className={INPUT} />
            </Field>
          </>
        )}

        <Field label="Description">
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
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Record payment'}
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
