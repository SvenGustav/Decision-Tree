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
  /** Prior probabilities for Bayesian analysis (stored on chance node) */
  priors?: Record<string, number>
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
  /** Likelihood P(evidence | outcome) for Bayesian revision */
  bayesLikelihood?: number
  /** Prior probability for this branch (before Bayesian update) */
  priorProbability?: number
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

// ---- Sensitivity Analysis types ----
export interface SensitivityVariable {
  id: string
  type: 'probability' | 'payoff' | 'terminal_payoff'
  label: string
  currentValue: number
  description?: string
  edgeId?: string
  nodeId?: string
}

export interface SensitivityResult {
  variable: SensitivityVariable
  baseEmv: number
  lowValue: number
  highValue: number
  lowEmv: number
  highEmv: number
  impact: number
  percentChange: number
}

export interface TwoWayResult {
  var1: SensitivityVariable
  var2: SensitivityVariable
  grid: number[][] // 2D array of EMV values
  xValues: number[]
  yValues: number[]
}

// ---- Bayesian Analysis types ----
export interface BayesianBranchInfo {
  edgeId: string
  label: string
  prior: number
  likelihood: number
  posterior: number
}

export interface BayesianAnalysisResult {
  nodeId: string
  nodeLabel: string
  branches: BayesianBranchInfo[]
  evidenceProbability: number
}
