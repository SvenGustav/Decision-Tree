import { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown, Info, Activity } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { SensitivityVariable, TreeNode, TreeEdge } from '../../types/tree'
import { runOneWaySensitivity, runTwoWaySensitivity, computeSensitivityPath } from '../../engine/sensitivity'
import { palette } from '../../theme'

interface SensitivityDetailProps {
  variables: SensitivityVariable[]
  nodes: TreeNode[]
  edges: TreeEdge[]
  baseEmv: number
}

export function SensitivityDetail({ variables, nodes, edges, baseEmv }: SensitivityDetailProps) {
  const [selectedVar1, setSelectedVar1] = useState<string>('')
  const [selectedVar2, setSelectedVar2] = useState<string>('')
  const [range, setRange] = useState(0.3)
  const [activeView, setActiveView] = useState<'oneWay' | 'twoWay'>('oneWay')

  const selectedVariable = useMemo(() => 
    variables.find(v => v.id === selectedVar1),
    [variables, selectedVar1]
  )

  const oneWayResult = useMemo(() => {
    if (!selectedVariable) return null
    return runOneWaySensitivity(nodes, edges, selectedVariable, range, 20)
  }, [selectedVariable, nodes, edges, range])

  const sensitivityPath = useMemo(() => {
    if (!selectedVariable || !oneWayResult) return null
    return computeSensitivityPath(nodes, edges, selectedVariable, oneWayResult.lowValue, oneWayResult.highValue, 40)
  }, [selectedVariable, oneWayResult, nodes, edges])

  const var2 = useMemo(() => 
    variables.find(v => v.id === selectedVar2),
    [variables, selectedVar2]
  )

  const twoWayResult = useMemo(() => {
    if (!selectedVariable || !var2 || selectedVariable.id === var2.id) return null
    return runTwoWaySensitivity(nodes, edges, selectedVariable, var2, range, 8)
  }, [selectedVariable, var2, nodes, edges, range])

  if (variables.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: 48, 
        color: palette.gray[400],
      }}>
        <Activity size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
        <p style={{ fontSize: 15 }}>No sensitivity variables found.</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>Add probabilities and payoffs to enable sensitivity analysis.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 100px',
        gap: 16,
        padding: 16,
        background: palette.gray[50],
        borderRadius: 8,
        border: `1px solid ${palette.gray[200]}`,
      }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: palette.gray[600], display: 'block', marginBottom: 6 }}>
            Variable {activeView === 'twoWay' && '1'}
          </label>
          <select
            value={selectedVar1}
            onChange={(e) => setSelectedVar1(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: `1px solid ${palette.gray[300]}`,
              borderRadius: 6,
              fontSize: 13,
              background: 'white',
            }}
          >
            <option value="">Select variable...</option>
            {variables.map(v => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>

        {activeView === 'twoWay' && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: palette.gray[600], display: 'block', marginBottom: 6 }}>
              Variable 2
            </label>
            <select
              value={selectedVar2}
              onChange={(e) => setSelectedVar2(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: `1px solid ${palette.gray[300]}`,
                borderRadius: 6,
                fontSize: 13,
                background: 'white',
              }}
            >
              <option value="">Select variable...</option>
              {variables.filter(v => v.id !== selectedVar1).map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>
        )}

        {activeView === 'oneWay' && <div />}

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: palette.gray[600], display: 'block', marginBottom: 6 }}>
            Range (±{Math.round(range * 100)}%)
          </label>
          <input
            type="range"
            min={0.1}
            max={0.5}
            step={0.05}
            value={range}
            onChange={(e) => setRange(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setActiveView('oneWay')}
          style={{
            padding: '8px 16px',
            background: activeView === 'oneWay' ? palette.decision.base : 'white',
            border: `1px solid ${activeView === 'oneWay' ? palette.decision.base : palette.gray[300]}`,
            borderRadius: 6,
            color: activeView === 'oneWay' ? 'white' : palette.gray[600],
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          One-Way Analysis
        </button>
        <button
          onClick={() => setActiveView('twoWay')}
          style={{
            padding: '8px 16px',
            background: activeView === 'twoWay' ? palette.decision.base : 'white',
            border: `1px solid ${activeView === 'twoWay' ? palette.decision.base : palette.gray[300]}`,
            borderRadius: 6,
            color: activeView === 'twoWay' ? 'white' : palette.gray[600],
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Two-Way Analysis
        </button>
      </div>

      {/* Results */}
      {activeView === 'oneWay' && oneWayResult && (
        <OneWayResult result={oneWayResult} baseEmv={baseEmv} sensitivityPath={sensitivityPath} edges={edges} />
      )}

      {activeView === 'twoWay' && twoWayResult && (
        <TwoWayResult result={twoWayResult} />
      )}

      {!selectedVariable && (
        <div style={{ 
          textAlign: 'center', 
          padding: 40, 
          color: palette.gray[400],
          background: palette.gray[50],
          borderRadius: 8,
        }}>
          <Info size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 14 }}>Select a variable to view sensitivity analysis</p>
        </div>
      )}
    </div>
  )
}

function OneWayResult({
  result,
  baseEmv,
  sensitivityPath,
  edges,
}: {
  result: ReturnType<typeof runOneWaySensitivity>
  baseEmv: number
  sensitivityPath: ReturnType<typeof computeSensitivityPath> | null
  edges: TreeEdge[]
}) {
  const { variable, lowEmv, highEmv, lowValue, highValue, impact, percentChange } = result
  const isPositive = highEmv >= lowEmv

  const chartData = sensitivityPath
    ? sensitivityPath.points.map(p => ({
        value: variable.type === 'probability' ? parseFloat((p.value * 100).toFixed(2)) : parseFloat(p.value.toFixed(4)),
        emv: parseFloat(p.emv.toFixed(2)),
      }))
    : []

  const flipPoints = sensitivityPath?.flipPoints ?? []
  const hasFlip = flipPoints.length > 0

  const xLabel = variable.type === 'probability' ? `${variable.label} (%)` : variable.label

  const formatX = (v: number) =>
    variable.type === 'probability' ? `${v.toFixed(0)}%` : v.toLocaleString()

  return (
    <div style={{
      padding: 20,
      background: 'white',
      border: `1px solid ${palette.gray[200]}`,
      borderRadius: 8,
    }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: palette.gray[800] }}>
        {variable.label}
      </h4>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: palette.gray[500] }}>
        EMV as {xLabel} varies from{' '}
        <strong>{variable.type === 'probability' ? `${(lowValue * 100).toFixed(0)}%` : lowValue.toFixed(2)}</strong>
        {' '}to{' '}
        <strong>{variable.type === 'probability' ? `${(highValue * 100).toFixed(0)}%` : highValue.toFixed(2)}</strong>
      </p>

      {/* Key Metrics */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 12,
        marginBottom: 20,
      }}>
        <MetricBox
          label="Current Value"
          value={variable.type === 'probability'
            ? `${(variable.currentValue * 100).toFixed(1)}%`
            : variable.currentValue.toLocaleString()
          }
          color={palette.gray[600]}
        />
        <MetricBox
          label="Low EMV"
          value={lowEmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          color={palette.error}
          icon={<ArrowDown size={14} />}
        />
        <MetricBox
          label="High EMV"
          value={highEmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          color={palette.success}
          icon={<ArrowUp size={14} />}
        />
        <MetricBox
          label="Impact"
          value={impact.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          color={impact > Math.abs(baseEmv) * 0.1 ? palette.warning : palette.info}
        />
      </div>

      {/* Line Chart */}
      {chartData.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: palette.gray[600], marginBottom: 8 }}>
            EMV Sensitivity Chart
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.gray[200]} vertical={false} />
              <XAxis
                dataKey="value"
                tickFormatter={formatX}
                tick={{ fontSize: 11, fill: palette.gray[500] }}
                axisLine={{ stroke: palette.gray[300] }}
                tickLine={{ stroke: palette.gray[300] }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: palette.gray[500] }}
                axisLine={{ stroke: palette.gray[300] }}
                tickLine={{ stroke: palette.gray[300] }}
                tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: `1px solid ${palette.gray[200]}`,
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v) => [
                  (v as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  'EMV',
                ]}
                labelFormatter={(l) => `${xLabel}: ${formatX(l as number)}`}
              />
              {/* Base EMV */}
              <ReferenceLine
                y={baseEmv}
                stroke={palette.gray[400]}
                strokeDasharray="4 2"
                strokeWidth={1}
                label={{ value: 'Base EMV', position: 'insideTopRight', fontSize: 10, fill: palette.gray[500] }}
              />
              {/* Current variable value */}
              <ReferenceLine
                x={variable.type === 'probability'
                  ? parseFloat((variable.currentValue * 100).toFixed(2))
                  : parseFloat(variable.currentValue.toFixed(4))}
                stroke={palette.info}
                strokeDasharray="4 2"
                strokeWidth={1}
                label={{ value: 'Current', position: 'insideTopLeft', fontSize: 10, fill: palette.info }}
              />
              {/* Decision flip lines */}
              {flipPoints.map((fp, i) => {
                const xVal = variable.type === 'probability'
                  ? parseFloat((fp.value * 100).toFixed(2))
                  : parseFloat(fp.value.toFixed(4))
                return (
                  <ReferenceLine
                    key={i}
                    x={xVal}
                    stroke={palette.warning}
                    strokeWidth={2}
                    label={{
                      value: `Decision flips at ${formatX(xVal)}`,
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: palette.warning,
                    }}
                  />
                )
              })}
              <Line
                type="monotone"
                dataKey="emv"
                stroke={palette.info}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Decision flip callout */}
      {hasFlip && (
        <div style={{
          padding: 12,
          background: '#fffbeb',
          borderRadius: 6,
          border: `1px solid #fcd34d`,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
            Decision switch detected
          </div>
          {flipPoints.map((fp, i) => {
            const flipVal = variable.type === 'probability'
              ? `${(fp.value * 100).toFixed(1)}%`
              : fp.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            const fromEdge = edges.find(e => e.id === fp.fromEdgeId)
            const toEdge = edges.find(e => e.id === fp.toEdgeId)
            return (
              <p key={i} style={{ margin: 0, fontSize: 12, color: '#92400e' }}>
                At <strong>{variable.label} = {flipVal}</strong>
                {fromEdge && toEdge
                  ? `, the optimal decision switches from "${fromEdge.data?.label ?? fp.fromEdgeId}" to "${toEdge.data?.label ?? fp.toEdgeId}".`
                  : ', the optimal decision branch changes.'}
              </p>
            )
          })}
        </div>
      )}

      {/* Interpretation */}
      <div style={{
        padding: 12,
        background: isPositive ? '#f0fdf4' : '#fef2f2',
        borderRadius: 6,
        borderLeft: `3px solid ${isPositive ? palette.success : palette.error}`,
      }}>
        <p style={{ margin: 0, fontSize: 12, color: palette.gray[600] }}>
          {isPositive
            ? `Increasing ${variable.label} improves the EMV. Higher values favor the current optimal decision.`
            : `Increasing ${variable.label} reduces the EMV. Lower values are preferable.`
          }
          {' '}Sensitivity impact: <strong>{percentChange.toFixed(1)}% of base EMV</strong>{' '}
          (<strong>{impact > Math.abs(baseEmv) * 0.2 ? 'high' : impact > Math.abs(baseEmv) * 0.05 ? 'medium' : 'low'}</strong> sensitivity).
        </p>
      </div>
    </div>
  )
}

