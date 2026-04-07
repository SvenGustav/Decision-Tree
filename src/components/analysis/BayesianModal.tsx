import { useState, useMemo } from 'react'
import { X, RotateCcw, Calculator, AlertCircle, CheckCircle } from 'lucide-react'
import { useTreeStore } from '../../store/treeStore'
import { bayesianSwap, restorePriors, getBayesianState } from '../../engine/bayesian'
import { palette } from '../../theme'

interface BayesianModalProps {
  isOpen: boolean
  onClose: () => void
  nodeId: string | null
}

export function BayesianModal({ isOpen, onClose, nodeId }: BayesianModalProps) {
  const { nodes, edges, loadSnapshot } = useTreeStore()
  const [likelihoods, setLikelihoods] = useState<Record<string, number>>({})
  const [showResults, setShowResults] = useState(false)

  const chanceNode = useMemo(() => {
    if (!nodeId) return null
    return nodes.find(n => n.id === nodeId && n.data.kind === 'chance')
  }, [nodes, nodeId])

  const outgoingEdges = useMemo(() => {
    if (!nodeId) return []
    return edges.filter(e => e.source === nodeId)
  }, [edges, nodeId])

  // Initialize likelihoods when modal opens
  useMemo(() => {
    const initial: Record<string, number> = {}
    for (const edge of outgoingEdges) {
      initial[edge.id] = edge.data?.bayesLikelihood ?? 0.5
    }
    setLikelihoods(initial)
    setShowResults(false)
  }, [outgoingEdges])

  const bayesianState = useMemo(() => {
    if (!nodeId) return null
    return getBayesianState(nodeId, nodes, edges)
  }, [nodeId, nodes, edges])

  if (!isOpen || !chanceNode) return null

  const totalLikelihood = Object.values(likelihoods).reduce((a, b) => a + b, 0)
  const isValid = totalLikelihood > 0

  const handleApply = () => {
    if (!isValid || !nodeId) return
    const { newEdges } = bayesianSwap(nodeId, nodes, edges, likelihoods)
    loadSnapshot({ nodes, edges: newEdges })
    setShowResults(true)
  }

  const handleRestore = () => {
    if (!nodeId) return
    const newEdges = restorePriors(nodeId, edges)
    loadSnapshot({ nodes, edges: newEdges })
    setShowResults(false)
  }

  const probTotal = outgoingEdges.reduce((sum, e) => sum + (e.data?.probability ?? 0), 0)
  const isProbValid = Math.abs(probTotal - 1) < 0.001

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: 520,
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${palette.gray[200]}`,
            background: `linear-gradient(135deg, ${palette.chance.base} 0%, ${palette.chance.border} 100%)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Calculator size={18} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'white' }}>
                Bayesian Update
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                {chanceNode.data.label}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {!isProbValid && (
            <div style={{
              padding: '12px 16px',
              background: palette.gray[100],
              border: `1px solid ${palette.gray[200]}`,
              borderRadius: 8,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <AlertCircle size={18} color={palette.warning} />
              <span style={{ fontSize: 13, color: palette.gray[700] }}>
                Current probabilities sum to {(probTotal * 100).toFixed(1)}%. Please normalize before applying Bayesian update.
              </span>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: palette.gray[700], margin: '0 0 8px' }}>
              Prior Probabilities
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {outgoingEdges.map(edge => {
                const targetNode = nodes.find(n => n.id === edge.target)
                const prior = edge.data?.priorProbability ?? edge.data?.probability ?? 0
                return (
                  <div key={edge.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: palette.gray[50],
                    borderRadius: 6,
                    border: `1px solid ${palette.gray[200]}`,
                  }}>
                    <span style={{ fontSize: 13, color: palette.gray[700] }}>
                      {edge.data?.label || targetNode?.data.label || 'Branch'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: palette.chance.base }}>
                      {(prior * 100).toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: palette.gray[700], margin: '0 0 8px' }}>
              Likelihoods P(Evidence | Outcome)
            </h3>
            <p style={{ fontSize: 12, color: palette.gray[500], margin: '0 0 12px' }}>
              Enter the probability of observing the evidence given each outcome.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {outgoingEdges.map(edge => {
                const targetNode = nodes.find(n => n.id === edge.target)
                const label = edge.data?.label || targetNode?.data.label || 'Branch'
                const value = likelihoods[edge.id] ?? 0.5
                
                return (
                  <div key={edge.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px',
                    gap: 12,
                    alignItems: 'center',
                  }}>
                    <label style={{ fontSize: 12, color: palette.gray[600] }}>
                      P(Evidence | {label})
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={value}
                        onChange={(e) => setLikelihoods(prev => ({
                          ...prev,
                          [edge.id]: parseFloat(e.target.value)
                        }))}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={value}
                        onChange={(e) => setLikelihoods(prev => ({
                          ...prev,
                          [edge.id]: parseFloat(e.target.value) || 0
                        }))}
                        style={{
                          width: 60,
                          padding: '6px 8px',
                          border: `1px solid ${palette.gray[300]}`,
                          borderRadius: 4,
                          fontSize: 12,
                          textAlign: 'right',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {showResults && bayesianState && (
            <div style={{
              padding: 16,
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
              border: `1px solid ${palette.chance.border}`,
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckCircle size={18} color={palette.chance.optimal} />
                <span style={{ fontSize: 14, fontWeight: 600, color: palette.chance.base }}>
                  Posterior Probabilities Calculated
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bayesianState.branches.map(branch => (
                  <div key={branch.edgeId} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 80px',
                    gap: 12,
                    padding: '8px 12px',
                    background: 'white',
                    borderRadius: 6,
                  }}>
                    <span style={{ fontSize: 12, color: palette.gray[700] }}>{branch.label}</span>
                    <span style={{ fontSize: 11, color: palette.gray[500], textAlign: 'right' }}>
                      Prior: {(branch.prior * 100).toFixed(1)}%
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: palette.chance.optimal, textAlign: 'right' }}>
                      {(branch.posterior * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: `1px solid ${palette.gray[200]}`,
          background: palette.gray[50],
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={handleRestore}
            disabled={!bayesianState?.branches.some(b => b.prior !== b.posterior)}
            style={{
              padding: '10px 16px',
              background: 'white',
              border: `1px solid ${palette.gray[300]}`,
              borderRadius: 6,
              color: palette.gray[600],
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: !bayesianState?.branches.some(b => b.prior !== b.posterior) ? 0.5 : 1,
            }}
          >
            <RotateCcw size={14} />
            Restore Priors
          </button>
          <button
            onClick={handleApply}
            disabled={!isValid}
            style={{
              padding: '10px 20px',
              background: isValid ? palette.chance.base : palette.gray[400],
              border: 'none',
              borderRadius: 6,
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            Apply Bayesian Update
          </button>
        </div>
      </div>
    </div>
  )
}
