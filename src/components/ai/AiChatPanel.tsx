import { useEffect, useRef, useState, useCallback } from 'react'
import { Bot, Send, Settings, X, CheckCircle, Loader2, ChevronDown, Zap, RefreshCw, WifiOff, ToggleLeft, ToggleRight } from 'lucide-react'
import { useTreeStore } from '../../store/treeStore'
import type { TreeNode, TreeEdge } from '../../types/tree'
import {
  streamChat,
  fetchModels,
  loadConfig,
  saveConfig,
  RISKTREE_JSON_SCHEMA,
  type LmStudioConfig,
  type ChatMessage,
} from '../../services/lmStudio'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  patch?: AiPatch
  /** Set when structured output was used — prevents raw JSON showing during/after stream */
  isStructured?: boolean
  /** Parsed action from structured output */
  structuredAction?: AiPatch
}

interface AiPatch {
  action: 'update_tree' | 'build_tree'
  changes?: AiChange[]
  tree?: AiTreeNode
}

interface AiChange {
  type: 'updateEdge' | 'updateNode'
  id: string
  probability?: number
  payoff?: number
  label?: string
}

interface AiTreeNode {
  label: string
  kind: 'decision' | 'chance' | 'terminal'
  payoff?: number
  edgeLabel?: string
  edgeProbability?: number
  edgePayoff?: number
  children?: AiTreeNode[]
}

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(nodes: TreeNode[], edges: TreeEdge[]): string {
  const nodesSummary = nodes
    .map((n) => {
      const d = n.data
      const out = edges.filter((e) => e.source === n.id)
      const probSum = out.reduce((s, e) => s + (e.data?.probability ?? 0), 0)
      const parts = [`id="${n.id}" kind="${d.kind}" label="${d.label}"`]
      if (d.emv !== undefined) parts.push(`emv=${d.emv.toFixed(2)}`)
      if (d.payoff !== undefined) parts.push(`payoff=${d.payoff}`)
      if (d.kind === 'chance' && out.length > 0) parts.push(`prob_sum=${probSum.toFixed(3)}`)
      return `  - ${parts.join(', ')}`
    })
    .join('\n')

  const edgesSummary = edges
    .map((e) => {
      const parts = [`id="${e.id}" ${e.source}→${e.target} label="${e.data?.label ?? ''}"`]
      if (e.data?.probability !== undefined) parts.push(`p=${e.data.probability}`)
      if (e.data?.payoff) parts.push(`payoff=${e.data.payoff}`)
      return `  - ${parts.join(', ')}`
    })
    .join('\n')

  return `You are a decision analysis assistant embedded in RiskTree, an Expected Monetary Value (EMV) decision tree application.

## CRITICAL OUTPUT RULE — READ FIRST
Every time the user asks you to build, create, or update a decision tree, you MUST end your reply with a JSON action block. This is not optional. The application parses this block to actually change the diagram. Without it, no changes occur.

To BUILD a new tree (replaces everything):
\`\`\`json
{"action":"build_tree","tree":{"label":"Root Decision","kind":"decision","children":[{"label":"Option A","edgeLabel":"Option A","edgePayoff":0,"kind":"chance","children":[{"label":"Win","edgeLabel":"Win","edgeProbability":0.6,"edgePayoff":0,"kind":"terminal","payoff":1000},{"label":"Lose","edgeLabel":"Lose","edgeProbability":0.4,"edgePayoff":0,"kind":"terminal","payoff":-200}]}]}}
\`\`\`

To UPDATE values in the current tree (use exact node/edge IDs from the tree state below):
\`\`\`json
{"action":"update_tree","changes":[{"type":"updateEdge","id":"EDGE_ID","probability":0.4},{"type":"updateNode","id":"NODE_ID","payoff":500}]}
\`\`\`

JSON rules:
- kind must be exactly "decision", "chance", or "terminal"
- terminal nodes require a numeric payoff field
- edgeProbability on siblings of a chance node must sum to exactly 1.0
- edgePayoff is incremental cost on that branch (use 0 if none)
- Output raw JSON only — no comments, no trailing commas

## Node types
- decision: The decision-maker chooses the branch with highest EMV.
- chance: An uncertain event. All outgoing branch probabilities must sum to 1.0.
- terminal: Final outcome with a monetary payoff value.

## Current tree state
Nodes:
${nodesSummary || '  (empty)'}

Edges:
${edgesSummary || '  (empty)'}

## Your responsibilities
1. Probability estimation — suggest calibrated probabilities with base-rate reasoning. Flag optimism bias, overconfidence, availability heuristic, and anchoring.
2. Payoff estimation — help size revenues and costs realistically.
3. Bias review — identify cognitive biases affecting the user's estimates.
4. Tree construction — build complete trees from plain-language descriptions.
5. Sensitivity insight — note which variables most affect the EMV.

Be concise. Always end with the JSON block when tree changes are involved.`
}

