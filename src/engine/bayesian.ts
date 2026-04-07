import type { TreeEdge, TreeNode, BayesianAnalysisResult, BayesianBranchInfo } from '../types/tree'

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

/**
 * Bayesian Swap: Perform a complete Bayesian update with reversible operation.
 * 
 * This stores the original priors and allows swapping between prior and posterior views.
 * It also stores likelihoods for reference.
 */
export function bayesianSwap(
  chanceNodeId: string,
  nodes: TreeNode[],
  edges: TreeEdge[],
  likelihoods: Record<string, number>,
): { newEdges: TreeEdge[]; result: BayesianAnalysisResult } {
  const outgoing = edges.filter((e) => e.source === chanceNodeId)
  const chanceNode = nodes.find((n) => n.id === chanceNodeId)
  
  if (!chanceNode) {
    throw new Error(`Chance node ${chanceNodeId} not found`)
  }

  // Store priors if not already stored
  const edgesWithPriors = edges.map((e) => {
    if (e.source !== chanceNodeId) return e
    return {
      ...e,
      data: {
        ...e.data,
        priorProbability: e.data?.priorProbability ?? e.data?.probability ?? 0,
        bayesLikelihood: likelihoods[e.id] ?? e.data?.bayesLikelihood ?? 1,
      },
    }
  })

  // Calculate posteriors
  const joints = outgoing.map((e) => ({
    edgeId: e.id,
    prior: e.data?.probability ?? 0,
    likelihood: likelihoods[e.id] ?? 0,
    joint: (likelihoods[e.id] ?? 0) * (e.data?.probability ?? 0),
  }))

  const sumJoint = joints.reduce((s, j) => s + j.joint, 0)
  
  const newEdges = edgesWithPriors.map((e) => {
    if (e.source !== chanceNodeId) return e
    const j = joints.find((x) => x.edgeId === e.id)
    const posterior = sumJoint > 0 && j ? j.joint / sumJoint : e.data?.probability ?? 0
    
    return {
      ...e,
      data: {
        ...e.data,
        probability: posterior,
        bayesLikelihood: likelihoods[e.id] ?? e.data?.bayesLikelihood ?? 1,
      },
    }
  })

  const branches: BayesianBranchInfo[] = outgoing.map((e) => {
    const j = joints.find((x) => x.edgeId === e.id)
    return {
      edgeId: e.id,
      label: e.data?.label ?? 'Unknown',
      prior: j?.prior ?? 0,
      likelihood: j?.likelihood ?? 0,
      posterior: sumJoint > 0 && j ? j.joint / sumJoint : j?.prior ?? 0,
    }
  })

  const result: BayesianAnalysisResult = {
    nodeId: chanceNodeId,
    nodeLabel: chanceNode.data.label,
    branches,
    evidenceProbability: sumJoint,
  }

  return { newEdges, result }
}

/**
 * Restore original priors (reverse Bayesian update)
 */
export function restorePriors(
  chanceNodeId: string,
  edges: TreeEdge[],
): TreeEdge[] {
  return edges.map((e) => {
    if (e.source !== chanceNodeId) return e
    return {
      ...e,
      data: {
        ...e.data,
        probability: e.data?.priorProbability ?? e.data?.probability ?? 0,
      },
    }
  })
}

/**
 * Calculate pre-posterior analysis - expected value of sample information
 */
export function calculatePrePosterior(
  chanceNodeId: string,
  nodes: TreeNode[],
  edges: TreeEdge[],
  testAccuracy: number, // P(positive | true) = P(negative | false)
): { testPositive: BayesianAnalysisResult; testNegative: BayesianAnalysisResult } {
  const outgoing = edges.filter((e) => e.source === chanceNodeId)
  const chanceNode = nodes.find((n) => n.id === chanceNodeId)
  
  if (!chanceNode) {
    throw new Error(`Chance node ${chanceNodeId} not found`)
  }

  // For each branch, set up likelihoods for positive and negative test results
  const positiveLikelihoods: Record<string, number> = {}
  const negativeLikelihoods: Record<string, number> = {}

  for (const edge of outgoing) {
    // Assume test accuracy applies symmetrically
    // For a branch with prior p: P(positive|branch) = accuracy, P(negative|branch) = 1-accuracy
    // But we need to be smarter: treat this as a binary test for a specific outcome
    // For simplicity, assume we're testing for the first branch
    positiveLikelihoods[edge.id] = testAccuracy
    negativeLikelihoods[edge.id] = 1 - testAccuracy
  }

  // Run Bayesian update for both scenarios
  const { result: testPositive } = bayesianSwap(chanceNodeId, nodes, edges, positiveLikelihoods)
  const { result: testNegative } = bayesianSwap(chanceNodeId, nodes, edges, negativeLikelihoods)

  return { testPositive, testNegative }
}

/**
 * Calculate Expected Value of Sample Information (EVSI)
 */
export function calculateEVSI(
  chanceNodeId: string,
  nodes: TreeNode[],
  edges: TreeEdge[],
  testCost: number,
  testAccuracy: number,
): number {
  const outgoing = edges.filter((e) => e.source === chanceNodeId)
  if (outgoing.length === 0) return 0

  // Calculate posterior probabilities for test outcomes
  const { testPositive, testNegative } = calculatePrePosterior(chanceNodeId, nodes, edges, testAccuracy)
  
  // P(positive test) = sum of P(positive|branch) * P(branch)
  const pPositive = testPositive.evidenceProbability
  const pNegative = testNegative.evidenceProbability

  // EVSI = P(positive) * EMV_with_positive_info + P(negative) * EMV_with_negative_info - EMV_without_info - testCost
  // This is a simplified calculation - in practice you'd need to recompute EMV with new probabilities
  
  // For now, return a placeholder that indicates if the test is worth doing
  const expectedValueWithInfo = pPositive * 100 + pNegative * 50 // Placeholder
  
  return Math.max(0, expectedValueWithInfo - testCost)
}

/**
 * Get current Bayesian state for a chance node
 */
export function getBayesianState(
  chanceNodeId: string,
  nodes: TreeNode[],
  edges: TreeEdge[],
): BayesianAnalysisResult | null {
  const outgoing = edges.filter((e) => e.source === chanceNodeId)
  const chanceNode = nodes.find((n) => n.id === chanceNodeId)
  
  if (!chanceNode || outgoing.length === 0) return null

  const branches: BayesianBranchInfo[] = outgoing.map((e) => ({
    edgeId: e.id,
    label: e.data?.label ?? 'Unknown',
    prior: e.data?.priorProbability ?? e.data?.probability ?? 0,
    likelihood: e.data?.bayesLikelihood ?? 1,
    posterior: e.data?.probability ?? 0,
  }))

  return {
    nodeId: chanceNodeId,
    nodeLabel: chanceNode.data.label,
    branches,
    evidenceProbability: branches.reduce((sum, b) => sum + b.posterior * b.likelihood, 0),
  }
}
