import { useState } from 'react'
import { Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { TileGrid } from '../components/ui/Tile'
import { StatTile } from '../components/ui/StatTile'
import { ListRow, ListTile } from '../components/ui/ListRow'
import { IconChip, Badge } from '../components/ui/IconChip'
import { StatSlot } from '../components/ui/StatSlot'
import { ErrorTile } from '../components/ui/ErrorTile'
import { CacheBadge } from '../components/ui/CacheBadge'
import { Skeleton } from '../components/ui/Skeleton'
import { ExplainModal } from '../components/ui/ExplainModal'
import { AmountInput } from '../components/ui/AmountInput'
import { usePlanHeaderActions } from '../components/overview/PlanHeaderAction'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useLang } from '../i18n/LanguageContext'
import { emergenciesApi } from '../api/emergencies'
import { overviewApi } from '../api/overview'
import {
  formatDate, formatMonth, money, moneyFull, monthLocal, plural, snap, todayLocal,
} from '../utils/format'
import { extractErrorMessage } from '../api/client'
import type { BucketPayment, Currency, EmergencyRequest } from '../types'

const INPUT = 'w-full min-h-[44px] bg-white border border-slate-200 rounded-control px-3 py-2.5 ' +
  'text-sm text-slate-900 placeholder:text-slate-500 focus-ring'

const FORM_ID = 'emergency-form'

/** Grid cells for `Skeleton` and `ErrorTile`, which take a className rather than a tile span. */
const SPAN_HERO = 'md:col-span-3 xl:col-span-6'
const SPAN_STAT = 'md:col-span-2 xl:col-span-3'
const SPAN_HALF = 'md:col-span-3 xl:col-span-6'
const SPAN_FULL = 'md:col-span-6 xl:col-span-12'

/**
 * `marked` rides on the wire but is not on the shared `BucketPayment` type yet. A marked row
 * carries a MarkPaid id rather than a transaction id, so it must never offer edit or delete.
 */
type PaymentRow = BucketPayment & { marked?: boolean }

interface Props {
  /** The month the Plan page is showing, as 'YYYY-MM'. Every scoped figure here follows it. */
  month?: string
  currency?: Currency
  /** Called after any successful write, so the Plan's bucket card can refetch alongside us. */
  onWrote?: () => void
  /**
   * NESTING CONTRACT — read before you delete this.
   *
   * Plan (`Overview.tsx`) renders this page inside its own `PageHeader` and its own `TileGrid`.
   * An embedded copy must therefore add neither: two `<h1>`s fight over the single phone app bar,
   * and a grid inside a grid is exactly the case `Tile.tsx` warns about, which is what produced
   * the five different card widths the audit found. Embedded, the page returns its tiles as a
   * fragment of DIRECT children of Plan's grid (Plan's tab panel is `display: contents`, so the
   * spans still resolve against the page grid) and moves its write verbs into a full-width action
   * row. Standalone — mounted on a route of its own — it keeps its header and its grid. Do not
   * collapse the two branches.
   */
  embedded?: boolean
}

/**
 * The emergency fund, from both sides.
 *
 * The fund is modelled twice: this tab owns an `Emergency` table, while the Plan's bucket counts
 * EMERGENCY_CONTRIBUTION transactions — and paying the bucket from the Plan writes an
 * emergency-fund investment, which lands in the transactions but never in this table. That is why
 * "Target met" could sit above "0 contributions". The fix here is on the read side: the headline
 * is the Plan's own figure for the month, the rows behind it are listed as the Plan sees them, and
 * the editable table sits underneath with its own scope word. Picking ONE model is an owner
 * decision, not one this page can make quietly.
 */