// ─── Tree builder ──────────────────────────────────────────────────────────────

const TYPE_MAP = {
  decision: 'decisionNode',
  chance: 'chanceNode',
  terminal: 'terminalNode',
} as const

function buildNodesEdges(aiTree: AiTreeNode): { nodes: TreeNode[]; edges: TreeEdge[] } {
  const nodes: TreeNode[] = []
  const edges: TreeEdge[] = []
  let leafCount = 0

  function uid(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
  }

  function layout(aiNode: AiTreeNode, depth: number): { id: string; y: number } {
    const id = uid(`ai-${aiNode.kind[0]}`)
    const x = depth * 240 + 80

    if (!aiNode.children || aiNode.children.length === 0) {
      const y = leafCount * 120 + 80
      leafCount++
      nodes.push({
        id,
        type: TYPE_MAP[aiNode.kind],
        position: { x, y },
        data: { kind: aiNode.kind, label: aiNode.label, payoff: aiNode.payoff },
      })
      return { id, y }
    }

    const childInfo = aiNode.children.map((child) => layout(child, depth + 1))
    const y = (childInfo[0].y + childInfo[childInfo.length - 1].y) / 2

    nodes.push({
      id,
      type: TYPE_MAP[aiNode.kind],
      position: { x, y },
      data: { kind: aiNode.kind, label: aiNode.label, payoff: aiNode.payoff },
    })

    aiNode.children.forEach((child, i) => {
      edges.push({
        id: uid('ai-e'),
        source: id,
        target: childInfo[i].id,
        data: {
          label: child.edgeLabel ?? child.label,
          probability: child.edgeProbability,
          payoff: child.edgePayoff ?? 0,
        },
      })
    })

    return { id, y }
  }

  layout(aiTree, 0)
  return { nodes, edges }
}

// ─── JSON patch extraction ─────────────────────────────────────────────────────

function extractPatch(content: string): AiPatch | null {
  // Strategy 1: look for the LAST ```json ... ``` fenced block
  const fenced = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)]
  for (let i = fenced.length - 1; i >= 0; i--) {
    try {
      const p = JSON.parse(fenced[i][1]) as AiPatch
      if (p.action === 'update_tree' || p.action === 'build_tree') return p
    } catch { /* skip */ }
  }

  // Strategy 2: find the last occurrence of {"action": even without fences
  // Walk backwards through all JSON-like substrings
  const raw = [...content.matchAll(/\{\s*"action"\s*:/g)]
  for (let i = raw.length - 1; i >= 0; i--) {
    const start = raw[i].index!
    // Try increasingly long substrings to find valid JSON
    for (let end = start + 20; end <= content.length; end += 20) {
      try {
        const p = JSON.parse(content.slice(start, end)) as AiPatch
        if (p.action === 'update_tree' || p.action === 'build_tree') return p
      } catch { /* keep growing */ }
    }
  }
  return null
}

