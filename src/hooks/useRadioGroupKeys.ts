import { useCallback } from 'react'
import type { KeyboardEvent } from 'react'

/**
 * Roving tabindex + arrow-key selection for a hand-rolled `role="radiogroup"`.
 *
 * A radiogroup puts a screen reader into forms mode, where the arrow keys — not Tab — are how
 * the user moves between and picks options, and the whole group is one tab stop. Without this
 * the arrows do nothing at all (so the group is reported as broken) and a keyboard user pays
 * one Tab per option, which on the ten-swatch wallet colour picker is nine extra stops.
 *
 * `Tabs.tsx` implements the same pattern for its tablist; this is the version for the groups
 * that are not tabs. Focus moves through the DOM rather than a ref array so a caller can lay
 * its radios out however it likes: siblings are found by `[role="radio"]` inside the nearest
 * enclosing `[role="radiogroup"]`.
 */
export function useRadioGroupKeys<T>(
  options: readonly T[],
  selected: T,
  onSelect: (value: T) => void,
) {
  // When nothing is selected yet the group would otherwise have no tabbable member and drop out
  // of the tab order entirely, so the first option holds the stop until a choice is made.
  const activeIndex = Math.max(0, options.indexOf(selected))

  return useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        const last = options.length - 1
        let next: number
        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowDown': next = index === last ? 0 : index + 1; break
          case 'ArrowLeft':
          case 'ArrowUp':   next = index === 0 ? last : index - 1; break
          case 'Home':      next = 0; break
          case 'End':       next = last; break
          default: return
        }
        e.preventDefault()
        onSelect(options[next])
        const group = e.currentTarget.closest('[role="radiogroup"]')
        const radios = group?.querySelectorAll<HTMLElement>('[role="radio"]')
        radios?.[next]?.focus()
      },
    }),
    [options, activeIndex, onSelect],
  )
}
