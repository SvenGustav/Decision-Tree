import type { PathResult, TornadoEntry, TreeEdge, TreeNode } from '../types/tree'
import { computeEMV } from './emv'

/**
 * Enumerate all root-to-terminal paths and compute their joint probability and cumulative payoff.
 */
export function enumeratePaths(nodes: TreeNode[], edges: TreeEdge[]): PathResult[] {
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
    bestDecision: boolean,
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
        dfs(childId, cumPayoff + pay, cumProb * prob, bestDecision)
      }
    } else {
      // decision: enumerate all branches (for the risk profile we show all outcomes,
      // not only optimal; mark best branch)
      for (const { edge, childId } of kids) {
        const pay = edge.data?.payoff ?? 0
        dfs(childId, cumPayoff + pay, cumProb, bestDecision && (edge.data?.isOptimal ?? false))
      }
    }
  }

  for (const root of roots) {
    dfs(root.id, 0, 1, true)
  }

  return results
}

/**
 * Run a simple ±20% tornado sensitivity analysis on edge probabilities and payoffs.
 */
export function tornadoAnalysis(
  nodes: TreeNode[],
  edges: TreeEdge[],
  baseEmv: number,
): TornadoEntry[] {
  const entries: TornadoEntry[] = []
  const DELTA = 0.2


  // Get root node EMV after perturbation
  function rootEmv(mutatedEdges: TreeEdge[]): number {
    const hasParent = new Set(mutatedEdges.map((e) => e.target))
    const root = nodes.find((n) => !hasParent.has(n.id))
    if (!root) return baseEmv
    const { emvMap } = computeEMV(nodes, mutatedEdges)
    return emvMap.get(root.id) ?? baseEmv
  }

  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    if (!sourceNode) continue

    // Sensitivity on probability (chance node branches only)
    if (sourceNode.data.kind === 'chance' && edge.data?.probability !== undefined) {
      const orig = edge.data.probability
      const targetLabel =
        nodes.find((n) => n.id === edge.target)?.data.label ?? edge.target

      const lowEdges = edges.map((e) =>
        e.id === edge.id
          ? { ...e, data: { ...e.data, probability: Math.max(0, orig * (1 - DELTA)) } }
          : e,
      )
      const highEdges = edges.map((e) =>
        e.id === edge.id
          ? { ...e, data: { ...e.data, probability: Math.min(1, orig * (1 + DELTA)) } }
          : e,
      )
      const low = rootEmv(lowEdges)
      const high = rootEmv(highEdges)
      if (low !== high) {
        entries.push({
          label: `P(${sourceNode.data.label} → ${targetLabel})`,
          base: baseEmv,
          low: Math.min(low, high),
          high: Math.max(low, high),
          range: Math.abs(high - low),
        })
      }
    }

    // Sensitivity on branch payoff
    if (edge.data?.payoff !== undefined && edge.data.payoff !== 0) {
      const origPay = edge.data.payoff
      const targetLabel =
        nodes.find((n) => n.id === edge.target)?.data.label ?? edge.target
      const lowEdges = edges.map((e) =>
        e.id === edge.id
          ? { ...e, data: { ...e.data, payoff: origPay * (1 - DELTA) } }
          : e,
      )
      const highEdges = edges.map((e) =>
        e.id === edge.id
          ? { ...e, data: { ...e.data, payoff: origPay * (1 + DELTA) } }
          : e,
      )
      const low = rootEmv(lowEdges)
      const high = rootEmv(highEdges)
      if (low !== high) {
        entries.push({
          label: `Payoff(${sourceNode.data.label} → ${targetLabel})`,
          base: baseEmv,
          low: Math.min(low, high),
          high: Math.max(low, high),
          range: Math.abs(high - low),
        })
      }
    }
  }

  // Sensitivity on terminal node payoffs
  for (const node of nodes) {
    if (node.data.kind !== 'terminal') continue
    const orig = node.data.payoff ?? 0
    if (orig === 0) continue
    const lowNodes = nodes.map((n) =>
      n.id === node.id ? { ...n, data: { ...n.data, payoff: orig * (1 - DELTA) } } : n,
    )
    const highNodes = nodes.map((n) =>
      n.id === node.id ? { ...n, data: { ...n.data, payoff: orig * (1 + DELTA) } } : n,
    )
    const hasParent = new Set(edges.map((e) => e.target))
    const root = nodes.find((n) => !hasParent.has(n.id))
    if (!root) continue
    const low = computeEMV(lowNodes, edges).emvMap.get(root.id) ?? baseEmv
    const high = computeEMV(highNodes, edges).emvMap.get(root.id) ?? baseEmv
    if (low !== high) {
      entries.push({
        label: `Payoff(${node.data.label})`,
        base: baseEmv,
        low: Math.min(low, high),
        high: Math.max(low, high),
        range: Math.abs(high - low),
      })
    }
  }

  return entries.sort((a, b) => b.range - a.range)
}
