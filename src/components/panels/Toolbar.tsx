import { useRef } from 'react'
import {
  Square,
  Circle,
  Hexagon,
  Save,
  FolderOpen,
  BarChart2,
  Trash2,
  RefreshCw,
  HelpCircle,
  GitBranch,
  Bot,
} from 'lucide-react'
import { useTreeStore } from '../../store/treeStore'
import { exportTree, importTree } from '../../utils/io'

// Toolbar color tokens
const TB = {
  bg: '#0f172a',
  border: '#1e293b',
  divider: '#334155',
  textMuted: '#64748b',
  textLabel: '#94a3b8',
  btnBorder: '#334155',
  btnHover: '#1e293b',
}

export function Toolbar() {
  const { addNode, nodes, edges, loadSnapshot, clearTree, runEMV, setAnalysisOpen, aiPanelOpen, setAiPanelOpen } = useTreeStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSave() {
    exportTree({ nodes, edges })
  }

  function handleLoad() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const snap = await importTree(file)
      loadSnapshot(snap)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load file')
    }
    e.target.value = ''
  }

  return (
    <header
      role="toolbar"
      aria-label="Main toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 12px',
        height: 48,
        background: TB.bg,
        borderBottom: `1px solid ${TB.border}`,
        flexShrink: 0,
      }}
    >
      {/* App title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginRight: 12,
          color: '#f8fafc',
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '-0.3px',
        }}
      >
        <GitBranch size={16} color="#60a5fa" style={{ flexShrink: 0 }} />
        RiskTree
      </div>

      <Divider />

      {/* Add nodes group */}
      <GroupLabel label="Add" />
      <NodeBtn
        icon={<Square size={13} />}
        label="Decision"
        accent="#3b82f6"
        accentBg="rgba(59,130,246,0.12)"
        onClick={() => addNode('decision')}
        title="Add Decision node — square (highest-EMV branch chosen)"
      />
      <NodeBtn
        icon={<Circle size={13} />}
        label="Chance"
        accent="#22c55e"
        accentBg="rgba(34,197,94,0.12)"
        onClick={() => addNode('chance')}
        title="Add Chance node — circle (probabilities must sum to 100%)"
      />
      <NodeBtn
        icon={<Hexagon size={13} />}
        label="Terminal"
        accent="#f59e0b"
        accentBg="rgba(245,158,11,0.12)"
        onClick={() => addNode('terminal')}
        title="Add Terminal node — shows final payoff"
      />

      <Divider />

      {/* Actions group */}
      <ActionBtn
        icon={<RefreshCw size={13} />}
        label="Recalculate"
        onClick={runEMV}
        title="Recalculate expected values and optimal path"
      />
      <ActionBtn
        icon={<BarChart2 size={13} />}
        label="Analyze"
        onClick={() => setAnalysisOpen(true)}
        title="Open Risk Profile and Sensitivity charts"
        accent="#a855f7"
      />

      <Divider />

      <ActionBtn icon={<Save size={13} />} label="Save" onClick={handleSave} title="Export tree as JSON file" />
      <ActionBtn icon={<FolderOpen size={13} />} label="Load" onClick={handleLoad} title="Import tree from JSON file" />

      <Divider />

      {/* AI assistant toggle */}
      <button
        onClick={() => setAiPanelOpen(!aiPanelOpen)}
        title={aiPanelOpen ? 'Close AI assistant' : 'Open AI assistant — asks LM Studio for probability help'}
        aria-pressed={aiPanelOpen}
        aria-label="AI Assistant"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          height: 32,
          padding: '0 10px',
          borderRadius: 6,
          border: aiPanelOpen ? '1px solid rgba(139,92,246,0.6)' : '1px solid rgba(139,92,246,0.3)',
          background: aiPanelOpen ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.08)',
          color: '#a78bfa',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.12s, border-color 0.12s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.25)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.7)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = aiPanelOpen ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.08)'; e.currentTarget.style.borderColor = aiPanelOpen ? 'rgba(139,92,246,0.6)' : 'rgba(139,92,246,0.3)' }}
      >
        <Bot size={13} />
        AI
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
      />

      <div style={{ flex: 1 }} />

      {/* Legend */}
      <div
        aria-label="Node type legend"
        style={{ display: 'flex', gap: 10, alignItems: 'center', marginRight: 8 }}
      >
        <LegendItem color="#3b82f6" label="Decision" shape="square" />
        <LegendItem color="#22c55e" label="Chance" shape="circle" />
        <LegendItem color="#f59e0b" label="Terminal" shape="hex" />
      </div>

      <Divider />

      <button
        title="Tip: Double-click canvas to add a Decision node. Drag handles to connect. Delete key removes selection."
        aria-label="Help"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'help',
          padding: 6,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          color: TB.textMuted,
        }}
      >
        <HelpCircle size={15} />
      </button>

      <Divider />

      <ActionBtn
        icon={<Trash2 size={13} />}
        label="Clear"
        onClick={() => { if (confirm('Clear the entire tree? This cannot be undone.')) clearTree() }}
        title="Remove all nodes and branches"
        accent="#ef4444"
        danger
      />
    </header>
  )
}

function GroupLabel({ label }: { label: string }) {
  return (
    <span
      style={{
        color: TB.textLabel,
        fontSize: 10,
        fontWeight: 600,
        marginRight: 2,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {label}:
    </span>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 22, background: TB.divider, margin: '0 6px', flexShrink: 0 }} />
}

function NodeBtn({
  icon,
  label,
  accent,
  accentBg,
  onClick,
  title,
}: {
  icon: React.ReactNode
  label: string
  accent: string
  accentBg: string
  onClick: () => void
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={`Add ${label} node`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: accentBg,
        border: `1px solid ${accent}40`,
        borderRadius: 6,
        padding: '0 10px',
        height: 32,
        color: accent,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background 0.12s, border-color 0.12s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${accent}22`
        e.currentTarget.style.borderColor = `${accent}80`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = accentBg
        e.currentTarget.style.borderColor = `${accent}40`
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function ActionBtn({
  icon,
  label,
  onClick,
  title,
  accent,
  danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  title?: string
  accent?: string
  danger?: boolean
}) {
  const color = danger ? '#ef4444' : accent ?? TB.textLabel
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: 'transparent',
        border: `1px solid ${TB.btnBorder}`,
        borderRadius: 6,
        padding: '0 9px',
        height: 32,
        color,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background 0.12s, border-color 0.12s, color 0.12s',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.1)' : TB.btnHover
        e.currentTarget.style.borderColor = danger ? 'rgba(239,68,68,0.4)' : '#475569'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = TB.btnBorder
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function LegendItem({
  color,
  label,
  shape,
}: {
  color: string
  label: string
  shape: 'square' | 'circle' | 'hex'
}) {
  const shapeStyle: React.CSSProperties =
    shape === 'circle'
      ? { borderRadius: '50%' }
      : shape === 'hex'
        ? { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }
        : { borderRadius: 2 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 10, height: 10, background: color, flexShrink: 0, ...shapeStyle }} />
      <span style={{ color: TB.textLabel, fontSize: 10, fontWeight: 500 }}>{label}</span>
    </div>
  )
}
