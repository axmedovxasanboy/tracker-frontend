# Tracker — Bento UX Audit (6 September 2026)

Full report with screenshots, scorecard, glossary and mock-ups: https://claude.ai/code/artifact/61b338fe-9237-4e82-a322-2d2a76a77307

Reviewed live at `localhost:5173` (commit `91d2aa7`) at 1536 px and 390 px, in English and Uzbek.
65 screenshots · 12,200 lines of frontend source · 330 findings, each checked by a second reviewer.

## Verdict — 4 / 10

Tracker has the Bento **ingredients** (soft grey ground, white tiles, hairline borders, 16 px corners,
one gap) but not the Bento **composition**: pages are stacks of full-width bands with equal-size stat
cards, no page has a hero tile, coloured left bars and tinted panels replace the white-tile rhythm, and
the biggest tile on Home is a chart with one month of data.

The bigger risk is trust and breakage, not styling: money figures contradict each other between
screens, the planning page opens on a red "Level 1.2 · Survival tier" with no title, one primary button
does nothing, and the phone layout of the allocation header overprints its labels.

Scores: Bento fidelity 4 · Comprehension 4 · Mobile 4 · Consistency 3.5 · Forms & dialogs 5.

## Bento scorecard

| Criterion | Status | Today |
|---|---|---|
| Modular grid | partial | Only the Home chart + allocation row is a grid; other pages are `p-6 space-y-6` stacks |
| Varied spans / hero | **fail** | No hero anywhere; 3–5 identical stat cards per page |
| Radius 16–24 consistent | partial | 16 px on tiles, but 12 px (242 uses) and 8 px (114) mixed at the same level |
| Soft neutral ground, white tiles | partial | Ground is right; left accent bars, pink banner, cream box, pastel Finance tiles, yellow cash tiles |
| One gap, one padding | partial | Grid 16, sections 24, lists 8–12; padding 12–24 on one page |
| One idea per tile | partial | Allocation tiles hold 5–6 ideas; transaction cards 60% empty; a tile that holds only tabs |
| Hierarchy by size | **fail** | Every number the same size; unformatted `29500000.00` is the largest text on Finance |
| Responsive reflow | partial | Stacks fine, but header collision at 390 px, floating menu covers content, tab strip overflows |
| Motion only where clickable | partial | Home stat cards lift; everything else static; card actions hover-only |
| Content-first chrome | partial | 3–4 filled buttons beside each title; Finance has two tab strips + a totals bar before content |

## The twelve that matter (ranked)

1. **Critical — Money contradicts itself across screens.** Overview: Donation "Paid 284,2 k · Target met";
   Donations tab: "1 donation · 50.000"; Months: Donation 50.000, Emergency 0. Home headline
   "568,4 k of 426,3 k set aside · 100% covered". Fix: one vocabulary (Target / Paid / Set aside),
   one paid figure per bucket per month, scope word beside every amount, bar capped at 100%.
   `AllocationPanel.tsx:91-116`, `Overview.tsx:664-684`, `Months.tsx:116-130`.
2. **Critical — First run is disabled buttons, dashes and jargon.** Income gate is a 12 px amber strip
   ("your tier and every allocation…"), Settings explains its field as "drives the tier dashboard",
   nothing says what to do next. Fix: "Get started" hero tile on Home with the income input inline,
   then add a wallet, then first expense; tracking start behind Advanced.
   `IncomeRequiredNotice.tsx`, `Dashboard.tsx:60-84`, `Settings.tsx:100-150`, `Signup.tsx:41-43`.
3. **Critical — Dead ends.** Finance "Add" does nothing on its landing tab (works on Loans);
   add-transaction defaults to "Card only" with no cards; Overview hides its three tabs when the
   ritual is incomplete; 0 of 36 data hooks render their error (failures look like empty accounts);
   `/login` is unguarded after a reset. Fix: chooser on Finance summary; Cash default; tabs visible
   but locked with a reason; shared `ErrorTile` with Retry; guard `/login` like `/signup`.
   `Finance.tsx:341-345,410-413`, `TransactionModal.tsx:1028-1040`, `Overview.tsx:82,156,182`,
   `useApi.ts:46-54`, `App.tsx:46-47`.
4. **Critical — Phone chrome breaks.** Overview allocation header prints "THISALLOCATION MONTHDUE";
   the floating menu button covers digits once scrolled; 3–4 buttons wrap beside titles; Transactions
   opens on a full filter panel; the tab strip scrolls with no hint. Fix: stack the header with
   `white-space:nowrap` stats; sticky 56 px app bar (or bottom tabs); one "+ Add" per page; filters as
   chips; fitted segmented tabs. `Overview.tsx:664-684,158-176`, `App.tsx:62-71`,
   `TransactionFilters.tsx:16-81`.
