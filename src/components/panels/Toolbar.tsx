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
import { toolbarTheme, palette } from '../../theme'

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
        padding: '0 14px',
        height: 52,
        background: toolbarTheme.bg,
        borderBottom: `1px solid ${toolbarTheme.border}`,
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      {/* App title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginRight: 16,
          padding: '6px 12px',
          borderRadius: 8,
        }}
      >
        <div style={{
          width: 28,
          height: 28,
          background: '#1d4ed8',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <GitBranch size={16} color="white" />
        </div>
        <div>
          <div style={{
            color: toolbarTheme.text,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '-0.3px',
          }}>
            RiskTree
          </div>
          <div style={{
            color: toolbarTheme.textMuted,
            fontSize: 10,
            fontWeight: 500,
          }}>
            Decision Analysis
          </div>
        </div>
      </div>

      <Divider />

      {/* Add nodes group */}
      <GroupLabel label="Add" />
      <NodeBtn
        icon={<Square size={14} />}
        label="Decision"
        accent={toolbarTheme.accent.decision}
        accentBg="#eff6ff"
        onClick={() => addNode('decision')}
        title="Add Decision node — square (highest-EMV branch chosen)"
      />
      <NodeBtn
        icon={<Circle size={14} />}
        label="Chance"
        accent={toolbarTheme.accent.chance}
        accentBg="#ecfdf5"
        onClick={() => addNode('chance')}
        title="Add Chance node — circle (probabilities must sum to 100%)"
      />
      <NodeBtn
        icon={<Hexagon size={14} />}
        label="Terminal"
        accent={toolbarTheme.accent.terminal}
        accentBg="#fffbeb"
        onClick={() => addNode('terminal')}
        title="Add Terminal node — shows final payoff"
      />

      <Divider />

      {/* Actions group */}
      <ActionBtn
        icon={<RefreshCw size={14} />}
        label="Recalculate"
        onClick={runEMV}
        title="Recalculate expected values and optimal path"
      />
      <ActionBtn
        icon={<BarChart2 size={14} />}
        label="Analyze"
        onClick={() => setAnalysisOpen(true)}
        title="Open Risk Profile and Sensitivity charts"
        accent="#7c3aed"
        highlight
      />

      <Divider />

      <ActionBtn icon={<Save size={14} />} label="Save" onClick={handleSave} title="Export tree as JSON file" />
      <ActionBtn icon={<FolderOpen size={14} />} label="Load" onClick={handleLoad} title="Import tree from JSON file" />

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
          gap: 6,
          height: 34,
          padding: '0 12px',
          borderRadius: 6,
          border: aiPanelOpen ? '1px solid #7c3aed' : `1px solid ${toolbarTheme.border}`,
          background: aiPanelOpen ? '#ede9fe' : 'white',
          color: '#7c3aed',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.12s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { 
          e.currentTarget.style.background = '#ede9fe'
          e.currentTarget.style.borderColor = '#7c3aed'
        }}
        onMouseLeave={(e) => { 
          e.currentTarget.style.background = aiPanelOpen ? '#ede9fe' : 'white'
          e.currentTarget.style.borderColor = aiPanelOpen ? '#7c3aed' : toolbarTheme.border
        }}
      >
        <Bot size={14} />
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
        style={{ 
          display: 'flex', 
          gap: 14, 
          alignItems: 'center', 
          marginRight: 12,
          padding: '6px 14px',
          background: palette.gray[50],
          border: `1px solid ${palette.gray[200]}`,
          borderRadius: 8,
        }}
      >
        <LegendItem color={toolbarTheme.accent.decision} label="Decision" shape="square" />
        <LegendItem color={toolbarTheme.accent.chance} label="Chance" shape="circle" />
        <LegendItem color={toolbarTheme.accent.terminal} label="Terminal" shape="hex" />
      </div>

      <Divider />

      <button
        title="Tip: Double-click canvas to add a Decision node. Drag handles to connect. Delete key removes selection."
        aria-label="Help"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'help',
          padding: 8,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          color: toolbarTheme.textMuted,
          transition: 'all 0.12s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = toolbarTheme.text
          e.currentTarget.style.background = palette.gray[100]
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = toolbarTheme.textMuted
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <HelpCircle size={18} />
      </button>

      <Divider />

      <ActionBtn
        icon={<Trash2 size={14} />}
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
        color: toolbarTheme.textMuted,
        fontSize: 10,
        fontWeight: 700,
        marginRight: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {label}:
    </span>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 24, background: toolbarTheme.border, margin: '0 8px', flexShrink: 0 }} />
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
        gap: 6,
        background: accentBg,
        border: `1px solid ${accent}30`,
        borderRadius: 6,
        padding: '0 12px',
        height: 34,
        color: accent,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.12s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${accent}25`
        e.currentTarget.style.borderColor = `${accent}60`
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = accentBg
        e.currentTarget.style.borderColor = `${accent}30`
        e.currentTarget.style.transform = 'translateY(0)'
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
  highlight,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  title?: string
  accent?: string
  danger?: boolean
  highlight?: boolean
}) {
  const color = danger ? '#ef4444' : accent ?? toolbarTheme.text
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: highlight ? `${accent}15` : 'transparent',
        border: `1px solid ${highlight ? `${accent}40` : toolbarTheme.border}`,
        borderRadius: 6,
        padding: '0 11px',
        height: 34,
        color,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.12s',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? '#fee2e2' : highlight ? `${accent}18` : palette.gray[100]
        e.currentTarget.style.borderColor = danger ? '#fca5a5' : highlight ? `${accent}60` : palette.gray[300]
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = highlight ? `${accent}15` : 'transparent'
        e.currentTarget.style.borderColor = highlight ? `${accent}40` : toolbarTheme.border
        e.currentTarget.style.transform = 'translateY(0)'
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 10, height: 10, background: color, flexShrink: 0, ...shapeStyle }} />
      <span style={{ color: toolbarTheme.textMuted, fontSize: 11, fontWeight: 500 }}>{label}</span>
    </div>
  )
}
