import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { ErrorTile } from '../ui/ErrorTile'
import { Skeleton } from '../ui/Skeleton'
import { useLang } from '../../i18n/LanguageContext'
import type { Lang, TKey } from '../../i18n/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { overviewApi } from '../../api/overview'
import { extractErrorMessage } from '../../api/client'
import { formatMonth, money, moneyFull } from '../../utils/format'
import type {
  AllocationLevelView, AllocationRulesView, AllocationSubLevelView,
  Currency, LevelAllocationRuleRequest,
} from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /**
   * What the percentages are actually multiplied by — `tier.allocationBase`, i.e. stable income
   * minus monthly bills minus this month's debt payments (OverviewService.java:167, applied at
   * :1059). The dialog used to multiply each percentage by the LEVEL BAND on left money instead,
   * so its example amounts could never match the bucket tiles. Null while the tier is unknown,
   * in which case no amount is offered at all rather than a wrong one.
   */
  allocationBase: number | null
  currency: Currency
}

const SUBS = ['1', '2', '3']

/** `s` is stocks: a retired bucket, still a column. See the note in `handleSave`. */
type SubEdit = { d: string; e: string; i: string; s: string }
type Edit = { minLeftover: string; expirationMonth: string; subs: Record<string, SubEdit> }

const INPUT = 'w-full border border-slate-200 rounded-control px-3 py-2.5 text-sm text-slate-900 tabular-nums focus-ring'

function n2s(n: number | null | undefined): string { return n == null ? '' : `${n}` }
function s2n(s: string): number | null {
  const t = s.trim(); if (t === '') return null
  const v = Number(t); return Number.isFinite(v) ? v : null
}

/** The engine keys the sub-level off the debt ratio's suffix, so the label can be translated. */
function debtLabelKey(subLevel: string): TKey {
  if (subLevel.endsWith('.1')) return 'page.overview.subLevelNoDebt'
  if (subLevel.endsWith('.3')) return 'page.overview.subLevelHigh'
  return 'page.overview.subLevelManageable'
}

/**
 * Two dialogs in one sheet: a read-only explanation of how the allocation is worked out, and —
 * only for the level you are actually on — a small form to change it.
 *
 * It used to open on a wall of every level at once, five of them unconfigured, which meant
 * forty-five em-dashes above the three numbers that mattered. The other levels are still here,
 * behind a disclosure, because comparing them is the reason the screen exists.
 */