5. **High — Names.** "Dashboard" (nav) is headed "Overview"; the next nav item is "Overview" whose first
   tab is "Dashboard"; Finance's first tab is a third "Overview"; the Overview page has no heading;
   the Finance nav string is hard-coded English. Fix: Home · Plan (tab "This month") · Months ·
   Transactions · Wallets · Finance (tab "Summary") · Categories · Settings, in both languages, plus
   one `PageHeader`. `Sidebar.tsx:12-13,93`, `Dashboard.tsx:65`, `Overview.tsx:34,86`.
6. **High — The level is an alarm and its explanations disagree.** Pink banner, red "Level 1.2";
   "Debt ratio (debt ÷ left money) 5.0%" from 400.000 ÷ 3.242.000 (which is 12.3%); rules dialog
   reads "owner spec … (7 / 3 / 10 / 0)" and shows a raw 5000000. Fix: neutral chip once per page;
   one ratio with agreeing operands; read-only "How allocation works" separate from "Edit Level 1".
   `Overview.tsx:481-498`, `LevelExplainModal.tsx`, `AllocationRulesModal.tsx`.
7. **High — No hero tile.** Equal spans and stacked bands everywhere; the chart is two thirds of the
   width for one month of data. Fix: 12-column grid per page with one hero (Home → Spendable;
   Plan → Left balance with chain; Months → Left; Wallets → total held; Finance → net position);
   chart as bars for months with data or a sparkline.
8. **High — Money written five ways.** "8,6 M UZS" / "142.100 UZS" / "500 000 UZS/mo" / "0,00 USD" /
   "29500000.00" (no unit); "1 loans taken"; three date formats; English months in Uzbek. Fix: one
   formatter (compact in tiles, full in lists, unit always, no `.00`), `formatDate(date, lang)`,
   plural helper; start with the 19 `toFixed(2)` sites in `Finance.tsx`.
9. **High — Add-transaction form.** Amount is the eighth control; six advanced types up front;
   Description required with "e.g. Monthly salary" on Expense; focus opens on the close button;
   Escape discards a filled form. Fix: Amount first and large; Category, Card (Cash default), Date;
   the rest behind "More options"; bound labels; dirty guard; bottom sheet on mobile.
   `TransactionModal.tsx:533-1060`, `Modal.tsx:24-27`.
10. **High — Colour has no contract.** Left bars + solid icon squares; pink/cream/pastel/yellow tiles;
    green means income, done, lent, HUMO, online; red means expense, the tier, debt, both loan
    sub-tabs, Clear. Ten accent hues in source. Fix: indigo action · green in · red out · amber
    attention; all tiles white; colour on icon chips, pills and bars only; at most one tinted alert
    per page. `SummaryCard.tsx:20-32,47`, `Overview.tsx:481-486`, `Finance.tsx:1021-1024`.
11. **High — Vocabulary drift.** "Left Money" vs "Left balance"; Mandatory / Monthly commitments /
    Monthly; Bank installments / Instalment / Debt Payments; Emergency / Emergencies / Emergency Fund
    (modelled twice); Lented / Loans lent pending / Loan Given; Record / Add / Top Up / New Goal;
    "Tagged". Fix: the glossary below applied by grep; Plan strip as a chain
    "Income 8,0 M → after bills 3,2 M → after debt 2,8 M"; one verb "Add".
12. **High — Density, feedback, reach.** ~110 px cards with content in the top 45 px; 67 spinners and
    zero skeletons; search refetches per keystroke; "Allocation due" and cash balance go stale after
    writes with no success toast; meta text slate-300 (1.5:1); 16 px ⓘ, 28 px unnamed hover-only
    edit/delete; confirm and toast titles English in Uzbek. Fix: `ListRow` 52–56 / 72 px;
    `Skeleton` + `ErrorTile`; debounce 300 ms; refetch ledger/cash after writes; slate-500 floor;
    44 px named icon buttons visible on touch. `RecordCard.tsx:50-84`, `useApi.ts`,
    `Overview.tsx:663,388-414`, `Cards.tsx:437`, `InfoDot.tsx`, `ConfirmContext.tsx:52-61`.

Also: USD/EUR cash pots still offered (`Cards.tsx:173`); Uzbek gaps (nav "Finance", "Level 1.2",
bucket names, chart months, action items, confirms, toasts, API errors, dates); Developer in primary
nav and "Backend online" on every page; sidebar clips Settings/Developer under ~780 px tall; Months
shows "—" all month and no overdue-month hint; investments total includes emergency-fund items;
Danger Zone competes with Save; no `prefers-reduced-motion` and no focus rings; scrollbar jump
between Overview tabs; "Where it went" omits Stocks.

## Tokens

