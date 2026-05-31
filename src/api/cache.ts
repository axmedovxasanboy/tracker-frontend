import type { CachedEntry } from '../types'

const PREFIX = 'tracker_cache_'
// Entries older than this are treated as missing — "I went on vacation" window.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
// Hard cap on cached entries to avoid blowing localStorage quota.
const MAX_ENTRIES = 200

export function saveToCache<T>(key: string, data: T): void {
  try {
    const entry: CachedEntry<T> = { data, timestamp: new Date().toISOString() }
    const serialized = JSON.stringify(entry)
    try {
      localStorage.setItem(PREFIX + key, serialized)
    } catch {
      evictOldest()
      try { localStorage.setItem(PREFIX + key, serialized) } catch { /* give up */ }
    }
    trimCount()
  } catch {
    // ignore
  }
}

export function getFromCache<T>(key: string): CachedEntry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CachedEntry<T>
    const age = Date.now() - new Date(entry.timestamp).getTime()
    if (Number.isNaN(age) || age > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return entry
  } catch {
    return null
  }
}

export function clearCache(): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k))
}

function trimCount() {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX))
  if (keys.length <= MAX_ENTRIES) return
  const sorted = keys
    .map((k) => ({ k, ts: tsOf(localStorage.getItem(k)) }))
    .sort((a, b) => a.ts - b.ts)
  for (let i = 0; i < sorted.length - MAX_ENTRIES; i++) {
    localStorage.removeItem(sorted[i].k)
  }
}

function evictOldest() {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX))
  if (keys.length === 0) return
  let oldestKey = keys[0]
  let oldestTs = tsOf(localStorage.getItem(oldestKey))
  for (const k of keys.slice(1)) {
    const ts = tsOf(localStorage.getItem(k))
    if (ts < oldestTs) { oldestTs = ts; oldestKey = k }
  }
  localStorage.removeItem(oldestKey)
}

function tsOf(raw: string | null): number {
  if (!raw) return 0
  try {
    const parsed = JSON.parse(raw) as { timestamp?: string }
    return parsed?.timestamp ? new Date(parsed.timestamp).getTime() : 0
  } catch {
    return 0
  }
}
