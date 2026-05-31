import { useState } from 'react'
import { ArrowLeftRight, LogIn, Lock, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { extractErrorMessage } from '../api/client'
import { Spinner } from '../components/ui/Spinner'

const INPUT = 'w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

export function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-white" />
          </div>
          <span className="text-slate-800 font-semibold text-lg tracking-tight">Tracker</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h1 className="text-lg font-bold text-slate-800">Welcome back</h1>
          <p className="text-sm text-slate-400 mb-5">Sign in to your tracker.</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input autoFocus required value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="Username" autoComplete="username" className={INPUT} />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Password" autoComplete="current-password" className={INPUT} />
            </div>

            {error && (
              <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button type="submit" disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <Spinner className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
