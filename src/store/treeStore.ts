import { create } from 'zustand'
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'
import type { TreeNode, TreeEdge, TreeSnapshot } from '../types/tree'
import { computeEMV } from '../engine/emv'

let idCounter = 1
function nextId(prefix: string) {
  return `${prefix}-${idCounter++}`
}

interface TreeStore {
  nodes: TreeNode[]
  edges: TreeEdge[]

  // React Flow handlers
  onNodesChange: (changes: NodeChange<TreeNode>[]) => void
  onEdgesChange: (changes: EdgeChange<TreeEdge>[]) => void
  onConnect: (connection: Connection) => void

  // CRUD
  addNode: (kind: TreeNode['data']['kind'], position?: { x: number; y: number }) => void
  updateNodeData: (id: string, data: Partial<TreeNode['data']>) => void
  updateEdgeData: (id: string, data: Partial<TreeEdge['data']>) => void
  deleteNode: (id: string) => void
  deleteEdge: (id: string) => void

  // Selection
  selectedNodeId: string | null
  selectedEdgeId: string | null
  setSelectedNode: (id: string | null) => void
  setSelectedEdge: (id: string | null) => void

  // EMV engine
  runEMV: () => void

  // Persist
  loadSnapshot: (snap: TreeSnapshot) => void
  clearTree: () => void

  // Analysis modal
  analysisOpen: boolean
  setAnalysisOpen: (open: boolean) => void

  // AI chat panel
  aiPanelOpen: boolean
  setAiPanelOpen: (open: boolean) => void
}

const STORAGE_KEY = 'risktree_snapshot'

function saveToStorage(nodes: TreeNode[], edges: TreeEdge[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }))
  } catch {
    // ignore quota errors
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSave(nodes: TreeNode[], edges: TreeEdge[]) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveToStorage(nodes, edges), 1000)
}

function defaultTree(): { nodes: TreeNode[]; edges: TreeEdge[] } {
  // Try to load from localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as TreeSnapshot
      if (parsed.nodes?.length) return parsed
    }
  } catch {
    // ignore
  }

  // Default: small example tree
  const nodes: TreeNode[] = [
    {
      id: 'd1',
      type: 'decisionNode',
      position: { x: 80, y: 250 },
      data: { kind: 'decision', label: 'Decision' },
    },
    {
      id: 'c1',
      type: 'chanceNode',
      position: { x: 320, y: 120 },
      data: { kind: 'chance', label: 'Option A' },
    },
    {
      id: 'c2',
      type: 'chanceNode',
      position: { x: 320, y: 380 },
      data: { kind: 'chance', label: 'Option B' },
    },
    {
      id: 't1',
      type: 'terminalNode',
      position: { x: 560, y: 40 },
      data: { kind: 'terminal', label: 'High', payoff: 200 },
    },
    {
      id: 't2',
      type: 'terminalNode',
      position: { x: 560, y: 200 },
      data: { kind: 'terminal', label: 'Low', payoff: 50 },
    },
    {
      id: 't3',
      type: 'terminalNode',
      position: { x: 560, y: 300 },
      data: { kind: 'terminal', label: 'Good', payoff: 150 },
    },
    {
      id: 't4',
      type: 'terminalNode',
      position: { x: 560, y: 460 },
      data: { kind: 'terminal', label: 'Bad', payoff: -20 },
    },
  ]
  const edges: TreeEdge[] = [
    { id: 'e-d1-c1', source: 'd1', target: 'c1', data: { label: 'Option A', payoff: 0 } },
    { id: 'e-d1-c2', source: 'd1', target: 'c2', data: { label: 'Option B', payoff: 0 } },
    { id: 'e-c1-t1', source: 'c1', target: 't1', data: { label: 'High', probability: 0.4, payoff: 0 } },
    { id: 'e-c1-t2', source: 'c1', target: 't2', data: { label: 'Low', probability: 0.6, payoff: 0 } },
    { id: 'e-c2-t3', source: 'c2', target: 't3', data: { label: 'Good', probability: 0.7, payoff: 0 } },
    { id: 'e-c2-t4', source: 'c2', target: 't4', data: { label: 'Bad', probability: 0.3, payoff: 0 } },
  ]
  return { nodes, edges }
}

function applyEMV(nodes: TreeNode[], edges: TreeEdge[]): { nodes: TreeNode[]; edges: TreeEdge[] } {
  const { emvMap, optimalEdges, optimalNodes } = computeEMV(nodes, edges)

  const updatedNodes = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      emv: emvMap.get(n.id),
      isOptimal: optimalNodes.has(n.id),
    },
  }))

  const updatedEdges = edges.map((e) => ({
    ...e,
    data: {
      ...e.data,
      isOptimal: optimalEdges.has(e.id),
    },
    className: optimalEdges.has(e.id) ? 'optimal' : undefined,
  }))

  return { nodes: updatedNodes, edges: updatedEdges }
}

