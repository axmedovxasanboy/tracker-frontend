import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { en as enCore } from './en'
import { uz as uzCore } from './uz'
import { en_pages } from './en.pages'
import { uz_pages } from './uz.pages'
import { en_components } from './en.components'
import { uz_components } from './uz.components'

// Split by area purely so the files stay manageable; they form one flat key space.
const en = { ...enCore, ...en_pages, ...en_components }
const uz = { ...uzCore, ...uz_pages, ...uz_components }

export type Lang = 'en' | 'uz'
export type TKey = keyof typeof en

const STORAGE_KEY = 'tracker.lang'
const DICTS: Record<Lang, Record<string, string>> = { en, uz }

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  /** Translate a key. Falls back to English, then to the key itself. */
  t: (key: TKey, vars?: Record<string, string | number>) => string
  /** Category names live in the database, not the dictionaries. */
  categoryName: (c?: { name: string; nameUz?: string | null } | null) => string
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

function readStored(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'uz' || v === 'en' ? v : 'en'
  } catch {
    return 'en' // private mode / storage blocked
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStored)

  // Kept in localStorage rather than Settings so switching is instant and works
  // offline — no round-trip, and no cached-response invalidation to worry about.
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* storage blocked — session only */ }
  }, [])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const value = useMemo<LanguageContextValue>(() => ({
    lang,
    setLang,
    t: (key, vars) => {
      const raw = DICTS[lang][key] ?? en[key] ?? String(key)
      if (!vars) return raw
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), raw)
    },
    categoryName: (c) => {
      if (!c) return ''
      const uzName = c.nameUz?.trim()
      return lang === 'uz' && uzName ? uzName : c.name
    },
  }), [lang, setLang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}
