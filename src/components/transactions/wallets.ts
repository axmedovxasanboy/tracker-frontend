import { useCallback, useEffect, useRef, useState } from 'react'
import { cardsApi } from '../../api/cards'
import { cashBalancesApi } from '../../api/cashBalances'
import type { CardResponse, Currency, TransactionType } from '../../types'

/**
 * Where money comes from or goes to, as one value: a card id, the cash pot, or — for the few
 * forms that can record money that never sat in a tracked wallet — 'none'. Null = not chosen.
 */
export type WalletValue = number | 'cash' | 'none' | null

// ── Remembered answers ─────────────────────────────────────────────────────────────────────────
// Everything here lives in localStorage, per browser. Every read and write is guarded: a private
// window or blocked storage must cost the owner a default, never a crash.

const LAST_WALLET_KEY = 'tracker.lastWallet'
const LAST_TYPE_KEY = 'tracker.lastTxType'
const LAST_CHILD_KEY = 'tracker.lastSubCategory'

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function write(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* storage blocked — the default just resets */ }
}

/** The wallet the owner last paid from or into: a card id, 'cash', or null when never. */
export function readLastWallet(): number | 'cash' | null {
  const v = read(LAST_WALLET_KEY)
  if (v === 'cash') return 'cash'
  const m = v ? /^card:(\d+)$/.exec(v) : null
  return m ? Number(m[1]) : null
}

/** Remember a wallet that was actually used. 'none' and null are not wallets, so they are ignored. */
export function rememberWallet(v: WalletValue) {
  if (v === 'cash') write(LAST_WALLET_KEY, 'cash')
  else if (typeof v === 'number') write(LAST_WALLET_KEY, `card:${v}`)
}

export function readLastType(): TransactionType | null {
  const v = read(LAST_TYPE_KEY)
  return v === 'INCOME' || v === 'EXPENSE' ? v : null
}

export function rememberType(type: TransactionType) {
  write(LAST_TYPE_KEY, type)
}

function readChildMap(): Record<string, number> {
  try {
    const parsed = JSON.parse(read(LAST_CHILD_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {}
  } catch {
    return {}
  }
}

/** The sub-category last used under `parentId`, if any. */
export function readLastChild(parentId: number): number | null {
  const v = readChildMap()[String(parentId)]
  return typeof v === 'number' ? v : null
}

export function rememberChild(parentId: number, childId: number) {
  const map = readChildMap()
  map[String(parentId)] = childId
  write(LAST_CHILD_KEY, JSON.stringify(map))
}

// ── The default ────────────────────────────────────────────────────────────────────────────────

/**
 * The wallet a form should start on: the one last used, otherwise the card holding the most.
 *
 * Cash is never the default for money going OUT when the cash pot holds less than `amount` —
 * that payment would be refused, or would leave the owner believing cash covered it. When no card
 * exists at all, cash is the only wallet there is, so it is still the answer.
 */
export function defaultWallet(
  cards: CardResponse[],
  cashBalance: number | null,
  amount: number,
  opts: { incoming?: boolean; allowCash?: boolean } = {},
): number | 'cash' | null {
  const allowCash = opts.allowCash ?? true
  const last = readLastWallet()
  const cashCovers = opts.incoming || (cashBalance ?? 0) >= (amount || 0)
  if (last === 'cash' && allowCash && cashCovers) return 'cash'
  if (typeof last === 'number' && cards.some(c => c.id === last)) return last
  if (cards.length > 0) {
    return cards.reduce((best, c) => ((c.currentBalance ?? 0) > (best.currentBalance ?? 0) ? c : best)).id
  }
  return allowCash ? 'cash' : null
}

// ── Loading ────────────────────────────────────────────────────────────────────────────────────

/**
 * The owner's wallets for a form: every usable card in `currency` plus the cash pot's balance.
 * Fetched each time the form opens, so a payment made a minute ago is already in the balances.
 */
export function useWallets(open: boolean, currency: Currency = 'UZS') {
  const [cards, setCards] = useState<CardResponse[]>([])
  const [cashBalance, setCashBalance] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const runRef = useRef(0)

  const load = useCallback(() => {
    const run = ++runRef.current
    setLoaded(false)
    setFailed(false)
    Promise.all([
      cardsApi.getAll(),
      // A missing cash pot is not a failure: cash simply shows no balance.
      cashBalancesApi.getAll().catch(() => null),
    ])
      .then(([cardRes, cashRes]) => {
        if (runRef.current !== run) return
        // Legacy CASH-type cards were migrated to the cash pot; they must never be offered.
        setCards(cardRes.data.filter(c => c.currency === currency && c.type !== 'CASH'))
        setCashBalance(cashRes?.data.find(b => b.currency === currency)?.currentBalance ?? null)
      })
      .catch(() => { if (runRef.current === run) setFailed(true) })
      .finally(() => { if (runRef.current === run) setLoaded(true) })
  }, [currency])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  return { cards, cashBalance, loaded, failed, reload: load }
}

/**
 * A wallet choice that starts on `defaultWallet` and keeps following it — as the amount is typed,
 * a remembered cash pot that stops covering it gives way to a card — until the owner picks one
 * themselves. From then on it is theirs and nothing moves it.
 */
export function useWalletChoice({
  open, cards, cashBalance, loaded, amount, incoming = false, allowCash = true, fixed,
}: {
  open: boolean
  cards: CardResponse[]
  cashBalance: number | null
  loaded: boolean
  amount: number
  incoming?: boolean
  allowCash?: boolean
  /** A starting value that is not a default (an edit, a preselected card): never recomputed. */
  fixed?: WalletValue
}) {
  const [value, setValue] = useState<WalletValue>(fixed ?? null)
  const touched = useRef(false)

  // A fresh open is a fresh question.
  useEffect(() => {
    if (!open) return
    touched.current = false
    setValue(fixed ?? null)
    // `fixed` is read once per open on purpose — a parent re-render must not reset the choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open || !loaded || touched.current || fixed != null) return
    setValue(defaultWallet(cards, cashBalance, amount, { incoming, allowCash }))
  }, [open, loaded, cards, cashBalance, amount, incoming, allowCash, fixed])

  const choose = useCallback((v: WalletValue) => {
    touched.current = true
    setValue(v)
  }, [])

  return { value, choose, touched: touched.current }
}
