import { format } from 'date-fns'
import { ArrowUpRight, ArrowDownRight, Pencil, Trash2, CreditCard, MapPin, Route, Wallet } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useLang } from '../../i18n/LanguageContext'
import { Spinner } from '../ui/Spinner'
import { formatCurrency } from '../../utils/format'
import { parseTransportDescription } from '../../utils/transactionDescription'
import type { Currency, Transaction } from '../../types'

interface Props {
  transaction: Transaction | null
  open: boolean
  onClose: () => void
  onEdit: (t: Transaction) => void
  onDelete: (id: number) => void
  deleting: boolean
}

export function TransactionDetailModal({ transaction: tx, open, onClose, onEdit, onDelete, deleting }: Props) {
  const { t, categoryName } = useLang()
  const SUB_TYPE_LABELS: Record<string, string> = {
    REGULAR_INCOME: t('cmp.subType.regularIncome'), LOAN_RECEIVED: t('cmp.subType.loanReceived'),
    LOAN_RETURNED_TO_ME: t('cmp.subType.loanReturned'), REGULAR_EXPENSE: t('cmp.subType.regularExpense'),
    LOAN_GIVEN: t('cmp.subType.loanGiven'), LOAN_REPAYMENT: t('cmp.subType.loanRepayment'),
    BANK_LOAN_PAYMENT: t('cmp.subType.bankLoanPayment'), INVESTMENT: t('cmp.subType.investment'), DONATION: t('cmp.subType.donation'),
  }
  if (!tx) return null

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

  return (
    <Modal open={open} onClose={onClose} title={t('cmp.txDetail.title')} maxWidth="max-w-lg">
      <div className="space-y-5">
        {/* Hero amount */}
        <div className={`rounded-2xl p-5 flex items-center gap-4 ${
          tx.type === 'INCOME' ? 'bg-emerald-50' : 'bg-rose-50'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            tx.type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'
          }`}>
            {tx.type === 'INCOME'
              ? <ArrowUpRight className="w-6 h-6 text-white" />
              : <ArrowDownRight className="w-6 h-6 text-white" />
            }
          </div>
          <div>
            <p className={`text-3xl font-bold ${tx.type === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'}`}>
              {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency as Currency)}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">{heroDescription || '—'}</p>
          </div>
        </div>

        {/* Details grid */}
        <div className="space-y-3">
          <Row label={t('tx.date')}>{format(new Date(tx.transactionDate), 'dd-MMM-yyyy')}</Row>
          <Row label={t('tx.currency')}>{tx.currency}</Row>

          {tx.category && (
            <Row label={t('tx.category')}>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tx.category.color }} />
                {categoryName(tx.category)}
              </span>
            </Row>
          )}

          {tx.subType && (
            <Row label={t('cmp.txDetail.transactionType')}>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
                {SUB_TYPE_LABELS[tx.subType] ?? tx.subType}
              </span>
            </Row>
          )}

          {tx.card && (
            <Row label={t('cmp.txDetail.cardWallet')}>
              <span className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                {tx.card.name} •••• {tx.card.lastFourDigits}
              </span>
            </Row>
          )}

          {(tx.cashAmount ?? 0) > 0 && (
            <Row label={t('cmp.txDetail.paymentSplit')}>
              <span className="flex items-center gap-2 text-xs">
                <Wallet className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-amber-700 font-semibold">{formatCurrency(tx.cashAmount, tx.currency as Currency)}</span>
                <span className="text-slate-400">{t('tx.cash').toLowerCase()}</span>
                {tx.card && (tx.cardAmount ?? 0) > 0 && (
                  <>
                    <span className="text-slate-300">·</span>
                    <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-indigo-700 font-semibold">{formatCurrency(tx.cardAmount, tx.currency as Currency)}</span>
                    <span className="text-slate-400">{t('tx.card').toLowerCase()}</span>
                  </>
                )}
              </span>
            </Row>
          )}

          {(routeFrom || routeTo) && (
            <Row label={t('cmp.txDetail.route')}>
              <span className="flex items-center gap-1.5 text-slate-700">
                <Route className="w-4 h-4 text-orange-400" />
                <span>{routeFrom || '—'}</span>
                <span className="text-slate-300">→</span>
                <span>{routeTo || '—'}</span>
              </span>
            </Row>
          )}

          {/* Legacy place column — kept visible if older rows still have it. */}
          {!isTransport && tx.place && (
            <Row label={t('cmp.txDetail.place')}>
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400" />
                {tx.place}
              </span>
            </Row>
          )}

          {isTransport && detailNote && (
            <Row label={t('tx.note')}><span className="text-slate-600">{detailNote}</span></Row>
          )}
          {!isTransport && tx.note && <Row label={t('tx.note')}><span className="text-slate-600">{tx.note}</span></Row>}

          <Row label={t('cmp.txDetail.created')}>{format(new Date(tx.createdAt), 'dd-MMM-yyyy HH:mm')}</Row>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1 border-t border-slate-100">
          <button
            onClick={() => { onClose(); onEdit(tx) }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Pencil className="w-4 h-4" /> {t('action.edit')}
          </button>
          <button
            onClick={() => onDelete(tx.id)}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-100 transition-colors disabled:opacity-50"
          >
            {deleting ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            {t('action.delete')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-50">
      <span className="text-sm text-slate-400 shrink-0">{label}</span>
      <span className="text-sm text-slate-700 text-right font-medium">{children}</span>
    </div>
  )
}
