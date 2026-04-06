import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { TreeNode } from '../../../types/tree'
import { useTreeStore } from '../../../store/treeStore'

export const TerminalNode = memo(({ data, id, selected }: NodeProps<TreeNode>) => {
  const setSelectedNode = useTreeStore((s) => s.setSelectedNode)

  const positive = (data.payoff ?? 0) >= 0
  const bg = positive ? (data.isOptimal ? '#b45309' : '#f59e0b') : '#ef4444'
  const border = positive ? '#92400e' : '#991b1b'
  const textColor = '#fff'

  return (
    <div
      onClick={() => setSelectedNode(id)}
      style={{
        width: 90,
        height: 60,
        background: bg,
        border: selected ? `3px solid #6366f1` : `2px solid ${border}`,
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        boxShadow: selected ? '0 0 0 3px rgba(99,102,241,0.4)' : '0 2px 4px rgba(0,0,0,0.15)',
        clipPath: 'polygon(12px 0%, calc(100% - 12px) 0%, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0% 50%)',
        transition: 'background 0.2s',
      }}
    >
      <div style={{ color: textColor, fontWeight: 700, fontSize: 11, textAlign: 'center', padding: '0 16px', lineHeight: 1.2 }}>
        {data.label}
      </div>
      <div style={{ color: textColor, fontSize: 11, fontWeight: 600 }}>
        {data.payoff !== undefined
          ? (data.payoff >= 0 ? '+' : '') + data.payoff.toLocaleString()
          : '—'}
      </div>
      <Handle type="target" position={Position.Left} style={{ background: '#fff', border: `2px solid ${border}`, left: 4 }} />
    </div>
  )
})
