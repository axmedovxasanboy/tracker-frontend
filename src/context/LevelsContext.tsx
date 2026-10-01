import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AxiosError } from 'axios'
import { levelsApi } from '../api/levels'
import { Level5Dialog } from '../components/levels/Level5Dialog'
import type { LevelNotice } from '../types/levels'

interface LevelsContextValue {
  /**
   * Whether the server has levels and savings rules. True once `/levels/notice` answered; false on
   * a 404 (a server from before them — then the Savings rules row and Profile's "Change" stay
   * hidden); null while unknown, or when the call failed for any other reason.
   */
  available: boolean | null
  /** A drop from Level 5 not yet shown on the web — Home and Profile show it as a tile. */
  down: LevelNotice | null
  /** "OK" on that tile: mark it seen, and stop showing it. */
  dismissDown: () => void
}

const LevelsContext = createContext<LevelsContextValue>({ available: null, down: null, dismissDown: () => {} })

/** A notice is only ever an object with an id; a 204 is an empty body. */
const asNotice = (data: unknown): LevelNotice | null =>
  data && typeof data === 'object' && typeof (data as LevelNotice).id === 'number' ? (data as LevelNotice) : null

/**
 * The shell asks once per app load whether a level change is waiting to be shown (spec §2.4, §2.5):
 * a rise to Level 5 opens its dialog over whatever page is on screen; a drop back becomes a tile
 * on Home and Profile.
 *
 * Nothing waits on it. The page renders at once; the answer arrives when it arrives. A failure is
 * silent — the dialog simply does not appear this time, and the next load asks again — and an
 * offline copy of an old answer is ignored, so a change already seen can never come back from the
 * cache.
 */
export function LevelsProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [up, setUp] = useState<LevelNotice | null>(null)
  const [down, setDown] = useState<LevelNotice | null>(null)

  useEffect(() => {
    let live = true
    levelsApi.notice()
      .then(res => {
        if (!live) return
        // An offline answer says nothing about what is waiting now.
        if ((res as unknown as { isCached?: boolean }).isCached) return
        setAvailable(true)
        const n = asNotice(res.data)
        if (!n) return
        if (n.kind === 'UP') setUp(n)
        else if (n.kind === 'DOWN') setDown(n)
      })
      .catch((err: AxiosError) => {
        if (live && err?.response?.status === 404) setAvailable(false)
      })
    return () => { live = false }
  }, [])

  const markSeen = useCallback((n: LevelNotice) => {
    // Best effort: a mark that fails means the notice shows once more next time, nothing worse.
    levelsApi.seen(n.id).catch(() => {})
  }, [])

  const dismissDown = useCallback(() => {
    setDown(prev => {
      if (prev) markSeen(prev)
      return null
    })
  }, [markSeen])

  const value = useMemo<LevelsContextValue>(() => ({ available, down, dismissDown }), [available, down, dismissDown])

  return (
    <LevelsContext.Provider value={value}>
      {children}
      {up && <Level5Dialog notice={up} onDone={() => { markSeen(up); setUp(null) }} />}
    </LevelsContext.Provider>
  )
}

export function useLevels(): LevelsContextValue {
  return useContext(LevelsContext)
}
