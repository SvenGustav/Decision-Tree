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
      addNode('decision', { x: event.clientX - bounds.left - 40, y: event.clientY - bounds.top - 40 })
    },
    [addNode],
  )

  return (
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
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
      <Controls />
      <MiniMap
        nodeColor={(n: TreeNode) => {
          if (n.type === 'decisionNode') return '#3b82f6'
          if (n.type === 'chanceNode') return '#22c55e'
          return '#f59e0b'
        }}
        style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}
      />
    </ReactFlow>
  )
}
