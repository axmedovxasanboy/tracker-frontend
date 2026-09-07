/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Three radii, nothing else at surface level: mixing rounded-lg/xl/2xl in one
      // stack is what made the old screens read as unrelated widgets.
      borderRadius: {
        tile: '20px',     // every tile, every dialog
        control: '12px',  // buttons, inputs, selects, chips-with-actions
        chip: '8px',      // status pills, badges, tags
      },
      // Depth is the only hover affordance a tile gets; the lift comes from a transform.
      boxShadow: {
        tile: '0 1px 2px rgba(0,0,0,.04)',
        'tile-hover': '0 8px 24px -12px rgba(0,0,0,.18), 0 1px 2px rgba(0,0,0,.04)',
      },
      // These two carry TEXT far more often than they carry a fill — every amount on every list
      // row, every field error, every "+142 k ahead". The original emerald-500/rose-500 pair
      // measured 2.54:1 and 3.67:1 against the white tile they always sit on, so the app's most
      // important figures were below the 4.5:1 AA floor. emerald-700 and rose-700 measure 5.48:1
      // and 6.29:1 on white (5.04 / 5.77 on the #F5F5F7 ground) and lift every filled use with
      // them: `bg-income text-white` chips went from 2.54:1 to 5.48:1. The chart keeps the
      // brighter pair as its own literals (IncomeExpenseChart.tsx), where bar fills only owe 3:1.
      colors: {
        income: '#047857',
        expense: '#be123c',
        ground: '#F5F5F7',      // the one page background — never tint a page or a section
        hairline: 'rgba(0,0,0,.06)',
      },
      // The one layer the contract's z-scale names that Tailwind has no default for. Without it
      // `z-60` compiles to nothing and a toast fired from an open dialog falls behind it.
      zIndex: {
        60: '60',
      },
      // The scale the app was missing: a real hero, a stat below it, and a caps label.
      // Weight travels with the size so a figure cannot be styled half-way.
      fontSize: {
        hero: ['40px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '600' }],
        stat: ['28px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        title: ['18px', { lineHeight: '24px', fontWeight: '600' }],
        label: ['11px', { lineHeight: '14px', letterSpacing: '0.08em', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
}
