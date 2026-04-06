import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'
import type { PathResult } from '../../types/tree'

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

  // PMF data
  const pmfData = sorted.map(([payoff, prob]) => ({
    payoff: payoff.toFixed(1),
    probability: parseFloat((prob * 100).toFixed(2)),
  }))

  // CDF data
  let cumSum = 0
  const cdfData = sorted.map(([payoff, prob]) => {
    cumSum += prob
    return {
      payoff: payoff.toFixed(1),
      cdf: parseFloat((cumSum * 100).toFixed(2)),
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <ChartTitle>Outcome Probability (PMF)</ChartTitle>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={pmfData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="payoff" tick={{ fontSize: 11 }} label={{ value: 'Payoff', position: 'insideBottom', offset: -2, fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v) => `${(v as number).toFixed(2)}%`} />
            <Bar dataKey="probability" fill="#3b82f6" name="Probability" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <ChartTitle>Cumulative Probability (CDF)</ChartTitle>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={cdfData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="payoff" tick={{ fontSize: 11 }} label={{ value: 'Payoff', position: 'insideBottom', offset: -2, fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
            <Tooltip formatter={(v) => `${(v as number).toFixed(2)}%`} />
            <Line type="stepAfter" dataKey="cdf" stroke="#2563eb" dot={{ r: 3 }} name="Cumulative P" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ChartTitle({ children }: { children: React.ReactNode }) {
  return <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#374151', fontWeight: 600 }}>{children}</h4>
}

function EmptyState({ msg }: { msg: string }) {
  return <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 24 }}>{msg}</p>
}