| Token | Value |
|---|---|
| Ground | `#F5F5F7` (dark `#111214`); never tint pages or sections |
| Tile | white · 1 px rgba(0,0,0,.06) · shadow 0 1px 2px rgba(0,0,0,.04); no left bars, no tinted tiles |
| Radius | tile 20 · control 12 · chip 8 (add to `tailwind.config.js`) |
| Gap / padding | 16 (20 at xl) / 20 (24 hero) |
| Hover / press | translateY(-2px) + shadow 200 ms, scale .98; only on tiles that do something; reduced-motion respected |
| Focus | 2 px indigo-300 ring via `focus-visible` |
| Type | hero 40/44 · stat 28 · title 18 · body 14 · label 11 caps; keep self-hosted Inter; `tabular-nums` on figures |
| Text floor | slate-900 / 600 / 500; nothing lighter than slate-500 for text ≤ 14 px |
| Colour contract | indigo action · green in · red out · amber attention; status = text + small pill |
| Numbers | compact in tiles, full in lists, unit always, no `.00`; one date helper with the `uz` locale |

Home composition (12 columns at xl): Spendable hero 6×2 · Left to allocate 3×1 · September plan
(Paid / Target / ahead) 3×1 · Income 3×1 · Expenses 3×1 · Set-aside buckets 4×1 · Recent 5×1 ·
Month status + "Add transaction" 3×1. Phone order: hero, plan, add, then one column.

Plan composition: header with month stepper and neutral level chip; hero = Left balance with the
chain; action tile collapses to one green line when done; one flat tile per bucket (amount largest,
% muted, bar, Done / "+142 k ahead" pill, Add, History); tabs always visible; debt breakdown hidden
when zero.

Components to build once: `PageHeader`, `Tile`/`StatTile`, `Tabs`, `Button`, `Field`, `ListRow`,
`ErrorTile`, `Skeleton`, `Sheet`.

## Glossary (apply by grep in EN and UZ)

| Today | Use |
|---|---|
| Dashboard / Overview (Home heading) | Home |
| Overview / (no heading) / "Dashboard" tab | Plan · "This month" |
| Monthly Summary / Monthly (Finance tab) | Months · Monthly bills |
| Cards & Wallets | Wallets |
| Finance › Overview | Summary |
| Left Money / Left balance | After bills / Left to allocate |
| Mandatory (Subscriptions) / Monthly commitments | Monthly bills |
| Bank installments / Bank Instalment / Debt Payments | Bank loan payment |
| Emergency / Emergencies / Emergency Fund | Emergency fund |
| Lented Money / Loans lent pending / Owed to You (Lent) | Lent |
| Borrowed Money / Loans borrowed owed / You Owe | Borrowed |
| Record / Add Donation / Add contribution / New Goal / Top Up / Transaction | Add |
| Tagged total / Tagged out / envelope | Set aside |
| Level 1.2 · Survival tier + Sub-level 1.2 · Manageable debt | "Level 1.2 · Survival" chip + one line |
| Met / All caught up / Target met / Settled / on target | Done |
| Backend online / Cached 14:32 / Request failed (500) | hidden / As of 14:32 / "Can't reach your server — retry" |

## First run and return loop

First run: (1) Signup says what Tracker does and what happens next; (2) Home opens on a "Get
started" hero with the income input inline; (3) add a card or cash from the same hero; (4) record the
first expense, amount first; (5) the Plan hero explains the chain once.

Return loop: month tile on Home and in the sidebar ("closes in 24 days · 142 k still to set aside");
overdue-month banner with "Close August"; progress toward the next level; land on the new month after
closing; Recent activity on Home; success toast on every write.

## Implementation plan

- **Phase 0 · Trust and breakage (1–2 days):** one formatter (19 `toFixed` sites); phone header +
  app bar; Finance Add chooser; Cash default; page renames in EN/UZ + Plan heading + translated
  confirm/toast defaults; scope words and one paid figure per bucket; refetch after writes + success
  toasts + `ErrorTile`; remove USD/EUR; fix "Lented"; fix the level ratio and "owner spec" text.
- **Phase 1 · Tile system (~1 week):** tokens; remove bars/tints; `Tile`, `StatTile`, `PageHeader`,
  `Tabs`, `Button`, `Skeleton`; Home grid with Spendable hero, bars/sparkline, Recent mounted; Plan
  rebuilt; Months, Wallets, Finance on the same grid.
- **Phase 2 · Forms and lists (~1 week):** Amount-first form with "More options", dirty guard, bottom
  sheet, bound labels; `ListRow` everywhere; filters as chips + debounce; close-month dialog with
  labels and live everyday-spending; 44 px named icon buttons, focus rings, reduced motion; one
  emergency-fund model.
- **Phase 3 · First run and return loop (3–4 days):** Get-started hero; Signup tile + language
  toggle + cold-start skeleton; month status tile + overdue banner + land on new month; next-level
  progress; Developer under Settings › Advanced; status only when offline; Danger Zone behind a
  disclosure.

## Keep

Surface system · ⓘ explainer pattern and inline formulas · Home tiles' plain words · income green /
expense red · bucket identities · safe irreversible flows (close month, transfer) · Modal
accessibility · Uzbek coverage.

## Limits

Account had data, so first run was assessed from code. Touch, hover on devices and performance not
measured. Login reviewed signed out only. Three app-wide code passes (global tokens, first-run
simulation, copy) stopped on an account usage limit; the glossary and onboarding path are
recommendations synthesised from the per-screen results.
