# Tracker — Design System: **"Command Center"** (ui-ux-pro-max)

A **dark, data-dense fintech dashboard**. Direction sourced directly from the
`ui-ux-pro-max` design intelligence for this product type.

> **Preview:** open `design-concept-pro-max.html` in a browser (no build). The
> floating control switches **Dashboard → Transactions → Sign in**.

---

## 0. Why this direction (skill output)

| Query | Recommendation |
| --- | --- |
| `product` → *Financial Dashboard* | **Dark Mode (OLED) + Data-Dense**, secondary: Minimalism, Accessible & Ethical |
| `style` → *Data-Dense Dashboard* | 12-col grid, KPI cards, sortable tables, minimal padding (8–12px), filter row |
| `color` → *Personal Finance Tracker* | **Trust blue `#1E40AF/#3B82F6` + profit green `#059669/#10B981` on deep navy `#0F172A`**, red/green alerts |
| `typography` → *Financial Trust* | **IBM Plex Sans** (UI) + **IBM Plex Mono** (tabular figures for money) |
| `chart` | Trend → **Area/Line**; Breakdown → **Donut**; differentiate series by style not color alone |

This is intentionally a *different* concept from the warm light "Ledger"
(`design-concept.html` / `DESIGN.md`) — pick whichever you prefer; both share the
mono-tabular-numerals principle for money.

## 1. Typography

`index.html` — replace the Inter `<link>`:

```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- **IBM Plex Sans** — all UI text. Weights: 700 hero, 600 titles/buttons, 500 labels, 400 body.
- **IBM Plex Mono** (`tabular-nums`) — every currency value, %, date, KPI, axis label. This keeps columns aligned and prevents layout shift (`number-tabular`).

## 2. Color tokens (dark, WCAG-checked)

| Token | Value | Use |
| --- | --- | --- |
| `bg` | `#0A0F1C` | page (OLED navy) |
| `surface` | `#111A2E` | cards |
| `surface-2` | `#16203A` | hover / elevated |
| `muted` | `#0E1524` | inputs, tracks, insets |
| `border` | `rgba(148,163,184,.13)` | hairlines |
| `fg` | `#EEF2F8` | text (~15:1) |
| `fg-2` | `#9AA8BE` | secondary (~6:1) |
| `fg-3` | `#5C6A82` | faint / axis |
| `blue` | `#3B82F6` | primary / trust / actions |
| `green` | `#10B981` | **income / positive** |
| `red` | `#F43F5E` | **expense / negative** |
| `amber` `violet` `cyan` | `#F59E0B` `#8B5CF6` `#22D3EE` | data-series / emergency / investments / subscriptions |

> Dark-mode rule (`color-dark-mode`): these are desaturated tonal values, **not**
> inverted light colors. Contrast was checked independently for dark.

## 3. `tailwind.config.js`

```js
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        bg: '#0A0F1C',
        surface: { DEFAULT: '#111A2E', 2: '#16203A' },
        muted: '#0E1524',
        fg: { DEFAULT: '#EEF2F8', 2: '#9AA8BE', 3: '#5C6A82' },
        brand:   '#3B82F6',
        income:  '#10B981',   // keep the names your code already uses
        expense: '#F43F5E',
        amber: '#F59E0B', violet: '#8B5CF6', cyan: '#22D3EE',
      },
      borderColor: { DEFAULT: 'rgba(148,163,184,.13)' },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,.03) inset, 0 16px 40px -24px rgba(0,0,0,.8)',
        glow: '0 0 0 1px rgba(59,130,246,.35), 0 8px 28px -8px rgba(59,130,246,.55)',
      },
    },
  },
  plugins: [],
}
```

## 4. `index.css`

```css
@layer base {
  body { @apply bg-bg text-fg font-sans; }
  .tnum { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
  .eyebrow { @apply font-mono text-[10px] tracking-[0.18em] uppercase text-fg-3 font-medium; }
}
/* live status dot */
@keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(16,185,129,.5)} 70%{box-shadow:0 0 0 6px rgba(16,185,129,0)} 100%{box-shadow:0 0 0 0 rgba(16,185,129,0)} }
.dot-live { @apply w-1.5 h-1.5 rounded-full bg-income; animation: pulse 2.4s infinite; }
@media (prefers-reduced-motion: reduce) { .dot-live { animation: none; } }
```

Atmosphere (page background) — two faint radial accents on the navy:
```css
body{ background:
  radial-gradient(120% 80% at 100% -10%, rgba(59,130,246,.10), transparent 55%),
  radial-gradient(90% 60% at -10% 110%, rgba(16,185,129,.09), transparent 55%),
  #0A0F1C; }
```

## 5. recharts theming (dark)

