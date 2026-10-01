import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { LinkButton } from '../home/HomeTiles'
import { useLang } from '../../i18n/LanguageContext'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { notifyDataChanged } from '../../hooks/useApi'
import { levelsApi } from '../../api/levels'
import { extractErrorMessage } from '../../api/client'
import { formatDate, money, moneyFull, todayLocal } from '../../utils/format'
import { PercentFields, checkDraft, draftOf, sameDraft } from './PercentFields'
import type { PercentDraft } from './PercentFields'
import { LEVEL5_PAY, amountsOf, amountsText, incomeFor, situationName, versionAt } from './levelWords'
import { SPLIT_SITUATIONS } from '../../types/levels'
import type { LevelNotice } from '../../types/levels'

/**
 * "You're on Level 5" (spec §2.4). It shows the three months that earned it and Level 5's
 * percentages for the situation the owner is in, editable in place.
 *
 * Level 5 applies whatever is pressed — the owner asked for it to be automatic — so every way out
 * (Later, ×, Esc, a tap outside) marks the dialog seen and changes nothing. Only an edit, saved
 * with Save, writes: from the Level 5 start month, with no month question, so the dialog stays
 * one step.
 */
export function Level5Dialog({ notice, onDone }: { notice: LevelNotice; onDone: () => void }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { showSuccess } = useToast()
  const situation = notice.situation
  const isSplit = situation != null && SPLIT_SITUATIONS.has(situation)

  const [initial, setInitial] = useState<PercentDraft | null>(notice.percents ? draftOf(notice.percents) : null)
  const [draft, setDraft] = useState<PercentDraft | null>(initial)
  const [cutoff0, setCutoff0] = useState<number | null>(notice.cutoff ?? null)
  const [cutoff, setCutoff] = useState<number>(notice.cutoff ?? 0)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The line (and, from an older answer, the percentages) come from Level 5's version for the
  // start month when the notice does not carry them.
  useEffect(() => {
    if (!situation || (cutoff0 != null && initial)) return
    let live = true
    levelsApi.get(todayLocal(), { silent: true })
      .then(res => {
        const five = res.data.levels?.find(l => l.level === 5)
        if (!live || !five) return
        const v = versionAt(five, notice.from)
        if (cutoff0 == null) { setCutoff0(v.cutoff); setCutoff(v.cutoff) }
        if (!initial && v.rules[situation]) {
          const d = draftOf(v.rules[situation])
          setInitial(d)
          setDraft(d)
        }
      })
      .catch(() => {})
    return () => { live = false }
    // Once, for this notice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice.id])

  const check = useMemo(() => (draft ? checkDraft(draft) : null), [draft])
  const changed = !!draft && !!initial && (!sameDraft(draft, initial) || (isSplit && cutoff0 != null && cutoff !== cutoff0))
  const month = formatDate(notice.from, lang, 'monthShort')
  const income = incomeFor(settings, notice.from)
  const amounts = check?.values && income ? amountsOf(check.values, income) : !changed ? notice.amounts : null

  const save = async () => {
    if (!changed) { onDone(); return }
    setTried(true)
    if (!check?.values || !situation) return
    if (isSplit && !(cutoff > 0)) return
    setSaving(true); setError(null)
    try {
      await levelsApi.saveRules(5, {
        from: notice.from,
        rules: { [situation]: check.values },
        ...(isSplit && cutoff0 != null && cutoff !== cutoff0 ? { cutoff } : {}),
      })
      notifyDataChanged()
      showSuccess(t('lvl.saved', { n: 5, month }))
      onDone()
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open
      onClose={onDone}
      title={t('lvl5.title')}
      maxWidth="max-w-lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button label={t('lvl5.later')} onClick={onDone} disabled={saving} />
          <Button
            variant="primary"
            loading={saving}
            label={changed ? t('action.save') : t('lvl5.keep')}
            onClick={save}
          />
        </div>
      }
    >
      <div className="space-y-4 text-sm text-slate-700">
        <div>
          <p>{t('lvl5.pay', { amount: moneyFull(LEVEL5_PAY) })}</p>
          <p className="mt-1 font-medium tabular-nums text-slate-900">
            {notice.months.map(m => `${formatDate(m.month, lang, 'monthShort')} ${money(m.pay)}`).join(' · ')}
          </p>
          <p className="mt-2">{t('lvl5.from', { month })}</p>
        </div>

        {situation && draft && check && (
          <div className="space-y-3 border-t border-hairline pt-4">
            <p className="font-medium text-slate-900">
              {t('lvl5.situation', { name: situationName(t, situation, cutoff0 ?? notice.cutoff) })}
            </p>
            <PercentFields
              idPrefix="lvl5"
              draft={draft}
              onChange={setDraft}
              check={check}
              showErrors={tried || Object.keys(check.errors).length > 0}
              split={isSplit && cutoff0 != null ? { value: cutoff, onChange: setCutoff, invalid: !(cutoff > 0) } : undefined}
              disabled={saving}
            />
            {amounts && (
              <p className="tabular-nums text-slate-600">{t('lvl.edit.money', { amounts: amountsText(amounts) })}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-slate-600">{t('lvl5.others')}</p>
          <LinkButton label={t('lvl.title')} onClick={() => { onDone(); navigate('/settings/rules?level=5') }} />
        </div>
        {error && <p role="alert" className="text-sm font-medium text-expense">{error}</p>}
      </div>
    </Modal>
  )
}
