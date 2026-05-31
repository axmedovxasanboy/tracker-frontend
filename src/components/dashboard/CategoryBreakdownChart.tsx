import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts'
import { Spinner } from '../ui/Spinner'
import { CacheBadge } from '../ui/CacheBadge'
import type { CategoryBreakdown, Currency } from '../../types'
import { formatCurrency } from '../../utils/format'

interface Props {
  data: CategoryBreakdown[]
  loading: boolean
  currency: Currency
  isCached?: boolean
  cachedAt?: string | null
}

const FALLBACK_COLORS = ['#6366f1','#10b981','#f43f5e','#f59e0b','#06b6d4','#a855f7','#ec4899']

function ActiveShape(props: Parameters<typeof Sector>[0] & { currency: Currency; value: number; name: string; percent: number }) {
  const { cx = 0, cy = 0, innerRadius, outerRadius = 0, startAngle, endAngle, fill, currency, value, name, percent } = props
  return (
    <g>
      {/* Expanded outer ring */}
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={1} />
      {/* Soft outer glow ring */}
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 16}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.3} />
      {/* Center label */}
      <text x={cx} y={cy - 14} textAnchor="middle" fill="#1e293b" fontSize={13} fontWeight={600}>{name}</text>
      <text x={cx} y={cy + 6} textAnchor="middle" fill="#6366f1" fontSize={16} fontWeight={700}>
        {formatCurrency(value, currency, true)}
      </text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  )
}

export function CategoryBreakdownChart({ data, loading, currency, isCached, cachedAt }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>()

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">Expense Breakdown</h3>
          <p className="text-xs text-slate-400 mt-0.5">Click a segment to inspect</p>
        </div>
        <CacheBadge isCached={!!isCached} cachedAt={cachedAt ?? null} />
      </div>

      {loading ? (
        <div className="h-56 flex items-center justify-center"><Spinner /></div>
      ) : data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-slate-400 text-sm">No expense data yet</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                strokeWidth={0}
                activeIndex={activeIndex}
                activeShape={(props: unknown) => {
                  const p = props as Parameters<typeof Sector>[0] & { value: number; name: string; percent: number }
                  return <ActiveShape {...p} currency={currency} />
                }}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(undefined)}
                onClick={(_, index) => setActiveIndex(prev => prev === index ? undefined : index)}
                style={{ cursor: 'pointer' }}
              >
                {data.map((entry, i) => (
                  <Cell
                    key={entry.category}
                    fill={entry.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                    opacity={activeIndex === undefined || activeIndex === i ? 1 : 0.4}
                  />
                ))}
              </Pie>
              {/* Don't show default tooltip when a segment is actively hovered */}
              {activeIndex === undefined && (
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                  formatter={(value: number, name: string) => [
                    `${formatCurrency(value, currency)} (${data.find(d => d.category === name)?.percentage ?? 0}%)`, name,
                  ]}
                />
              )}
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-2 space-y-1.5">
            {data.map((entry, i) => (
              <button
                key={entry.category}
                onClick={() => setActiveIndex(prev => prev === i ? undefined : i)}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all text-left ${
                  activeIndex === i ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
              >
                <span className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }} />
                <span className={`flex-1 text-xs truncate ${activeIndex === i ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                  {entry.category}
                </span>
                <span className="text-xs text-slate-400 shrink-0">{entry.percentage}%</span>
                <span className="text-xs font-medium text-slate-700 shrink-0">{formatCurrency(entry.amount, currency, true)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
