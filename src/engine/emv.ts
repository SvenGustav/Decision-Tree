import type { TreeNode, TreeEdge } from '../types/tree'

export interface EmvResult {
  /** Map from nodeId to computed EMV */
  emvMap: Map<string, number>
  /** Set of edge IDs on the optimal decision path */
  optimalEdges: Set<string>
  /** Set of node IDs on the optimal decision path */
  optimalNodes: Set<string>
}

/**
 * Compute Expected Monetary Value (EMV) for every node via bottom-up DFS.
 *
 * Rules:
 *   Terminal  → emv = node.data.payoff (default 0)
 *   Chance    → emv = Σ (branch.probability × child_emv + branch.payoff)
 *   Decision  → emv = max(child_emv + branch.payoff)
 */
export function computeEMV(nodes: TreeNode[], edges: TreeEdge[]): EmvResult {
  const emvMap = new Map<string, number>()
  const optimalEdges = new Set<string>()
  const optimalNodes = new Set<string>()

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Build adjacency: parent → [{edge, childId}]
  const children = new Map<string, { edge: TreeEdge; childId: string }[]>()
  for (const e of edges) {
    if (!children.has(e.source)) children.set(e.source, [])
    children.get(e.source)!.push({ edge: e, childId: e.target })
  }

  // Find root nodes (no incoming edges)
  const hasParent = new Set(edges.map((e) => e.target))
  const roots = nodes.filter((n) => !hasParent.has(n.id))

  function dfs(nodeId: string): number {
    if (emvMap.has(nodeId)) return emvMap.get(nodeId)!
    const node = nodeMap.get(nodeId)
    if (!node) return 0

    const kids = children.get(nodeId) ?? []

    if (node.data.kind === 'terminal' || kids.length === 0) {
      const val = node.data.payoff ?? 0
      emvMap.set(nodeId, val)
      return val
    }

    if (node.data.kind === 'chance') {
      let total = 0
      for (const { edge, childId } of kids) {
        const prob = edge.data?.probability ?? 0
        const branchPayoff = edge.data?.payoff ?? 0
        const childEmv = dfs(childId)
        total += prob * (childEmv + branchPayoff)
      }
      emvMap.set(nodeId, total)
      return total
    }

    // Decision node: pick max
    let bestEmv = -Infinity
    let bestEdge: TreeEdge | null = null
    let bestChild: string | null = null

    for (const { edge, childId } of kids) {
      const branchPayoff = edge.data?.payoff ?? 0
      const val = dfs(childId) + branchPayoff
      if (val > bestEmv) {
        bestEmv = val
        bestEdge = edge
        bestChild = childId
      }
    }

    emvMap.set(nodeId, bestEmv === -Infinity ? 0 : bestEmv)

    if (bestEdge) optimalEdges.add(bestEdge.id)
    if (bestChild) propagateOptimal(bestChild)

    return emvMap.get(nodeId)!
  }

  /** Walk down marking all edges/nodes as optimal after a decision is made. */
  function propagateOptimal(nodeId: string) {
    if (optimalNodes.has(nodeId)) return
    optimalNodes.add(nodeId)
    const node = nodeMap.get(nodeId)
    if (!node) return

    const kids = children.get(nodeId) ?? []
    if (kids.length === 0) return

    if (node.data.kind === 'chance') {
      // All branches of a chance node are optimal (they will all occur with some probability)
      for (const { edge, childId } of kids) {
        optimalEdges.add(edge.id)
        propagateOptimal(childId)
      }
    } else if (node.data.kind === 'decision') {
      // Only the best branch
      let bestEmv = -Infinity
      let bestEdge: TreeEdge | null = null
      let bestChild: string | null = null
      for (const { edge, childId } of kids) {
        const branchPayoff = edge.data?.payoff ?? 0
        const val = (emvMap.get(childId) ?? 0) + branchPayoff
        if (val > bestEmv) {
          bestEmv = val
          bestEdge = edge
          bestChild = childId
        }
      }
      if (bestEdge) optimalEdges.add(bestEdge.id)
      if (bestChild) propagateOptimal(bestChild)
    }
  }

  for (const root of roots) {
    optimalNodes.add(root.id)
    dfs(root.id)
    // propagate from root
    propagateOptimal(root.id)
  }

  return { emvMap, optimalEdges, optimalNodes }
}
