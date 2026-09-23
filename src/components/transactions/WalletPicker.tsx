import { Ban, Banknote, CreditCard } from 'lucide-react'
import { useLang } from '../../i18n/LanguageContext'
import { Button } from '../ui/Button'
import { money } from '../../utils/format'
import { ChipGroup, LINK_BLOCK } from './formParts'
import type { ChipOption } from './formParts'
import type { WalletValue } from './wallets'
import type { CardResponse, Currency } from '../../types'

/**
 * THE wallet question, asked once: "From" for money going out, "To" for money coming in. Every
 * card, then Cash, each with what it holds — so the owner picks the wallet and sees the balance in
 * the same glance. Replaces the "Card only / Cash only / Both" switch plus a separate card select.
 *
 * `noneLabel` adds the one extra answer a few forms accept (money that never sat in a tracked
 * wallet). `onSplitChange` adds the "split between card and cash" link; while split, Cash is not
 * an answer here — the cash half is typed beside it.
 */
export function WalletPicker({
  id, label, cards, cashBalance, value, onChange, currency = 'UZS',
  loaded = true, failed = false, onRetry, noneLabel,
  split = false, onSplitChange, error, help,
}: {
  id: string
  label: string
  cards: CardResponse[]
  cashBalance: number | null
  value: WalletValue
  onChange: (v: number | 'cash' | 'none') => void
  currency?: Currency
  loaded?: boolean
  failed?: boolean
  onRetry?: () => void
  noneLabel?: string
  split?: boolean
  onSplitChange?: (split: boolean) => void
  error?: string
  help?: string
}) {
  const { t } = useLang()

  // A name alone is ambiguous when two cards share it; the last four digits settle it.
  const dupNames = new Set(cards.map(c => c.name).filter((n, i, all) => all.indexOf(n) !== i))
  const options: ChipOption<number | string>[] = cards.map(c => ({
    value: c.id,
    label: dupNames.has(c.name) ? `${c.name} ••${c.lastFourDigits}` : c.name,
    sub: money(c.currentBalance ?? 0, c.currency),
    icon: <CreditCard className="h-4 w-4" />,
  }))
  if (!split) {
    options.push({
      value: 'cash',
      label: t('tx.cash'),
      sub: cashBalance != null ? money(cashBalance, currency) : undefined,
      icon: <Banknote className="h-4 w-4" />,
    })
  }
  if (noneLabel && !split) {
    options.push({ value: 'none', label: noneLabel, icon: <Ban className="h-4 w-4" /> })
  }

  if (!loaded) {
    return (
      <div className="min-w-0" aria-busy="true">
        <p className="mb-1 text-xs font-medium text-slate-600">{label}</p>
        <div className="flex gap-2">
          <div className="h-11 w-28 animate-pulse rounded-control bg-slate-200/70" />
          <div className="h-11 w-24 animate-pulse rounded-control bg-slate-200/70" />
        </div>
        <span className="sr-only">{t('ui.loading')}</span>
      </div>
    )
  }

  const canSplit = !!onSplitChange && cards.length > 0

  return (
    <div className="min-w-0 space-y-1">
      <ChipGroup<number | string>
        id={id}
        label={label}
        required
        options={options}
        value={value}
        onChange={v => onChange(v as number | 'cash' | 'none')}
        error={error}
        help={help}
      />
      {failed && (
        <div className="flex items-center justify-between gap-3 rounded-control border border-slate-200 px-3 py-1.5">
          <p className="text-xs text-slate-500">{t('cmp.txModal.cardsLoadFailed')}</p>
          {onRetry && <Button size="sm" variant="ghost" label={t('ui.error.retry')} onClick={onRetry} />}
        </div>
      )}
      {canSplit && (
        <button type="button" onClick={() => onSplitChange!(!split)} className={LINK_BLOCK}>
          {split ? t('home.wallet.noSplit') : t('home.wallet.split')}
        </button>
      )}
    </div>
  )
}
