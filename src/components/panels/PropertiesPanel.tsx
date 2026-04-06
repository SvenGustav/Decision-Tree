import { Trash2, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { useTreeStore } from '../../store/treeStore'
import { normalizeProbabilities } from '../../engine/bayesian'

// ── Semantic tokens ──────────────────────────────────────────────
const T = {
  panelBg: '#ffffff',
  sectionBg: '#f8fafc',
  sectionBorder: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  decision: '#2563eb',
  chance: '#16a34a',
  terminal: '#d97706',
  error: '#dc2626',
  errorBg: '#fef2f2',
  errorBorder: '#fecaca',
  success: '#16a34a',
  successBg: '#f0fdf4',
  successBorder: '#bbf7d0',
  warning: '#d97706',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
  inputBg: '#f8fafc',
  inputBorder: '#cbd5e1',
  inputBorderFocus: '#2563eb',
}

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
        width: 260,
        minWidth: 260,
        flexShrink: 0,
        background: T.panelBg,
        borderLeft: `1px solid ${T.sectionBorder}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 14px 8px',
          borderBottom: `1px solid ${T.sectionBorder}`,
          background: T.sectionBg,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: T.textMuted }}>
          PROPERTIES
        </span>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
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
  const kindColors: Record<string, string> = { decision: T.decision, chance: T.chance, terminal: T.terminal }
  const kindLabels: Record<string, string> = { decision: 'Decision Node', chance: 'Chance Node', terminal: 'Terminal Node' }
  const accent = kindColors[d.kind] ?? T.textSecondary

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 10, height: 10, background: accent, flexShrink: 0,
            borderRadius: d.kind === 'decision' ? 2 : d.kind === 'chance' ? '50%' : 0,
            clipPath: d.kind === 'terminal' ? 'polygon(50% 0%, 100% 100%, 0% 100%)' : undefined,
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: accent }}>
          {kindLabels[d.kind] ?? 'NODE'}
        </span>
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
        <EmvCard emv={d.emv} isOptimal={d.isOptimal ?? false} />
      )}

      {d.kind === 'chance' && (
        <BranchProbEditor
          nodeId={node.id}
          edges={edges}
          nodes={nodes}
          loadSnapshot={loadSnapshot}
          updateEdgeData={store.updateEdgeData}
        />
      )}

      <DangerButton label="Delete Node" onConfirm={() => deleteNode(node.id)} />
    </>
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
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: T.textMuted }}>
        BRANCH
      </span>
      {sourceNode && targetNode && (
        <div style={{ fontSize: 12, color: T.textSecondary }}>
          <span style={{ fontWeight: 600, color: T.textPrimary }}>{sourceNode.data.label}</span>
          {' → '}
          <span style={{ fontWeight: 600, color: T.textPrimary }}>{targetNode.data.label}</span>
        </div>
      )}

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
          label="Probability (0–1)"
          id={`eprob-${edge.id}`}
          hint="e.g. 0.40 = 40%"
        >
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
          />
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
    <Section label="Branch Probabilities">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {outgoing.map((e) => {
          const targetLabel = nodes.find((n) => n.id === e.target)?.data.label ?? e.id
          const prob = e.data?.probability ?? 0
          const isHighlighted = e.id === highlightEdgeId
          return (
            <div
              key={e.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 76px',
                gap: 6,
                alignItems: 'center',
                padding: '3px 6px',
                borderRadius: 6,
                background: isHighlighted ? '#eff6ff' : 'transparent',
                border: isHighlighted ? '1px solid #bfdbfe' : '1px solid transparent',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: T.textPrimary,
                  fontWeight: isHighlighted ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={targetLabel}
              >
                {e.data?.label ?? targetLabel}
              </span>
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
                  padding: '0 6px',
                  border: `1px solid ${T.inputBorder}`,
                  borderRadius: 5,
                  fontSize: 12,
                  fontFamily: 'inherit',
                  background: T.inputBg,
                  color: T.textPrimary,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
                onFocus={(ev) => {
                  ev.target.style.borderColor = T.inputBorderFocus
                  ev.target.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.15)'
                }}
                onBlur={(ev) => {
                  ev.target.style.borderColor = T.inputBorder
                  ev.target.style.boxShadow = 'none'
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div
        aria-hidden="true"
        style={{ height: 5, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden', marginTop: 4 }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, totalPct)}%`,
            background: isValid ? T.success : totalPct > 100 ? T.error : T.warning,
            borderRadius: 4,
            transition: 'width 0.2s ease, background 0.2s ease',
          }}
        />
      </div>

      {/* Sum status chip */}
      <div
        role={isValid ? undefined : 'alert'}
        style={{
          padding: '7px 10px',
          borderRadius: 7,
          background: isValid ? T.successBg : totalPct > 100 ? T.errorBg : T.warningBg,
          border: `1px solid ${isValid ? T.successBorder : totalPct > 100 ? T.errorBorder : T.warningBorder}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 7,
        }}
      >
        {isValid ? (
          <CheckCircle2 size={14} color={T.success} style={{ flexShrink: 0, marginTop: 1 }} />
        ) : (
          <AlertTriangle size={14} color={totalPct > 100 ? T.error : T.warning} style={{ flexShrink: 0, marginTop: 1 }} />
        )}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: isValid ? T.success : totalPct > 100 ? T.error : T.warning }}>
            Total: {totalPct.toFixed(1)}%
            {isValid
              ? ' — valid ✓'
              : totalPct > 100
                ? ' — over 100%'
                : ` — needs ${remaining.toFixed(1)}% more`}
          </div>
          {!isValid && (
            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 1 }}>
              {totalPct > 100
                ? 'Reduce one or more values so they sum to 100%.'
                : 'All branches must sum to exactly 100%.'}
            </div>
          )}
        </div>
      </div>

      {/* Auto-normalize button — shown only when invalid */}
      {!isValid && (
        <button
          onClick={() => {
            const newEdges = normalizeProbabilities(nodeId, edges)
            loadSnapshot({ nodes, edges: newEdges })
          }}
          style={{
            padding: '8px 12px',
            background: '#2563eb',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: '100%',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#1d4ed8')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#2563eb')}
        >
          Auto-normalize to 100%
        </button>
      )}
    </Section>
  )
}

function EmvCard({ emv, isOptimal }: { emv: number; isOptimal: boolean }) {
  const positive = emv >= 0
  return (
    <div
      style={{
        borderRadius: 8,
        padding: '10px 12px',
        background: positive ? T.successBg : T.errorBg,
        border: `1px solid ${positive ? T.successBorder : T.errorBorder}`,
      }}
    >
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 2 }}>Expected Monetary Value</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: positive ? T.success : T.error, lineHeight: 1.2 }}>
        {emv >= 0 ? '+' : ''}{emv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      {isOptimal && (
        <div
          style={{
            marginTop: 5, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            color: T.decision, background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 4, padding: '2px 6px', display: 'inline-block',
          }}
        >
          OPTIMAL PATH
        </div>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 8, border: `1px solid ${T.sectionBorder}`, overflow: 'hidden' }}>
      <div
        style={{
          padding: '6px 10px',
          background: T.sectionBg,
          borderBottom: `1px solid ${T.sectionBorder}`,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: T.textSecondary,
        }}
      >
        {label}
      </div>
      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label htmlFor={id} style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary }}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <span style={{ fontSize: 11, color: T.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
          <Info size={10} />
          {hint}
        </span>
      )}
      {error && (
        <span role="alert" style={{ fontSize: 11, color: T.error, display: 'flex', alignItems: 'center', gap: 3 }}>
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
        height: 38,
        padding: '0 10px',
        border: `1px solid ${T.inputBorder}`,
        borderRadius: 6,
        fontSize: 13,
        fontFamily: 'inherit',
        background: T.inputBg,
        color: T.textPrimary,
        boxSizing: 'border-box',
        outline: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        ...props.style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = T.inputBorderFocus
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = T.inputBorder
        e.currentTarget.style.boxShadow = 'none'
        props.onBlur?.(e)
      }}
    />
  )
}

function DangerButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  return (
    <button
      onClick={() => { if (confirm(`${label}?`)) onConfirm() }}
      aria-label={label}
      style={{
        marginTop: 4, width: '100%', height: 36,
        background: 'transparent', border: `1px solid ${T.errorBorder}`,
        borderRadius: 6, color: T.error, fontSize: 12, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = T.errorBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <Trash2 size={13} />
      {label}
    </button>
  )
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 8px', textAlign: 'center' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h7v7H3z"/><circle cx="17.5" cy="6.5" r="3.5"/><path d="M14 21v-4a2 2 0 0 1 4 0v4"/><path d="M10 21h4"/><path d="M7 10v11"/>
      </svg>
      <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>
        Click a node or branch to edit its properties.
      </div>
      <div
        style={{
          padding: '10px 12px', background: T.sectionBg, border: `1px solid ${T.sectionBorder}`,
          borderRadius: 8, fontSize: 11, color: T.textMuted, lineHeight: 1.7, textAlign: 'left', width: '100%',
        }}
      >
        <div style={{ fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Quick tips</div>
        <ul style={{ margin: 0, paddingLeft: 14 }}>
          <li>Drag handles to connect nodes</li>
          <li>Double-click canvas → add Decision</li>
          <li>Delete key removes selection</li>
          <li>Chance branches must sum to 100%</li>
        </ul>
      </div>
    </div>
  )
}
