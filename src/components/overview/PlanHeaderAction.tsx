import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { OverflowAction } from '../ui/PageHeader'

/**
 * The seam that lets a tab embedded in Plan put ITS write verb in Plan's header.
 *
 * Plan owns the one `PageHeader` on the route, so the Investments / Donations / Emergency tabs
 * cannot render a header of their own — but their "Add" is the primary action of the screen the
 * user is actually looking at, and on a phone the header IS the app bar. So the embedded page
 * publishes what its button should say and do, and Plan paints it.
 *
 * The failure this pattern invites is a stale action: tab A's "Add donation" left sitting in the
 * header while tab B is on screen, firing tab B's… nothing at all, because A is unmounted. Three
 * things make that impossible here rather than merely unlikely:
 *
 *  1. every registration is STAMPED with the tab that made it (`owner`), and the tab never names
 *     itself — the token comes from the context, so it is always the tab Plan had active at the
 *     moment of the registration;
 *  2. `usePlanHeaderSlot` RENDERS an action only while its stamp equals the tab that is active
 *     now, so an action that outlived its tab is invisible even if its cleanup never ran;
 *  3. the slot additionally drops any registration that does not belong to the new tab whenever
 *     the active tab changes, so nothing survives in state either.
 *
 * Point 2 is the load-bearing one: it is a filter at paint time, not a promise about lifecycles.
 */

/** The one filled button. `PageHeader` takes exactly one, so a tab publishes exactly one. */
export interface PlanPrimaryAction {
  label: string
  onClick: () => void
  icon?: ReactNode
  /**
   * Gated. The header will NOT paint a live button; Plan paints a disabled one with
   * `disabledReason` visible beside it, because a disabled control cannot hold a tooltip.
   * The gate covers this action only — an overflow action a tab cannot offer is simply omitted.
   */
  disabled?: boolean
  disabledReason?: string
}

export interface PlanHeaderActions {
  primary: PlanPrimaryAction
  /** The tab's other write verbs, for the header's `⋯` menu. */
  overflow?: OverflowAction[]
}

interface PlanHeaderSlotValue {
  /** The tab that currently owns the header. Stamped onto every registration made under it. */
  owner: string
  publish: (owner: string, actions: PlanHeaderActions | null) => void
}

const PlanHeaderSlotContext = createContext<PlanHeaderSlotValue | null>(null)

/**
 * Plan's half of the seam: the actions to paint right now, and the props to hand the provider.
 *
 * `owner` is the active tab id. Everything else is internal.
 */
export function usePlanHeaderSlot(owner: string): {
  /** Null unless the tab that is active NOW has published something. */
  actions: PlanHeaderActions | null
  publish: (from: string, actions: PlanHeaderActions | null) => void
} {
  const [held, setHeld] = useState<{ owner: string; actions: PlanHeaderActions } | null>(null)

  // Stable for the life of the page, so a child's effect never re-runs because of this function.
  const publish = useCallback((from: string, actions: PlanHeaderActions | null) => {
    setHeld(prev => {
      if (actions) return { owner: from, actions }
      // A cleanup clears its OWN registration and nothing else. Without this test, an unmount
      // whose cleanup lands after the next tab has already registered would wipe the new tab's
      // button — the mirror image of the stale-action bug.
      return prev && prev.owner === from ? null : prev
    })
  }, [])

  // Belt and braces to (3) above: leaving a tab drops its registration even if the tab was torn
  // down without running effects. Child effects run before this one, so a tab that registered
  // during the same commit is already the owner and survives.
  useEffect(() => {
    setHeld(prev => (prev && prev.owner === owner ? prev : null))
  }, [owner])

  return { actions: held && held.owner === owner ? held.actions : null, publish }
}

/** Wraps Plan's tab panel. Renders no DOM, so tiles inside stay direct children of the grid. */
export function PlanHeaderSlotProvider({ owner, publish, children }: {
  owner: string
  publish: (from: string, actions: PlanHeaderActions | null) => void
  children: ReactNode
}) {
  const value = useMemo<PlanHeaderSlotValue>(() => ({ owner, publish }), [owner, publish])
  return <PlanHeaderSlotContext.Provider value={value}>{children}</PlanHeaderSlotContext.Provider>
}

/**
 * The embedded page's half: publish this tab's header actions, get back whether the header took
 * them.
 *
 * Pass `null` when the page is standalone — it renders its own `PageHeader` then and must not
 * register anything. The returned flag is derived from the presence of a slot, not from the
 * effect having run, so a page can branch on it during the very first render without the body
 * fallback flashing for a frame.
 */
export function usePlanHeaderActions(actions: PlanHeaderActions | null): boolean {
  const slot = useContext(PlanHeaderSlotContext)
  const owner = slot?.owner
  const publish = slot?.publish

  // Handlers are read through this at CLICK time and are deliberately not part of the signature
  // below: a page rebuilds its closures on every render, and republishing on identity alone would
  // loop — publish → Plan re-renders → the page re-renders → new closures → publish.
  const latest = useRef(actions)
  latest.current = actions

  // Everything the header actually paints. An icon is a static element, so it rides along with
  // the publish that a label change causes rather than triggering one of its own.
  const signature = actions
    ? [
        actions.primary.label,
        actions.primary.disabled ? '1' : '0',
        actions.primary.disabledReason ?? '',
        ...(actions.overflow ?? []).map(o => `${o.danger ? '!' : ''}${o.label}`),
      // A separator no label can contain, so "Add"+"Goal" cannot collide with "AddGoal".
      ].join('\u001f')
    : null

  useEffect(() => {
    if (!publish || owner === undefined) return
    const current = latest.current
    if (!current) {
      publish(owner, null)
      return
    }
    publish(owner, {
      primary: { ...current.primary, onClick: () => latest.current?.primary.onClick() },
      overflow: current.overflow?.map((action, i) => ({
        ...action,
        onClick: () => latest.current?.overflow?.[i]?.onClick(),
      })),
    })
    return () => publish(owner, null)
  }, [publish, owner, signature])

  return slot !== null
}
