import type { Node, Edge } from '@xyflow/react'

// ---- Node types ----
export type NodeKind = 'decision' | 'chance' | 'terminal'

export interface TreeNodeData extends Record<string, unknown> {
  label: string
  kind: NodeKind
  /** Payoff for terminal nodes */
  payoff?: number
  /** Computed Expected Monetary Value (set by EMV engine) */
  emv?: number
  /** Whether this node sits on the optimal decision path */
  isOptimal?: boolean
}

export type TreeNode = Node<TreeNodeData>

// ---- Edge (branch) types ----
export interface BranchData extends Record<string, unknown> {
  label?: string
  /** Probability for branches out of chance nodes (0-1) */
  probability?: number
  /** Incremental payoff along this branch */
  payoff?: number
  /** Whether this branch is on the optimal path */
  isOptimal?: boolean
}

export type TreeEdge = Edge<BranchData>

// ---- Serializable snapshot ----
export interface TreeSnapshot {
  nodes: TreeNode[]
  edges: TreeEdge[]
}

// ---- Analysis types ----
export interface PathResult {
  terminalId: string
  terminalLabel: string
  totalPayoff: number
  probability: number
}

export interface TornadoEntry {
  label: string
  base: number
  low: number
  high: number
  range: number
}
