/**
 * TRANSPORT-kind transactions encode their route inside the `description` column
 * (no dedicated from/to columns anymore). The convention is:
 *
 *   "Kvartira >>> Chilonzor metro"            ← route only (description optional)
 *   "Kvartira >>> Chilonzor metro\n<note>"    ← route + user note
 *
 * These helpers parse and compose that format so the modal, the detail view,
 * and the list view all stay consistent.
 */

export const ROUTE_SEPARATOR = ' >>> '

export interface ParsedDescription {
  from?: string
  to?: string
  note: string
}

export function parseTransportDescription(
  raw: string | null | undefined,
  isTransport: boolean,
): ParsedDescription {
  const text = raw ?? ''
  if (!isTransport) return { note: text }
  const newline = text.indexOf('\n')
  const firstLine = newline >= 0 ? text.slice(0, newline) : text
  const rest = newline >= 0 ? text.slice(newline + 1) : ''
  if (firstLine.includes(ROUTE_SEPARATOR)) {
    const [fromPart, toPart] = firstLine.split(ROUTE_SEPARATOR)
    return {
      from: fromPart.trim() || undefined,
      to: toPart.trim() || undefined,
      note: rest,
    }
  }
  return { note: text }
}

export function composeTransportDescription(
  from: string | undefined,
  to: string | undefined,
  note: string | undefined,
): string {
  const f = (from ?? '').trim()
  const t = (to ?? '').trim()
  const n = (note ?? '').trim()
  const routeLine = f || t ? `${f || '—'}${ROUTE_SEPARATOR}${t || '—'}` : ''
  if (routeLine && n) return `${routeLine}\n${n}`
  return routeLine || n
}
