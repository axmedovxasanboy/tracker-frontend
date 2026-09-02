import { AlertTriangle } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'
import { useLang } from '../../i18n/LanguageContext'

/**
 * Shown wherever money can be recorded, while Settings has no monthly stable income.
 * The backend rejects those writes outright, so this explains the block up front rather
 * than letting the user fill in a form and hit a 400.
 */
export function IncomeRequiredNotice() {
  const { hasStableIncome, loading } = useSettings()
  const { t } = useLang()
  if (loading || hasStableIncome) return null
  return (
    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800">
        <span className="font-semibold">{t('income.requiredTitle')}</span>{' '}
        {t('income.requiredBody')}{' '}
        <NavLink to="/settings" className="underline font-medium hover:text-amber-900">
          {t('action.openSettings')}
        </NavLink>
      </p>
    </div>
  )
}