const { nodes: initNodes, edges: initEdges } = defaultTree()
const { nodes: emvNodes, edges: emvEdges } = applyEMV(initNodes, initEdges)

export const useTreeStore = create<TreeStore>((set, get) => ({
  nodes: emvNodes,
  edges: emvEdges,
  selectedNodeId: null,
  selectedEdgeId: null,
  analysisOpen: false,
  aiPanelOpen: false,

  onNodesChange(changes) {
    const nodes = applyNodeChanges(changes, get().nodes) as TreeNode[]
    set({ nodes })
    debouncedSave(nodes, get().edges)
  },

  onEdgesChange(changes) {
    const edges = applyEdgeChanges(changes, get().edges) as TreeEdge[]
    set({ edges })
    debouncedSave(get().nodes, edges)
  },

  onConnect(connection) {
    const newEdge: TreeEdge = {
      ...connection,
      id: nextId('e'),
      source: connection.source,
      target: connection.target,
      data: { label: 'Branch', probability: undefined, payoff: 0, isOptimal: false },
    }
    const edges = addEdge(newEdge, get().edges) as TreeEdge[]
    const { nodes, edges: e2 } = applyEMV(get().nodes, edges)
    set({ edges: e2, nodes })
    debouncedSave(nodes, e2)
  },

  addNode(kind, position = { x: 300, y: 300 }) {
    const id = nextId(kind === 'decision' ? 'd' : kind === 'chance' ? 'c' : 't')
    const typeMap = { decision: 'decisionNode', chance: 'chanceNode', terminal: 'terminalNode' }
    const node: TreeNode = {
      id,
      type: typeMap[kind],
      position,
      data: {
        kind,
        label: kind === 'decision' ? 'Decision' : kind === 'chance' ? 'Chance' : 'Terminal',
        payoff: kind === 'terminal' ? 0 : undefined,
      },
    }
    const nodes = [...get().nodes, node]
    set({ nodes })
    debouncedSave(nodes, get().edges)
  },

  updateNodeData(id, data) {
    const nodes = get().nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
    )
    const { nodes: n2, edges: e2 } = applyEMV(nodes, get().edges)
    set({ nodes: n2, edges: e2 })
    debouncedSave(n2, e2)
  },

  updateEdgeData(id, data) {
    const edges = get().edges.map((e) =>
      e.id === id ? { ...e, data: { ...e.data, ...data } } : e,
    )
    const { nodes: n2, edges: e2 } = applyEMV(get().nodes, edges)
    set({ nodes: n2, edges: e2 })
    debouncedSave(n2, e2)
  },

  deleteNode(id) {
    const nodes = get().nodes.filter((n) => n.id !== id)
    const edges = get().edges.filter((e) => e.source !== id && e.target !== id)
    const { nodes: n2, edges: e2 } = applyEMV(nodes, edges)
    set({ nodes: n2, edges: e2, selectedNodeId: null })
    debouncedSave(n2, e2)
  },

  deleteEdge(id) {
    const edges = get().edges.filter((e) => e.id !== id)
    const { nodes: n2, edges: e2 } = applyEMV(get().nodes, edges)
    set({ nodes: n2, edges: e2, selectedEdgeId: null })
    debouncedSave(n2, e2)
  },

  setSelectedNode(id) {
    set({ selectedNodeId: id, selectedEdgeId: null })
  },

  setSelectedEdge(id) {
    set({ selectedEdgeId: id, selectedNodeId: null })
  },

  runEMV() {
    const { nodes: n2, edges: e2 } = applyEMV(get().nodes, get().edges)
    set({ nodes: n2, edges: e2 })
    debouncedSave(n2, e2)
  },

  loadSnapshot(snap) {
    const { nodes: n2, edges: e2 } = applyEMV(snap.nodes, snap.edges)
    set({ nodes: n2, edges: e2, selectedNodeId: null, selectedEdgeId: null })
    saveToStorage(n2, e2)
  },

  clearTree() {
    set({ nodes: [], edges: [], selectedNodeId: null, selectedEdgeId: null })
    saveToStorage([], [])
  },

  setAnalysisOpen(open) {
    set({ analysisOpen: open })
  },

  setAiPanelOpen(open) {
    set({ aiPanelOpen: open })
  },
}))
