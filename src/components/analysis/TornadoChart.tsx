import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import type { TornadoEntry } from '../../types/tree'

interface TornadoChartProps {
  entries: TornadoEntry[]
  baseEmv: number
}

export function TornadoChart({ entries, baseEmv }: TornadoChartProps) {
  if (entries.length === 0) {
    return (
      <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>
        No sensitivity data available. Add probabilities and payoffs to generate a tornado chart.
      </p>
    )
  }

  const top10 = entries.slice(0, 10)

  // Recharts needs [{name, low, high, base, range}] with range being just high-low bar width
  const data = top10.map((e) => ({
    name: e.label,
    low: parseFloat(e.low.toFixed(2)),
    high: parseFloat(e.high.toFixed(2)),
    base: parseFloat(e.base.toFixed(2)),
    range: parseFloat(e.range.toFixed(2)),
    // For a horizontal floating bar, encode as [low, high]
    bar: [parseFloat(e.low.toFixed(2)), parseFloat(e.high.toFixed(2))],
  }))

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          Base EMV: <strong style={{ color: '#1d4ed8' }}>{baseEmv.toFixed(2)}</strong>
          {' '}— Each bar shows EMV range when input varies ±20%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, top10.length * 36)}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 80, left: 8, bottom: 8 }}
        >
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            tick={{ fontSize: 10 }}
            tickLine={false}
          />
          <Tooltip
            formatter={(_v, _name, props) => {
              const p = (props as { payload?: TornadoEntry }).payload
              if (!p) return []
              return [
                `Low: ${p.low.toFixed(2)}  High: ${p.high.toFixed(2)}  Range: ${p.range.toFixed(2)}`,
                'EMV Range',
              ] as [string, string]
            }}
          />
          <ReferenceLine x={baseEmv} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Base', fontSize: 10, fill: '#f59e0b' }} />
          <Bar dataKey="bar" fill="#3b82f6" radius={[0, 3, 3, 0]} minPointSize={4}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.low < baseEmv ? '#ef4444' : '#22c55e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
        Bars sorted by impact (widest = most influential). Red = can reduce EMV below base; Green = can increase above base.
      </p>
    </div>
  )
}
