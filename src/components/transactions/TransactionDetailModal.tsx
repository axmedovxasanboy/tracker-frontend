import { format } from 'date-fns'
import { ArrowUpRight, ArrowDownRight, Pencil, Trash2, CreditCard, MapPin, Route, Wallet } from 'lucide-react'
import { Modal } from '../ui/Modal'
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

const SUB_TYPE_LABELS: Record<string, string> = {
  REGULAR_INCOME: 'Regular Income', LOAN_RECEIVED: 'Loan Received',
  LOAN_RETURNED_TO_ME: 'Loan Returned', REGULAR_EXPENSE: 'Regular Expense',
  LOAN_GIVEN: 'Loan Given', LOAN_REPAYMENT: 'Loan Repayment',
  BANK_LOAN_PAYMENT: 'Bank Loan Payment', INVESTMENT: 'Investment', DONATION: 'Donation',
}

export function TransactionDetailModal({ transaction: t, open, onClose, onEdit, onDelete, deleting }: Props) {
  if (!t) return null

  const isTransport = t.category?.kind === 'TRANSPORT'
  const parsed = parseTransportDescription(t.description, isTransport)
  // Fall back to legacy columns when modern description-encoded route is absent.
  const routeFrom = parsed.from ?? t.fromLocation ?? undefined
  const routeTo = parsed.to ?? t.toLocation ?? undefined
  const heroDescription = isTransport && (routeFrom || routeTo)
    ? (parsed.note.trim() || `${routeFrom ?? '—'} → ${routeTo ?? '—'}`)
    : t.description
  // For non-TRANSPORT we just show the raw description in its row.
  const detailNote = isTransport ? parsed.note.trim() : ''

  return (
    <Modal open={open} onClose={onClose} title="Transaction Details" maxWidth="max-w-lg">
      <div className="space-y-5">
        {/* Hero amount */}
        <div className={`rounded-2xl p-5 flex items-center gap-4 ${
          t.type === 'INCOME' ? 'bg-emerald-50' : 'bg-rose-50'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            t.type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'
          }`}>
            {t.type === 'INCOME'
              ? <ArrowUpRight className="w-6 h-6 text-white" />
              : <ArrowDownRight className="w-6 h-6 text-white" />
            }
          </div>
          <div>
            <p className={`text-3xl font-bold ${t.type === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'}`}>
              {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount, t.currency as Currency)}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">{heroDescription || '—'}</p>
          </div>
        </div>

        {/* Details grid */}
        <div className="space-y-3">
          <Row label="Date">{format(new Date(t.transactionDate), 'dd-MMM-yyyy')}</Row>
          <Row label="Currency">{t.currency}</Row>

          {t.category && (
            <Row label="Category">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.category.color }} />
                {t.category.name}
              </span>
            </Row>
          )}

          {t.subType && (
            <Row label="Transaction Type">
              <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
                {SUB_TYPE_LABELS[t.subType] ?? t.subType}
              </span>
            </Row>
          )}

          {t.card && (
            <Row label="Card / Wallet">
              <span className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                {t.card.name} •••• {t.card.lastFourDigits}
              </span>
            </Row>
          )}

          {(t.cashAmount ?? 0) > 0 && (
            <Row label="Payment Split">
              <span className="flex items-center gap-2 text-xs">
                <Wallet className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-amber-700 font-semibold">{formatCurrency(t.cashAmount, t.currency as Currency)}</span>
                <span className="text-slate-400">cash</span>
                {t.card && (t.cardAmount ?? 0) > 0 && (
                  <>
                    <span className="text-slate-300">·</span>
                    <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-indigo-700 font-semibold">{formatCurrency(t.cardAmount, t.currency as Currency)}</span>
                    <span className="text-slate-400">card</span>
                  </>
                )}
              </span>
            </Row>
          )}

          {(routeFrom || routeTo) && (
            <Row label="Route">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Route className="w-4 h-4 text-orange-400" />
                <span>{routeFrom || '—'}</span>
                <span className="text-slate-300">→</span>
                <span>{routeTo || '—'}</span>
              </span>
            </Row>
          )}

          {/* Legacy place column — kept visible if older rows still have it. */}
          {!isTransport && t.place && (
            <Row label="Place">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400" />
                {t.place}
              </span>
            </Row>
          )}

          {isTransport && detailNote && (
            <Row label="Note"><span className="text-slate-600">{detailNote}</span></Row>
          )}
          {!isTransport && t.note && <Row label="Note"><span className="text-slate-600">{t.note}</span></Row>}

          <Row label="Created">{format(new Date(t.createdAt), 'dd-MMM-yyyy HH:mm')}</Row>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1 border-t border-slate-100">
          <button
            onClick={() => { onClose(); onEdit(t) }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button
            onClick={() => onDelete(t.id)}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-100 transition-colors disabled:opacity-50"
          >
            {deleting ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            Delete
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
