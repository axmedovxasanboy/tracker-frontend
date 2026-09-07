import { cloneElement, isValidElement } from 'react'
import type { ReactNode } from 'react'

/** The subset of the control's props Field takes over. Anything else the child declares is kept. */
interface ControlProps {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-required'?: boolean
}

/**
 * Label, help and error for one control, wired together.
 *
 * The forms in the app label their inputs with a bare `<label>` and no `htmlFor`, so tapping the
 * label does nothing and a screen reader reads the input as unlabelled. Field binds the two by
 * `id` — injected into the child when it is a single element, so most call sites need no change
 * beyond the wrapper — and points `aria-describedby` at whichever of help and error is showing.
 *
 * Help sits above the control because it is meant to be read before typing; the error sits below,
 * where the eye lands after leaving the field.
 */
export function Field({ id, label, required, help, error, children, className = '' }: {
  id: string
  label: string
  required?: boolean
  help?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined

  // Only a single element child can be wired up; anything else (a fragment, a list of radios)
  // is rendered as given and the caller is responsible for the id.
  const single = isValidElement<ControlProps>(children) ? children : null
  const control = single
    ? cloneElement(single, {
        // Field's id wins: the whole point is that `htmlFor` and the control agree.
        id,
        'aria-describedby': [single.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : single.props['aria-invalid'],
        'aria-required': required || single.props['aria-required'],
      })
    : children

  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {/* Decorative — the control carries aria-required, so this is not read out twice. */}
        {required && <span aria-hidden="true" className="text-expense"> *</span>}
      </label>
      {help && <p id={helpId} className="text-xs text-slate-500 leading-snug mb-1.5">{help}</p>}
      {control}
      {error && <p id={errorId} role="alert" className="text-xs text-expense leading-snug mt-1">{error}</p>}
    </div>
  )
}
