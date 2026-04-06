import type { TreeEdge, TreeNode } from '../types/tree'

/**
 * Bayesian revision ("flip") for a chance node.
 *
 * Given a chance node whose branches have prior probabilities P(outcome_i),
 * and given a new test with likelihoods P(evidence_j | outcome_i) stored as
 * `bayesLikelihood` on each outgoing edge, compute posterior:
 *   P(outcome_i | evidence) = P(evidence | outcome_i) × P(outcome_i) / P(evidence)
 *
 * For the simple UI case we just allow the user to enter the posterior probabilities
 * directly. This helper normalises probabilities so they sum to 1.
 */
export function normalizeProbabilities(
  chanceNodeId: string,
  edges: TreeEdge[],
): TreeEdge[] {
  const outgoing = edges.filter((e) => e.source === chanceNodeId)
  const total = outgoing.reduce((s, e) => s + (e.data?.probability ?? 0), 0)
  if (total === 0) return edges

  return edges.map((e) => {
    if (e.source !== chanceNodeId) return e
    return {
      ...e,
      data: {
        ...e.data,
        probability: (e.data?.probability ?? 0) / total,
      },
    }
  })
}

/**
 * Perform a full Bayesian revision on a chance node.
 *
 * The user provides likelihoods P(positive_test | branch_i) for each branch.
 * We compute:
 *   P(branch_i | positive_test) = P(positive_test | branch_i) × P(branch_i) / Σ(...)
 */
export function bayesianRevision(
  chanceNodeId: string,
  _nodes: TreeNode[],
  edges: TreeEdge[],
  /** Map from edgeId to P(evidence | outcome) */
  likelihoods: Record<string, number>,
): TreeEdge[] {
  const outgoing = edges.filter((e) => e.source === chanceNodeId)

  // Compute joint P(evidence, outcome_i) = likelihood_i × prior_i
  const joints = outgoing.map((e) => ({
    edgeId: e.id,
    joint: (likelihoods[e.id] ?? 0) * (e.data?.probability ?? 0),
  }))

  const sumJoint = joints.reduce((s, j) => s + j.joint, 0)
  if (sumJoint === 0) return edges

  return edges.map((e) => {
    if (e.source !== chanceNodeId) return e
    const j = joints.find((x) => x.edgeId === e.id)
    return {
      ...e,
      data: {
        ...e.data,
        probability: j ? j.joint / sumJoint : e.data?.probability ?? 0,
      },
    }
  })
}
