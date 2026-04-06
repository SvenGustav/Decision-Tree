import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { TreeNode } from '../../../types/tree'
import { useTreeStore } from '../../../store/treeStore'

export const DecisionNode = memo(({ data, id, selected }: NodeProps<TreeNode>) => {
  const setSelectedNode = useTreeStore((s) => s.setSelectedNode)

  return (
    <div
      onClick={() => setSelectedNode(id)}
      style={{
        width: 80,
        height: 80,
        background: data.isOptimal ? '#1d4ed8' : '#3b82f6',
        border: selected ? '3px solid #f59e0b' : '2px solid #1e40af',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        boxShadow: selected ? '0 0 0 3px rgba(245,158,11,0.4)' : '0 2px 4px rgba(0,0,0,0.15)',
        transition: 'background 0.2s',
      }}
    >
      <div style={{ color: '#fff', fontWeight: 700, fontSize: 11, textAlign: 'center', padding: '0 4px', lineHeight: 1.2 }}>
        {data.label}
      </div>
      {data.emv !== undefined && (
        <div style={{ color: '#bfdbfe', fontSize: 10, marginTop: 3 }}>
          EMV: {data.emv.toFixed(1)}
        </div>
      )}
      <Handle type="target" position={Position.Left} style={{ background: '#fff', border: '2px solid #1e40af' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#fff', border: '2px solid #1e40af' }} />
    </div>
  )
})
