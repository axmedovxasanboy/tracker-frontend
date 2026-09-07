import type { ReactNode } from 'react'
import { ArrowUpRight, ArrowDownRight, Pencil, Trash2, CreditCard, MapPin, Route, Wallet } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useLang } from '../../i18n/LanguageContext'
import { formatDate, moneyFull } from '../../utils/format'
import { parseTransportDescription } from '../../utils/transactionDescription'
import type { Transaction } from '../../types'

interface Props {
  transaction: Transaction | null
  open: boolean
  onClose: () => void
  onEdit: (t: Transaction) => void
  onDelete: (id: number) => void
  deleting: boolean
}

export function TransactionDetailModal({ transaction: tx, open, onClose, onEdit, onDelete, deleting }: Props) {
  const { t, lang, categoryName } = useLang()
  const SUB_TYPE_LABELS: Record<string, string> = {
    REGULAR_INCOME: t('cmp.subType.regularIncome'), LOAN_RECEIVED: t('cmp.subType.loanReceived'),
    LOAN_RETURNED_TO_ME: t('cmp.subType.loanReturned'), REGULAR_EXPENSE: t('cmp.subType.regularExpense'),
    LOAN_GIVEN: t('cmp.subType.loanGiven'), LOAN_REPAYMENT: t('cmp.subType.loanRepayment'),
    BANK_LOAN_PAYMENT: t('cmp.subType.bankLoanPayment'), INVESTMENT: t('cmp.subType.investment'), DONATION: t('cmp.subType.donation'),
  }
  if (!tx) return null

  const income = tx.type === 'INCOME'
  const isTransport = tx.category?.kind === 'TRANSPORT'
  const parsed = parseTransportDescription(tx.description, isTransport)
  // Fall back to legacy columns when modern description-encoded route is absent.
  const routeFrom = parsed.from ?? tx.fromLocation ?? undefined
  const routeTo = parsed.to ?? tx.toLocation ?? undefined
  const heroDescription = isTransport && (routeFrom || routeTo)
    ? (parsed.note.trim() || `${routeFrom ?? '—'} → ${routeTo ?? '—'}`)
    : tx.description
  // For non-TRANSPORT we just show the raw description in its row.
  const detailNote = isTransport ? parsed.note.trim() : ''

  const categoryLabel = tx.category ? categoryName(tx.category) : ''
  const subTypeLabel = tx.subType ? (SUB_TYPE_LABELS[tx.subType] ?? tx.subType) : ''
  /**
   * The seeded categories are named after their sub-type ("Donation", "Investment", …), so the
   * old Category and Transaction-type rows printed the same word twice for one fact. The type
   * only earns a row when it says something the category does not — and "Regular expense" beside
   * a red amount never does.
   */
  const showSubType = !!subTypeLabel
    && tx.subType !== 'REGULAR_INCOME' && tx.subType !== 'REGULAR_EXPENSE'
    && subTypeLabel.toLocaleLowerCase(lang) !== categoryLabel.toLocaleLowerCase(lang)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cmp.txDetail.title')}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
            label={t('action.edit')}
            onClick={() => { onClose(); onEdit(tx) }}
            className="flex-1"
          />
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            label={t('action.delete')}
            loading={deleting}
            onClick={() => onDelete(tx.id)}
            className="flex-1"
          />
        </div>
      }
    >
      <div className="space-y-5">
        {/* The amount, said once. Colour lives on the chip and the figure — the surface stays
            white, so one saved record cannot shout louder than the page it opened from. */}
        <div className="flex items-center gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-chip ${
            income ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
          }`}>
            {income
              ? <ArrowUpRight className="h-6 w-6" aria-hidden="true" />
              : <ArrowDownRight className="h-6 w-6" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className={`text-stat tabular-nums ${income ? 'text-income' : 'text-expense'}`}>
              {income ? '+' : '-'}{moneyFull(tx.amount, tx.currency)}
            </p>
            <p className="mt-0.5 text-sm text-slate-600 break-words">{heroDescription || '—'}</p>
          </div>
        </div>

        <div className="space-y-1">
          <Row label={t('tx.date')}>{formatDate(tx.transactionDate, lang)}</Row>

          {tx.category && (
            <Row label={t('tx.category')}>
              <span className="flex items-center justify-end gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tx.category.color }} />
                {categoryLabel}
                {showSubType && (
                  <span className="rounded-chip bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {subTypeLabel}
                  </span>
                )}
              </span>
            </Row>
          )}

          {/* A sub-type with no category of its own still has to be named somewhere. */}
          {!tx.category && showSubType && (
            <Row label={t('cmp.txDetail.transactionType')}>
              <span className="rounded-chip bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {subTypeLabel}
              </span>
            </Row>
          )}

          {tx.card && (
            <Row label={t('cmp.txDetail.cardWallet')}>
              <span className="flex items-center justify-end gap-2">
                <CreditCard className="h-4 w-4 text-slate-400" aria-hidden="true" />
                {tx.card.name} •••• {tx.card.lastFourDigits}
              </span>
            </Row>
          )}

          {(tx.cashAmount ?? 0) > 0 && (
            <Row label={t('cmp.txDetail.paymentSplit')}>
              <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                <Wallet className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <span className="tabular-nums">{moneyFull(tx.cashAmount, tx.currency)}</span>
                <span className="text-slate-500">{t('tx.cash').toLowerCase()}</span>
                {tx.card && (tx.cardAmount ?? 0) > 0 && (
                  <>
                    <span className="text-slate-400">·</span>
                    <CreditCard className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span className="tabular-nums">{moneyFull(tx.cardAmount, tx.currency)}</span>
                    <span className="text-slate-500">{t('tx.card').toLowerCase()}</span>
                  </>
                )}
              </span>
            </Row>
          )}

          {(routeFrom || routeTo) && (
            <Row label={t('cmp.txDetail.route')}>
              <span className="flex items-center justify-end gap-1.5">
                <Route className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <span>{routeFrom || '—'}</span>
                <span className="text-slate-400">→</span>
                <span>{routeTo || '—'}</span>
              </span>
            </Row>
          )}

          {/* Legacy place column — kept visible if older rows still have it. */}
          {!isTransport && tx.place && (
            <Row label={t('cmp.txDetail.place')}>
              <span className="flex items-center justify-end gap-2">
                <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                {tx.place}
              </span>
            </Row>
          )}

          {isTransport && detailNote && <Row label={t('tx.note')}>{detailNote}</Row>}
          {!isTransport && tx.note && <Row label={t('tx.note')}>{tx.note}</Row>}

          <Row label={t('cmp.txDetail.created')}>{formatDate(tx.createdAt, lang, 'time')}</Row>
        </div>
      </div>
    </Modal>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline py-2 last:border-b-0">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-900">{children}</span>
    </div>
  )
}
