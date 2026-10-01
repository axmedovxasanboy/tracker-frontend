import { useMemo, useState } from 'react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { IncomeFromChips, incomeMonths } from '../settings/IncomeFrom'
import { useLang } from '../../i18n/LanguageContext'
import { useSettings } from '../../context/SettingsContext'
import { levelsApi } from '../../api/levels'
import { extractErrorMessage } from '../../api/client'
import { PercentFields, checkDraft, draftOf, sameDraft } from './PercentFields'
import type { PercentDraft } from './PercentFields'
import { GROUP_OF, amountsOf, amountsText, groupName, incomeFor, lineLabel, versionAt } from './levelWords'
import { SPLIT_SITUATIONS } from '../../types/levels'
import type { LevelEntry, LevelSituation, LevelsResponse } from '../../types/levels'

interface Props {
  open: boolean
  onClose: () => void
  data: LevelsResponse
  entry: LevelEntry | null
  situation: LevelSituation | null
  onSaved: (next: LevelsResponse, level: number, from: string) => void
}

/**
 * One situation of one level, edited in one step (spec §2.3, with the owner's §6): its three
 * percentages, the level's "Split at" line when it is one of the four split rows, "From which
 * month?", Save.
 *
 * A fresh form on every open — keyed by level and situation, so it never shows the last one's
 * numbers for a frame.
 */
export function RuleEditSheet(props: Props) {
  const { open, entry, situation } = props
  if (!open || !entry || !situation) return null
  return <RuleEditForm key={`${entry.level}-${situation}`} {...props} entry={entry} situation={situation} />
}

function RuleEditForm({ onClose, data, entry, situation, onSaved }: Props & { entry: LevelEntry; situation: LevelSituation }) {
  const { t } = useLang()
  const { settings } = useSettings()
  const thisMonth = data.month
  const months = incomeMonths(data.firstMonth, thisMonth)
  const isSplit = SPLIT_SITUATIONS.has(situation)

  const [from, setFrom] = useState(() => (months.includes(thisMonth) ? thisMonth : months[0]))
  const version = versionAt(entry, from)
  const [draft, setDraft] = useState<PercentDraft>(() => draftOf(version.rules[situation]))
  const [cutoff, setCutoff] = useState(() => version.cutoff)
  const [touched, setTouched] = useState(false)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = useMemo(() => checkDraft(draft), [draft])
  const base = version.rules[situation]
  const cutoffChanged = isSplit && cutoff !== version.cutoff
  const dirty = touched && (!sameDraft(draft, draftOf(base)) || cutoffChanged)
  const income = incomeFor(settings, from)
  const inForceNow = data.level === entry.level && data.situation === situation && from === thisMonth
  const line = lineLabel(t, situation, cutoff)

  // The fields show the version in force for the chosen month — until the owner types; after
  // that, a different month keeps what they typed.
  const pickMonth = (m: string) => {
    setFrom(m)
    if (touched) return
    const v = versionAt(entry, m)
    setDraft(draftOf(v.rules[situation]))
    setCutoff(v.cutoff)
  }

  const save = async () => {
    setTried(true)
    if (!check.values) return
    if (isSplit && !(cutoff > 0)) return
    setSaving(true); setError(null)
    try {
      const res = await levelsApi.saveRules(entry.level, {
        from,
        rules: { [situation]: check.values },
        // Left out, the server keeps the line in force at `from`.
        ...(cutoffChanged ? { cutoff } : {}),
      })
      onSaved(res.data, entry.level, from)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      // The level and the situation's name in the title; the line, which can be long, under it.
      title={t('lvl.edit.title', { n: entry.level, situation: groupName(t, GROUP_OF[situation]) })}
      maxWidth="max-w-lg"
      dirty={dirty}
      footer={
        <Button
          variant="primary"
          label={saving ? t('action.saving') : t('action.save')}
          loading={saving}
          onClick={save}
          className="w-full sm:ml-auto sm:w-auto"
        />
      }
    >
      <div className="space-y-4">
        {line && <p className="text-sm font-medium tabular-nums text-slate-900">{line}</p>}
        <PercentFields
          idPrefix="rule-edit"
          draft={draft}
          onChange={d => { setTouched(true); setDraft(d) }}
          check={check}
          showErrors={tried || Object.keys(check.errors).length > 0}
          split={isSplit ? { value: cutoff, onChange: v => { setTouched(true); setCutoff(v) }, invalid: !(cutoff > 0) } : undefined}
          disabled={saving}
        />
        {check.values && income != null && income > 0 && (
          <p aria-live="polite" className="text-sm tabular-nums text-slate-600">
            {t(inForceNow ? 'lvl.edit.moneyNow' : 'lvl.edit.money', { amounts: amountsText(amountsOf(check.values, income)) })}
          </p>
        )}
        <IncomeFromChips months={months} value={from} onChange={pickMonth} disabled={saving} />
        {error && <p role="alert" className="text-sm font-medium text-expense">{error}</p>}
      </div>
    </Sheet>
  )
}
