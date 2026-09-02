import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { useLang } from '../../i18n/LanguageContext'
import { overviewApi } from '../../api/overview'
import { extractErrorMessage } from '../../api/client'
import { formatCurrency } from '../../utils/format'
import type { AllocationLevelView, AllocationRulesView, LevelAllocationRuleRequest } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const SUBS = ['1', '2', '3']

type SubEdit = { d: string; e: string; i: string; s: string }
type Edit = { minLeftover: string; expirationMonth: string; subs: Record<string, SubEdit> }

const NUM = 'w-14 border border-slate-200 rounded-lg px-1.5 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-300'
const FIELD = 'border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

function n2s(n: number | null | undefined): string { return n == null ? '' : `${n}` }
function s2n(s: string): number | null {
  const t = s.trim(); if (t === '') return null
  const v = Number(t); return Number.isFinite(v) ? v : null
}
function amtRange(pct: number | null, low: number, high: number): string | null {
  if (pct == null || pct === 0) return null
  return `${formatCurrency((pct / 100) * low, 'UZS', true)} – ${formatCurrency((pct / 100) * high, 'UZS', true)}`
}

export function AllocationRulesModal({ open, onClose, onSaved }: Props) {
  const { t } = useLang()
  const BUCKET_COLS = [t('cmp.bucket.donation'), t('cmp.bucket.emergency'), t('cmp.bucket.investments'), t('cmp.bucket.stocks')] as const
  const [view, setView] = useState<AllocationRulesView | null>(null)
  const [edit, setEdit] = useState<Edit | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editLevelView: AllocationLevelView | undefined = view?.levels.find(l => l.editable)

  useEffect(() => {
    if (!open) return
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
          setEdit({
            minLeftover: n2s(ev.minLeftover),
            expirationMonth: ev.expirationMonth ?? '',
            subs,
          })
        } else {
          setEdit(null)
        }
      })
      .catch(err => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
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
              investmentsPercent: s2n(r.i), stocksPercent: s2n(r.s),
            }
          })
        : undefined
      await overviewApi.saveLevelConfig({
        level: lvl,
        minLeftover: s2n(edit.minLeftover),
        expirationMonth: edit.expirationMonth ? `${edit.expirationMonth}-01` : null,
        rules,
      })
      onSaved(); onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('cmp.allocationRules.title')} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          {t('cmp.allocationRules.intro')}
          {view?.currentLevel ? t('cmp.allocationRules.currentLevelParen', { level: view.currentLevel }) : ''}
          {t('cmp.allocationRules.lockSuffix')}
        </p>
        <p className="text-[11px] text-slate-400">
          {t('cmp.allocationRules.level1Note')}
        </p>

        {loading ? (
          <div className="h-40 flex items-center justify-center"><Spinner /></div>
        ) : view?.missingStableIncome ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            {t('cmp.allocationRules.missingIncome')}
          </div>
        ) : view ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {view.levels.map(lvl => {
              const isCurrent = view.currentLevel === lvl.level
              const ev = lvl.editable ? edit : null
              return (
                <div key={lvl.level}
                  className={`rounded-xl border p-3 ${isCurrent ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-100'}`}>
                  {/* Level header */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${isCurrent ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {t('cmp.allocationRules.level', { level: lvl.level })}
                      </p>
                      <span className="text-[11px] text-slate-400">
                        {formatCurrency(lvl.incomeLow, 'UZS', true)} – {formatCurrency(lvl.incomeHigh, 'UZS', true)}
                      </span>
                      {lvl.builtIn && <span className="text-[10px] uppercase tracking-wider text-slate-400">{t('cmp.allocationRules.builtIn')}</span>}
                      {isCurrent && <span className="text-[10px] uppercase tracking-wider text-indigo-500">{t('cmp.allocationRules.youAreHere')}</span>}
                    </div>
                    {lvl.locked && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                        <Lock className="w-3 h-3" /> {t('cmp.allocationRules.lockedUntil', { month: lvl.expirationMonth ?? '' })}
                      </span>
                    )}
                  </div>

                  {/* Per-level config: min leftover + expiration */}
                  <div className="flex items-end gap-4 flex-wrap mb-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{t('cmp.allocationRules.minLeftover')}</label>
                      {ev ? (
                        <input type="number" min="0" step="100000" value={ev.minLeftover}
                          onChange={e => setEdit(p => p && ({ ...p, minLeftover: e.target.value }))}
                          className={`${FIELD} w-40`} placeholder="—" />
                      ) : (
                        <p className="text-sm text-slate-600">{lvl.minLeftover != null ? formatCurrency(lvl.minLeftover, 'UZS', true) : '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{t('cmp.allocationRules.lockUntilMonth')}</label>
                      {ev ? (
                        <input type="month" value={ev.expirationMonth}
                          onChange={e => setEdit(p => p && ({ ...p, expirationMonth: e.target.value }))}
                          className={`${FIELD} w-40`} />
                      ) : (
                        <p className="text-sm text-slate-600">{lvl.expirationMonth ?? '—'}</p>
                      )}
                    </div>
                  </div>

                  {/* Sub-level percentage matrix */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-slate-400 text-left">
                        <th className="font-medium py-1 pr-2">{t('cmp.allocationRules.subLevel')}</th>
                        {BUCKET_COLS.map(c => <th key={c} className="font-medium py-1 px-1 text-right">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {lvl.subLevels.map(sl => {
                        const isCurSub = view.currentSubLevel === sl.subLevel
                        const cells: { field: keyof SubEdit; pct: number | null }[] = [
                          { field: 'd', pct: sl.donationPercent },
                          { field: 'e', pct: sl.emergencyPercent },
                          { field: 'i', pct: sl.investmentsPercent },
                          { field: 's', pct: sl.stocksPercent },
                        ]
                        return (
                          <tr key={sl.subLevel} className={`align-top ${isCurSub ? 'bg-indigo-100/40' : ''}`}>
                            <td className="py-1.5 pr-2 whitespace-nowrap">
                              <span className="font-medium text-slate-600">{sl.subLevel}</span>
                              <span className="ml-1.5 text-[11px] text-slate-400">{sl.debtLabel}</span>
                            </td>
                            {cells.map(({ field, pct }) => {
                              const liveStr = ev ? ev.subs[sl.subLevel]?.[field] : undefined
                              const livePct = ev ? s2n(liveStr ?? '') : pct
                              const range = amtRange(livePct, lvl.incomeLow, lvl.incomeHigh)
                              return (
                                <td key={field} className="py-1.5 px-1 text-right">
                                  {ev && !lvl.builtIn ? (
                                    <input type="number" min="0" max="100" step="0.5"
                                      value={liveStr ?? ''}
                                      onChange={e => setSubCell(sl.subLevel, field, e.target.value)}
                                      placeholder="—" className={NUM} />
                                  ) : (
                                    <span className="text-slate-600">{pct != null ? `${pct}%` : '—'}</span>
                                  )}
                                  {range && <p className="text-[10px] text-slate-400 mt-0.5">{range}</p>}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        ) : null}

        {error && (
          <p className="text-rose-500 text-sm bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</p>
        )}

        {!loading && view && !view.missingStableIncome && !editLevelView && (
          <p className="text-xs text-slate-400">
            {view.currentLevel == null
              ? t('cmp.allocationRules.noEditableLevel')
              : t('cmp.allocationRules.lockedReadOnly', { level: view.currentLevel })}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
            {t('action.close')}
          </button>
          {editLevelView && (
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Spinner className="w-4 h-4" />}
              {saving ? t('action.saving') : t('cmp.allocationRules.saveLevel', { level: editLevelView.level })}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
