import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import type { TreeNode } from '../../../types/tree'
import { useTreeStore } from '../../../store/treeStore'
import { nodeTheme } from '../../../theme'

export const ChanceNode = memo(({ data, id, selected }: NodeProps<TreeNode>) => {
  const setSelectedNode = useTreeStore((s) => s.setSelectedNode)
  const edges = useTreeStore((s) => s.edges)
  const isOptimal = data.isOptimal ?? false

  const outgoing = edges.filter((e) => e.source === id)
  const probTotal = outgoing.reduce((sum, e) => sum + (e.data?.probability ?? 0), 0)
  const showWarning = outgoing.length > 0 && Math.abs(probTotal - 1) > 0.005
  
  const theme = nodeTheme.chance

  return (
    <div style={{ position: 'relative' }}>
      {/* Warning badge */}
      {showWarning && (
        <div
          title={`Probabilities sum to ${(probTotal * 100).toFixed(1)}% — must equal exactly 100%`}
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            zIndex: 10,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fbbf24',
            border: '2px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          <AlertTriangle size={11} color="#78350f" />
        </div>
      )}
      
      <div
        onClick={() => setSelectedNode(id)}
        style={{
          width: 88,
          height: 88,
          background: isOptimal ? theme.bgOptimal : theme.bg,
          border: selected
            ? `2px solid ${theme.borderOptimal}`
            : showWarning
              ? '1.5px solid #fcd34d'
              : `1.5px solid ${isOptimal ? theme.borderOptimal : theme.border}`,
          borderRadius: '50%',
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
        {/* Chance indicator */}
        <div style={{
          position: 'absolute',
          top: 6,
          width: 5,
          height: 5,
          background: isOptimal ? theme.borderOptimal : theme.textSecondary,
          borderRadius: '50%',
          opacity: 0.6,
        }} />
        
        <div style={{ 
          color: theme.text, 
          fontWeight: 600, 
          fontSize: 11, 
          textAlign: 'center', 
          padding: '0 10px', 
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
            bottom: -6,
            width: 14,
            height: 14,
            background: theme.borderOptimal,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
            left: -4,
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
            right: -4,
          }} 
        />
      </div>
    </div>
  )
})
