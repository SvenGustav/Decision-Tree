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
import { palette } from '../../theme'

interface TornadoChartProps {
  entries: TornadoEntry[]
  baseEmv: number
}

export function TornadoChart({ entries, baseEmv }: TornadoChartProps) {
  if (entries.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: 48, 
        color: palette.gray[400],
      }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 16, opacity: 0.5 }}>
          <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
        </svg>
        <p style={{ fontSize: 15, color: palette.gray[600], marginBottom: 8 }}>No sensitivity data available</p>
        <p style={{ fontSize: 13, color: palette.gray[400] }}>Add probabilities and payoffs to generate a tornado chart</p>
      </div>
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

  // Calculate max range for relative sizing
  const maxRange = Math.max(...entries.map(e => e.range))

  return (
    <div>
      <div style={{ 
        marginBottom: 16, 
        padding: 12, 
        background: `${palette.decision.base}08`,
        borderRadius: 8,
        border: `1px solid ${palette.decision.border}20`,
      }}>
        <div style={{ fontSize: 13, color: palette.gray[600] }}>
          Base EMV: <strong style={{ color: palette.decision.base, fontSize: 16 }}>{baseEmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </div>
        <div style={{ fontSize: 12, color: palette.gray[500], marginTop: 4 }}>
          Each bar shows EMV range when input varies ±20%
        </div>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(280, top10.length * 44)}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 80, left: 8, bottom: 8 }}
        >
          <XAxis 
            type="number" 
            tick={{ fontSize: 11, fill: palette.gray[500] }}
            axisLine={{ stroke: palette.gray[300] }}
            tickLine={{ stroke: palette.gray[300] }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ fontSize: 11, fill: palette.gray[600] }}
            tickLine={false}
            axisLine={{ stroke: palette.gray[300] }}
          />
          <Tooltip
            contentStyle={{
              background: 'white',
              border: `1px solid ${palette.gray[200]}`,
              borderRadius: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            formatter={(_, __, props) => {
              const p = (props as { payload?: TornadoEntry }).payload
              if (!p) return []
              return [
                `Low: ${p.low.toFixed(2)} | High: ${p.high.toFixed(2)} | Range: ${p.range.toFixed(2)}`,
                'EMV Range',
              ]
            }}
          />
          <ReferenceLine 
            x={baseEmv} 
            stroke={palette.decision.optimal} 
            strokeDasharray="4 2" 
            strokeWidth={2}
            label={{ 
              value: 'Base', 
              position: 'top',
              fontSize: 11, 
              fill: palette.decision.optimal,
              fontWeight: 600,
            }} 
          />
          <Bar dataKey="bar" radius={[0, 4, 4, 0]} minPointSize={4}>
            {data.map((entry, idx) => {
              // Color based on impact intensity
              const impactRatio = entry.range / maxRange
              const isNegative = entry.low < baseEmv
              const opacity = 0.4 + impactRatio * 0.6
              
              return (
                <Cell 
                  key={idx} 
                  fill={isNegative 
                    ? `rgba(239,68,68,${opacity})` 
                    : `rgba(16,185,129,${opacity})`
                  }
                  stroke={isNegative ? palette.error : palette.success}
                  strokeWidth={1}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      <div style={{ 
        marginTop: 16,
        padding: 12,
        background: palette.gray[50],
        borderRadius: 8,
        fontSize: 12,
        color: palette.gray[500],
        lineHeight: 1.6,
      }}>
        <strong style={{ color: palette.gray[700] }}>Interpretation:</strong> Bars sorted by impact (widest = most influential). 
        <span style={{ color: palette.error }}> Red</span> = can reduce EMV below base; 
        <span style={{ color: palette.success }}> Green</span> = can increase above base.
        Width indicates sensitivity magnitude.
      </div>
    </div>
  )
}
