import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,

  CartesianGrid,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts'
import type { PathResult } from '../../types/tree'
import { palette } from '../../theme'

interface RiskProfileChartProps {
  paths: PathResult[]
}

export function RiskProfileChart({ paths }: RiskProfileChartProps) {
  if (paths.length === 0) {
    return <EmptyState msg="No paths found. Build a complete tree first." />
  }

  // Group by payoff (in case of duplicate payoffs)
  const grouped = new Map<number, number>()
  for (const p of paths) {
    grouped.set(p.totalPayoff, (grouped.get(p.totalPayoff) ?? 0) + p.probability)
  }

  const sorted = Array.from(grouped.entries()).sort((a, b) => a[0] - b[0])

  // Calculate statistics
  const totalProb = paths.reduce((sum, p) => sum + p.probability, 0)
  const expectedValue = paths.reduce((sum, p) => sum + p.totalPayoff * p.probability, 0)
  const minPayoff = Math.min(...paths.map(p => p.totalPayoff))
  const maxPayoff = Math.max(...paths.map(p => p.totalPayoff))

  // PMF data
  const pmfData = sorted.map(([payoff, prob]) => ({
    payoff: payoff.toFixed(0),
    payoffRaw: payoff,
    probability: parseFloat((prob * 100).toFixed(2)),
  }))

  // CDF data
  let cumSum = 0
  const cdfData = sorted.map(([payoff, prob]) => {
    cumSum += prob
    return {
      payoff: payoff.toFixed(0),
      payoffRaw: payoff,
      cdf: parseFloat((cumSum * 100).toFixed(2)),
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Statistics Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        padding: 16,
        background: `${palette.info}08`,
        borderRadius: 10,
        border: `1px solid ${palette.info}20`,
      }}>
        <StatBox label="Expected Value" value={expectedValue.toFixed(2)} color={palette.info} />
        <StatBox label="Min Payoff" value={minPayoff.toFixed(0)} color={palette.error} />
        <StatBox label="Max Payoff" value={maxPayoff.toFixed(0)} color={palette.success} />
        <StatBox label="Total Prob" value={`${(totalProb * 100).toFixed(1)}%`} color={palette.gray[600]} />
      </div>

      {/* PMF Chart */}
      <div style={{
        padding: 20,
        background: 'white',
        border: `1px solid ${palette.gray[200]}`,
        borderRadius: 10,
      }}>
        <ChartTitle>Outcome Probability Distribution (PMF)</ChartTitle>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={pmfData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.gray[200]} vertical={false} />
            <XAxis 
              dataKey="payoff" 
              tick={{ fontSize: 11, fill: palette.gray[500] }}
              axisLine={{ stroke: palette.gray[300] }}
              tickLine={{ stroke: palette.gray[300] }}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: palette.gray[500] }} 
              unit="%"
              axisLine={{ stroke: palette.gray[300] }}
              tickLine={{ stroke: palette.gray[300] }}
            />
            <Tooltip
              contentStyle={{
                background: 'white',
                border: `1px solid ${palette.gray[200]}`,
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}
              formatter={(v) => [`${(v as number).toFixed(2)}%`, 'Probability']}
              labelFormatter={(l) => `Payoff: ${l}`}
            />
            <ReferenceLine 
              x={expectedValue.toFixed(0)} 
              stroke={palette.info}
              strokeDasharray="4 2"
              strokeWidth={2}
            />
            <Bar 
              dataKey="probability" 
              fill={`${palette.info}40`}
              stroke={palette.info}
              strokeWidth={1}
              radius={[4, 4, 0, 0]} 
              name="Probability"
            />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: palette.info }}>
            ─ Expected Value: {expectedValue.toFixed(2)}
          </span>
        </div>
      </div>

      {/* CDF Chart */}
      <div style={{
        padding: 20,
        background: 'white',
        border: `1px solid ${palette.gray[200]}`,
        borderRadius: 10,
      }}>
        <ChartTitle>Cumulative Distribution Function (CDF)</ChartTitle>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={cdfData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="cdfGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={palette.info} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={palette.info} stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.gray[200]} vertical={false} />
            <XAxis 
              dataKey="payoff" 
              tick={{ fontSize: 11, fill: palette.gray[500] }}
              axisLine={{ stroke: palette.gray[300] }}
              tickLine={{ stroke: palette.gray[300] }}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: palette.gray[500] }} 
              unit="%"
              domain={[0, 100]}
              axisLine={{ stroke: palette.gray[300] }}
              tickLine={{ stroke: palette.gray[300] }}
            />
            <Tooltip
              contentStyle={{
                background: 'white',
                border: `1px solid ${palette.gray[200]}`,
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}
              formatter={(v) => [`${(v as number).toFixed(2)}%`, 'Cumulative Probability']}
              labelFormatter={(l) => `Payoff ≤ ${l}`}
            />
            <Area 
              type="stepAfter" 
              dataKey="cdf" 
              stroke={palette.info}
              strokeWidth={2}
              fill="url(#cdfGradient)"
              name="Cumulative Probability"
            />
            <ReferenceLine 
              y={50} 
              stroke={palette.warning}
              strokeDasharray="4 2"
              strokeWidth={1}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: palette.warning }}>
            ─ Median (50th percentile)
          </span>
        </div>
      </div>

      {/* Interpretation */}
      <div style={{
        padding: 16,
        background: `${palette.success}08`,
        borderRadius: 10,
        border: `1px solid ${palette.success}30`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: palette.success, marginBottom: 6 }}>
          Risk Profile Summary
        </div>
        <div style={{ fontSize: 12, color: palette.gray[600], lineHeight: 1.6 }}>
          The expected value of this decision is <strong>{expectedValue.toFixed(2)}</strong>.
          {' '}There is a {(cumSum * 100).toFixed(1)}% probability of outcomes ranging from{' '}
          <strong style={{ color: minPayoff < 0 ? palette.error : palette.success }}>{minPayoff.toFixed(0)}</strong>
          {' '}to{' '}
          <strong style={{ color: palette.success }}>{maxPayoff.toFixed(0)}</strong>.
          {' '}The distribution shows the full range of possible outcomes and their likelihoods.
        </div>
      </div>
    </div>
  )
}

function ChartTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{ 
      margin: '0 0 12px', 
      fontSize: 14, 
      color: palette.gray[700], 
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      {children}
    </h4>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: palette.gray[500], marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: 48, 
      color: palette.gray[400],
    }}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 16, opacity: 0.5 }}>
        <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
      </svg>
      <p style={{ fontSize: 15, color: palette.gray[600], marginBottom: 8 }}>{msg}</p>
    </div>
  )
}
