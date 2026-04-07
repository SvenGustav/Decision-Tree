import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react'
import type { TreeEdge } from '../../../types/tree'
import { useTreeStore } from '../../../store/treeStore'
import { edgeTheme } from '../../../theme'

export const BranchEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data,
    selected,
  }: EdgeProps<TreeEdge>) => {
    const setSelectedEdge = useTreeStore((s) => s.setSelectedEdge)
    const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })

    const isOptimal = data?.isOptimal ?? false
    
    const getStrokeColor = () => {
      if (selected) return edgeTheme.selected.stroke
      if (isOptimal) return edgeTheme.optimal.stroke
      return edgeTheme.normal.stroke
    }
    
    const getStrokeWidth = () => {
      if (selected) return edgeTheme.selected.strokeWidth
      if (isOptimal) return edgeTheme.optimal.strokeWidth
      return edgeTheme.normal.strokeWidth
    }

    const probText =
      data?.probability !== undefined ? `${(data.probability * 100).toFixed(0)}%` : ''
    const payText =
      data?.payoff !== undefined && data.payoff !== 0
        ? (data.payoff >= 0 ? '+' : '') + data.payoff.toLocaleString()
        : ''
    
    const lines = [data?.label, probText, payText].filter(Boolean)

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: getStrokeColor(),
            strokeWidth: getStrokeWidth(),
            cursor: 'pointer',
            transition: 'stroke 0.2s, stroke-width 0.2s',
          }}
          onClick={() => setSelectedEdge(id)}
        />
        {lines.length > 0 && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                background: 'white',
                border: `1px solid ${isOptimal ? '#93c5fd' : '#e2e8f0'}`,
                borderRadius: 4,
                padding: '3px 7px',
                fontSize: 10,
                fontWeight: isOptimal ? 600 : 500,
                color: isOptimal ? '#1d4ed8' : '#475569',
                pointerEvents: 'all',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
                userSelect: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
              onClick={() => setSelectedEdge(id)}
              className="nodrag nopan"
            >
              {lines.map((l, i) => (
                <div key={i} style={{ 
                  textAlign: 'center',
                  color: i === 1 && data?.probability !== undefined ? '#d97706' : undefined,
                }}>{l}</div>
              ))}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    )
  },
)
