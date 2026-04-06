import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import type { TreeNode } from '../../../types/tree'
import { useTreeStore } from '../../../store/treeStore'

export const ChanceNode = memo(({ data, id, selected }: NodeProps<TreeNode>) => {
  const setSelectedNode = useTreeStore((s) => s.setSelectedNode)
  const edges = useTreeStore((s) => s.edges)

  const outgoing = edges.filter((e) => e.source === id)
  const probTotal = outgoing.reduce((sum, e) => sum + (e.data?.probability ?? 0), 0)
  const showWarning = outgoing.length > 0 && Math.abs(probTotal - 1) > 0.005

  return (
    <div style={{ position: 'relative' }}>
      {showWarning && (
        <div
          title={`Probabilities sum to ${(probTotal * 100).toFixed(1)}% — must equal exactly 100%`}
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            zIndex: 10,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fbbf24',
            border: '2px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        >
          <AlertTriangle size={10} color="#78350f" />
        </div>
      )}
      <div
        onClick={() => setSelectedNode(id)}
        style={{
          width: 80,
          height: 80,
          background: data.isOptimal ? '#15803d' : '#22c55e',
          border: selected ? '3px solid #f59e0b' : showWarning ? '2px solid #fbbf24' : '2px solid #166534',
          borderRadius: '50%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: selected
            ? '0 0 0 3px rgba(245,158,11,0.4)'
            : showWarning
              ? '0 0 0 2px rgba(251,191,36,0.25)'
              : '0 2px 4px rgba(0,0,0,0.15)',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 11, textAlign: 'center', padding: '0 8px', lineHeight: 1.2 }}>
          {data.label}
        </div>
        {data.emv !== undefined && (
          <div style={{ color: '#bbf7d0', fontSize: 10, marginTop: 3 }}>
            EMV: {data.emv.toFixed(1)}
          </div>
        )}
        <Handle type="target" position={Position.Left} style={{ background: '#fff', border: '2px solid #166534' }} />
        <Handle type="source" position={Position.Right} style={{ background: '#fff', border: '2px solid #166534' }} />
      </div>
    </div>
  )
})
