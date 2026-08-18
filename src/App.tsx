import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopBar } from './components/layout/TopBar';
import { OfficeCanvas } from './components/phaser/OfficeCanvas';
import { MultiTerminalPanel } from './components/terminal/MultiTerminalPanel';
import { RulesDrawer } from './components/panels/RulesDrawer';
import { ObservabilityModal } from './components/panels/ObservabilityModal';
import { SettingsModal } from './components/panels/SettingsModal';
import { AddAgentModal } from './components/panels/AddAgentModal';
import { MemoryView } from './components/memory/MemoryView';
import type { AppView } from './components/layout/TopBar';
import './App.css';

const queryClient = new QueryClient();

function App() {
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [view, setView] = useState<AppView>('office');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-container">
        {/* Header - Real TopBar */}
        <TopBar
          onOpenTelemetry={() => setIsTelemetryOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAddAgent={() => setIsAddAgentOpen(true)}
          onToggleRules={() => setIsRulesOpen(o => !o)}
          view={view}
          onViewChange={setView}
        />

        {/* Memory Map view replaces the whole workspace */}
        {view === 'memory' && (
          <div className="workspace" style={{ display: 'block' }}>
            <MemoryView />
          </div>
        )}

        {/* 2-Row Bento Box Workspace */}
        <div className="workspace" style={view === 'memory' ? { display: 'none' } : undefined}>
          
          {/* Top Row: Office (Landscape Tilemap) */}
          <div className="panel office-column">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', height: '32px', background: 'transparent', borderBottom: '1px solid #2c2c3b' }}>
              <span style={{ color: '#9090a2' }}>HQ — LIVE AGENT SIMULATION</span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }}></div>
                ONLINE
              </span>
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <OfficeCanvas />
              </div>
            </div>
          </div>

          {/* Bottom Row: full-width terminal workspace */}
          <div className="workspace-bottom" style={{ gridTemplateColumns: '1fr' }}>
            <div className="terminal-column" style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
               <MultiTerminalPanel />
            </div>
          </div>

        </div>

        {/* Modals */}
        <ObservabilityModal
          isOpen={isTelemetryOpen}
          onClose={() => setIsTelemetryOpen(false)}
        />
        
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />

        <AddAgentModal
          isOpen={isAddAgentOpen}
          onClose={() => setIsAddAgentOpen(false)}
        />

        <RulesDrawer
          isOpen={isRulesOpen}
          onClose={() => setIsRulesOpen(false)}
        />
      </div>
    </QueryClientProvider>
  );
}

export default App;
