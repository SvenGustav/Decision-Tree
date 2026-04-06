import { Toolbar } from './components/panels/Toolbar'
import { PropertiesPanel } from './components/panels/PropertiesPanel'
import { DecisionCanvas } from './components/canvas/DecisionCanvas'
import { AnalysisModal } from './components/analysis/AnalysisModal'
import { AiChatPanel } from './components/ai/AiChatPanel'
import { useTreeStore } from './store/treeStore'

export default function App() {
  const aiPanelOpen = useTreeStore((s) => s.aiPanelOpen)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <Toolbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <DecisionCanvas />
        </div>
        {aiPanelOpen ? <AiChatPanel /> : <PropertiesPanel />}
      </div>
      <AnalysisModal />
    </div>
  )
}
