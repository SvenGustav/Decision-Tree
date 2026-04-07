import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { TreeNode } from '../../../types/tree'
import { useTreeStore } from '../../../store/treeStore'
import { nodeTheme } from '../../../theme'

export const DecisionNode = memo(({ data, id, selected }: NodeProps<TreeNode>) => {
  const setSelectedNode = useTreeStore((s) => s.setSelectedNode)
  const isOptimal = data.isOptimal ?? false
  
  const theme = nodeTheme.decision

  return (
    <div
      onClick={() => setSelectedNode(id)}
      style={{
        width: 88,
        height: 88,
        background: isOptimal ? theme.bgOptimal : theme.bg,
        border: selected
          ? `2px solid ${theme.borderOptimal}`
          : `1.5px solid ${isOptimal ? theme.borderOptimal : theme.border}`,
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        boxShadow: selected
          ? theme.glow
          : isOptimal
            ? theme.shadowOptimal
            : theme.shadow,
        transition: 'all 0.15s ease',
      }}
    >
      {/* Decision icon indicator */}
      <div style={{
        position: 'absolute',
        top: 4,
        left: 4,
        width: 6,
        height: 6,
        background: isOptimal ? theme.borderOptimal : theme.textSecondary,
        borderRadius: 1,
        opacity: 0.7,
      }} />
      
      <div style={{ 
        color: theme.text, 
        fontWeight: 600, 
        fontSize: 11, 
        textAlign: 'center', 
        padding: '0 6px', 
        lineHeight: 1.3,
      }}>
        {data.label}
      </div>
      
      {data.emv !== undefined && (
        <div style={{ 
          color: theme.textSecondary, 
          fontSize: 10, 
          marginTop: 4,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {data.emv.toFixed(1)}
        </div>
      )}
      
      {/* Optimal indicator */}
      {isOptimal && (
        <div style={{
          position: 'absolute',
          bottom: -8,
          width: 16,
          height: 16,
          background: theme.borderOptimal,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
      
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ 
          background: theme.borderOptimal, 
          border: `1.5px solid ${theme.border}`,
          width: 8,
          height: 8,
        }} 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ 
          background: theme.borderOptimal, 
          border: `1.5px solid ${theme.border}`,
          width: 8,
          height: 8,
        }} 
      />
    </div>
  )
})
