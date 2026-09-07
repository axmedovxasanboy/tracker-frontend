import { Modal } from './Modal'
import { useLang } from '../../i18n/LanguageContext'

export interface ExplainRow {
  label: string
  value: string
  /** Renders as the summed/derived line rather than an input to it. */
  strong?: boolean
}

/**
 * "What is this number and where did it come from?" for a card that shows a derived figure.
 *
 * Three beats, the same everywhere: what it means, the rule that produced it, and — where the
 * caller can supply them — the parts that add up to it. The caller passes rows it has already
 * computed from the same data the card rendered, so the explanation cannot claim arithmetic the
 * card did not do.
 */
export function ExplainModal({
  open, onClose, title, meaning, formula, rows, note,
}: {
  open: boolean
  onClose: () => void
  title: string
  meaning: string
  formula: string
  rows?: ExplainRow[]
  note?: string
}) {
  const { t } = useLang()
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-lg">
      <div className="space-y-5">
        <p className="text-sm text-slate-600 leading-relaxed">{meaning}</p>

        <section>
          <p className="text-label uppercase text-slate-500 mb-2">
            {t('cmp.cardInfo.howItsBuilt')}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-hairline rounded-control px-3 py-2.5">
            {formula}
          </p>
        </section>

        {rows && rows.length > 0 && (
          <section>
            <p className="text-label uppercase text-slate-500 mb-2">
              {t('cmp.cardInfo.theNumbers')}
            </p>
            <div className="rounded-control border border-hairline divide-y divide-hairline text-sm">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 gap-3">
                  <span className={r.strong ? 'text-slate-700 font-medium' : 'text-slate-500'}>{r.label}</span>
                  <span className={`shrink-0 tabular-nums ${r.strong ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Neutral, not indigo: the colour contract reserves indigo for action and selection,
            and this is a passive footnote nobody can act on. */}
        {note && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-hairline rounded-control px-3 py-2.5 leading-relaxed">
            {note}
          </p>
        )}
      </div>
    </Modal>
  )
}
