import { useState } from 'react'
import { ArrowLeftRight, Eye, EyeOff, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { extractErrorMessage } from '../api/client'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { LanguageToggle } from '../components/ui/LanguageToggle'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'

// 44px tall (h-11): these two screens are the first thing a phone user touches.
const INPUT = 'w-full h-11 rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus-ring'

/** The three steps the first-run checklist on Home will walk through, previewed here. */
const FIRST_STEPS: TKey[] = [
  'page.signup.first.step1',
  'page.signup.first.step2',
  'page.signup.first.step3',
]

export function Signup() {
  const { t } = useLang()
  const { signup } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { setError(t('page.signup.passwordTooShort')); return }
    if (password !== confirm) { setError(t('page.signup.passwordMismatch')); return }
    setSubmitting(true); setError(null)
    try {
      await signup(username.trim(), password)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-ground p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-500 rounded-chip flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <span className="text-slate-900 font-semibold text-lg tracking-tight">Tracker</span>
          </div>
          <LanguageToggle />
        </div>

        {/* One sentence about what this is. The screen used to open with three password fields
            and no statement of what the account was for. */}
        <p className="px-1 text-sm text-slate-600 leading-snug">{t('page.signup.productLine')}</p>

        <div className="bg-white rounded-tile border border-hairline shadow-tile p-5">
          <h1 className="text-title text-slate-900">{t('page.signup.title')}</h1>
          <p className="mt-0.5 text-sm text-slate-600">{t('page.signup.subtitle')}</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <Field id="signup-username" label={t('page.signup.usernameLabel')}>
              <input
                autoFocus required value={username} onChange={e => setUsername(e.target.value)}
                placeholder={t('page.signup.usernamePlaceholder')} autoComplete="username"
                className={INPUT}
              />
            </Field>

            <div className="relative">
              <Field id="signup-password" label={t('page.shared.password')} help={t('page.signup.passwordHelp')}>
                <input
                  required type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password" className={`${INPUT} pr-12`}
                />
              </Field>
              <RevealButton shown={showPassword} onToggle={() => setShowPassword(v => !v)} />
            </div>

            <div className="relative">
              <Field id="signup-confirm" label={t('page.signup.confirmPasswordPlaceholder')}>
                <input
                  required type={showConfirm ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password" className={`${INPUT} pr-12`}
                />
              </Field>
              <RevealButton shown={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
            </div>

            {error && (
              <p role="alert" className="text-sm text-expense leading-snug">{error}</p>
            )}

            <Button
              type="submit" variant="primary" className="w-full"
              icon={<UserPlus className="w-4 h-4" aria-hidden="true" />}
              label={submitting ? t('page.signup.creating') : t('page.signup.createAccount')}
              loading={submitting}
            />
          </form>

          <Link
            to="/login"
            className="mt-4 block rounded-control py-2 text-center text-sm font-medium
                       text-indigo-600 hover:text-indigo-700 hover:underline focus-ring"
          >
            {t('page.signup.haveAccount')}
          </Link>
        </div>

        {/* What happens after the account exists — the same three steps Home will ask for, so
            the first screen is a preview of the work rather than a form with no context. */}
        <div className="bg-white rounded-tile border border-hairline shadow-tile p-5">
          <h2 className="text-sm font-semibold text-slate-900">{t('page.signup.whatNextTitle')}</h2>
          <ol className="mt-3 space-y-2.5">
            {FIRST_STEPS.map((key, i) => (
              <li key={key} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                             bg-slate-100 text-xs font-semibold tabular-nums text-slate-600"
                >
                  {i + 1}
                </span>
                <span className="text-sm text-slate-600">{t(key)}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="px-1 text-xs text-slate-500 leading-snug">{t('page.signup.noResetNote')}</p>
      </div>
    </div>
  )
}

/** The show/hide control for one password input, anchored to the input's own bottom edge. */
function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { t } = useLang()
  const label = t(shown ? 'page.shared.hidePassword' : 'page.shared.showPassword')

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={label}
      title={label}
      className="absolute right-0 bottom-0 w-11 h-11 flex items-center justify-center
                 rounded-control text-slate-500 hover:text-slate-900 transition-colors focus-ring"
    >
      {shown ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
    </button>
  )
}
