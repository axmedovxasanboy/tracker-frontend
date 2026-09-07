import { forwardRef, useId } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Info } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

/** Everything a native button accepts, minus the props this component computes itself. */
type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'disabled' | 'title' | 'children' | 'className' | 'aria-label' | 'aria-busy'
>

export interface ButtonProps extends NativeButtonProps {
  variant?: ButtonVariant
  /** `md` is 44px tall — the touch floor. `sm` is 36px but still gets a 44px hit area. */
  size?: ButtonSize
  icon?: ReactNode
  /** Draws the icon alone; `label` becomes the accessible name and the tooltip. */
  iconOnly?: boolean
  /**
   * Required, always, even when only an icon is drawn: the audit found 4 of 190 buttons carried
   * an aria-label, so the 28px icon buttons scattered across the app announced as "button".
   * Making it a required prop is the only way to stop that coming back.
   */
  label: string
  type?: 'button' | 'submit'
  disabled?: boolean
  /**
   * Why the button is disabled. Becomes the tooltip and the button's accessible description.
   * For the visible half — which is what a touch user actually gets — render `DisabledHint`
   * beside the button; see the note on that component.
   */
  disabledReason?: string
  loading?: boolean
  className?: string
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:   'bg-indigo-600 text-white shadow-sm enabled:hover:bg-indigo-700',
  // slate-200 rather than the hairline token: a control needs a visible edge to read as pressable,
  // and rgba(0,0,0,.06) disappears against the white tile the button usually sits on.
  secondary: 'bg-white text-slate-700 border border-slate-200 shadow-sm enabled:hover:bg-slate-50 enabled:hover:border-slate-300',
  ghost:     'text-slate-600 enabled:hover:bg-slate-100 enabled:hover:text-slate-900',
  // rose-800, not rose-600: the `expense` token is rose-700 now (white text on the old #f43f5e
  // was 3.67:1), so hovering to rose-600 would have made the button lighter under the pointer.
  danger:    'bg-expense text-white shadow-sm enabled:hover:bg-rose-800',
}

const SIZE: Record<ButtonSize, { box: string; padding: string; square: string }> = {
  md: { box: 'h-11', padding: 'px-4', square: 'w-11' },
  // The pseudo-element is what actually delivers the 44px target: it pushes the hit box 4px past
  // every edge without touching layout, so a 36px button still occupies 36px in the grid.
  sm: { box: "h-9 after:absolute after:-inset-1 after:content-['']", padding: 'px-3', square: 'w-9' },
}

/**
 * `Spinner` hard-codes `text-indigo-500`, which is invisible on a primary or danger button.
 * This one inherits `currentColor`, so it works on all four variants.
 */
function ButtonSpinner() {
  return (
    <svg className="w-4 h-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

/**
 * The one button. Every filled, outlined, ghost and destructive control in the app is this.
 *
 * Three things it guarantees that the 190 hand-rolled buttons did not: a 44px touch target at
 * every size, an accessible name even when nothing but an icon is drawn, and a disabled state
 * that says why. `loading` keeps the label in place so the button cannot change width mid-submit
 * and move the thing under the user's finger.
 *
 * It renders exactly one element and takes no layout of its own — `className` reaches the
 * `<button>`, so `flex-1` and `w-full` behave the way the call site expects.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'secondary', size = 'md', icon, iconOnly, label, type = 'button',
  disabled, disabledReason, loading, className = '', ...rest
}, ref) {
  const hintId = useId()

  const explained = !!disabled && !!disabledReason
  // Loading blocks the click too, otherwise a slow save takes two writes. It does NOT set the
  // `disabled` attribute, though: the browser blurs an element the moment it becomes disabled,
  // so pressing Enter on "Sign in" dropped focus to <body> and left the user twenty tab stops
  // from the field the error message was about. aria-disabled plus the guard in onClick below
  // says the same thing to assistive tech while keeping the control under the user's cursor.
  const inert = !!disabled || !!loading
  // With an icon the spinner takes the icon's slot and the label stays put; without one there is
  // no slot to borrow, so the content is hidden in place — either way the width never changes.
  const overlaySpinner = !!loading && !icon

  const classes = [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap select-none',
    'rounded-control text-sm font-semibold focus-ring',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    // The press animation and the dimming used to ride on the `disabled` attribute. Loading no
    // longer sets it (see `inert`), so both are decided here instead — a button that cannot be
    // pressed must not animate as though it were.
    inert ? '' : 'active:scale-[.98]',
    loading && !disabled ? 'opacity-50 cursor-wait' : '',
    VARIANT[variant],
    SIZE[size].box,
    iconOnly ? SIZE[size].square : SIZE[size].padding,
    className,
  ].join(' ')

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={disabled}
      // Only for the loading case: where `disabled` is a real attribute it already says this,
      // and both at once makes some screen readers announce "dimmed" twice.
      aria-disabled={loading && !disabled ? true : undefined}
      // Blocks the second write a slow save invites, and — because a click on a submit button is
      // what implicit submission (Enter in a text field) fires — blocks the form with it.
      onClick={e => {
        if (inert) { e.preventDefault(); e.stopPropagation(); return }
        rest.onClick?.(e)
      }}
      // Fixed rather than derived from the content: the name has to survive `iconOnly` and the
      // loading state, and it matches the visible text exactly when there is any.
      aria-label={label}
      aria-busy={loading || undefined}
      aria-describedby={explained ? hintId : rest['aria-describedby']}
      title={explained ? disabledReason : iconOnly ? label : undefined}
      className={classes}
    >
      {/* min-w-0 twice over: without it a flex item refuses to shrink past its content, and a
          long label on a w-full button would overflow instead of truncating. */}
      <span className={`inline-flex items-center justify-center gap-2 min-w-0 ${overlaySpinner ? 'invisible' : ''}`}>
        {loading && icon ? <ButtonSpinner /> : icon}
        {!iconOnly && <span className="truncate min-w-0">{label}</span>}
      </span>
      {overlaySpinner && (
        <span className="absolute inset-0 flex items-center justify-center">
          <ButtonSpinner />
        </span>
      )}
      {/* A disabled button is not tabbable, so the reason can only be reached by browsing — and
          `title` is suppressed on disabled elements in Chrome and Safari. Neither is enough on
          its own, which is why `DisabledHint` exists. It is not part of the accessible name:
          aria-label above settles that. */}
      {explained && <span id={hintId} className="sr-only">{disabledReason}</span>}
    </button>
  )
})

/**
 * The visible half of `disabledReason` — the one a touch user gets, since a tooltip needs a
 * pointer and a disabled button cannot be focused.
 *
 * It is a separate component rather than something `Button` renders itself because a block of
 * text emitted from inside the button would have to be wrapped, and a wrapper changes how
 * `flex-1` and `w-full` resolve in the dialog footers these buttons live in. So the call site
 * places it: under the submit row, or beside the control the gate refers to. Renders nothing
 * without a reason, so it can sit in the tree unconditionally.
 */
export function DisabledHint({ reason, id, className = '' }: {
  reason?: string
  id?: string
  className?: string
}) {
  if (!reason) return null
  return (
    <p id={id} className={`flex items-start gap-1.5 text-xs text-slate-500 leading-snug ${className}`}>
      <Info className="w-3.5 h-3.5 shrink-0 mt-px text-slate-400" aria-hidden="true" />
      <span>{reason}</span>
    </p>
  )
}
