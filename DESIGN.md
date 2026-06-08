# Tracker — Design System: **"The Ledger"**

A warm, editorial *financial-almanac* refresh. Numbers are the hero. Replaces the
generic Inter / indigo-slate admin look.

> **Preview:** open `design-concept.html` in a browser (no build needed). The
> floating control at the bottom switches between **Dashboard** and **Sign in**.

---

## 1. Concept

| Axis | Direction |
| --- | --- |
| Tone | Editorial / private-bank stationery × broadsheet almanac |
| Surface | Warm bone **paper**, espresso ink, hairline rules + double-rules (not heavy shadows) |
| Hero | Money. Every figure is **mono with tabular numerals** so columns align like a ledger |
| Signature | The recent-activity ledger table + the large Fraunces balance |

## 2. Typography

| Role | Family | Notes |
| --- | --- | --- |
| Display / headings | **Fraunces** (opsz, ital) | Characterful optical serif. Italic for accents/greetings |
| UI / body | **Hanken Grotesk** | Warm humanist grotesque — replaces Inter |
| Figures / labels | **IBM Plex Mono** (`tabular-nums`) | All currency, %, eyebrows, small-caps labels |

**`index.html`** — replace the Inter `<link>` with:

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

## 3. Color tokens

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#F2EDE2` | page background |
| `paper-2` | `#E9E1D1` | recessed insets, table head, chips |
| `card` | `#FBF9F3` | raised surfaces |
| `ink` | `#221C16` | primary text |
| `ink-2` | `#6A6052` | body / muted |
| `ink-3` | `#9A8F7D` | captions / faint |
| `pine` | `#2F6B45` | **income / positive** (was emerald) |
| `ox` (oxblood) | `#9C3326` | **expense / negative** (was rose) |
| `gold` | `#B5872F` | accent / active nav / tier (was indigo) |
| `espresso` | `#1D1812` | sidebar (was slate-900) |
| `line` | `rgba(34,28,22,.12)` | hairlines |

## 4. `tailwind.config.js`

```js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono:    ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper:    { DEFAULT: '#F2EDE2', 2: '#E9E1D1' },
        card:     '#FBF9F3',
        ink:      { DEFAULT: '#221C16', 2: '#6A6052', 3: '#9A8F7D' },
        income:   '#2F6B45',   // pine  (kept the name your code already uses)
        expense:  '#9C3326',   // oxblood
        gold:     '#B5872F',
        espresso: { DEFAULT: '#1D1812', 2: '#2A231B' },
      },
      boxShadow: {
        ledger: '0 1px 0 rgba(34,28,22,.04), 0 18px 40px -28px rgba(34,28,22,.45)',
      },
    },
  },
  plugins: [],
}
```

## 5. `index.css` additions

```css
@layer base {
  body { @apply bg-paper text-ink; font-feature-settings: "ss01"; }
  /* tabular figures everywhere money is shown */
  .tnum { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
}
@layer components {
  /* small-caps mono eyebrow used for every section/stat label */
  .eyebrow { @apply font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-3 font-medium; }
  /* editorial double-rule under section titles */
  .rule-double { border:none; border-top:2px solid theme(colors.ink.DEFAULT);
                 box-shadow:0 3px 0 -2px theme(colors.ink.DEFAULT); }
}
/* paper-grain overlay — add once near <body> root */
```

## 6. Component mapping (old → new)

| Component | Change |
| --- | --- |
| `Sidebar` | `bg-slate-900` → `bg-espresso`; active item indigo → `bg-gold/14` + gold left-marker; brand mark = circular gold `₮` |
| `Header` | currency switcher pills → mono, `bg-paper-2`; active pill `text-ink` on `card` |
| `SummaryCard` | drop left-border-accent; use hairline-divided tile grid; value in `font-mono tnum`; income→pine, expense→oxblood, net→gold |
| `Dashboard` | add Fraunces greeting + large mono **balance hero** + tier card |
| Charts | recharts: bars pine/oxblood gradient; donut palette pine/gold/oxblood/taupe; mono axis labels |
| `RecentTransactions` | becomes the **ledger table** — ruled rows, mono signed amounts (`+` pine / `−` oxblood), method `chip` |
| `Modal` | header title → `font-display`; keep focus-trap logic unchanged |
| `Login` / `Signup` | split layout: espresso art panel (oversized faded `₮`, almanac tagline) + cream form; pine submit button |
| `Button` (primary) | indigo → **pine** (`bg-income`), `font-semibold`, soft pine shadow |

## 7. Motion

- One orchestrated **page-load**: staggered `rise` (opacity + 14px translateY) on hero → tiles → charts → ledger via `animation-delay` (40ms steps). Use the Motion library in React if you want spring physics.
- Bar chart **grows from baseline** on mount (`height` transition, `cubic-bezier(.2,.8,.2,1)`).
- Ledger rows: hover → `bg-paper-2`. Keep it quiet; the data is the show.

## 8. Rollout order (low-risk)

1. Foundation: fonts (`index.html`), `tailwind.config.js`, `index.css` — instant global shift.
2. Shell: `Sidebar`, `Header`, primary button.
3. Hero surfaces: `Dashboard` + `SummaryCard` + `RecentTransactions` (ledger).
4. Auth: `Login` / `Signup`.
5. Sweep the rest (Finance, Overview, Cards, modals) reusing the tokens.

Nothing above changes data flow, routing, or the `useApi`/context layer — it's
purely presentational tokens + markup classes.