export function EmergenciesPage({
  month = monthLocal(), currency = 'UZS', onWrote, embedded = false,
}: Props) {
  const { t, lang } = useLang()
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()

  // The editable table. It carries the ids an edit or a delete needs, so it stays unscoped.
  const emergencies = useApi(() => emergenciesApi.getAll(), [])
  // What the Plan actually counted this month — including the emergency-fund investment top-ups
  // the table above cannot see, and the month's "already paid" marks.
  const counted = useApi(
    () => overviewApi.getBucketPayments('EMERGENCY', month, currency), [month, currency])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [info, setInfo] = useState(false)
  const [form, setForm] = useState<EmergencyRequest>({
    amount: 0, currency: 'UZS', date: todayLocal(),
  })

  const set = <K extends keyof EmergencyRequest>(key: K, value: EmergencyRequest[K]) => {
    setDirty(true)
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ amount: 0, currency: 'UZS', date: todayLocal() })
    setDirty(false)
    setSheetOpen(true)
  }

  const openEdit = (id: number) => {
    const e = emergencies.data?.find(x => x.id === id)
    if (!e) return
    setEditId(id)
    setForm({
      amount: e.amount, currency: e.currency, date: e.date,
      description: e.description ?? undefined,
    })
    setDirty(false)
    setSheetOpen(true)
  }

  const closeSheet = () => { setSheetOpen(false); setEditId(null); setDirty(false) }

  // Embedded in Plan there is no header of this page's own, so its write verb is published to
  // Plan's — top right on a desktop, in the phone app bar on a phone, exactly where Home puts its
  // Add. The flag is false only if this page is ever embedded somewhere with no header slot, and
  // the in-body row below then still paints rather than the verb vanishing.
  const inPlanHeader = usePlanHeaderActions(embedded ? {
    primary: {
      label: t('page.emergencies.addContribution'),
      onClick: openAdd,
      icon: <Plus className="w-4 h-4" aria-hidden="true" />,
    },
  } : null)

  /** A contribution is mirrored into a transaction, so both figures here move on every write. */
  const refetchAll = () => { emergencies.refetch(); counted.refetch(); onWrote?.() }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (editId) await emergenciesApi.update(editId, form)
      else await emergenciesApi.create(form)
      closeSheet()
      refetchAll()
      showSuccess(editId ? t('page.emergencies.updatedToast') : t('page.emergencies.addedToast'))
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!await confirm({ message: t('page.emergencies.confirmDelete'), destructive: true })) return
    setDeleting(id)
    try {
      await emergenciesApi.delete(id)
      refetchAll()
      showSuccess(t('page.emergencies.deletedToast'))
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setDeleting(null) }
  }

  const list = emergencies.data ?? []
  const rows = (counted.data ?? []) as PaymentRow[]
  const monthLabel = formatMonth(month, lang)
  const monthTotal = snap(rows.reduce((sum, p) => sum + p.amount, 0))

  // Summed apart by currency: non-UZS rows were purged in the UZS-only pivot, so this is one
  // entry in practice, but adding two currencies together would invent a number.
  const byCurrency = list.reduce<Partial<Record<Currency, number>>>((acc, e) => {
    acc[e.currency] = (acc[e.currency] ?? 0) + e.amount
    return acc
  }, {})
  const allTime = Object.entries(byCurrency) as [Currency, number][]
  const allTimeValue = allTime.length
    ? allTime.map(([ccy, sum]) => money(snap(sum), ccy)).join(' + ')
    : money(0, currency)
  const allTimeExact = allTime.length
    ? allTime.map(([ccy, sum]) => moneyFull(snap(sum), ccy)).join(' + ')
    : moneyFull(0, currency)

  const staleError = (counted.error && counted.data ? counted.error : null)
    ?? (emergencies.error && emergencies.data ? emergencies.error : null)

  const tiles = (
    <>
      {/* The fallback for an embed with no header slot to publish into. */}
      {embedded && !inPlanHeader && (
        <div className={`flex flex-wrap items-center justify-end gap-2 ${SPAN_FULL}`}>
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" aria-hidden="true" />}
            label={t('page.emergencies.addContribution')}
            onClick={openAdd}
          />
        </div>
      )}

      {staleError && (
        <ErrorTile
          compact
          message={staleError}
          onRetry={() => { counted.refetch(); emergencies.refetch() }}
          className={SPAN_FULL}
        />
      )}

      <StatSlot query={counted} span={SPAN_HERO}>
        <StatTile
          hero
          span={6}
          rows={2}
          label={t('page.shared.setAsideIn', { month: monthLabel })}
          value={money(monthTotal, currency)}
          caption={t('ui.exactValue', { value: moneyFull(monthTotal, currency) })}
          icon={<ShieldAlert className="w-5 h-5" aria-hidden="true" />}
          iconTone="amber"
          onInfo={() => setInfo(true)}
        >
          <p className="text-sm text-slate-600">{t('page.emergencies.planNote')}</p>
          {/* Cached figures are pixel-identical to live ones; only this says which. */}
          <CacheBadge isCached={counted.isCached} cachedAt={counted.cachedAt} />
        </StatTile>
      </StatSlot>

      <StatSlot query={emergencies} span={SPAN_STAT}>
        <StatTile
          span={3}
          // Named after the list it totals, not after its period: this is the editable
          // contributions table below, which cannot see the Plan-side top-ups or the month's
          // "already paid" marks that the hero beside it counts. Headed only "All time" it
          // read as a whole that its own part exceeded.
          label={t('page.emergencies.allHeading')}
          value={allTimeValue}
          caption={`${t('page.shared.allTime')} · ${allTimeExact}`}
        />
      </StatSlot>

      <StatSlot query={counted} span={SPAN_STAT}>
        <StatTile
          span={3}
          // One source, one scope: this counts the rows listed under "Counted in {month}".
          label={t('page.emergencies.countLabel')}
          value={String(rows.length)}
          caption={t('page.emergencies.countedIn', { month: monthLabel })}
        />
      </StatSlot>

      {counted.loading ? (
        <Skeleton variant="row" count={3} className={SPAN_HALF} />
      ) : counted.error && !counted.data ? (
        <ErrorTile message={counted.error} onRetry={counted.refetch} className={SPAN_HALF} />
      ) : (
        <ListTile
          span={6}
          className={counted.refreshing ? 'opacity-60 transition-opacity' : undefined}
          header={
            <div className="min-w-0">
              <h2 className="text-title text-slate-900">
                {t('page.emergencies.countedIn', { month: monthLabel })}
              </h2>
              <p className="text-sm text-slate-500">{t('page.emergencies.fromPlanCaption')}</p>
            </div>
          }
          empty={t('page.emergencies.countedEmpty', { month: monthLabel })}
        >
          {rows.map(p => (
            <ListRow
              key={`${p.marked ? 'mark' : 'row'}-${p.id}`}
              leading={<IconChip tone="amber"><ShieldAlert className="w-4 h-4" aria-hidden="true" /></IconChip>}
              title={p.marked ? t('page.emergencies.markedTitle') : t('page.emergencies.countedTitle')}
              badges={p.marked && <Badge>{t('page.emergencies.markedBadge')}</Badge>}
              subtitle={[formatDate(p.date, lang), p.description].filter(Boolean).join(' · ')}
              amount={moneyFull(p.amount, currency)}
            />
          ))}
        </ListTile>
      )}

      {emergencies.loading ? (
        <Skeleton variant="row" count={5} className={SPAN_FULL} />
      ) : emergencies.error && !emergencies.data ? (
        <ErrorTile message={emergencies.error} onRetry={emergencies.refetch} className={SPAN_FULL} />
      ) : (
        <ListTile
          span={12}
          className={emergencies.refreshing ? 'opacity-60 transition-opacity' : undefined}
          header={
            <>
              <div className="min-w-0">
                <h2 className="text-title text-slate-900">{t('page.emergencies.allHeading')}</h2>
                <p className="text-sm text-slate-500">{t('page.emergencies.allCaption')}</p>
              </div>
              <p className="text-sm text-slate-500 tabular-nums shrink-0">
                {plural(
                  list.length,
                  t('page.emergencies.contribution', { count: list.length }),
                  t('page.emergencies.contributions', { count: list.length }),
                  lang,
                )}
              </p>
            </>
          }
          empty={t('page.emergencies.empty')}
        >
          {list.map(e => (
            <ListRow
              key={e.id}
              leading={<IconChip tone="amber"><ShieldAlert className="w-4 h-4" aria-hidden="true" /></IconChip>}
              title={formatDate(e.date, lang)}
              subtitle={e.description ?? undefined}
              amount={moneyFull(e.amount, e.currency)}
              actions={[
                {
                  label: t('action.edit'),
                  icon: <Pencil className="w-4 h-4" aria-hidden="true" />,
                  onClick: () => openEdit(e.id),
                },
                {
                  label: t('action.delete'),
                  icon: <Trash2 className="w-4 h-4" aria-hidden="true" />,
                  onClick: () => del(e.id),
                  danger: true,
                  disabled: deleting === e.id,
                },
              ]}
            />
          ))}
        </ListTile>
      )}
    </>
  )

  const overlays = (
    <>
      <ExplainModal
        open={info} onClose={() => setInfo(false)}
        title={t('cmp.potInfo.emergency.title')}
        meaning={t('cmp.potInfo.emergency.meaning')}
        formula={t('cmp.potInfo.emergency.formula')}
        note={t('cmp.potInfo.emergency.note')}
      />

      <Sheet
        open={sheetOpen}
        onClose={closeSheet}
        dirty={dirty}
        title={editId ? t('page.emergencies.editTitle') : t('page.emergencies.newTitle')}
        footer={
          <div className="flex gap-3">
            <Button className="flex-1" label={t('action.cancel')} onClick={closeSheet} />
            <Button
              className="flex-1"
              variant="primary"
              type="submit"
              form={FORM_ID}
              loading={saving}
              label={saving ? t('action.saving') : editId ? t('action.update') : t('action.create')}
            />
          </div>
        }
      >
        <form id={FORM_ID} onSubmit={save} className="space-y-4">
          <Field id="emergency-amount" label={t('tx.amount')} required>
            <AmountInput required value={form.amount || 0} currency={form.currency}
              onChange={v => set('amount', v)}
              className={INPUT} suffix={form.currency} />
          </Field>

          <Field id="emergency-date" label={t('tx.date')} required>
            <input required type="date" value={form.date}
              onChange={e => set('date', e.target.value)}
              className={INPUT} />
          </Field>

          <Field id="emergency-description" label={t('tx.description')}>
            <textarea rows={2} value={form.description ?? ''}
              onChange={e => set('description', e.target.value)}
              className={`${INPUT} resize-none`} placeholder={t('page.emergencies.descPlaceholder')} />
          </Field>
        </form>
      </Sheet>
    </>
  )

  // Nested in Plan: no header, no grid — Plan owns both. See `embedded` on Props.
  if (embedded) return <>{tiles}{overlays}</>

  return (
    <div className="space-y-4 xl:space-y-5">
      <PageHeader
        title={t('page.emergencies')}
        subtitle={t('page.emergencies.subtitle')}
        info={{ label: t('cmp.cardInfo.button', { title: t('page.emergencies') }), onClick: () => setInfo(true) }}
        primary={{
          label: t('page.emergencies.addContribution'),
          onClick: openAdd,
          icon: <Plus className="w-4 h-4" aria-hidden="true" />,
        }}
      />

      <TileGrid>{tiles}</TileGrid>
      {overlays}
    </div>
  )
}
