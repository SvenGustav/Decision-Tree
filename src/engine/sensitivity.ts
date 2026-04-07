import type { 
  PathResult, 
  TornadoEntry, 
  TreeEdge, 
  TreeNode,
  SensitivityVariable,
  SensitivityResult,
  TwoWayResult,
} from '../types/tree'
import { computeEMV } from './emv'

/**
 * Enumerate all root-to-terminal paths and compute their joint probability and cumulative payoff.
 * At decision nodes, only the optimal branch is followed (max-EMV), so probabilities sum to 1.
 */
export function enumeratePaths(nodes: TreeNode[], edges: TreeEdge[]): PathResult[] {
  const { optimalEdges } = computeEMV(nodes, edges)

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const children = new Map<string, { edge: TreeEdge; childId: string }[]>()
  for (const e of edges) {
    if (!children.has(e.source)) children.set(e.source, [])
    children.get(e.source)!.push({ edge: e, childId: e.target })
  }

  const hasParent = new Set(edges.map((e) => e.target))
  const roots = nodes.filter((n) => !hasParent.has(n.id))

  const results: PathResult[] = []

  function dfs(
    nodeId: string,
    cumPayoff: number,
    cumProb: number,
  ) {
    const node = nodeMap.get(nodeId)
    if (!node) return
    const kids = children.get(nodeId) ?? []

    if (node.data.kind === 'terminal' || kids.length === 0) {
      results.push({
        terminalId: nodeId,
        terminalLabel: node.data.label,
        totalPayoff: cumPayoff + (node.data.payoff ?? 0),
        probability: cumProb,
      })
      return
    }

    if (node.data.kind === 'chance') {
      for (const { edge, childId } of kids) {
        const prob = edge.data?.probability ?? 0
        const pay = edge.data?.payoff ?? 0
        dfs(childId, cumPayoff + pay, cumProb * prob)
      }
    } else {
      // decision: only follow the single optimal branch
      for (const { edge, childId } of kids) {
        if (optimalEdges.has(edge.id)) {
          const pay = edge.data?.payoff ?? 0
          dfs(childId, cumPayoff + pay, cumProb)
          break // only one optimal branch per decision node
        }
      }
    }
  }

  for (const root of roots) {
    dfs(root.id, 0, 1)
  }

  return results
}

/**
 * Get all sensitivity variables from the tree
 */
export function getSensitivityVariables(
  nodes: TreeNode[], 
  edges: TreeEdge[]
): SensitivityVariable[] {
  const variables: SensitivityVariable[] = []

  // Edge probabilities and payoffs
  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)
    if (!sourceNode || !targetNode) continue

    const baseLabel = `${sourceNode.data.label} → ${targetNode.data.label}`

    // Probability sensitivity for chance branches
    if (sourceNode.data.kind === 'chance' && edge.data?.probability !== undefined) {
      variables.push({
        id: `prob-${edge.id}`,
        type: 'probability',
        label: `P(${baseLabel})`,
        currentValue: edge.data.probability,
        description: `Probability of branch "${edge.data.label || targetNode.data.label}"`,
        edgeId: edge.id,
      })
    }

    // Payoff sensitivity for edges with non-zero payoff
    if (edge.data?.payoff !== undefined && edge.data.payoff !== 0) {
      variables.push({
        id: `payoff-${edge.id}`,
        type: 'payoff',
        label: `Payoff(${baseLabel})`,
        currentValue: edge.data.payoff,
        description: `Payoff on branch "${edge.data.label || targetNode.data.label}"`,
        edgeId: edge.id,
      })
    }
  }

  // Terminal node payoffs
  for (const node of nodes) {
    if (node.data.kind === 'terminal' && node.data.payoff !== undefined) {
      variables.push({
        id: `terminal-${node.id}`,
        type: 'terminal_payoff',
        label: `Payoff(${node.data.label})`,
        currentValue: node.data.payoff,
        description: `Terminal payoff for "${node.data.label}"`,
        nodeId: node.id,
      })
    }
  }

  return variables
}

/**
 * Compute actual EMV at each step across a variable range and detect decision flips.
 * Returns data points as well as any values where the optimal decision branch changes.
 */
export interface SensitivityPathPoint {
  value: number
  emv: number
  /** IDs of optimal edges from each decision node at this value */
  optimalDecisionEdges: string[]
}

export interface DecisionFlipPoint {
  value: number
  fromEdgeId: string
  toEdgeId: string
}

