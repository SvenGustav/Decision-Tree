import { useState } from 'react'
import { Trash2, AlertTriangle, CheckCircle2, Info, GitBranch, Calculator, RotateCcw } from 'lucide-react'
import { useTreeStore } from '../../store/treeStore'
import { normalizeProbabilities, bayesianSwap, restorePriors } from '../../engine/bayesian'
import { palette, panelTheme } from '../../theme'

function probTotal(edges: ReturnType<typeof useTreeStore.getState>['edges'], nodeId: string) {
  return edges
    .filter((e) => e.source === nodeId)
    .reduce((s, e) => s + (e.data?.probability ?? 0), 0)
}

export function PropertiesPanel() {
  const store = useTreeStore()
  const { nodes, edges, selectedNodeId, selectedEdgeId } = store

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId)
  const chanceBranchParent =
    selectedEdge && !selectedNode
      ? nodes.find((n) => n.id === selectedEdge.source && n.data.kind === 'chance')
      : undefined

  return (
    <aside
      aria-label="Properties"
      style={{
        width: 280,
        minWidth: 280,
        flexShrink: 0,
        background: panelTheme.bg,
        borderLeft: `1px solid ${panelTheme.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      }}
    >
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: `1px solid ${panelTheme.border}`,
          background: panelTheme.headerBg,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8,
            height: 8,
            background: palette.decision.optimal,
            borderRadius: 2,
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: palette.gray[500] }}>
            PROPERTIES
          </span>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {!selectedNode && !selectedEdge && <EmptyState />}
        {selectedNode && <NodePanel node={selectedNode} store={store} />}
        {selectedEdge && !selectedNode && (
          <EdgePanel edge={selectedEdge} store={store} parentChanceNode={chanceBranchParent} />
        )}
      </div>
    </aside>
  )
}

function NodePanel({
  node,
  store,
}: {
  node: ReturnType<typeof useTreeStore.getState>['nodes'][number]
  store: ReturnType<typeof useTreeStore.getState>
}) {
  const { updateNodeData, deleteNode, loadSnapshot, edges, nodes } = store
  const d = node.data
  
  const kindColors = {
    decision: palette.decision.base,
    chance: palette.chance.base,
    terminal: palette.terminal.positive.base,
  }
  const kindLabels = {
    decision: 'Decision Node',
    chance: 'Chance Node',
    terminal: 'Terminal Node',
  }
  const accent = kindColors[d.kind] ?? palette.gray[600]

  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        background: `${accent}10`,
        borderRadius: 8,
        border: `1px solid ${accent}30`,
      }}>
        <div
          style={{
            width: 12,
            height: 12,
            background: accent,
            flexShrink: 0,
            borderRadius: d.kind === 'decision' ? 3 : d.kind === 'chance' ? '50%' : 0,
            clipPath: d.kind === 'terminal' ? 'polygon(50% 0%, 100% 100%, 0% 100%)' : undefined,
          }}
        />
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, color: accent, display: 'block' }}>
            {kindLabels[d.kind] ?? 'NODE'}
          </span>
          <span style={{ fontSize: 11, color: palette.gray[500] }}>
            ID: {node.id}
          </span>
        </div>
      </div>

      <FormField label="Label" id={`label-${node.id}`}>
        <StyledInput
          id={`label-${node.id}`}
          type="text"
          value={d.label}
          onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
          placeholder="Node label"
        />
      </FormField>

      {d.kind === 'terminal' && (
        <FormField label="Payoff" id={`payoff-${node.id}`} hint="Final value at this outcome">
          <StyledInput
            id={`payoff-${node.id}`}
            type="number"
            value={d.payoff ?? 0}
            onChange={(e) => updateNodeData(node.id, { payoff: parseFloat(e.target.value) || 0 })}
          />
        </FormField>
      )}

      {d.emv !== undefined && d.kind !== 'terminal' && (
        <EmvCard emv={d.emv} isOptimal={d.isOptimal ?? false} kind={d.kind} />
      )}

      {d.kind === 'chance' && (
        <>
          <BranchProbEditor
            nodeId={node.id}
            edges={edges}
            nodes={nodes}
            loadSnapshot={loadSnapshot}
            updateEdgeData={store.updateEdgeData}
          />
          <BayesianSection
            nodeId={node.id}
            nodes={nodes}
            edges={edges}
            loadSnapshot={loadSnapshot}
          />
        </>
      )}

      <DangerButton label="Delete Node" onConfirm={() => deleteNode(node.id)} />
    </>
  )
}

function BayesianSection({
  nodeId,
  nodes,
  edges,
  loadSnapshot,
}: {
  nodeId: string
  nodes: ReturnType<typeof useTreeStore.getState>['nodes']
  edges: ReturnType<typeof useTreeStore.getState>['edges']
  loadSnapshot: ReturnType<typeof useTreeStore.getState>['loadSnapshot']
}) {
  const [showLikelihoods, setShowLikelihoods] = useState(false)
  const [likelihoods, setLikelihoods] = useState<Record<string, number>>({})

  const outgoing = edges.filter((e) => e.source === nodeId)
  const hasPriors = outgoing.some(e => e.data?.priorProbability !== undefined)

  const handleApplyBayesian = () => {
    const { newEdges } = bayesianSwap(nodeId, nodes, edges, likelihoods)
    loadSnapshot({ nodes, edges: newEdges })
  }

  const handleRestore = () => {
    const newEdges = restorePriors(nodeId, edges)
    loadSnapshot({ nodes, edges: newEdges })
  }

  if (!showLikelihoods) {
    return (
      <div style={{
        padding: 14,
        background: `${palette.chance.base}08`,
        border: `1px solid ${palette.chance.border}40`,
        borderRadius: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <GitBranch size={14} color={palette.chance.base} />
          <span style={{ fontSize: 12, fontWeight: 600, color: palette.chance.base }}>
            Bayesian Analysis
          </span>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 11, color: palette.gray[500], lineHeight: 1.5 }}>
          Update probabilities based on new evidence using Bayes' theorem.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const initial: Record<string, number> = {}
              for (const edge of outgoing) {
                initial[edge.id] = 0.5
              }
              setLikelihoods(initial)
              setShowLikelihoods(true)
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: palette.chance.borderActive,
              border: 'none',
              borderRadius: 6,
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Calculator size={14} />
            Open
          </button>
          {hasPriors && (
            <button
              onClick={handleRestore}
              style={{
                padding: '8px 12px',
                background: 'white',
                border: `1px solid ${palette.gray[300]}`,
                borderRadius: 6,
                color: palette.gray[600],
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RotateCcw size={14} />
              Restore
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      padding: 14,
      background: 'white',
      border: `1px solid ${palette.chance.border}`,
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: palette.chance.base }}>
          Likelihoods P(E|Outcome)
        </span>
        <button
          onClick={() => setShowLikelihoods(false)}
          style={{
            background: 'none',
            border: 'none',
            color: palette.gray[400],
            cursor: 'pointer',
            padding: 2,
          }}
        >
          <span style={{ fontSize: 16 }}>×</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {outgoing.map(edge => {
          const targetNode = nodes.find(n => n.id === edge.target)
          return (
            <div key={edge.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, color: palette.gray[600] }}>
                {edge.data?.label || targetNode?.data.label || 'Branch'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={likelihoods[edge.id] ?? 0.5}
                  onChange={(e) => setLikelihoods(prev => ({
                    ...prev,
                    [edge.id]: parseFloat(e.target.value)
                  }))}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={likelihoods[edge.id] ?? 0.5}
                  onChange={(e) => setLikelihoods(prev => ({
                    ...prev,
                    [edge.id]: parseFloat(e.target.value) || 0
                  }))}
                  style={{
                    width: 56,
                    padding: '4px 6px',
                    border: `1px solid ${palette.gray[300]}`,
                    borderRadius: 4,
                    fontSize: 11,
                    textAlign: 'right',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={handleApplyBayesian}
        style={{
          width: '100%',
          marginTop: 12,
          padding: '10px',
          background: palette.chance.borderActive,
          border: 'none',
          borderRadius: 6,
          color: 'white',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Apply Bayesian Update
      </button>
    </div>
  )
}

function EdgePanel({
  edge,
  store,
  parentChanceNode,
}: {
  edge: ReturnType<typeof useTreeStore.getState>['edges'][number]
  store: ReturnType<typeof useTreeStore.getState>
  parentChanceNode?: ReturnType<typeof useTreeStore.getState>['nodes'][number]
}) {
  const { updateEdgeData, deleteEdge, nodes, edges, loadSnapshot } = store
  const d = edge.data ?? {}
  const sourceNode = nodes.find((n) => n.id === edge.source)
  const targetNode = nodes.find((n) => n.id === edge.target)
  const isChanceBranch = sourceNode?.data.kind === 'chance'

  return (
    <>
      <div style={{
        padding: '12px 14px',
        background: `${palette.decision.base}08`,
        border: `1px solid ${palette.decision.border}40`,
        borderRadius: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: palette.gray[400] }}>
          BRANCH
        </span>
        {sourceNode && targetNode && (
          <div style={{ fontSize: 13, color: palette.gray[700], marginTop: 4 }}>
            <span style={{ fontWeight: 600, color: palette.gray[900] }}>{sourceNode.data.label}</span>
            <span style={{ color: palette.gray[400], margin: '0 6px' }}>→</span>
            <span style={{ fontWeight: 600, color: palette.gray[900] }}>{targetNode.data.label}</span>
          </div>
        )}
      </div>

      <FormField label="Label" id={`elabel-${edge.id}`}>
        <StyledInput
          id={`elabel-${edge.id}`}
          type="text"
          value={d.label ?? ''}
          onChange={(e) => updateEdgeData(edge.id, { label: e.target.value })}
          placeholder="Branch label"
        />
      </FormField>

      {isChanceBranch && (
        <FormField
          label="Probability"
          id={`eprob-${edge.id}`}
          hint="Enter value between 0 and 1 (e.g., 0.40 = 40%)"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StyledInput
              id={`eprob-${edge.id}`}
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={d.probability ?? 0}
              onChange={(e) =>
                updateEdgeData(edge.id, {
                  probability: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)),
                })
              }
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 13, color: palette.gray[500], fontWeight: 500 }}>
              {(d.probability ?? 0) * 100}%
            </span>
          </div>
        </FormField>
      )}

      <FormField label="Incremental Payoff" id={`epayoff-${edge.id}`} hint="Added to cumulative path value">
        <StyledInput
          id={`epayoff-${edge.id}`}
          type="number"
          value={d.payoff ?? 0}
          onChange={(e) => updateEdgeData(edge.id, { payoff: parseFloat(e.target.value) || 0 })}
        />
      </FormField>

      {isChanceBranch && parentChanceNode && (
        <BranchProbEditor
          nodeId={parentChanceNode.id}
          edges={edges}
          nodes={nodes}
          loadSnapshot={loadSnapshot}
          updateEdgeData={store.updateEdgeData}
          highlightEdgeId={edge.id}
        />
      )}

      <DangerButton label="Delete Branch" onConfirm={() => deleteEdge(edge.id)} />
    </>
  )
}

function BranchProbEditor({
  nodeId,
  edges,
  nodes,
  loadSnapshot,
  updateEdgeData,
  highlightEdgeId,
}: {
  nodeId: string
  edges: ReturnType<typeof useTreeStore.getState>['edges']
  nodes: ReturnType<typeof useTreeStore.getState>['nodes']
  loadSnapshot: ReturnType<typeof useTreeStore.getState>['loadSnapshot']
  updateEdgeData: ReturnType<typeof useTreeStore.getState>['updateEdgeData']
  highlightEdgeId?: string
}) {
  const outgoing = edges.filter((e) => e.source === nodeId)
  if (outgoing.length === 0) return null

  const total = probTotal(edges, nodeId)
  const totalPct = total * 100
  const isValid = Math.abs(total - 1) < 0.0001
  const remaining = (1 - total) * 100

  return (
    <div style={{
      borderRadius: 8,
      border: `1px solid ${panelTheme.border}`,
      overflow: 'hidden',
      background: panelTheme.sectionBg,
    }}>
      <div
        style={{
          padding: '10px 12px',
          background: panelTheme.headerBg,
          borderBottom: `1px solid ${panelTheme.border}`,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: palette.gray[500],
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>Branch Probabilities</span>
        {!isValid && (
          <span style={{
            marginLeft: 'auto',
            padding: '2px 6px',
            background: totalPct > 100 ? `${palette.error}20` : `${palette.warning}20`,
            color: totalPct > 100 ? palette.error : palette.warning,
            borderRadius: 4,
            fontSize: 10,
          }}>
            {totalPct.toFixed(0)}%
          </span>
        )}
      </div>
      
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {outgoing.map((e) => {
            const targetLabel = nodes.find((n) => n.id === e.target)?.data.label ?? e.id
            const prob = e.data?.probability ?? 0
            const isHighlighted = e.id === highlightEdgeId
            return (
              <div
                key={e.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px',
                  gap: 8,
                  alignItems: 'center',
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: isHighlighted ? `${palette.decision.optimal}15` : 'white',
                  border: isHighlighted ? `1px solid ${palette.decision.optimal}40` : `1px solid ${palette.gray[200]}`,
                  transition: 'all 0.15s',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: isHighlighted ? palette.gray[900] : palette.gray[600],
                    fontWeight: isHighlighted ? 600 : 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={targetLabel}
                >
                  {e.data?.label ?? targetLabel}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={prob}
                    aria-label={`Probability for ${targetLabel}`}
                    onChange={(ev) =>
                      updateEdgeData(e.id, {
                        probability: Math.min(1, Math.max(0, parseFloat(ev.target.value) || 0)),
                      })
                    }
                    style={{
                      width: '100%',
                      height: 32,
                      padding: '0 8px',
                      border: `1px solid ${palette.gray[300]}`,
                      borderRadius: 5,
                      fontSize: 12,
                      fontFamily: 'inherit',
                      background: 'white',
                      color: palette.gray[800],
                      boxSizing: 'border-box',
                      outline: 'none',
                      textAlign: 'right',
                    }}
                    onFocus={(ev) => {
                      ev.target.style.borderColor = palette.decision.optimal
                      ev.target.style.boxShadow = `0 0 0 3px ${palette.decision.optimal}20`
                    }}
                    onBlur={(ev) => {
                      ev.target.style.borderColor = palette.gray[300]
                      ev.target.style.boxShadow = 'none'
                    }}
                  />
                  <span style={{ fontSize: 11, color: palette.gray[400], width: 16 }}>%</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div
          aria-hidden="true"
          style={{ height: 6, borderRadius: 3, background: palette.gray[200], overflow: 'hidden' }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, totalPct)}%`,
              background: isValid 
                ? palette.success 
                : totalPct > 100 
                  ? palette.error 
                  : palette.warning,
              borderRadius: 3,
              transition: 'width 0.2s ease, background 0.2s ease',
            }}
          />
        </div>

        {/* Status */}
        <div
          role={isValid ? undefined : 'alert'}
          style={{
            padding: '10px 12px',
            borderRadius: 6,
            background: isValid 
              ? `${palette.success}10` 
              : totalPct > 100 
                ? `${palette.error}10` 
                : `${palette.warning}10`,
            border: `1px solid ${isValid 
              ? `${palette.success}30` 
              : totalPct > 100 
                ? `${palette.error}30` 
                : `${palette.warning}30`}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          {isValid ? (
            <CheckCircle2 size={14} color={palette.success} style={{ flexShrink: 0, marginTop: 1 }} />
          ) : (
            <AlertTriangle size={14} color={totalPct > 100 ? palette.error : palette.warning} style={{ flexShrink: 0, marginTop: 1 }} />
          )}
          <div>
            <div style={{ 
              fontSize: 12, 
              fontWeight: 600, 
              color: isValid ? palette.success : totalPct > 100 ? palette.error : palette.warning 
            }}>
              Total: {totalPct.toFixed(1)}%
              {isValid
                ? ' — valid ✓'
                : totalPct > 100
                  ? ' — exceeds 100%'
                  : ` — needs ${remaining.toFixed(1)}% more`}
            </div>
            {!isValid && (
              <div style={{ fontSize: 11, color: palette.gray[500], marginTop: 2 }}>
                {totalPct > 100
                  ? 'Reduce values so they sum to exactly 100%.'
                  : 'All branches must sum to exactly 100%.'}
              </div>
            )}
          </div>
        </div>

        {/* Auto-normalize button */}
        {!isValid && (
          <button
            onClick={() => {
              const newEdges = normalizeProbabilities(nodeId, edges)
              loadSnapshot({ nodes, edges: newEdges })
            }}
            style={{
              padding: '10px 12px',
              background: palette.decision.optimal,
              border: 'none',
              borderRadius: 6,
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              width: '100%',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1e40af')}
            onMouseLeave={(e) => (e.currentTarget.style.background = palette.decision.optimal)}
          >
            <RotateCcw size={14} />
            Auto-normalize to 100%
          </button>
        )}
      </div>
    </div>
  )
}

function EmvCard({ emv, isOptimal, kind }: { emv: number; isOptimal: boolean; kind: string }) {
  const positive = emv >= 0
  const accentColor = kind === 'decision' ? palette.decision.base : palette.chance.base
  
  return (
    <div
      style={{
        borderRadius: 8,
        padding: '14px',
        background: positive ? `${palette.success}08` : `${palette.error}08`,
        border: `1px solid ${positive ? `${palette.success}30` : `${palette.error}30`}`,
      }}
    >
      <div style={{ fontSize: 11, color: palette.gray[500], marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        Expected Monetary Value
        {isOptimal && (
          <span style={{
            padding: '2px 8px',
            background: `${accentColor}20`,
            color: accentColor,
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}>
            OPTIMAL
          </span>
        )}
      </div>
      <div style={{ 
        fontSize: 24, 
        fontWeight: 700, 
        fontVariantNumeric: 'tabular-nums', 
        color: positive ? palette.success : palette.error,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
      }}>
        {emv >= 0 ? '+' : ''}{emv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  )
}

function FormField({
  label, id, children, hint, error,
}: {
  label: string
  id: string
  children: React.ReactNode
  hint?: string
  error?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 12, fontWeight: 600, color: palette.gray[600] }}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <span style={{ fontSize: 11, color: palette.gray[400], display: 'flex', alignItems: 'center', gap: 4 }}>
          <Info size={10} />
          {hint}
        </span>
      )}
      {error && (
        <span role="alert" style={{ fontSize: 11, color: palette.error, display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={10} />
          {error}
        </span>
      )}
    </div>
  )
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        height: 40,
        padding: '0 12px',
        border: `1px solid ${palette.gray[300]}`,
        borderRadius: 6,
        fontSize: 14,
        fontFamily: 'inherit',
        background: 'white',
        color: palette.gray[800],
        boxSizing: 'border-box',
        outline: 'none',
        transition: 'all 0.15s',
        ...props.style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = palette.decision.optimal
        e.currentTarget.style.boxShadow = `0 0 0 3px ${palette.decision.optimal}15`
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = palette.gray[300]
        e.currentTarget.style.boxShadow = 'none'
        props.onBlur?.(e)
      }}
    />
  )
}

function DangerButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  return (
    <button
      onClick={() => { if (confirm(`${label}? This action cannot be undone.`)) onConfirm() }}
      aria-label={label}
      style={{
        marginTop: 8,
        width: '100%',
        height: 40,
        background: 'transparent',
        border: `1px solid ${palette.error}40`,
        borderRadius: 6,
        color: palette.error,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${palette.error}10`
        e.currentTarget.style.borderColor = `${palette.error}60`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = `${palette.error}40`
      }}
    >
      <Trash2 size={14} />
      {label}
    </button>
  )
}