function TwoWayResult({ result }: { result: ReturnType<typeof runTwoWaySensitivity> }) {
  const { var1, var2, grid, xValues, yValues } = result
  
  const minVal = Math.min(...grid.flat())
  const maxVal = Math.max(...grid.flat())
  
  // Color scale function
  const getColor = (val: number) => {
    const t = (val - minVal) / (maxVal - minVal || 1)
    if (t < 0.5) {
      // Red to yellow
      const r = 239
      const g = Math.round(68 + (251 - 68) * (t * 2))
      const b = Math.round(68 + (191 - 68) * (t * 2))
      return `rgb(${r},${g},${b})`
    } else {
      // Yellow to green
      const r = Math.round(251 + (16 - 251) * ((t - 0.5) * 2))
      const g = 191
      const b = Math.round(36 + (185 - 36) * ((t - 0.5) * 2))
      return `rgb(${r},${g},${b})`
    }
  }

  return (
    <div style={{
      padding: 20,
      background: 'white',
      border: `1px solid ${palette.gray[200]}`,
      borderRadius: 8,
    }}>
      <h4 style={{ margin: '0 0 16px', fontSize: 14, color: palette.gray[800] }}>
        Two-Way Sensitivity: {var1.label} vs {var2.label}
      </h4>

      {/* Heatmap Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Header row with var1 values */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 60, fontSize: 10, color: palette.gray[500], textAlign: 'right', paddingRight: 8 }}>
            {var2.label.split('→').pop()?.trim().substring(0, 8)}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {xValues.map((x, i) => (
              <div key={i} style={{ 
                width: 48, 
                fontSize: 9, 
                color: palette.gray[500],
                textAlign: 'center',
              }}>
                {var1.type === 'probability' ? `${(x * 100).toFixed(0)}%` : x.toFixed(0)}
              </div>
            ))}
          </div>
        </div>
        
        {/* Grid rows */}
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 60, fontSize: 9, color: palette.gray[500], textAlign: 'right', paddingRight: 8 }}>
              {var2.type === 'probability' ? `${(yValues[rowIdx] * 100).toFixed(0)}%` : yValues[rowIdx].toFixed(0)}
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {row.map((val, colIdx) => (
                <div
                  key={colIdx}
                  style={{
                    width: 48,
                    height: 32,
                    background: getColor(val),
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 600,
                    color: val > (minVal + maxVal) / 2 ? '#064e3b' : '#7f1d1d',
                  }}
                  title={`${var1.label}: ${xValues[colIdx].toFixed(3)}, ${var2.label}: ${yValues[rowIdx].toFixed(3)} = EMV: ${val.toFixed(1)}`}
                >
                  {val.toFixed(0)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: 12,
        marginTop: 16,
      }}>
        <span style={{ fontSize: 11, color: palette.gray[500] }}>{minVal.toFixed(1)}</span>
        <div style={{
          width: 200,
          height: 12,
          background: 'linear-gradient(90deg, rgb(239,68,68), rgb(251,191,36), rgb(16,185,129))',
          borderRadius: 6,
        }} />
        <span style={{ fontSize: 11, color: palette.gray[500] }}>{maxVal.toFixed(1)}</span>
      </div>
      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: palette.gray[400] }}>EMV Range</span>
      </div>
    </div>
  )
}

function MetricBox({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      padding: 12,
      background: palette.gray[50],
      borderRadius: 6,
      border: `1px solid ${palette.gray[200]}`,
    }}>
      <div style={{ fontSize: 11, color: palette.gray[500], marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}
        {value}
      </div>
    </div>
  )
}
