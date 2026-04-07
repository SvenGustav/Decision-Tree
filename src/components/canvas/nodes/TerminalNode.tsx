import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { TreeNode } from '../../../types/tree'
import { useTreeStore } from '../../../store/treeStore'
import { nodeTheme, palette } from '../../../theme'

export const TerminalNode = memo(({ data, id, selected }: NodeProps<TreeNode>) => {
  const setSelectedNode = useTreeStore((s) => s.setSelectedNode)
  const isOptimal = data.isOptimal ?? false

  const payoff = data.payoff ?? 0
  const isPositive = payoff >= 0
  const t = nodeTheme.terminal

  const bg = isOptimal
    ? (isPositive ? t.bgPositiveOptimal : '#fee2e2')
    : (isPositive ? t.bgPositive : t.bgNegative)
  const borderColor = selected
    ? (isPositive ? t.borderPositiveActive : t.borderNegativeActive)
    : isOptimal
      ? (isPositive ? t.borderPositiveActive : t.borderNegativeActive)
      : (isPositive ? t.borderPositive : t.borderNegative)
  const textColor = isPositive ? t.textPositive : t.textNegative

  return (
    <div
      onClick={() => setSelectedNode(id)}
      style={{
        width: 100,
        height: 64,
        background: bg,
        border: selected ? `2px solid ${borderColor}` : `1.5px solid ${borderColor}`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        boxShadow: selected
          ? t.glow
          : isOptimal
            ? t.shadowOptimal
            : t.shadow,
        clipPath: 'polygon(14px 0%, calc(100% - 14px) 0%, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0% 50%)',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Value indicator dot */}
      <div style={{
        position: 'absolute',
        top: 4,
        width: 5,
        height: 5,
        background: isOptimal ? borderColor : palette.gray[300],
        borderRadius: '50%',
      }} />
      
      <div style={{ 
        color: textColor,
        fontWeight: 600, 
        fontSize: 10, 
        textAlign: 'center', 
        padding: '0 18px', 
        lineHeight: 1.3,
      }}>
        {data.label}
      </div>
      
      <div style={{ 
        color: textColor,
        fontSize: 12, 
        fontWeight: 700,
        marginTop: 2,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {payoff >= 0 ? '+' : ''}{payoff.toLocaleString()}
      </div>
      
      {/* Optimal indicator */}
      {isOptimal && (
        <div style={{
          position: 'absolute',
          bottom: -8,
          width: 16,
          height: 16,
          background: isPositive ? '#d97706' : '#dc2626',
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
          background: borderColor,
          border: `1.5px solid ${borderColor}`,
          width: 8,
          height: 8,
          left: 6,
        }} 
      />
    </div>
  )
})