function EmptyState() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: 16, 
      padding: '32px 16px', 
      textAlign: 'center',
      color: palette.gray[400],
    }}>
      <div style={{
        width: 64,
        height: 64,
        background: palette.gray[100],
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={palette.gray[400]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3h7v7H3z"/><circle cx="17.5" cy="6.5" r="3.5"/><path d="M14 21v-4a2 2 0 0 1 4 0v4"/><path d="M10 21h4"/><path d="M7 10v11"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 15, color: palette.gray[600], fontWeight: 600, marginBottom: 4 }}>
          No Selection
        </div>
        <div style={{ fontSize: 13, color: palette.gray[500], lineHeight: 1.5 }}>
          Click a node or branch to edit its properties
        </div>
      </div>
      <div style={{
        padding: '16px',
        background: palette.gray[50],
        border: `1px solid ${palette.gray[200]}`,
        borderRadius: 10,
        fontSize: 12,
        color: palette.gray[500],
        lineHeight: 1.8,
        textAlign: 'left',
        width: '100%',
      }}>
        <div style={{ fontWeight: 700, color: palette.gray[700], marginBottom: 8, fontSize: 11, letterSpacing: '0.05em' }}>
          QUICK TIPS
        </div>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li>Drag handles to connect nodes</li>
          <li>Double-click canvas to add Decision</li>
          <li>Delete key removes selection</li>
          <li>Chance branches must sum to 100%</li>
        </ul>
      </div>
    </div>
  )
}
