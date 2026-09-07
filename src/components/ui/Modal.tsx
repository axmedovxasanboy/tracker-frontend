import { Sheet } from './Sheet'
import type { SheetProps } from './Sheet'

export type ModalProps = SheetProps

/**
 * The old name for `Sheet`, kept so the dialogs across the app keep working untouched while they
 * migrate one at a time. It is a pure alias — same props, same behaviour, including the two
 * things `Sheet` added: `dirty` (the discard guard) and `initialFocusRef`.
 *
 * Delete it once every call site imports `Sheet` directly.
 */
export function Modal(props: ModalProps) {
  return <Sheet {...props} />
}
