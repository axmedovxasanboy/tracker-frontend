import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { ChevronLeft, ChevronRight, CloudOff, X } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Tile, TileGrid } from '../components/ui/Tile'
import { Button } from '../components/ui/Button'
import { ErrorTile } from '../components/ui/ErrorTile'
import { IconChip } from '../components/ui/IconChip'
import { Skeleton } from '../components/ui/Skeleton'
import { RuleEditSheet } from '../components/levels/RuleEditSheet'
import {
  GROUPS, LEVEL5_PAY, amountsOf, groupName, incomeFor, lineLabel, pctCell, percentsText, situationName, totalOf, versionAt,
} from '../components/levels/levelWords'
import { useApi, notifyDataChanged } from '../hooks/useApi'
import { useLang } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/LanguageContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { levelsApi } from '../api/levels'
import { extractErrorMessage } from '../api/client'
import { formatDate, moneyFull, todayLocal } from '../utils/format'
import type { LevelEntry, LevelPercents, LevelSituation, LevelsResponse } from '../types/levels'

const FULL = 'md:col-span-6 xl:col-span-12'
const LEVELS = [1, 2, 3, 4, 5] as const

/** The three bucket columns, each with the dot of its usual colour. */
const BUCKETS: ReadonlyArray<{ key: keyof LevelPercents; label: TKey; dot: string }> = [
  { key: 'donation', label: 'cmp.bucket.donation', dot: 'bg-pink-500' },
  { key: 'emergency', label: 'cmp.bucket.emergency', dot: 'bg-amber-500' },
  { key: 'investments', label: 'cmp.bucket.investments', dot: 'bg-teal-500' },
]

/**
 * The row grid. A phone has three cells — the name (which wraps, never truncates), the three
 * figures as one "5% · 2% · 8%", the chevron. From `sm` the figures take a column each, under
 * their bucket's header. The hidden cells are `display: none`, so they hold no grid track.
 */
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_auto_1rem] sm:grid-cols-[minmax(0,1fr)_5rem_5.5rem_6rem_1rem]'

type Result = { kind: 'ok'; data: LevelsResponse } | { kind: 'outdated' }

/**
 * Savings rules (LEVELS-ALLOCATION-SPEC.md §2.1–§2.3): every level's percentages, one level at a
 * time, for each of the seven situations a month can be in.
 *
 * The page opens on the level this month is on. What applies now comes first, in words and money;
 * the table under it is for the day the owner wants to change something. No sub-level codes, no
 * "scenario": a situation is named the way the owner would say it.
 */