export function computeSensitivityPath(
  nodes: TreeNode[],
  edges: TreeEdge[],
  variable: SensitivityVariable,
  lowValue: number,
  highValue: number,
  steps: number = 40,
): { points: SensitivityPathPoint[]; flipPoints: DecisionFlipPoint[] } {
  const hasParent = new Set(edges.map((e) => e.target))
  const decisionNodeIds = nodes
    .filter((n) => n.data.kind === 'decision' && !hasParent.has(n.id) === false || n.data.kind === 'decision')
    .map((n) => n.id)

  // Edges from decision nodes
  const decisionEdgesByNode = new Map<string, string[]>()
  for (const id of decisionNodeIds) {
    const out = edges.filter(e => e.source === id).map(e => e.id)
    if (out.length > 0) decisionEdgesByNode.set(id, out)
  }

  const points: SensitivityPathPoint[] = []

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const value = lowValue + (highValue - lowValue) * t
    const testNodes = applyVariable(nodes, variable, value)
    const testEdges = applyVariableToEdges(edges, variable, value)
    const { emvMap, optimalEdges } = computeEMV(testNodes, testEdges)
    const root = testNodes.find((n) => !new Set(testEdges.map(e => e.target)).has(n.id))
    const emv = root ? (emvMap.get(root.id) ?? 0) : 0

    // Collect which optimal edge each decision node is taking
    const optimalDecisionEdges: string[] = []
    for (const [, edgeIds] of decisionEdgesByNode) {
      for (const eid of edgeIds) {
        if (optimalEdges.has(eid)) {
          optimalDecisionEdges.push(eid)
          break
        }
      }
    }

    points.push({ value, emv, optimalDecisionEdges })
  }

  // Detect flip points — where optimalDecisionEdges changes
  const flipPoints: DecisionFlipPoint[] = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].optimalDecisionEdges
    const curr = points[i].optimalDecisionEdges
    // Simple check: compare as sorted strings
    if (prev.slice().sort().join(',') !== curr.slice().sort().join(',')) {
      // Interpolate flip value between prev and curr
      const flipValue = (points[i - 1].value + points[i].value) / 2
      // Find which edge changed
      const fromEdge = prev.find(id => !curr.includes(id)) ?? ''
      const toEdge = curr.find(id => !prev.includes(id)) ?? ''
      if (fromEdge || toEdge) {
        flipPoints.push({ value: flipValue, fromEdgeId: fromEdge, toEdgeId: toEdge })
      }
    }
  }

  return { points, flipPoints }
}


export function runOneWaySensitivity(
  nodes: TreeNode[],
  edges: TreeEdge[],
  variable: SensitivityVariable,
  range: number = 0.3, // ±30%
  _steps: number = 10,
): SensitivityResult {
  const baseEmv = getRootEmv(nodes, edges)
  
  // Calculate bounds
  const isProbability = variable.type === 'probability'
  let lowValue: number
  let highValue: number
  
  if (isProbability) {
    // For probabilities, use absolute bounds
    lowValue = Math.max(0, variable.currentValue - range)
    highValue = Math.min(1, variable.currentValue + range)
  } else {
    // For payoffs, use percentage bounds
    lowValue = variable.currentValue * (1 - range)
    highValue = variable.currentValue * (1 + range)
  }

  // Test low value
  const lowEmv = getEmvWithVariable(nodes, edges, variable, lowValue)
  
  // Test high value
  const highEmv = getEmvWithVariable(nodes, edges, variable, highValue)

  const impact = Math.abs(highEmv - lowEmv)
  const percentChange = baseEmv !== 0 ? (impact / Math.abs(baseEmv)) * 100 : 0

  return {
    variable,
    baseEmv,
    lowValue,
    highValue,
    lowEmv,
    highEmv,
    impact,
    percentChange,
  }
}

/**
 * Run two-way sensitivity analysis
 */
