import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react'
import { useTreeStore } from '../../store/treeStore'
import { DecisionNode } from './nodes/DecisionNode'
import { ChanceNode } from './nodes/ChanceNode'
import { TerminalNode } from './nodes/TerminalNode'
import { BranchEdge } from './edges/BranchEdge'
import type { TreeNode } from '../../types/tree'
import { palette } from '../../theme'

const nodeTypes = {
  decisionNode: DecisionNode,
  chanceNode: ChanceNode,
  terminalNode: TerminalNode,
}

const edgeTypes = {
  default: BranchEdge,
}

export function DecisionCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNode,
    setSelectedEdge,
    addNode,
  } = useTreeStore()

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [setSelectedNode, setSelectedEdge])

  // Double-click on canvas to add a decision node at that position
  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('.react-flow__node')) return
      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
      addNode('decision', { x: event.clientX - bounds.left - 44, y: event.clientY - bounds.top - 44 })
    },
    [addNode],
  )

  const getMinimapNodeColor = (n: TreeNode) => {
    if (n.type === 'decisionNode') return palette.decision.borderActive
    if (n.type === 'chanceNode') return palette.chance.borderActive
    if (n.data.payoff && n.data.payoff < 0) return '#dc2626'
    return palette.terminal.positive.borderActive
  }

  return (
    <div style={{ width: '100%', height: '100%', background: palette.canvas }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onDoubleClick={onPaneDoubleClick}
        nodeTypes={nodeTypes as unknown as typeof nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'default' }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        minZoom={0.2}
        maxZoom={3}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={1.5} 
          color={palette.canvasGrid}
        />
        <Controls 
          style={{
            background: '#ffffff',
            border: `1px solid ${palette.gray[200]}`,
            borderRadius: 8,
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        />
        <MiniMap
          nodeColor={getMinimapNodeColor}
          style={{ 
            background: '#ffffff', 
            border: `1px solid ${palette.gray[200]}`,
            borderRadius: 8,
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
          nodeBorderRadius={4}
          maskColor={`${palette.gray[200]}80`}
        />
      </ReactFlow>
    </div>
  )
}
