import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react'
import type { TreeEdge } from '../../../types/tree'
import { useTreeStore } from '../../../store/treeStore'

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
    const strokeColor = isOptimal ? '#2563eb' : '#64748b'
    const strokeWidth = isOptimal ? 3 : 2

    const probText =
      data?.probability !== undefined ? `p=${(data.probability * 100).toFixed(0)}%` : ''
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
            stroke: selected ? '#f59e0b' : strokeColor,
            strokeWidth: selected ? 3 : strokeWidth,
            cursor: 'pointer',
          }}
          onClick={() => setSelectedEdge(id)}
        />
        {lines.length > 0 && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                background: isOptimal ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${isOptimal ? '#93c5fd' : '#cbd5e1'}`,
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 10,
                fontWeight: isOptimal ? 700 : 400,
                color: isOptimal ? '#1d4ed8' : '#475569',
                pointerEvents: 'all',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
                userSelect: 'none',
              }}
              onClick={() => setSelectedEdge(id)}
              className="nodrag nopan"
            >
              {lines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    )
  },
)
