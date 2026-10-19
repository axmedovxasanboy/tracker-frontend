import { useState } from 'react'
import { PauseCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { Tile } from '../ui/Tile'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { IconChip } from '../ui/IconChip'
import { ActionMenu } from '../ui/ActionMenu'
import type { MenuAction } from '../ui/ActionMenu'
import { CONTROL, CONTROL_INVALID } from '../transactions/formParts'
import { IncomeFromChips, incomeMonths } from '../settings/IncomeFrom'
import { OWN_ICON } from '../savings/SavingsThisMonth'
import { PercentInput, parsePct } from './PercentFields'
import { incomeFor, pctCell } from './levelWords'
import { useLang } from '../../i18n/LanguageContext'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { notifyDataChanged } from '../../hooks/useApi'
import { levelsApi } from '../../api/levels'
import { extractErrorMessage } from '../../api/client'
import { formatDate, moneyFull } from '../../utils/format'
import type { LevelsResponse, OwnSaving } from '../../types/levels'

/** Which sheet is open: a new saving, or a rename / stop of one. */
type Open = { kind: 'new' } | { kind: 'rename' | 'stop'; saving: OwnSaving } | null

/**
 * "Your own savings" on Savings rules: the savings the owner adds beside the three built-in ones
 * (2026-10-19). Each is a column of the table above — its percentage per level and situation is
 * edited there like the three's; here it is made, renamed, stopped from a month, or deleted while
 * no money has moved through it. Its money is put in on Savings.
 */
export function OwnSavings({ d, startNew = false }: { d: LevelsResponse; startNew?: boolean }) {
  const { t } = useLang()
  const { showSuccess, showError } = useToast()
  const confirm = useConfirm()
  const [open, setOpen] = useState<Open>(startNew ? { kind: 'new' } : null)
  const own = d.customSavings ?? []

  const remove = async (s: OwnSaving) => {
    const ok = await confirm({
      message: t('own.deleteConfirm', { name: s.name }),
      destructive: true,
      confirmLabel: t('own.delete'),
      cancelLabel: t('action.cancel'),
    })
    if (!ok) return
    try {
      await levelsApi.deleteSaving(s.id)
      notifyDataChanged()
      showSuccess(t('own.deleted', { name: s.name }))
    } catch (err) {
      showError(extractErrorMessage(err))
    }
  }

  const actions = (s: OwnSaving): MenuAction[] => [
    { label: t('own.rename'), icon: <Pencil className="h-4 w-4" aria-hidden="true" />, onClick: () => setOpen({ kind: 'rename', saving: s }) },
    { label: t('own.stop'), icon: <PauseCircle className="h-4 w-4" aria-hidden="true" />, onClick: () => setOpen({ kind: 'stop', saving: s }) },
    // One that money moved through keeps its history: it can be stopped, not deleted.
    ...(s.hasMoney ? [] : [{
      label: t('own.delete'), icon: <Trash2 className="h-4 w-4" aria-hidden="true" />, danger: true, onClick: () => remove(s),
    }]),
  ]

  return (
    <Tile span={12} as="section">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-title text-slate-900">{t('own.title')}</h2>
        <Button size="sm" label={t('own.new')} icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => setOpen({ kind: 'new' })} className="shrink-0" />
      </div>
      <p className="mt-1 text-sm text-slate-600">{t('own.intro')}</p>
      {own.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('own.empty')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-hairline">
          {own.map(s => {
            const now = d.percents?.custom?.[String(s.id)] ?? 0
            return (
              <li key={s.id} className="flex min-h-[56px] items-center gap-3 py-2">
                <IconChip tone={OWN_ICON.tone}>{OWN_ICON.icon}</IconChip>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">{s.name}</p>
                  <p className="text-xs tabular-nums text-slate-500">
                    {now > 0 ? t('own.thisMonth', { percent: pctCell(now) }) : t('own.notAsked')}
                  </p>
                </div>
                <ActionMenu actions={actions(s)} label={s.name} />
              </li>
            )
          })}
        </ul>
      )}

      {open?.kind === 'new' && <NewSavingSheet d={d} onClose={() => setOpen(null)} />}
      {open?.kind === 'rename' && <RenameSheet saving={open.saving} onClose={() => setOpen(null)} />}
      {open?.kind === 'stop' && <StopSheet d={d} saving={open.saving} onClose={() => setOpen(null)} />}
    </Tile>
  )
}

/** This month and the two after — a saving starts or stops in a month to come, never in one gone by. */
const monthsFrom = (thisMonth: string) => incomeMonths(thisMonth, thisMonth)

