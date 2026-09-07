import { useState } from 'react'
import { ArrowLeftRight, Eye, EyeOff, LogIn, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBackendStatus } from '../context/BackendStatusContext'
import { extractErrorMessage } from '../api/client'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { LanguageToggle } from '../components/ui/LanguageToggle'
import { Skeleton } from '../components/ui/Skeleton'
import { useLang } from '../i18n/LanguageContext'

// 44px tall (h-11): these two screens are the first thing a phone user touches.
const INPUT = 'w-full h-11 rounded-control border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus-ring'

export function Login() {
  const { t } = useLang()
  const { login } = useAuth()
  // A dead backend used to look like a working app that just would not let you in.
  const { isOnline, forceCheck } = useBackendStatus()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true); setError(null)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-ground p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-500 rounded-chip flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <span className="text-slate-900 font-semibold text-lg tracking-tight">Tracker</span>
          </div>
          <LanguageToggle />
        </div>

        <div className="bg-white rounded-tile border border-hairline shadow-tile p-5">
          {isOnline ? (
            <>
              <h1 className="text-title text-slate-900">{t('page.login.welcome')}</h1>
              <p className="mt-0.5 text-sm text-slate-600">{t('page.login.subtitle')}</p>
            </>
          ) : (
            // "Welcome back" over a form that cannot submit reads as a broken app. While the
            // server is unreachable the screen says so, and shows the shape of what is coming.
            <div>
              <h1 className="text-title text-slate-900">{t('page.login.stillConnecting')}</h1>
              <p className="mt-0.5 text-sm text-slate-600">{t('page.login.stillConnectingHelp')}</p>
              <Skeleton variant="text" count={2} bare className="mt-3" />
              <Button
                label={t('ui.error.retry')}
                icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
                onClick={() => { void forceCheck() }}
                className="mt-3"
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <Field id="login-username" label={t('page.login.usernameLabel')}>
              {/* No placeholder: it said "Username" too, and a placeholder that repeats the
                  label is a label that disappears the moment you type. */}
              <input
                autoFocus required value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" className={INPUT}
              />
            </Field>

            {/* The reveal button is positioned against this wrapper's bottom edge, which is the
                input's bottom edge — nothing renders below it in this form. */}
            <div className="relative">
              <Field id="login-password" label={t('page.shared.password')}>
                <input
                  required type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" className={`${INPUT} pr-12`}
                />
              </Field>
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-pressed={showPassword}
                aria-label={t(showPassword ? 'page.shared.hidePassword' : 'page.shared.showPassword')}
                title={t(showPassword ? 'page.shared.hidePassword' : 'page.shared.showPassword')}
                className="absolute right-0 bottom-0 w-11 h-11 flex items-center justify-center
                           rounded-control text-slate-500 hover:text-slate-900 transition-colors focus-ring"
              >
                {showPassword
                  ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                  : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>

            {error && (
              <p role="alert" className="text-sm text-expense leading-snug">{error}</p>
            )}

            <Button
              type="submit" variant="primary" className="w-full"
              icon={<LogIn className="w-4 h-4" aria-hidden="true" />}
              label={submitting ? t('page.login.signingIn') : t('page.login.signIn')}
              loading={submitting}
            />
          </form>

          {/* Always present, not gated on `needsSignup`: the route guard already redirects when
              the app KNOWS the account is gone, so the only case left is the one where it does
              not know — a stale status read after a factory reset. That is exactly when a
              hard-coded "Welcome back" with no way out strands the user. */}
          <Link
            to="/signup"
            className="mt-4 block rounded-control py-2 text-center text-sm font-medium
                       text-indigo-600 hover:text-indigo-700 hover:underline focus-ring"
          >
            {t('page.login.noAccountYet')}
          </Link>
        </div>

        <p className="px-1 text-xs text-slate-500 leading-snug">{t('page.login.noResetNote')}</p>
      </div>
    </div>
  )
}
