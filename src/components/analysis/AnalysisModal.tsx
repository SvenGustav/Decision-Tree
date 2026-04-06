import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { useTreeStore } from '../../store/treeStore'
import { enumeratePaths, tornadoAnalysis } from '../../engine/sensitivity'
import { computeEMV } from '../../engine/emv'
import { RiskProfileChart } from './RiskProfileChart'
import { TornadoChart } from './TornadoChart'

type Tab = 'riskProfile' | 'sensitivity'

export function AnalysisModal() {
  const { analysisOpen, setAnalysisOpen, nodes, edges } = useTreeStore()
  const [activeTab, setActiveTab] = useState<Tab>('riskProfile')

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
    [nodes, edges, baseEmv],
  )

  if (!analysisOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setAnalysisOpen(false) }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: 680,
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              Decision Analysis
            </h2>
            {rootNode && (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                Root: <strong>{rootNode.data.label}</strong> — Base EMV:{' '}
                <strong style={{ color: baseEmv >= 0 ? '#15803d' : '#b91c1c' }}>
                  {baseEmv.toFixed(2)}
                </strong>
              </p>
            )}
          </div>
          <button
            onClick={() => setAnalysisOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
          <TabBtn active={activeTab === 'riskProfile'} onClick={() => setActiveTab('riskProfile')}>
            Risk Profile
          </TabBtn>
          <TabBtn active={activeTab === 'sensitivity'} onClick={() => setActiveTab('sensitivity')}>
            Sensitivity (Tornado)
          </TabBtn>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'riskProfile' && <RiskProfileChart paths={paths} />}
          {activeTab === 'sensitivity' && <TornadoChart entries={tornado} baseEmv={baseEmv} />}
        </div>
      </div>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
        color: active ? '#2563eb' : '#64748b',
        fontWeight: active ? 600 : 400,
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}
