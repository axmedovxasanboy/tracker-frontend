import { en } from './en'
import { uz } from './uz'

/**
 * Translation for the handful of strings that are built OUTSIDE React.
 *
 * `api/client.ts` composes error text inside an axios response interceptor and inside
 * `extractErrorMessage`. Neither is a component, so neither can call `useLang()`. Returning a
 * key instead and translating at the consumer was the other option, but the result is consumed
 * as a finished string by 30+ call sites (`showError(extractErrorMessage(err))`,
 * `<ErrorTile message={…}>`, `setError(…)` in Login) that belong to other files — so that fix
 * would have to land in thirty files at once.
 *
 * Instead we resolve the language the same way `LanguageProvider` seeds its own state: from
 * localStorage. That is the single source of truth — `setLang` writes it on every switch — so
 * a toast raised after a switch already comes out in the new language, with no callback to
 * register and no render cycle to wait for.
 *
 * Only `en.ts` / `uz.ts` are consulted: everything outside React needs is core vocabulary, and
 * keeping the page/component dictionaries out means the api layer does not pull them in.
 */

/** Must match LanguageContext's STORAGE_KEY — they read and write the same value. */
const STORAGE_KEY = 'tracker.lang'

export type StaticKey = keyof typeof en

function currentLang(): 'en' | 'uz' {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'uz' ? 'uz' : 'en'
  } catch {
    return 'en' // private mode / storage blocked, same fallback as LanguageContext
  }
}

/** Same fallback chain and same `{var}` interpolation as the `t()` in LanguageContext. */
export function tStatic(key: StaticKey, vars?: Record<string, string | number>): string {
  const raw: string = (currentLang() === 'uz' ? uz[key] : undefined) ?? en[key]
  if (!vars) return raw
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), raw)
}