export function SavingsRules() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { settings } = useSettings()
  const { showSuccess, showError } = useToast()
  const confirm = useConfirm()
  const today = todayLocal()

  // A server from before levels answers 404: its own sentence, never an error.
  const q = useApi<Result>(async () => {
    try {
      const res = await levelsApi.get(today)
      return { ...res, data: { kind: 'ok' as const, data: res.data } }
    } catch (err) {
      if ((err as AxiosError)?.response?.status === 404) return { data: { kind: 'outdated' as const } }
      throw err
    }
  }, [today])

  const asked = Number(params.get('level'))
  const [picked, setPicked] = useState<number | null>(asked >= 1 && asked <= 5 ? asked : null)
  const [editing, setEditing] = useState<LevelSituation | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const result = q.data
  const d = result?.kind === 'ok' ? result.data : null
  const shown = picked ?? d?.level ?? 1
  const entry = d?.levels.find(l => l.level === shown) ?? null

  const removeVersion = async (level: number, month: string) => {
    const name = formatDate(month, lang, 'monthShort')
    const ok = await confirm({
      title: t('fix.income.removeTitle'),
      message: t('lvl.removeConfirm', { month: name, n: level }),
      destructive: true,
      confirmLabel: t('action.delete'),
      cancelLabel: t('action.cancel'),
    })
    if (!ok) return
    setRemoving(month)
    try {
      await levelsApi.removeVersion(level, month)
      notifyDataChanged()
      showSuccess(t('lvl.removed', { n: level, month: name }))
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setRemoving(null) }
  }

  return (
    <div className="p-4 sm:p-6">
      <Link
        to="/settings"
        aria-label={t('shell.categories.backLabel')}
        className="focus-ring -ml-2 mb-1 inline-flex min-h-[44px] items-center gap-1 rounded-control px-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t('shell.categories.back')}
      </Link>
      <PageHeader title={t('lvl.title')} />

      <div className="mt-4 xl:mt-5">
        <TileGrid className={q.refreshing ? 'opacity-60 transition-opacity' : ''}>
          {q.loading ? (
            <>
              <Skeleton variant="stat" className={FULL} />
              <Skeleton variant="row" count={7} className={FULL} />
            </>
          ) : q.error && !result ? (
            <ErrorTile className={FULL} message={q.error} onRetry={q.refetch} />
          ) : result?.kind === 'outdated' ? (
            <Tile span={12} as="section">
              <div className="flex items-start gap-3">
                <IconChip tone="neutral"><CloudOff className="h-4 w-4" aria-hidden="true" /></IconChip>
                <p className="min-w-0 pt-1.5 text-sm text-slate-700">{t('lvl.outdated')}</p>
              </div>
            </Tile>
          ) : d && entry ? (
            <>
              {q.error && <ErrorTile compact className={FULL} message={q.error} onRetry={q.refetch} />}
              <ThisMonth d={d} income={incomeFor(settings, d.month)} onSetIncome={() => navigate('/settings')} />

              <Tile span={12} as="section" padding="none" className="overflow-hidden">
                <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                  <p id="rules-levels-label" className="mb-2 text-label uppercase text-slate-500">{t('lvl.tabs')}</p>
                  <LevelTabs current={d.level} active={shown} onChange={setPicked} />
                  <p className="mt-3 text-sm text-slate-600 tabular-nums">{bandLine(t, entry, d.road?.payThreshold)}</p>
                </div>
                <div role="tabpanel" id="rules-panel" aria-labelledby={`level-tab-${shown}`} className="mt-3">
                  <RulesTable
                    d={d}
                    entry={entry}
                    onEdit={setEditing}
                  />
                  <VersionsLine
                    entry={entry}
                    busy={removing}
                    onRemove={month => removeVersion(entry.level, month)}
                  />
                </div>
              </Tile>
            </>
          ) : null}
        </TileGrid>
      </div>

      {d && (
        <RuleEditSheet
          open={!!editing}
          onClose={() => setEditing(null)}
          data={d}
          entry={entry}
          situation={editing}
          onSaved={(_next, level, from) => {
            setEditing(null)
            // Every page's figures may have moved, this one's included.
            notifyDataChanged()
            showSuccess(t('lvl.saved', { n: level, month: formatDate(from, lang, 'monthShort') }))
          }}
        />
      )}
    </div>
  )
}

/** "Level 2 · 15.000.000 UZS to 30.000.000 UZS left after bills", or Level 5's own rule. */
function bandLine(
  t: (key: TKey, vars?: Record<string, string | number>) => string, e: LevelEntry, threshold?: number,
): string {
  if (e.level >= 5) return t('lvl.band.five', { amount: moneyFull(threshold ?? LEVEL5_PAY) })
  if (e.leftTo == null) return t('lvl.band.top', { n: e.level, from: moneyFull(e.leftFrom ?? 0) })
  if (!e.leftFrom) return t('lvl.band.first', { n: e.level, to: moneyFull(e.leftTo) })
  return t('lvl.band.middle', { n: e.level, from: moneyFull(e.leftFrom), to: moneyFull(e.leftTo) })
}

// ── What applies now ──────────────────────────────────────────────────────────────────────────

function ThisMonth({ d, income, onSetIncome }: { d: LevelsResponse; income: number | null; onSetIncome: () => void }) {
  const { t } = useLang()
  if (d.level == null || !d.situation || !d.percents) {
    return (
      <Tile span={12} as="section">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm text-slate-700">{t('lvl.noIncome')}</p>
          <Button label={t('page.advisor.btn.setIncome')} onClick={onSetIncome} className="shrink-0" />
        </div>
      </Tile>
    )
  }
  const entry = d.levels.find(l => l.level === d.level)
  const cutoff = entry ? versionAt(entry, d.month).cutoff : null
  const monthly = income != null && income > 0 ? totalOf(amountsOf(d.percents, income)) : null
  return (
    <Tile span={12} padding="hero" as="section">
      <p className="text-label uppercase text-slate-500">
        {t('lvl.thisMonth')} · {t('shell.profile.level', { n: d.level })}
      </p>
      <p className="mt-2 text-title text-slate-900 [overflow-wrap:anywhere]">{situationName(t, d.situation, cutoff)}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
        <span className="text-stat text-slate-900">{percentsText(d.percents)}</span>
        {monthly != null && monthly > 0 && (
          <span className="text-sm text-slate-600">{t('lvl.monthAmount', { amount: moneyFull(monthly) })}</span>
        )}
      </p>
    </Tile>
  )
}