function NewSavingSheet({ d, onClose }: { d: LevelsResponse; onClose: () => void }) {
  const { t, lang } = useLang()
  const { settings } = useSettings()
  const { showSuccess } = useToast()
  const months = monthsFrom(d.month)
  const [name, setName] = useState('')
  const [percent, setPercent] = useState('')
  const [from, setFrom] = useState(months[0])
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pct = parsePct(percent)
  const nameError = tried && !name.trim() ? t('own.errName') : undefined
  const pctError = (tried || percent.trim() !== '') && (pct == null || (tried && !(pct > 0)))
    ? t(pct == null && /^\d+([.,]\d+)?$/.test(percent.trim()) ? 'lvl.err.each' : 'lvl.err.number') : undefined
  const income = incomeFor(settings, from)

  const save = async () => {
    setTried(true)
    if (!name.trim() || pct == null || !(pct > 0)) return
    setSaving(true); setError(null)
    try {
      await levelsApi.createSaving({ name: name.trim(), percent: pct, from })
      notifyDataChanged()
      showSuccess(t('own.created', { name: name.trim(), percent: pctCell(pct), month: formatDate(from, lang, 'monthShort') }))
      onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Sheet open onClose={onClose} title={t('own.newTitle')} maxWidth="max-w-lg"
      dirty={!!name.trim() || !!percent.trim()}
      footer={<Button variant="primary" label={saving ? t('action.saving') : t('action.save')} loading={saving}
        onClick={save} className="w-full sm:ml-auto sm:w-auto" />}>
      <div className="space-y-4">
        <Field id="own-name" label={t('own.name')} required error={nameError}>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="off"
            placeholder={t('own.namePlaceholder')} className={nameError ? CONTROL_INVALID : CONTROL} />
        </Field>
        <Field id="own-percent" label={t('own.percent')} required help={t('own.percentHelp')} error={pctError}>
          <PercentInput value={percent} onChange={e => setPercent(e.target.value)} invalid={!!pctError} />
        </Field>
        {pct != null && pct > 0 && income != null && income > 0 && (
          <p aria-live="polite" className="text-sm tabular-nums text-slate-600">
            {t('own.money', { amount: moneyFull(Math.round((income * pct) / 100)) })}
          </p>
        )}
        <IncomeFromChips months={months} value={from} onChange={setFrom} disabled={saving} />
        {error && <p role="alert" className="text-sm font-medium text-expense">{error}</p>}
      </div>
    </Sheet>
  )
}

function RenameSheet({ saving: s, onClose }: { saving: OwnSaving; onClose: () => void }) {
  const { t } = useLang()
  const { showSuccess } = useToast()
  const [name, setName] = useState(s.name)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameError = tried && !name.trim() ? t('own.errName') : undefined

  const save = async () => {
    setTried(true)
    if (!name.trim()) return
    if (name.trim() === s.name) { onClose(); return }
    setBusy(true); setError(null)
    try {
      await levelsApi.renameSaving(s.id, name.trim())
      notifyDataChanged()
      showSuccess(t('own.renamed', { name: name.trim() }))
      onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title={t('own.renameTitle', { name: s.name })} maxWidth="max-w-md"
      dirty={name.trim() !== s.name}
      footer={<Button variant="primary" label={busy ? t('action.saving') : t('action.save')} loading={busy}
        onClick={save} className="w-full sm:ml-auto sm:w-auto" />}>
      <div className="space-y-4">
        <Field id="own-rename" label={t('own.name')} required error={nameError}>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="off"
            className={nameError ? CONTROL_INVALID : CONTROL} />
        </Field>
        {error && <p role="alert" className="text-sm font-medium text-expense">{error}</p>}
      </div>
    </Sheet>
  )
}

function StopSheet({ d, saving: s, onClose }: { d: LevelsResponse; saving: OwnSaving; onClose: () => void }) {
  const { t, lang } = useLang()
  const { showSuccess } = useToast()
  const months = monthsFrom(d.month)
  // Next month by default: this one has already asked for it.
  const [from, setFrom] = useState(months[1] ?? months[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true); setError(null)
    try {
      await levelsApi.stopSaving(s.id, from)
      notifyDataChanged()
      showSuccess(t('own.stopped', { name: s.name, month: formatDate(from, lang, 'monthShort') }))
      onClose()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title={t('own.stopTitle', { name: s.name })} maxWidth="max-w-md"
      footer={<Button variant="primary" label={busy ? t('action.saving') : t('own.stop')} loading={busy}
        onClick={save} className="w-full sm:ml-auto sm:w-auto" />}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{t('own.stopHelp')}</p>
        <IncomeFromChips months={months} value={from} onChange={setFrom} disabled={busy} />
        {error && <p role="alert" className="text-sm font-medium text-expense">{error}</p>}
      </div>
    </Sheet>
  )
}

/** One own saving's percentage in a situation's figures; 0 when it is not asked. */
export const ownPct = (p: { custom?: Record<string, number> }, id: number): number => p.custom?.[String(id)] ?? 0