export function runTwoWaySensitivity(
  nodes: TreeNode[],
  edges: TreeEdge[],
  var1: SensitivityVariable,
  var2: SensitivityVariable,
  range: number = 0.2,
  steps: number = 8,
): TwoWayResult {
  // Generate value ranges
  const generateValues = (v: SensitivityVariable): number[] => {
    const isProb = v.type === 'probability'
    const min = isProb ? 0 : v.currentValue * (1 - range)
    const max = isProb ? 1 : v.currentValue * (1 + range)
    const vals: number[] = []
    for (let i = 0; i < steps; i++) {
      vals.push(min + (max - min) * (i / (steps - 1)))
    }
    return vals
  }

  const xValues = generateValues(var1)
  const yValues = generateValues(var2)
  
  const grid: number[][] = []
  
  for (const yVal of yValues) {
    const row: number[] = []
    for (const xVal of xValues) {
      let testNodes = nodes
      let testEdges = edges
      
      // Apply both variables
      testNodes = applyVariable(nodes, var2, yVal)
      testNodes = applyVariable(testNodes, var1, xVal)
      testEdges = applyVariableToEdges(edges, var2, yVal)
      testEdges = applyVariableToEdges(testEdges, var1, xVal)
      
      row.push(getRootEmv(testNodes, testEdges))
    }
    grid.push(row)
  }

  return {
    var1,
    var2,
    grid,
    xValues,
    yValues,
  }
}

/**
 * Run full tornado analysis with improved precision
 */
export function tornadoAnalysis(
  nodes: TreeNode[],
  edges: TreeEdge[],
  _baseEmv: number,
): TornadoEntry[] {
  const variables = getSensitivityVariables(nodes, edges)
  const results: SensitivityResult[] = []

  for (const variable of variables) {
    const result = runOneWaySensitivity(nodes, edges, variable, 0.2, 10)
    if (result.impact > 0.001) { // Filter out negligible impacts
      results.push(result)
    }
  }

  // Sort by impact
  results.sort((a, b) => b.impact - a.impact)

  return results.map(r => ({
    label: r.variable.label,
    base: r.baseEmv,
    low: Math.min(r.lowEmv, r.highEmv),
    high: Math.max(r.lowEmv, r.highEmv),
    range: r.impact,
  }))
}

// Helper functions
function getRootEmv(nodes: TreeNode[], edges: TreeEdge[]): number {
  const hasParent = new Set(edges.map((e) => e.target))
  const root = nodes.find((n) => !hasParent.has(n.id))
  if (!root) return 0
  const { emvMap } = computeEMV(nodes, edges)
  return emvMap.get(root.id) ?? 0
}

function getEmvWithVariable(
  nodes: TreeNode[],
  edges: TreeEdge[],
  variable: SensitivityVariable,
  value: number,
): number {
  const testNodes = applyVariable(nodes, variable, value)
  const testEdges = applyVariableToEdges(edges, variable, value)
  return getRootEmv(testNodes, testEdges)
}

function applyVariable(
  nodes: TreeNode[],
  variable: SensitivityVariable,
  value: number,
): TreeNode[] {
  if (variable.type !== 'terminal_payoff' || !variable.nodeId) {
    return nodes
  }
  
  return nodes.map((n) =>
    n.id === variable.nodeId
      ? { ...n, data: { ...n.data, payoff: value } }
      : n
  )
}

function applyVariableToEdges(
  edges: TreeEdge[],
  variable: SensitivityVariable,
  value: number,
): TreeEdge[] {
  if (variable.type === 'terminal_payoff') return edges
  
  return edges.map((e) => {
    if (variable.type === 'probability' && variable.edgeId === e.id) {
      return { ...e, data: { ...e.data, probability: value } }
    }
    if (variable.type === 'payoff' && variable.edgeId === e.id) {
      return { ...e, data: { ...e.data, payoff: value } }
    }
    return e
  })
}

/**
 * Calculate value of perfect information (VOI)
 */
export function calculateVOI(
  nodes: TreeNode[],
  edges: TreeEdge[],
  chanceNodeId: string,
): number {
  const baseEmv = getRootEmv(nodes, edges)
  
  // Find the chance node
  const chanceNode = nodes.find(n => n.id === chanceNodeId)
  if (!chanceNode || chanceNode.data.kind !== 'chance') return 0
  
  // Get outgoing edges
  const outgoing = edges.filter(e => e.source === chanceNodeId)
  if (outgoing.length === 0) return 0
  
  // Calculate EMV with perfect information (can choose best branch after knowing outcome)
  let emvWithPerfectInfo = 0
  
  for (const edge of outgoing) {
    const prob = edge.data?.probability ?? 0
    const targetNode = nodes.find(n => n.id === edge.target)
    if (!targetNode) continue
    
    // With perfect info, we'd know which branch occurs and can optimize from there
    const { emvMap } = computeEMV(nodes, edges)
    const branchEmv = emvMap.get(targetNode.id) ?? (targetNode.data.payoff ?? 0)
    emvWithPerfectInfo += prob * Math.max(branchEmv, 0) // Can choose to not take negative branches
  }
  
  return Math.max(0, emvWithPerfectInfo - baseEmv)
}