// ── The level tabs ────────────────────────────────────────────────────────────────────────────

/**
 * Five tabs across, at every width — "1" to "5" under the word "Level", the one the month is on
 * marked with a dot (and "Now" from `sm`). A tab strip of its own rather than `Tabs`, which
 * scrolls beyond four and has no way to mark one tab as the current one.
 */
function LevelTabs({ current, active, onChange }: { current: number | null; active: number; onChange: (n: number) => void }) {
  const { t } = useLang()
  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = LEVELS.length - 1
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    else return
    e.preventDefault()
    onChange(LEVELS[next])
    document.getElementById(`level-tab-${LEVELS[next]}`)?.focus()
  }
  return (
    <div role="tablist" aria-labelledby="rules-levels-label" className="grid grid-cols-5 gap-1 rounded-control bg-slate-100 p-1">
      {LEVELS.map((n, i) => {
        const on = n === active
        const now = n === current
        return (
          <button
            key={n}
            id={`level-tab-${n}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls="rules-panel"
            aria-label={now ? t('lvl.tabNow', { n }) : t('shell.profile.level', { n })}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(n)}
            onKeyDown={e => onKeyDown(e, i)}
            className={`focus-ring flex min-h-[48px] min-w-0 flex-col items-center justify-center rounded-chip px-1 text-base font-semibold tabular-nums transition-colors focus-visible:ring-offset-slate-100 ${
              on ? 'bg-white text-slate-900 shadow-tile' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{n}</span>
            {now && (
              <span className="flex items-center gap-1 text-[11px] font-medium leading-none text-indigo-600">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                <span className="hidden sm:inline">{t('lvl.now')}</span>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── The table ─────────────────────────────────────────────────────────────────────────────────

function RulesTable({ d, entry, onEdit }: { d: LevelsResponse; entry: LevelEntry; onEdit: (s: LevelSituation) => void }) {
  const { t, lang } = useLang()
  const inForce = versionAt(entry, d.month)
  const future = [...entry.versions].filter(v => v.from > d.month).sort((a, b) => a.from.localeCompare(b.from))
  const onThisLevel = d.level === entry.level

  return (
    <div>
      {/* The bucket names, once. Columns from `sm`; one legend line on a phone. */}
      <div className={`${ROW_GRID} hidden items-end gap-x-3 border-y border-hairline bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600 sm:grid sm:px-5`}>
        <span />
        {BUCKETS.map(b => (
          <span key={b.key} className="flex items-start justify-end gap-1.5 text-right leading-tight">
            <span aria-hidden="true" className={`mt-1 h-2 w-2 shrink-0 rounded-full ${b.dot}`} />
            {t(b.label)}
          </span>
        ))}
        <span />
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-hairline bg-slate-50 px-4 py-2 text-xs text-slate-600 sm:hidden">
        {BUCKETS.map(b => (
          <span key={b.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${b.dot}`} />
            {t(b.label)}
          </span>
        ))}
      </p>

      <div className="divide-y divide-hairline">
        {GROUPS.map(g => {
          const split = g.situations.length > 1
          return (
            <div key={g.group}>
              {split && (
                <p className="px-4 pt-3 text-sm font-semibold text-slate-900 sm:px-5">{groupName(t, g.group)}</p>
              )}
              {g.situations.map(s => {
                const p = inForce.rules[s]
                // What a later version changes on this row, as small text under it.
                const later = future
                  .filter(v => v.rules[s] && percentsText(v.rules[s]) !== percentsText(p))
                  .map(v => t('lvl.future', { month: formatDate(v.from, lang, 'monthShort'), percents: percentsText(v.rules[s]) }))
                return (
                  <RuleRow
                    key={s}
                    label={split ? lineLabel(t, s, inForce.cutoff)! : groupName(t, g.group)}
                    nested={split}
                    percents={p}
                    now={onThisLevel && d.situation === s}
                    yours={!onThisLevel && d.situation === s}
                    later={later}
                    onClick={() => onEdit(s)}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * One editable line: its name, its three figures, a chevron. The row in force has an indigo bar
 * and "Now"; on another level's tab, the owner's situation has a dashed frame and "Your situation"
 * — the row that would apply on that level today.
 */
function RuleRow({ label, nested, percents, now, yours, later, onClick }: {
  label: string
  nested: boolean
  percents: LevelPercents
  now: boolean
  yours: boolean
  later: string[]
  onClick: () => void
}) {
  const { t } = useLang()
  const spoken = BUCKETS.map(b => `${t(b.label)} ${pctCell(percents[b.key])}`).join(', ')
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${ROW_GRID} focus-ring focus-visible:ring-inset focus-visible:ring-offset-0 relative min-h-[52px] w-full items-center gap-x-3 px-4 py-2.5 text-left transition-colors sm:px-5 ${
        now ? 'bg-indigo-50/70 hover:bg-indigo-50' : 'hover:bg-slate-50'
      }`}
    >
      {now && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-indigo-600" />}
      {yours && <span aria-hidden="true" className="pointer-events-none absolute inset-1 rounded-control border border-dashed border-slate-300" />}

      <span className={`min-w-0 ${nested ? 'pl-3' : ''}`}>
        <span className="text-sm text-slate-900 tabular-nums [overflow-wrap:anywhere]">{label}</span>
        {(now || yours) && (
          <span className={`ml-2 inline-flex translate-y-[-1px] items-center rounded-chip px-1.5 py-0.5 align-middle text-[11px] font-semibold ${
            now ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {t(now ? 'lvl.now' : 'lvl.yourSituation')}
          </span>
        )}
        {later.map(l => (
          <span key={l} className="mt-0.5 block text-xs tabular-nums text-indigo-700">{l}</span>
        ))}
      </span>

      {/* Phone: the three figures as one, never wrapped. */}
      <span aria-hidden="true" className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-slate-900 sm:hidden">
        {percentsText(percents)}
      </span>
      {/* From sm: a column each. */}
      {BUCKETS.map(b => (
        <span key={b.key} aria-hidden="true" className={`hidden text-right text-sm tabular-nums sm:block ${
          percents[b.key] > 0 ? 'font-semibold text-slate-900' : 'text-slate-500'
        }`}>
          {pctCell(percents[b.key])}
        </span>
      ))}
      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
      <span className="sr-only">{spoken}</span>
    </button>
  )
}

// ── The changes made to a level ───────────────────────────────────────────────────────────────

/**
 * "Changes: from Nov 2026 × · from Sep 2026 (first)" — newest first, the same control as the
 * income's history. Every version but the first can be removed: the first is what the earliest
 * months read, so removing it would move their targets (the server refuses it too).
 */
function VersionsLine({ entry, busy, onRemove }: { entry: LevelEntry; busy: string | null; onRemove: (month: string) => void }) {
  const { t, lang } = useLang()
  const versions = [...entry.versions].sort((a, b) => b.from.localeCompare(a.from))
  const oldest = versions[versions.length - 1]?.from
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-hairline px-4 py-3 text-xs tabular-nums text-slate-500 sm:px-5">
      <span className="mr-1">{t('lvl.changes')}</span>
      {versions.map((v, i) => {
        const month = formatDate(v.from, lang, 'monthShort')
        return (
          <span key={v.from} className="inline-flex items-center gap-0.5">
            {i > 0 && <span aria-hidden="true" className="mr-1">·</span>}
            <span>{t('lvl.changeFrom', { month })}</span>
            {v.from === oldest && versions.length > 0 && <span className="ml-1">{t('lvl.first')}</span>}
            {v.from !== oldest && (
              <button
                type="button"
                onClick={() => onRemove(v.from)}
                disabled={busy != null}
                aria-label={t('lvl.removeVersion', { month })}
                className="focus-ring relative inline-flex h-6 w-6 items-center justify-center rounded-chip text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 after:absolute after:-inset-2.5 after:content-['']"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
