import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CreditCard, Plus, Wallet } from 'lucide-react'
import { AmountInput } from '../ui/AmountInput'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Tile } from '../ui/Tile'
import type { TileSpan } from '../ui/Tile'
import { useLang } from '../../i18n/LanguageContext'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { cashBalancesApi } from '../../api/cashBalances'
import { settingsApi } from '../../api/settings'
import { extractErrorMessage } from '../../api/client'
import { moneyFull } from '../../utils/format'
import type { Currency } from '../../types'

/** The one control the income gate points at, focused from anywhere on Home. */
export const INCOME_FIELD_ID = 'get-started-income'

/**
 * `AmountInput` has no default `className` and forwards whatever it is given straight to the
 * `<input>`, so omitting it leaves the control with Tailwind preflight's reset — no border, no
 * padding, no focus ring — and the absolutely positioned suffix printing over the digits. Both
 * fields here carry a currency suffix, hence the `pr-14` the suffix expects to sit in.
 */
const INPUT = 'focus-ring h-11 w-full rounded-control border border-slate-200 bg-white px-3 pr-14 text-sm text-slate-900 placeholder:text-slate-500'

/**
 * The first-run path Home never had.
 *
 * Every step is derived from server data — the settings row, the wallets, the transaction count —
 * so the checklist cannot claim a step is done that the API disagrees with, and no "onboarding
 * finished" flag has to be persisted anywhere. It disappears on its own once all three are true.
 *
 * Only the first unfinished step is expanded: three open forms at once is the screen a brand-new
 * account was already being shown, in a different arrangement.
 */
export function GetStartedHero({
  currency, walletCount, transactionCount, onStepDone, onAddExpense, span,
}: {
  currency: Currency
  walletCount: number
  transactionCount: number
  /** A step wrote something: Home's own figures are now stale. */
  onStepDone: () => void
  onAddExpense: () => void
  span?: TileSpan
}) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { hasStableIncome, refetch: refetchSettings } = useSettings()
  const { showSuccess, showError } = useToast()

  const [income, setIncome] = useState(0)
  const [savingIncome, setSavingIncome] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  const [cash, setCash] = useState(0)
  const [savingCash, setSavingCash] = useState(false)

  // A cash-only expense needs no wallet row, so a recorded transaction settles step 2 as well —
  // otherwise the checklist would pin itself open on an account that is demonstrably working.
  const done = [hasStableIncome, walletCount > 0 || transactionCount > 0, transactionCount > 0]
  const current = done.findIndex(d => !d)
  if (current === -1) return null

  const saveIncome = async () => {
    if (income <= 0) return
    setSavingIncome(true)
    try {
      // `allocationTrackingStartMonth` is deliberately absent: the backend locks it once set and
      // rejects any later value, so sending it back would break the very first save.
      await settingsApi.update({ monthlyStableIncome: income, monthlyStableIncomeCurrency: currency })
      showSuccess(moneyFull(income, currency), t('page.dashboard.getStarted.incomeSaved'))
      refetchSettings()
      onStepDone()
    } catch (err: unknown) {
      showError(extractErrorMessage(err))
    } finally {
      setSavingIncome(false)
    }
  }

  const saveCash = async () => {
    if (cash < 0) return
    setSavingCash(true)
    try {
      await cashBalancesApi.upsert({ currency, initialBalance: cash })
      showSuccess(moneyFull(cash, currency), t('page.dashboard.getStarted.cashSaved'))
      setCashOpen(false)
      onStepDone()
    } catch (err: unknown) {
      showError(extractErrorMessage(err))
    } finally {
      setSavingCash(false)
    }
  }

  return (
    <Tile span={span} as="section">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-title text-slate-900">{t('page.dashboard.getStarted.title')}</h2>
          <p className="text-sm text-slate-600 mt-0.5">{t('page.dashboard.getStarted.subtitle')}</p>
        </div>
        <span className="shrink-0 rounded-chip bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-600">
          {t('page.dashboard.getStarted.stepOf', { n: current + 1 })}
        </span>
      </div>

      <ol className="mt-4 divide-y divide-hairline">
        <Step
          n={1} done={done[0]} active={current === 0}
          title={t('page.dashboard.getStarted.step1Title')}
          help={t('page.dashboard.getStarted.step1Help')}
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field id={INCOME_FIELD_ID} label={t('page.settings.stableIncomeHeading')} className="min-w-[12rem] flex-1">
              {/* No autoFocus: this tile renders on page load, and stealing focus there would
                  scroll the reader to a form they did not ask for. Home focuses it on demand. */}
              <AmountInput value={income} onChange={setIncome} currency={currency} suffix={currency} className={INPUT} />
            </Field>
            <Button
              variant="primary"
              label={t('page.dashboard.getStarted.step1Save')}
              onClick={saveIncome}
              loading={savingIncome}
              disabled={income <= 0}
            />
          </div>
        </Step>

        <Step
          n={2} done={done[1]} active={current === 1}
          title={t('page.dashboard.getStarted.step2Title')}
          help={t('page.dashboard.getStarted.step2Help')}
        >
          {cashOpen ? (
            <div className="flex flex-wrap items-end gap-3">
              <Field id="get-started-cash" label={t('page.dashboard.getStarted.cashAmount')} className="min-w-[12rem] flex-1">
                <AmountInput value={cash} onChange={setCash} currency={currency} suffix={currency} className={INPUT} autoFocus />
              </Field>
              <Button variant="primary" label={t('action.save')} onClick={saveCash} loading={savingCash} />
              <Button variant="ghost" label={t('action.cancel')} onClick={() => setCashOpen(false)} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon={<CreditCard className="w-4 h-4" aria-hidden="true" />}
                label={t('page.dashboard.getStarted.step2Card')}
                onClick={() => navigate('/cards')}
              />
              <Button
                icon={<Wallet className="w-4 h-4" aria-hidden="true" />}
                label={t('page.dashboard.getStarted.step2Cash')}
                onClick={() => setCashOpen(true)}
              />
            </div>
          )}
        </Step>

        <Step
          n={3} done={done[2]} active={current === 2}
          title={t('page.dashboard.getStarted.step3Title')}
          help={t('page.dashboard.getStarted.step3Help')}
        >
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" aria-hidden="true" />}
            label={t('page.dashboard.getStarted.step3Action')}
            onClick={onAddExpense}
          />
        </Step>
      </ol>
    </Tile>
  )
}

function Step({ n, done, active, title, help, children }: {
  n: number
  done: boolean
  active: boolean
  title: string
  help: string
  children: ReactNode
}) {
  const { t } = useLang()

  return (
    <li className="flex gap-3 py-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
          done ? 'bg-emerald-100 text-emerald-600' : active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{title}</p>
        {done ? (
          <p className="text-xs text-slate-500">{t('page.dashboard.getStarted.stepDone')}</p>
        ) : active ? (
          <>
            <p className="mt-0.5 text-sm text-slate-600">{help}</p>
            <div className="mt-3">{children}</div>
          </>
        ) : null}
      </div>
    </li>
  )
}
