import { useState, useMemo } from 'react'
import { X, TrendingUp, Activity, BarChart3, Wind, GitBranch } from 'lucide-react'
import { useTreeStore } from '../../store/treeStore'
import { enumeratePaths, tornadoAnalysis, getSensitivityVariables } from '../../engine/sensitivity'
import { computeEMV } from '../../engine/emv'
import { RiskProfileChart } from './RiskProfileChart'
import { TornadoChart } from './TornadoChart'
import { SensitivityDetail } from './SensitivityDetail'
import { BayesianModal } from './BayesianModal'
import { palette } from '../../theme'

type Tab = 'riskProfile' | 'sensitivity' | 'sensitivityDetail'

export function AnalysisModal() {
  const { analysisOpen, setAnalysisOpen, nodes, edges, selectedNodeId } = useTreeStore()
  const [activeTab, setActiveTab] = useState<Tab>('riskProfile')
  const [bayesianOpen, setBayesianOpen] = useState(false)

  const hasParent = useMemo(() => new Set(edges.map((e) => e.target)), [edges])
  const rootNode = useMemo(() => nodes.find((n) => !hasParent.has(n.id)), [nodes, hasParent])
  
  const baseEmv = useMemo(() => {
    if (!rootNode) return 0
    const { emvMap } = computeEMV(nodes, edges)
    return emvMap.get(rootNode.id) ?? 0
  }, [nodes, edges, rootNode])

  const paths = useMemo(() => enumeratePaths(nodes, edges), [nodes, edges])
  const tornado = useMemo(
    () => tornadoAnalysis(nodes, edges, baseEmv),
    [nodes, edges, baseEmv]
  )

  const sensitivityVars = useMemo(
    () => getSensitivityVariables(nodes, edges),
    [nodes, edges]
  )

  // Check if selected node is a chance node for Bayesian
  const selectedChanceNode = useMemo(() => {
    if (!selectedNodeId) return null
    const node = nodes.find(n => n.id === selectedNodeId)
    return node?.data.kind === 'chance' ? node : null
  }, [selectedNodeId, nodes])

  if (!analysisOpen) return null

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setAnalysisOpen(false) }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            width: 760,
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
              background: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                background: '#1d4ed8',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <BarChart3 size={20} color="white" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: palette.gray[900] }}>
                  Decision Analysis
                </h2>
                {rootNode && (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: palette.gray[500] }}>
                    {rootNode.data.label} — Base EMV:{' '}
                    <strong style={{ color: baseEmv >= 0 ? palette.success : palette.error }}>
                      {baseEmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {selectedChanceNode && (
                <button
                  onClick={() => setBayesianOpen(true)}
                  style={{
                    padding: '8px 14px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 6,
                    color: '#1d4ed8',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#dbeafe'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#eff6ff'
                  }}
                >
                  <GitBranch size={14} />
                  Bayesian Update
                </button>
              )}
              <button
                onClick={() => setAnalysisOpen(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: palette.gray[400], 
                  padding: 6,
                  borderRadius: 6,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = palette.gray[100]
                  e.currentTarget.style.color = palette.gray[700]
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = palette.gray[400]
                }}
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ 
            display: 'flex', 
            borderBottom: `1px solid ${palette.gray[200]}`,
            background: palette.gray[50],
          }}>
            <TabBtn 
              active={activeTab === 'riskProfile'} 
              onClick={() => setActiveTab('riskProfile')}
              icon={<TrendingUp size={14} />}
            >
              Risk Profile
            </TabBtn>
            <TabBtn 
              active={activeTab === 'sensitivity'} 
              onClick={() => setActiveTab('sensitivity')}
              icon={<Wind size={14} />}
            >
              Tornado Chart
            </TabBtn>
            <TabBtn 
              active={activeTab === 'sensitivityDetail'} 
              onClick={() => setActiveTab('sensitivityDetail')}
              icon={<Activity size={14} />}
            >
              Sensitivity Detail
            </TabBtn>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {activeTab === 'riskProfile' && <RiskProfileChart paths={paths} />}
            {activeTab === 'sensitivity' && <TornadoChart entries={tornado} baseEmv={baseEmv} />}
            {activeTab === 'sensitivityDetail' && (
              <SensitivityDetail 
                variables={sensitivityVars}
                nodes={nodes}
                edges={edges}
                baseEmv={baseEmv}
              />
            )}
          </div>
        </div>
      </div>

      <BayesianModal
        isOpen={bayesianOpen}
        onClose={() => setBayesianOpen(false)}
        nodeId={selectedChanceNode?.id || null}
      />
    </>
  )
}

function TabBtn({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 20px',
        background: 'none',
        border: 'none',
        borderBottom: active ? `2px solid ${palette.decision.optimal}` : '2px solid transparent',
        color: active ? palette.decision.optimal : palette.gray[500],
        fontWeight: active ? 600 : 500,
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = palette.gray[700]
          e.currentTarget.style.background = palette.gray[100]
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = palette.gray[500]
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      {icon}
      {children}
    </button>
  )
}
