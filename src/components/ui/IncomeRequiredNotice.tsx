import { AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from './Button'
import { ErrorTile } from './ErrorTile'
import { useSettings } from '../../context/SettingsContext'
import { useLang } from '../../i18n/LanguageContext'

/**
 * The one place money can be recorded but is not: shown while Settings has no monthly stable
 * income, on the pages whose write actions the backend actually refuses.
 *
 * It is a component rather than a block on each page because the gate used to be solved three
 * different ways — an informational panel on Transactions, a disabled button with a tooltip on
 * Wallets, a silent scroll on Home — and a user who met two of them met what looked like two
 * unrelated features. One notice, one sentence, one route to being unblocked: the first-run
 * checklist on Home, where the same field is one tap away and no page of settings has to be
 * understood first.
 *
 * White, not amber: the contract allows one tinted alert per page and the amber belongs to the
 * icon chip. The tile reads as part of the grid it is dropped into.
 */
export function IncomeRequiredNotice({ className = '' }: { className?: string }) {
  const { hasStableIncome, ready, error, refetch } = useSettings()
  const { t } = useLang()
  const navigate = useNavigate()

  // A failed settings read is not "you have no income" — saying so to an account that has had one
  // for months is a lie, and the remedy it offers leads to a field that is already filled in.
  if (error) return <ErrorTile compact message={error} onRetry={refetch} className={className} />

  // `ready` rather than `!loading`: before the settings row has been answered, "no income" and
  // "not asked yet" look identical, and flashing the alarm on every load is how it earns being
  // ignored.
  if (!ready || hasStableIncome) return null

  return (
    <div
      role="status"
      className={`flex flex-col gap-3 rounded-tile border border-hairline bg-white p-5 shadow-tile
                  sm:flex-row sm:items-center ${className}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-amber-100 text-amber-600">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{t('income.requiredTitle')}</p>
          <p className="mt-0.5 text-sm text-slate-600">{t('income.requiredBody')}</p>
        </div>
      </div>
      <Button
        variant="primary"
        label={t('income.requiredAction')}
        onClick={() => navigate('/')}
        className="shrink-0 sm:ml-auto"
      />
    </div>
  )
}
