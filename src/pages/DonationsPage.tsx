import { useState } from 'react'
import { HeartHandshake, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { financeApi } from '../api/finance'
import { overviewApi } from '../api/overview'
import {
  formatDate, formatMonth, money, moneyFull, monthLocal, plural, snap, todayLocal,
} from '../utils/format'
import { extractErrorMessage } from '../api/client'
import type { BucketPayment, Currency, DonationRequest } from '../types'

const INPUT = 'w-full min-h-[44px] bg-white border border-slate-200 rounded-control px-3 py-2.5 ' +
  'text-sm text-slate-900 placeholder:text-slate-500 focus-ring'

const FORM_ID = 'donation-form'

/**
 * Several dictionary labels still carry a trailing '*' from the hand-rolled forms. `Field` draws
 * the required marker itself, so the star has to come off here or the label reads "Recipient * *".
 */
const req = (label: string) => label.replace(/\s*\*$/, '')

/**
 * Grid spans for the two things that stand in for a tile but are not one. `Skeleton` and
 * `ErrorTile` take a className rather than a span, so the cell they occupy has to be spelled out —
 * without it the row reflows the moment the real tile lands.
 */
const SPAN_HERO = 'md:col-span-3 xl:col-span-6'
const SPAN_STAT = 'md:col-span-2 xl:col-span-3'
const SPAN_HALF = 'md:col-span-3 xl:col-span-6'
const SPAN_FULL = 'md:col-span-6 xl:col-span-12'

/**
 * `marked` rides on the wire — `OverviewService.getBucketPayments` folds the month's "already
 * paid" marks into these rows so they add up to the figure on the Plan's bucket card — but the
 * shared `BucketPayment` type has not caught up. Read it here rather than edit a file this page
 * does not own; a marked row carries a MarkPaid id, so it must never offer edit or delete.
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

export function DonationsPage({
  month = monthLocal(), currency = 'UZS', onWrote, embedded = false,
}: Props) {
  const { t, lang } = useLang()
  const confirm = useConfirm()
  const { showSuccess, showError } = useToast()

  // The all-time CRUD surface: it is the only source that carries the ids an edit or a delete
  // needs, so it stays unscoped.
  const donations = useApi(() => financeApi.getDonations(), [])
  // The month figure comes from the endpoint the Plan itself reads. Summing this tab's own rows
  // would quietly disagree with the bucket card above it — which is exactly the contradiction
  // that put "Target met" over "0 contributions".
  const counted = useApi(
    () => overviewApi.getBucketPayments('DONATION', month, currency), [month, currency])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [info, setInfo] = useState(false)
  const [form, setForm] = useState<DonationRequest>({
    recipientName: '', amount: 0, currency: 'UZS', donationDate: todayLocal(),
  })

  const set = <K extends keyof DonationRequest>(key: K, value: DonationRequest[K]) => {
    setDirty(true)
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ recipientName: '', amount: 0, currency: 'UZS', donationDate: todayLocal() })
    setDirty(false)
    setSheetOpen(true)
  }

  const openEdit = (id: number) => {
    const d = donations.data?.find(x => x.id === id)
    if (!d) return
    setEditId(id)
    setForm({
      recipientName: d.recipientName, amount: d.amount, currency: d.currency,
      donationDate: d.donationDate,
      description: d.description ?? undefined,
      anonymous: d.anonymous,
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
      label: t('page.donations.addDonation'),
      onClick: openAdd,
      icon: <Plus className="w-4 h-4" aria-hidden="true" />,
    },
  } : null)

  /** Both figures on this screen move on every write, and so does the Plan's bucket card. */
  const refetchAll = () => { donations.refetch(); counted.refetch(); onWrote?.() }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId) await financeApi.updateDonation(editId, form)
      else await financeApi.createDonation(form)
      closeSheet()
      refetchAll()
      showSuccess(editId ? t('page.donations.updatedToast') : t('page.donations.createdToast'))
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setSaving(false) }
  }

  const del = async (id: number) => {
    if (!await confirm({ message: t('page.donations.confirmDelete'), destructive: true })) return
    setDeleting(id)
    try {
      await financeApi.deleteDonation(id)
      refetchAll()
      showSuccess(t('page.donations.deletedToast'))
    } catch (err) {
      showError(extractErrorMessage(err))
    } finally { setDeleting(null) }
  }

  const list = donations.data ?? []
  const rows = (counted.data ?? []) as PaymentRow[]
  const monthLabel = formatMonth(month, lang)
  const monthTotal = snap(rows.reduce((sum, p) => sum + p.amount, 0))

  // Records still carry a currency each. Non-UZS rows were purged in the UZS-only pivot, so this
  // is one entry in practice — but adding two different currencies into one figure would invent
  // a number, so they are summed apart and printed apart.
  const byCurrency = list.reduce<Partial<Record<Currency, number>>>((acc, d) => {
    acc[d.currency] = (acc[d.currency] ?? 0) + d.amount
    return acc
  }, {})
  const allTime = Object.entries(byCurrency) as [Currency, number][]
  const allTimeValue = allTime.length
    ? allTime.map(([ccy, sum]) => money(snap(sum), ccy)).join(' + ')
    : money(0, currency)
  const allTimeExact = allTime.length
    ? allTime.map(([ccy, sum]) => moneyFull(snap(sum), ccy)).join(' + ')
    : moneyFull(0, currency)

  // Stale-but-readable: the hook keeps the previous payload, so the strip offers the retry and
  // the tiles below stay on screen.
  const staleError = (counted.error && counted.data ? counted.error : null)
    ?? (donations.error && donations.data ? donations.error : null)

  const tiles = (
    <>
      {/* The fallback for an embed with no header slot to publish into. */}
      {embedded && !inPlanHeader && (
        <div className={`flex flex-wrap items-center justify-end gap-2 ${SPAN_FULL}`}>
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" aria-hidden="true" />}
            label={t('page.donations.addDonation')}
            onClick={openAdd}
          />
        </div>
      )}

      {staleError && (
        <ErrorTile
          compact
          message={staleError}
          onRetry={() => { counted.refetch(); donations.refetch() }}
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
          icon={<HeartHandshake className="w-5 h-5" aria-hidden="true" />}
          iconTone="pink"
          onInfo={() => setInfo(true)}
        >
          <p className="text-sm text-slate-600">{t('page.donations.planNote')}</p>
          {/* Cached figures are pixel-identical to live ones; only this says which. */}
          <CacheBadge isCached={counted.isCached} cachedAt={counted.cachedAt} />
        </StatTile>
      </StatSlot>

      <StatSlot query={donations} span={SPAN_STAT}>
        <StatTile
          span={3}
          // Named after the list it totals, not after its period: this figure counts the
          // donation records below and nothing else, while the hero beside it is the plan's
          // figure for the month — which also counts "already paid" marks, and so can be the
          // larger of the two. A tile headed only "All time" made that read as a part
          // exceeding its whole.
          label={t('page.donations.allHeading')}
          value={allTimeValue}
          caption={`${t('page.shared.allTime')} · ${allTimeExact}`}
        />
      </StatSlot>

      <StatSlot query={counted} span={SPAN_STAT}>
        <StatTile
          span={3}
          // One source, one scope: this counts the rows listed under "Counted in {month}".
          // Captioning it with the all-time record count put two sources on one tile and
          // printed "1 counted · 0 all time".
          label={t('page.donations.countLabel')}
          value={String(rows.length)}
          caption={t('page.donations.countedIn', { month: monthLabel })}
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
          header={<h2 className="text-title text-slate-900">{t('page.donations.countedIn', { month: monthLabel })}</h2>}
          empty={t('page.donations.countedEmpty', { month: monthLabel })}
        >
          {rows.map(p => (
            <ListRow
              key={`${p.marked ? 'mark' : 'row'}-${p.id}`}
              leading={<IconChip tone="pink"><HeartHandshake className="w-4 h-4" aria-hidden="true" /></IconChip>}
              title={p.marked ? t('page.donations.markedTitle') : p.label}
              badges={p.marked && <Badge>{t('page.donations.markedBadge')}</Badge>}
              subtitle={[formatDate(p.date, lang), p.description].filter(Boolean).join(' · ')}
              amount={moneyFull(p.amount, currency)}
            />
          ))}
        </ListTile>
      )}

      {donations.loading ? (
        <Skeleton variant="row" count={5} className={SPAN_FULL} />
      ) : donations.error && !donations.data ? (
        <ErrorTile message={donations.error} onRetry={donations.refetch} className={SPAN_FULL} />
      ) : (
        <ListTile
          span={12}
          className={donations.refreshing ? 'opacity-60 transition-opacity' : undefined}
          header={
            <>
              <h2 className="text-title text-slate-900">{t('page.donations.allHeading')}</h2>
              <p className="text-sm text-slate-500 tabular-nums">
                {plural(
                  list.length,
                  t('page.donations.donation', { count: list.length }),
                  t('page.donations.donations', { count: list.length }),
                  lang,
                )}
              </p>
            </>
          }
          empty={t('page.donations.empty')}
        >
          {list.map(d => (
            <ListRow
              key={d.id}
              leading={<IconChip tone="pink"><HeartHandshake className="w-4 h-4" aria-hidden="true" /></IconChip>}
              title={d.displayName}
              badges={d.anonymous && <Badge>{t('page.donations.anonymousCol')}</Badge>}
              subtitle={[formatDate(d.donationDate, lang), d.description].filter(Boolean).join(' · ')}
              amount={moneyFull(d.amount, d.currency)}
              actions={[
                {
                  label: t('action.edit'),
                  icon: <Pencil className="w-4 h-4" aria-hidden="true" />,
                  onClick: () => openEdit(d.id),
                },
                {
                  label: t('action.delete'),
                  icon: <Trash2 className="w-4 h-4" aria-hidden="true" />,
                  onClick: () => del(d.id),
                  danger: true,
                  disabled: deleting === d.id,
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
        title={t('cmp.potInfo.donation.title')}
        meaning={t('cmp.potInfo.donation.meaning')}
        formula={t('cmp.potInfo.donation.formula')}
        note={t('cmp.potInfo.donation.note')}
      />

      <Sheet
        open={sheetOpen}
        onClose={closeSheet}
        dirty={dirty}
        title={editId ? t('page.donations.editTitle') : t('page.donations.newTitle')}
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
          <Field id="donation-recipient" label={req(t('page.donations.recipientLabel'))} required>
            <input required value={form.recipientName}
              onChange={e => set('recipientName', e.target.value)}
              className={INPUT} />
          </Field>

          <Field id="donation-amount" label={t('tx.amount')} required>
            <AmountInput required value={form.amount || 0} currency={form.currency}
              onChange={v => set('amount', v)}
              className={INPUT} suffix={form.currency} />
          </Field>

          <Field id="donation-date" label={req(t('page.donations.donationDateLabel'))} required>
            <input required type="date" value={form.donationDate}
              onChange={e => set('donationDate', e.target.value)}
              className={INPUT} />
          </Field>

          <label htmlFor="donation-anonymous"
            className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-control border border-slate-200 px-3">
            <input id="donation-anonymous" type="checkbox" checked={form.anonymous ?? false}
              onChange={e => set('anonymous', e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus-ring" />
            <span className="text-sm text-slate-700">{t('page.donations.anonymousLabel')}</span>
          </label>

          <Field id="donation-description" label={t('tx.description')}>
            <textarea rows={2} value={form.description ?? ''}
              onChange={e => set('description', e.target.value)}
              className={`${INPUT} resize-none`} />
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
        title={t('page.donations')}
        subtitle={t('page.donations.subtitle')}
        info={{ label: t('cmp.cardInfo.button', { title: t('page.donations') }), onClick: () => setInfo(true) }}
        primary={{
          label: t('page.donations.addDonation'),
          onClick: openAdd,
          icon: <Plus className="w-4 h-4" aria-hidden="true" />,
        }}
      />

      <TileGrid>{tiles}</TileGrid>
      {overlays}
    </div>
  )
}