export function AllocationRulesModal({ open, onClose, onSaved, allocationBase, currency }: Props) {
  const { t, lang } = useLang()
  const { showSuccess } = useToast()
  const BUCKET_COLS = [t('cmp.bucket.donation'), t('cmp.bucket.emergency'), t('cmp.bucket.investments')] as const
  const [view, setView] = useState<AllocationRulesView | null>(null)
  const [edit, setEdit] = useState<Edit | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const editLevelView: AllocationLevelView | undefined = view?.levels.find(l => l.editable)

  const load = () => {
    setError(null); setLoading(true)
    overviewApi.getAllocationRules()
      .then(res => {
        setView(res.data)
        const ev = res.data.levels.find(l => l.editable)
        if (ev) {
          const subs: Record<string, SubEdit> = {}
          for (const sl of ev.subLevels) {
            subs[sl.subLevel] = {
              d: n2s(sl.donationPercent), e: n2s(sl.emergencyPercent),
              i: n2s(sl.investmentsPercent), s: n2s(sl.stocksPercent),
            }
          }
          setEdit({ minLeftover: n2s(ev.minLeftover), expirationMonth: ev.expirationMonth ?? '', subs })
        } else {
          setEdit(null)
        }
      })
      .catch(err => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!open) return
    setShowAll(false)
    load()
  }, [open])

  const setSubCell = (key: string, field: keyof SubEdit, value: string) =>
    setEdit(prev => prev && ({ ...prev, subs: { ...prev.subs, [key]: { ...prev.subs[key], [field]: value } } }))

  const handleSave = async () => {
    if (!editLevelView || !edit) return
    setSaving(true); setError(null)
    try {
      const lvl = editLevelView.level
      const rules: LevelAllocationRuleRequest[] | undefined = lvl >= 2
        ? SUBS.map(sub => {
            const key = `${lvl}.${sub}`
            const r = edit.subs[key]
            return {
              subLevel: key,
              donationPercent: s2n(r.d), emergencyPercent: s2n(r.e),
              investmentsPercent: s2n(r.i),
              // Stocks is a retired bucket with no cell in this form, but OverviewService's
              // upsertRule writes every field it is handed (`r.setStocksPercent(...)`), so
              // dropping it from the payload would null a real column rather than leave it alone.
              stocksPercent: s2n(r.s),
            }
          })
        : undefined
      await overviewApi.saveLevelConfig({
        level: lvl,
        minLeftover: s2n(edit.minLeftover),
        expirationMonth: edit.expirationMonth ? `${edit.expirationMonth}-01` : null,
        rules,
      })
      showSuccess(t('cmp.allocationRules.savedToast', { level: lvl }))
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const currentLevelView = view?.levels.find(l => l.level === view.currentLevel)
  const otherLevels = (view?.levels ?? []).filter(l => l.level !== view?.currentLevel)
  const minLeftoverNumber = edit ? s2n(edit.minLeftover) : null

  const footer = (
    <div className="flex gap-3">
      <Button label={t('action.close')} onClick={onClose} className="flex-1" />
      {editLevelView && (
        <Button
          variant="primary"
          className="flex-1"
          loading={saving}
          label={saving ? t('action.saving') : t('cmp.allocationRules.saveLevel', { level: editLevelView.level })}
          onClick={handleSave}
        />
      )}
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={t('cmp.allocationRules.title')} maxWidth="max-w-2xl" footer={footer}>
      <div className="space-y-5">

        {/* ── How it works ─────────────────────────────────────────────────────── */}
        <section>
          <p className="text-label uppercase text-slate-500">{t('cmp.allocationRules.howHeading')}</p>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {t('cmp.allocationRules.intro')}
            {view?.currentLevel ? t('cmp.allocationRules.currentLevelParen', { level: view.currentLevel }) : ''}
            {t('cmp.allocationRules.lockSuffix')}
          </p>
        </section>

        {loading && !view ? (
          <Skeleton variant="text" count={4} bare />
        ) : error && !view ? (
          <ErrorTile message={error} onRetry={load} />
        ) : view?.missingStableIncome ? (
          <p className="text-sm text-slate-600">{t('cmp.allocationRules.missingIncome')}</p>
        ) : view ? (
          <>
            {/* ── Your level, read-only, with the amounts it actually produces ──── */}
            {currentLevelView && (
              <section>
                <p className="text-label uppercase text-slate-500">
                  {t('cmp.allocationRules.currentLevelHeading')}
                </p>
                <LevelCard
                  level={currentLevelView}
                  currentSubLevel={view.currentSubLevel}
                  bucketCols={BUCKET_COLS}
                  base={allocationBase}
                  currency={currency}
                  lang={lang}
                  showAmounts
                />
                {currentLevelView.builtIn && (
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {t('cmp.allocationRules.level1Note')}
                  </p>
                )}
              </section>
            )}

            {/* ── The small edit form ──────────────────────────────────────────── */}
            {editLevelView && edit && (
              <section className="border-t border-hairline pt-5">
                <p className="text-label uppercase text-slate-500">
                  {t('cmp.allocationRules.editHeading', { level: editLevelView.level })}
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div className="min-w-0">
                    <Field
                      id="alloc-min-leftover"
                      label={t('cmp.allocationRules.minLeftover')}
                      help={t('cmp.allocationRules.minLeftoverHelp')}
                    >
                      <input type="number" min="0" step="100000" value={edit.minLeftover}
                        onChange={e => setEdit(p => p && ({ ...p, minLeftover: e.target.value }))}
                        className={INPUT} placeholder="—" />
                    </Field>
                    {/* The grouped figure beneath the raw one: an unformatted 5000000 in a number
                        input is the one place in the app a value is shown without separators. */}
                    {minLeftoverNumber != null && (
                      <p className="mt-1 text-xs text-slate-500 tabular-nums">
                        {moneyFull(minLeftoverNumber, 'UZS')}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Field
                      id="alloc-lock-until"
                      label={t('cmp.allocationRules.lockUntilMonth')}
                      help={t('cmp.allocationRules.lockUntilHelp')}
                    >
                      <input type="month" value={edit.expirationMonth}
                        onChange={e => setEdit(p => p && ({ ...p, expirationMonth: e.target.value }))}
                        className={INPUT} />
                    </Field>
                    {/* "2026-12" is an ISO string the app never shows anywhere else. */}
                    {edit.expirationMonth && (
                      <p className="mt-1 text-xs text-slate-500">
                        {formatMonth(edit.expirationMonth, lang)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Level 1's percentages are fixed by the engine; 2–6 are the user's own. */}
                {!editLevelView.builtIn && (
                  <div className="mt-4 space-y-3">
                    {editLevelView.subLevels.map(sl => (
                      <div key={sl.subLevel} className="rounded-control border border-hairline p-3">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-slate-900">
                            {t('page.overview.subLevelLabel', { level: sl.subLevel })}
                          </span>
                          <span className="text-xs text-slate-500">{t(debtLabelKey(sl.subLevel))}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {(['d', 'e', 'i'] as const).map((field, i) => (
                            <div key={field} className="min-w-0">
                              <label className="block text-label uppercase text-slate-500 mb-1 truncate"
                                htmlFor={`pct-${sl.subLevel}-${field}`}>
                                {BUCKET_COLS[i]}
                              </label>
                              <div className="relative">
                                <input
                                  id={`pct-${sl.subLevel}-${field}`}
                                  type="number" min="0" max="100" step="0.5"
                                  value={edit.subs[sl.subLevel]?.[field] ?? ''}
                                  onChange={e => setSubCell(sl.subLevel, field, e.target.value)}
                                  placeholder="—"
                                  className={`${INPUT} pr-7`} />
                                <span aria-hidden="true"
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {!editLevelView && (
              <p className="text-sm text-slate-600">
                {view.currentLevel == null
                  ? t('cmp.allocationRules.noEditableLevel')
                  : t('cmp.allocationRules.lockedReadOnly', { level: view.currentLevel })}
              </p>
            )}

            {/* ── Every other level, folded away ───────────────────────────────── */}
            {otherLevels.length > 0 && (
              <section className="border-t border-hairline pt-5">
                <p className="text-label uppercase text-slate-500 mb-2">
                  {t('cmp.allocationRules.otherLevelsHeading')}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAll(v => !v)}
                  aria-expanded={showAll}
                  className="w-full flex items-center justify-between gap-2 text-left cursor-pointer rounded-control focus-ring"
                >
                  <span className="text-sm font-semibold text-slate-900">
                    {showAll ? t('cmp.allocationRules.hideAllLevels') : t('cmp.allocationRules.showAllLevels')}
                  </span>
                  {showAll
                    ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />}
                </button>
                {showAll && (
                  <div className="mt-3 space-y-3">
                    {otherLevels.map(lvl => (
                      <LevelCard
                        key={lvl.level}
                        level={lvl}
                        currentSubLevel={null}
                        bucketCols={BUCKET_COLS}
                        base={null}
                        currency={currency}
                        lang={lang}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        ) : null}

        {error && view && <ErrorTile compact message={error} onRetry={load} />}
      </div>
    </Modal>
  )
}

/**
 * One level, read-only. `base` is the user's own left-to-allocate figure: supplied only for the
 * level they are on, because a percentage of a band they are not in is noise, not an example.
 */
function LevelCard({ level, currentSubLevel, bucketCols, base, currency, lang, showAmounts = false }: {
  level: AllocationLevelView
  currentSubLevel: string | null
  bucketCols: readonly [string, string, string]
  base: number | null
  currency: Currency
  lang: Lang
  showAmounts?: boolean
}) {
  const { t } = useLang()

  const pcts = (sl: AllocationSubLevelView): (number | null)[] =>
    [sl.donationPercent, sl.emergencyPercent, sl.investmentsPercent]

  return (
    <div className="mt-2 rounded-control border border-hairline p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-sm font-semibold text-slate-900">
          {t('cmp.allocationRules.level', { level: level.level })}
        </p>
        <span className="text-xs text-slate-500 tabular-nums">
          {t('cmp.allocationRules.leftMoneyBand', {
            low: money(level.incomeLow, currency),
            high: money(level.incomeHigh, currency),
          })}
        </span>
        {level.builtIn && (
          <span className="rounded-chip bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {t('cmp.allocationRules.builtIn')}
          </span>
        )}
        {level.locked && level.expirationMonth && (
          <span className="inline-flex items-center gap-1 rounded-chip bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <Lock className="w-3 h-3" />
            {t('cmp.allocationRules.lockedUntil', { month: formatMonth(level.expirationMonth, lang) })}
          </span>
        )}
      </div>

      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500 tabular-nums">
        <div className="flex gap-1">
          <dt>{t('cmp.allocationRules.minLeftover')}</dt>
          <dd className="text-slate-900">
            {level.minLeftover != null ? moneyFull(level.minLeftover, 'UZS') : '—'}
          </dd>
        </div>
        {level.expirationMonth && (
          <div className="flex gap-1">
            <dt>{t('cmp.allocationRules.lockUntilMonth')}</dt>
            <dd className="text-slate-900">{formatMonth(level.expirationMonth, lang)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-2 divide-y divide-hairline">
        {level.subLevels.map(sl => (
          <div key={sl.subLevel} className="py-2 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={`text-sm font-semibold ${
                sl.subLevel === currentSubLevel ? 'text-indigo-700' : 'text-slate-900'
              }`}>
                {t('page.overview.subLevelLabel', { level: sl.subLevel })}
              </span>
              <span className="text-xs text-slate-500">{t(debtLabelKey(sl.subLevel))}</span>
              {sl.subLevel === currentSubLevel && (
                <span className="rounded-chip bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {t('cmp.allocationRules.currentTag')}
                </span>
              )}
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {pcts(sl).map((pct, i) => (
                <div key={bucketCols[i]} className="min-w-0">
                  <p className="text-label uppercase text-slate-500 truncate">{bucketCols[i]}</p>
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">
                    {pct != null ? `${pct}%` : '—'}
                  </p>
                  {showAmounts && base != null && pct != null && pct > 0 && (
                    <p className="text-xs text-slate-500 tabular-nums">
                      {t('cmp.allocationRules.thisMonthAmount', { amount: money((pct / 100) * base, currency) })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