/** Strips JSON patch blocks (fenced or bare) from the visible message text */
function stripPatchBlocks(content: string): string {
  return content
    .replace(/```(?:json)?\s*\{\s*"action"\s*:[\s\S]*?```/g, '')
    .replace(/\{\s*"action"\s*:\s*"(?:update_tree|build_tree)"[\s\S]*?(?=\n\n|$)/g, '')
    .trim()
}

// ─── Color tokens ──────────────────────────────────────────────────────────────

const C = {
  panelBg: '#ffffff',
  headerBg: '#f8fafc',
  inputBg: '#f8fafc',
  inputBorder: '#e2e8f0',
  inputBorderFocus: '#1d4ed8',
  msgUser: '#1d4ed8',
  msgUserText: '#ffffff',
  msgAi: '#f8fafc',
  msgAiText: '#334155',
  muted: '#94a3b8',
  label: '#64748b',
  accent: '#1d4ed8',
  accentHover: '#1e40af',
  success: '#047857',
  warning: '#d97706',
  error: '#dc2626',
  border: '#e2e8f0',
  chipBg: '#f1f5f9',
  divider: '#e2e8f0',
}

// ─── LM Studio recommended system prompt ────────────────────────────────────

const LM_STUDIO_SYSTEM_PROMPT =
  'You are a focused decision analysis assistant. Do not use markdown formatting in your responses — no asterisks, no pound signs for headings, no dashes for bullets. Write in plain prose only. When asked to build or update a decision tree, always output the required JSON action block exactly as specified in the system instructions. Be concise.'

// ─── Quick-action prompts ─────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { label: 'Review my probabilities', prompt: 'Please review all the probability values in my current tree. Flag any that seem unrealistic or biased, and suggest calibrated alternatives with reasoning.' },
  { label: 'Check for biases', prompt: 'Analyze my current tree for cognitive biases — optimism bias, overconfidence, availability heuristic, base rate neglect, or anchoring. Be specific about which nodes/edges are affected.' },
  { label: 'Explain the EMV', prompt: 'Walk me through the Expected Monetary Value calculation for my tree and explain what the optimal decision is and why.' },
  { label: 'Suggest improvements', prompt: 'What branches, scenarios, or outcomes might I be missing from my current decision tree? Suggest additions that would make the analysis more complete.' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', marginLeft: 4 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: C.muted,
            animation: 'dot-pulse 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </span>
  )
}

// ─── Markdown-free message text renderer ──────────────────────────────────────

function stripInline(s: string): string {
  return s
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[_*](.+?)[_*]/g, '$1')
}