Your charts live in `IncomeExpenseChart.tsx` (AreaChart) and
`CategoryBreakdownChart.tsx` (donut). Re-skin, don't rebuild:

```tsx
<CartesianGrid stroke="rgba(148,163,184,.10)" strokeDasharray="3 4" vertical={false} />
<XAxis tick={{ fill: '#5C6A82', fontFamily: 'IBM Plex Mono', fontSize: 11 }} axisLine={false} tickLine={false} />
<YAxis tick={{ fill: '#5C6A82', fontFamily: 'IBM Plex Mono', fontSize: 11 }} axisLine={false} tickLine={false} />
<Tooltip contentStyle={{ background:'#16203A', border:'1px solid rgba(148,163,184,.22)',
  borderRadius:10, color:'#EEF2F8', fontFamily:'IBM Plex Mono' }} cursor={{ stroke:'rgba(148,163,184,.2)' }} />
// area gradients: income #10B981 @0.28→0, expense #F43F5E @0.22→0
// donut palette: ['#10B981','#3B82F6','#8B5CF6','#F59E0B','#22D3EE'] on a #0E1524 track
```

Chart a11y (`color-not-only`, `pattern-texture`): keep the legend + on-hover
tooltips and differentiate income/expense by **icon + label**, not color alone.

## 6. Component mapping (old → new)

| Component | Change |
| --- | --- |
| `Sidebar` | `bg-slate-900` → navy gradient `#0C1322→#090D18`; active item = blue-tinted gradient + glowing left marker; logo = blue→cyan gradient tile; account card with live pulse dot |
| `Header` | translucent `bg-bg/72` + `backdrop-blur`; add a global **search**; currency switch → mono segmented control; primary button gets blue **glow** shadow |
| `Dashboard` | add **balance hero** (gradient mono number + sparkline + MoM delta + mini-stats) and a **tier gauge** card beside it; KPI cards become dark with colored icon tiles + delta chips |
| `SummaryCard` | dark `surface` card, mono `tnum` value, colored icon tile (income=green, expense=red, net=blue, count=violet), small delta indicator |
| `RecentTransactions` / Transactions table | dense dark table: 44px rows, sticky mono uppercase headers with **sort** carets, icon tile + name/category, method `pill`, status badges (CLEARED/SPLIT), signed mono amounts (green/red), row hover `surface-2` |
| `TransactionFilters` | dark filter row: search + `fsel` dropdown pills (active = blue tint), date range pill, mono Reset |
| Pagination | mono page pills, active = solid blue |
| `Overview` (tier) | tier gauge + progress `tbar` with blue→cyan glow; allocation buckets as `chip`s; debt overview as labeled progress tracks (blue/violet/amber) |
| `Cards` | card visuals keep gradients but on dark; action bar uses `pill` buttons |
| `Finance` / Investments / Donations / Emergencies | same dense dark table + colored totals strip; status badges reuse the badge tokens |
| `Modal` | `surface` panel, `border` hairline, scrim `bg-black/60` (`scrim-and-modal-legibility`), title in 600; keep focus-trap logic |
| `Login` / `Signup` | split layout: left art panel (gradient **mesh** + faint grid + product stats), right dark form with blue **glow focus** rings; primary button glow |

## 7. Data-dense + UX rules applied (from the skill)

- **Grid & density** — 12-col, `gap:16px`, card padding 16–18px, base 14px / labels 12px, table row 44px (still ≥44px touch target).
- **Tables** — sticky headers, `aria-sort` on sortable columns, hover row highlight, tabular figures.
- **Loading** — use `animate-pulse` skeletons for cards/tables/charts >300ms (`loading-states`), never a frozen blank.
- **Charts** — empty state ("No data yet" + guidance) instead of an empty axis frame; tooltips on hover; legend always visible.
- **Accessibility** — focus rings (blue, 3px ring) on every input/button; functional color always paired with icon/text; `prefers-reduced-motion` disables the pulse, line-draw, and entrance stagger.
- **Motion** — entrance stagger 30–50ms; area-line draw-in (`stroke-dashoffset`); micro-interactions 150–300ms; exits faster than enters.

## 8. Rollout order (low-risk, presentational only)

1. Foundation — fonts (`index.html`), `tailwind.config.js` (+`darkMode:'class'`, set `<html class="dark">`), `index.css`.
2. Shell — `Sidebar`, `Header` (+ search), primary button + glow.
3. Hero surfaces — `Dashboard` balance hero + tier gauge + `SummaryCard` + recharts re-skin.
4. Tables — `RecentTransactions`, `Transactions` + `TransactionFilters` + pagination.
5. Sweep — `Overview`, `Finance`, `Cards`, `Categories`, `Settings`, list pages, `Modal`, `Login`/`Signup`.

Nothing here touches routing, `useApi`, contexts, or API shapes — tokens + classes only.
```
