import { useLang } from '../../i18n/LanguageContext'

/**
 * The language switch for screens outside the app shell.
 *
 * The only other one lives in the sidebar, which is unreachable while signed out — so an Uzbek
 * speaker met the first two screens of the app in English with no way to change it. Both names
 * are written in their own language, because a user who cannot read the current one still has
 * to be able to find theirs.
 */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLang()

  return (
    <div
      role="group"
      aria-label={t('nav.language')}
      className={`inline-flex items-center gap-1 rounded-control bg-slate-100 p-1 ${className}`}
    >
      {(['en', 'uz'] as const).map(code => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`min-h-[44px] md:min-h-[38px] px-3 rounded-chip text-xs font-semibold
                      transition-colors focus-ring focus-visible:ring-offset-slate-100 ${
            lang === code ? 'bg-white text-slate-900 shadow-tile' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {code === 'en' ? 'English' : 'O‘zbek'}
        </button>
      ))}
    </div>
  )
}