function MessageText({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []

  lines.forEach((line, i) => {
    if (/^###\s+/.test(line)) {
      nodes.push(
        <div key={i} style={{ fontWeight: 700, fontSize: 10, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 10, marginBottom: 2 }}>
          {stripInline(line.replace(/^###\s+/, ''))}
        </div>,
      )
    } else if (/^##\s+/.test(line)) {
      nodes.push(
        <div key={i} style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0', marginTop: 10, marginBottom: 3 }}>
          {stripInline(line.replace(/^##\s+/, ''))}
        </div>,
      )
    } else if (/^#\s+/.test(line)) {
      nodes.push(
        <div key={i} style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', marginTop: 10, marginBottom: 3 }}>
          {stripInline(line.replace(/^#\s+/, ''))}
        </div>,
      )
    } else if (/^[-*+]\s+/.test(line)) {
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
          <span style={{ color: C.accent, flexShrink: 0, lineHeight: '1.55' }}>•</span>
          <span>{stripInline(line.replace(/^[-*+]\s+/, ''))}</span>
        </div>,
      )
    } else if (/^\d+\.\s+/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1] ?? ''
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
          <span style={{ color: C.accent, flexShrink: 0, fontWeight: 600, minWidth: 16, lineHeight: '1.55' }}>{num}.</span>
          <span>{stripInline(line.replace(/^\d+\.\s+/, ''))}</span>
        </div>,
      )
    } else if (line === '') {
      nodes.push(<div key={i} style={{ height: 5 }} />)
    } else {
      nodes.push(
        <div key={i} style={{ marginBottom: 1 }}>
          {stripInline(line)}
        </div>,
      )
    }
  })

  return <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.55 }}>{nodes}</div>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      title="Copy to clipboard"
      style={{
        position: 'absolute',
        top: 5,
        right: 5,
        background: C.panelBg,
        border: `1px solid ${C.inputBorder}`,
        borderRadius: 4,
        padding: '2px 7px',
        fontSize: 10,
        color: copied ? C.success : C.muted,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: copied ? 600 : 400,
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function PatchCard({
  patch,
  onApply,
  applied,
}: {
  patch: AiPatch
  onApply: () => void
  applied: boolean
}) {
  const isUpdate = patch.action === 'update_tree'
  const count = isUpdate ? (patch.changes?.length ?? 0) : null
  const label = isUpdate
    ? `Update ${count} value${count !== 1 ? 's' : ''} in current tree`
    : 'Replace tree with AI-suggested structure'

  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: 8,
        border: `1px solid ${applied ? '#166534' : '#334155'}`,
        background: applied ? '#052e16' : '#172033',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Zap size={14} color={applied ? C.success : C.accent} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12, color: applied ? '#86efac' : C.label }}>{label}</span>
      {applied ? (
        <span style={{ fontSize: 11, color: C.success, display: 'flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle size={12} /> Applied
        </span>
      ) : (
        <button
          onClick={onApply}
          style={{
            background: C.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.accentHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
        >
          Apply to tree
        </button>
      )}
    </div>
  )
}

function MessageBubble({
  msg,
  onApplyPatch,
  appliedPatchIds,
  onForceApply,
}: {
  msg: Message
  onApplyPatch: (msgId: string, patch: AiPatch) => void
  appliedPatchIds: Set<string>
  onForceApply: (msgId: string) => void
}) {
  const isUser = msg.role === 'user'
  // When structured output is active during streaming, don't show raw JSON
  const showThinking = !isUser && msg.streaming && msg.isStructured
  const displayText = isUser
    ? msg.content
    : showThinking
      ? ''
      : stripPatchBlocks(msg.content)
  // Prefer structured action (from JSON schema), fall back to content parsing
  const patch = !isUser && !msg.streaming
    ? (msg.structuredAction ?? extractPatch(msg.content))
    : null
  // Only show force-hint for unstructured messages without any action
  const showForceHint =
    !isUser &&
    !msg.streaming &&
    !patch &&
    !msg.isStructured &&
    msg.id !== 'welcome' &&
    /open|clos|chance|decision|probabilit|payoff|tree|build|creat|\$|%/i.test(msg.content)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 8,
        alignItems: 'flex-start',
        marginBottom: 12,
      }}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#172033',
            border: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <Bot size={14} color={C.accent} />
        </div>
      )}

      <div style={{ maxWidth: '82%', minWidth: 0 }}>
        <div
          style={{
            padding: '9px 13px',
            borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
            background: isUser ? C.msgUser : C.msgAi,
            color: isUser ? C.msgUserText : C.msgAiText,
            fontSize: 13,
            wordBreak: 'break-word',
          }}
        >
          {isUser ? (
            <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{displayText}</span>
          ) : displayText ? (
            <MessageText text={displayText} />
          ) : (
            <span style={{ color: C.muted, fontStyle: 'italic' }}>Thinking…</span>
          )}
          {msg.streaming && <TypingDots />}
        </div>

        {patch && (
          <PatchCard
            patch={patch}
            applied={appliedPatchIds.has(msg.id)}
            onApply={() => onApplyPatch(msg.id, patch)}
          />
        )}

        {showForceHint && (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
              No tree action detected
            </span>
            <button
              onClick={() => onForceApply(msg.id)}
              title="Ask the AI to output the JSON action block so the tree can be updated"
              style={{
                background: 'transparent',
                border: `1px solid ${C.inputBorder}`,
                borderRadius: 5,
                padding: '3px 9px',
                color: C.label,
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = '#e2e8f0' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.color = C.label }}
            >
              <Zap size={11} /> Apply this to tree
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsPanel({
  config,
  onConfigChange,
}: {
  config: LmStudioConfig
  onConfigChange: (c: LmStudioConfig) => void
}) {
  const [models, setModels] = useState<string[]>([])
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const list = await fetchModels(config.baseUrl)
      setModels(list)
      setTestResult('ok')
    } catch {
      setTestResult('fail')
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    // Auto-fetch models whenever the panel opens
    fetchModels(config.baseUrl).then(setModels).catch(() => {})
  }, [config.baseUrl])

  return (
    <div
      style={{
        borderTop: `1px solid ${C.border}`,
        padding: '12px 14px',
        background: C.headerBg,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflowY: 'auto',
        maxHeight: 420,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        LM Studio Connection
      </div>

      {/* Server URL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: C.muted }}>Server URL</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={config.baseUrl}
            onChange={(e) => onConfigChange({ ...config, baseUrl: e.target.value })}
            placeholder="http://localhost:1234"
            style={{
              flex: 1,
              background: C.inputBg,
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 6,
              padding: '5px 9px',
              color: '#e2e8f0',
              fontSize: 12,
              fontFamily: 'monospace',
              outline: 'none',
            }}
          />
          <button
            onClick={handleTest}
            disabled={testing}
            title="Test connection to LM Studio"
            style={{
              background: C.inputBg,
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 6,
              padding: '5px 10px',
              color: C.label,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'inherit',
            }}
          >
            {testing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
            Test
          </button>
        </div>
        {testResult === 'ok' && (
          <span style={{ fontSize: 11, color: C.success, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={11} /> Connected — {models.length} model{models.length !== 1 ? 's' : ''} available
          </span>
        )}
        {testResult === 'fail' && (
          <span style={{ fontSize: 11, color: C.error, display: 'flex', alignItems: 'center', gap: 4 }}>
            <WifiOff size={11} /> Cannot connect. Is LM Studio running with CORS enabled?
          </span>
        )}
      </div>

      {/* Model selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: C.muted }}>
          Model <span style={{ color: C.muted, fontStyle: 'italic' }}>(leave blank to use loaded model)</span>
        </label>
        {models.length > 0 ? (
          <div style={{ position: 'relative' }}>
            <select
              value={config.model}
              onChange={(e) => onConfigChange({ ...config, model: e.target.value })}
              style={{
                width: '100%',
                background: C.inputBg,
                border: `1px solid ${C.inputBorder}`,
                borderRadius: 6,
                padding: '5px 28px 5px 9px',
                color: '#e2e8f0',
                fontSize: 12,
                appearance: 'none',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <option value="">— auto (use loaded model) —</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              color={C.muted}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
          </div>
        ) : (
          <input
            value={config.model}
            onChange={(e) => onConfigChange({ ...config, model: e.target.value })}
            placeholder="auto"
            style={{
              background: C.inputBg,
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 6,
              padding: '5px 9px',
              color: '#e2e8f0',
              fontSize: 12,
              fontFamily: 'monospace',
              outline: 'none',
            }}
          />
        )}
      </div>

      {/* Recommended LM Studio system prompt */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: C.muted }}>
          Recommended LM Studio system prompt
          <span style={{ display: 'block', fontStyle: 'italic', fontWeight: 400, marginTop: 1 }}>
            Paste into LM Studio → Chat tab → System Prompt field
          </span>
        </label>
        <div style={{ position: 'relative' }}>
          <textarea
            readOnly
            value={LM_STUDIO_SYSTEM_PROMPT}
            rows={4}
            style={{
              width: '100%',
              background: C.inputBg,
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 6,
              padding: '6px 9px',
              paddingRight: 52,
              color: '#94a3b8',
              fontSize: 10,
              fontFamily: 'monospace',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              lineHeight: 1.45,
            }}
          />
          <CopyButton text={LM_STUDIO_SYSTEM_PROMPT} />
        </div>
      </div>

      {/* Structured output toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={() => onConfigChange({ ...config, structuredOutput: !config.structuredOutput })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: config.structuredOutput ? 'rgba(34,197,94,0.1)' : C.inputBg,
            border: `1px solid ${config.structuredOutput ? 'rgba(34,197,94,0.4)' : C.inputBorder}`,
            borderRadius: 6,
            padding: '7px 10px',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          {config.structuredOutput
            ? <ToggleRight size={16} color={C.success} style={{ flexShrink: 0 }} />
            : <ToggleLeft size={16} color={C.muted} style={{ flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: config.structuredOutput ? '#86efac' : '#e2e8f0' }}>
              Structured Output {config.structuredOutput ? '(on)' : '(off)'}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
              Forces JSON Schema response — eliminates missing-action issues. Requires a compatible model.
            </div>
          </div>
        </button>

        {config.structuredOutput && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: C.muted }}>JSON Schema sent to LM Studio</label>
            <div style={{ position: 'relative' }}>
              <textarea
                readOnly
                value={JSON.stringify(RISKTREE_JSON_SCHEMA, null, 2)}
                rows={6}
                style={{
                  width: '100%',
                  background: C.inputBg,
                  border: `1px solid ${C.inputBorder}`,
                  borderRadius: 6,
                  padding: '6px 9px',
                  paddingRight: 52,
                  color: '#64748b',
                  fontSize: 9,
                  fontFamily: 'monospace',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                  lineHeight: 1.4,
                }}
              />
              <CopyButton text={JSON.stringify(RISKTREE_JSON_SCHEMA, null, 2)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function AiChatPanel() {
  const { nodes, edges, setAiPanelOpen, updateNodeData, updateEdgeData, loadSnapshot } = useTreeStore()

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm your decision analysis assistant. I can help you:\n\n• Estimate realistic probabilities with calibration advice\n• Identify cognitive biases in your estimates\n• Suggest payoff values with context\n• Build complete decision trees from a description\n\nTry asking me to review your current tree, or describe a new decision you'd like to model.",
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [config, setConfig] = useState<LmStudioConfig>(loadConfig)
  const [appliedPatchIds, setAppliedPatchIds] = useState<Set<string>>(new Set())
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Persist config changes
  useEffect(() => {
    saveConfig(config)
  }, [config])

  function stopStreaming() {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)))
  }

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || streaming) return

      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: trimmed }
      const assistantId = `a-${Date.now()}`

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', streaming: true, isStructured: config.structuredOutput },
      ])
      setInput('')
      setStreaming(true)

      const history: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(nodes, edges) },
        ...messages
          .filter((m) => !m.streaming)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: trimmed },
      ]

      const ac = new AbortController()
      abortRef.current = ac

      try {
        let content = ''
        for await (const chunk of streamChat(history, config, ac.signal)) {
          content += chunk
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content, streaming: true } : m)),
          )
        }
        // Structured output: parse JSON and extract message + action
        if (config.structuredOutput) {
          try {
            const parsed = JSON.parse(content) as {
              message?: string
              action_type?: string
              tree?: AiTreeNode
              changes?: AiChange[]
            }
            const displayContent = parsed.message ?? content
            let structuredAction: AiPatch | undefined
            if (parsed.action_type === 'build_tree' && parsed.tree) {
              structuredAction = { action: 'build_tree', tree: parsed.tree }
            } else if (parsed.action_type === 'update_tree' && parsed.changes) {
              structuredAction = { action: 'update_tree', changes: parsed.changes }
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: displayContent, streaming: false, structuredAction }
                  : m,
              ),
            )
          } catch {
            // JSON parse failed — show raw content as-is
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
            )
          }
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content, streaming: false } : m)),
          )
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        const errMsg = err instanceof Error ? err.message : String(err)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Error: ${errMsg}`, streaming: false }
              : m,
          ),
        )
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [messages, nodes, edges, config, streaming],
  )

  function handleApplyPatch(msgId: string, patch: AiPatch) {
    if (patch.action === 'update_tree' && patch.changes) {
      for (const change of patch.changes) {
        const { type, id, ...data } = change
        if (type === 'updateEdge') {
          updateEdgeData(id, data as Parameters<typeof updateEdgeData>[1])
        } else if (type === 'updateNode') {
          updateNodeData(id, data as Parameters<typeof updateNodeData>[1])
        }
      }
    } else if (patch.action === 'build_tree' && patch.tree) {
      try {
        const { nodes: newNodes, edges: newEdges } = buildNodesEdges(patch.tree)
        loadSnapshot({ nodes: newNodes, edges: newEdges })
      } catch (err) {
        alert(`Failed to build tree: ${err instanceof Error ? err.message : String(err)}`)
        return
      }
    }
    setAppliedPatchIds((prev) => new Set([...prev, msgId]))
  }

  function handleForceApply(msgId: string) {
    // Find the assistant message that lacked a patch and ask the model to output the JSON
    const msg = messages.find((m) => m.id === msgId)
    if (!msg) return
    const forcePrompt =
      'Based on your last response, please now output ONLY the build_tree or update_tree JSON action block (wrapped in ```json ... ```) so that the application can apply the changes. Do not include any other text.'
    sendMessage(forcePrompt)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <>
      {/* Keyframe styles injected once */}
      <style>{`
        @keyframes dot-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        style={{
          width: 360,
          minWidth: 360,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: C.panelBg,
          borderLeft: `1px solid ${C.border}`,
          overflow: 'hidden',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 12px',
            height: 40,
            flexShrink: 0,
            background: C.headerBg,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <Bot size={14} color={C.accent} />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9', flex: 1 }}>
            AI Assistant
          </span>
          <span style={{ fontSize: 11, color: C.muted, marginRight: 4 }}>LM Studio</span>

          {streaming && (
            <button
              onClick={stopStreaming}
              title="Stop generating"
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 5,
                padding: '2px 8px',
                color: '#fca5a5',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Stop
            </button>
          )}

          <button
            onClick={() => setShowSettings((v) => !v)}
            title="Connection settings"
            aria-label="Settings"
            style={{
              background: showSettings ? 'rgba(59,130,246,0.15)' : 'none',
              border: `1px solid ${showSettings ? 'rgba(59,130,246,0.4)' : 'transparent'}`,
              borderRadius: 6,
              padding: 5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: showSettings ? C.accent : C.muted,
            }}
          >
            <Settings size={14} />
          </button>

          <button
            onClick={() => setAiPanelOpen(false)}
            title="Close AI assistant"
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              borderRadius: 6,
              padding: 5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: C.muted,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Settings ───────────────────────────────────────────────── */}
        {showSettings && <SettingsPanel config={config} onConfigChange={setConfig} />}

        {/* ── Messages ───────────────────────────────────────────────── */}
        <div
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '12px 10px 4px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onApplyPatch={handleApplyPatch}
              appliedPatchIds={appliedPatchIds}
              onForceApply={handleForceApply}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Quick prompts ──────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 5,
            padding: '6px 10px',
            flexShrink: 0,
            borderTop: `1px solid ${C.divider}`,
          }}
        >
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              onClick={() => sendMessage(qp.prompt)}
              disabled={streaming}
              style={{
                background: C.chipBg,
                border: `1px solid ${C.inputBorder}`,
                borderRadius: 20,
                padding: '3px 9px',
                color: C.label,
                fontSize: 11,
                cursor: streaming ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: streaming ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { if (!streaming) { e.currentTarget.style.background = C.inputBg; e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = '#e2e8f0' } }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.chipBg; e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.color = C.label }}
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* ── Input ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '8px 14px 10px',
            flexShrink: 0,
            borderTop: `1px solid ${C.divider}`,
            alignItems: 'flex-end',
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              // Auto-grow up to 3 rows
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 72) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your decision tree… (Enter to send, Shift+Enter for newline)"
            disabled={streaming}
            aria-label="Message input"
            style={{
              flex: 1,
              background: C.inputBg,
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 8,
              padding: '7px 11px',
              color: '#e2e8f0',
              fontSize: 13,
              resize: 'none',
              outline: 'none',
              overflowY: 'hidden',
              lineHeight: 1.5,
              fontFamily: 'inherit',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.target.style.borderColor = C.inputBorderFocus)}
            onBlur={(e) => (e.target.style.borderColor = C.inputBorder)}
          />

          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            title="Send message (Enter)"
            aria-label="Send"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: input.trim() && !streaming ? C.accent : C.inputBg,
              border: `1px solid ${input.trim() && !streaming ? C.accent : C.inputBorder}`,
              cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: input.trim() && !streaming ? '#fff' : C.muted,
              flexShrink: 0,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {streaming ? (
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>
      </div>
    </>
  )
}
