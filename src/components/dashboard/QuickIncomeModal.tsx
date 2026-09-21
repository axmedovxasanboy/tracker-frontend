import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { AmountInput } from '../ui/AmountInput'
import { useLang } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { cardsApi } from '../../api/cards'
import { categoriesApi } from '../../api/categories'
import { transactionsApi } from '../../api/transactions'
import { extractErrorMessage } from '../../api/client'
import { moneyFull, todayLocal } from '../../utils/format'
import type { CardResponse, Category } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const FORM_ID = 'quick-income-form'
const CONTROL = 'focus-ring w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500'
const INPUT = `${CONTROL} h-11`
const MONEY_INPUT = `${INPUT} pr-14`
/** The wallet select's value for the cash pot; every other value is a card id. */
const CASH = 'cash'

/** A likely salary category to preselect: the owner records one when it arrives. */
const SALARY = /salary|maosh|oylik|ish haqi/i

/**
 * "Money came in" in five fields — amount, what for, category, wallet, date — in the same order
 * as the full Add form, minus the two questions it has already answered (income; Regular income).
 * The advisor never asks about the salary; recording it is how "coming" becomes "you have". The
 * category matters for one reason: a bonus-flagged one raises this month's set-aside targets by
 * its share, and a salary one does not.
 */
export function QuickIncomeModal({ open, onClose, onSaved }: Props) {
  const { t, categoryName } = useLang()
  const { showSuccess } = useToast()
  const [amount, setAmount] = useState(0)
  const [wallet, setWallet] = useState<string>(CASH)
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [date, setDate] = useState(todayLocal())
  const [note, setNote] = useState('')
  const [cards, setCards] = useState<CardResponse[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmount(0); setDate(todayLocal()); setNote(''); setError(null)
    cardsApi.getAll().then(r => {
      const uzs = r.data.filter(c => c.currency === 'UZS')
      setCards(uzs)
      // A salary usually lands on a card; start there when there is one.
      setWallet(uzs.length > 0 ? String(uzs[0].id) : CASH)
    }).catch(() => {})
    categoriesApi.getAll('INCOME').then(r => {
      setCategories(r.data)
      const flat = r.data.flatMap(c => [c, ...(c.children ?? [])])
      setCategoryId(flat.find(c => SALARY.test(c.name) || SALARY.test(c.nameUz ?? ''))?.id)
    }).catch(() => {})
  }, [open])

  // Parents with their children indented under them, so a bonus sub-category is findable.
  const categoryOptions = useMemo(() => categories.flatMap(c => [
    { id: c.id, label: categoryName(c) + (c.bonusIncome ? ` · ${t('cmp.quickIncome.bonusTag')}` : '') },
    ...(c.children ?? []).map(ch => ({
      id: ch.id,
      label: `— ${categoryName(ch)}${ch.bonusIncome || c.bonusIncome ? ` · ${t('cmp.quickIncome.bonusTag')}` : ''}`,
    })),
  ]), [categories, categoryName, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) { setError(t('cmp.err.amountPositive')); return }
    const cardId = wallet === CASH ? undefined : Number(wallet)
    setSaving(true); setError(null)
    try {
      await transactionsApi.create({
        type: 'INCOME', subType: 'REGULAR_INCOME', amount, currency: 'UZS',
        categoryId, cardId, cashAmount: cardId === undefined ? amount : 0,
        description: note.trim(), transactionDate: date,
      })
      showSuccess(t('cmp.quickIncome.saved', { amount: moneyFull(amount, 'UZS') }))
      onSaved(); onClose()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cmp.quickIncome.title')}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button label={t('action.cancel')} onClick={onClose} className="sm:flex-1" />
          <Button type="submit" form={FORM_ID} variant="primary" loading={saving} className="sm:flex-1"
            label={saving ? t('action.saving') : t('action.save')} />
        </div>
      }
    >
      {/* Same order as the full Add form: amount, what for, category, where, date. This dialog has
          already answered "income" and assumes Regular income, which is what makes it the
          shortcut; anything else goes through the full form. */}
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <Field id="quick-income-amount" label={t('cmp.field.amountRequired')}>
          <AmountInput id="quick-income-amount" required autoFocus value={amount || 0} currency="UZS"
            onChange={setAmount} className={MONEY_INPUT} suffix="UZS" />
        </Field>
        <Field id="quick-income-note" label={t('cmp.txModal.label.whatFor')}>
          <input id="quick-income-note" value={note} maxLength={255}
            onChange={e => setNote(e.target.value)} className={INPUT} />
        </Field>
        <Field id="quick-income-category" label={t('cmp.quickIncome.category')} help={t('cmp.quickIncome.categoryHelp')}>
          <select id="quick-income-category" value={categoryId ?? ''}
            onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : undefined)} className={INPUT}>
            <option value="">{t('cmp.quickIncome.noCategory')}</option>
            {categoryOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
        <Field id="quick-income-wallet" label={t('cmp.quickIncome.into')}>
          <select id="quick-income-wallet" value={wallet} onChange={e => setWallet(e.target.value)} className={INPUT}>
            {cards.map(c => (
              <option key={c.id} value={String(c.id)}>
                {c.name} •••• {c.lastFourDigits} · {moneyFull(c.currentBalance, c.currency)}
              </option>
            ))}
            <option value={CASH}>{t('tx.cash')}</option>
          </select>
        </Field>
        <Field id="quick-income-date" label={t('cmp.field.dateRequired')}>
          <input id="quick-income-date" required type="date" value={date}
            onChange={e => setDate(e.target.value)} className={INPUT} />
        </Field>
        {error && <p role="alert" className="text-sm text-expense">{error}</p>}
      </form>
    </Modal>
  )
}
