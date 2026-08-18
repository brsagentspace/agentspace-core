import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopBar } from './components/layout/TopBar';
import { OfficeCanvas } from './components/phaser/OfficeCanvas';
import { MultiTerminalPanel } from './components/terminal/MultiTerminalPanel';
import { RulesPanel } from './components/panels/RulesPanel';
import { ObservabilityModal } from './components/panels/ObservabilityModal';
import { SettingsModal } from './components/panels/SettingsModal';
import { AddAgentModal } from './components/panels/AddAgentModal';
import './App.css';

const queryClient = new QueryClient();

function App() {
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-container">
        {/* Header - Real TopBar */}
        <TopBar
          onOpenTelemetry={() => setIsTelemetryOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAddAgent={() => setIsAddAgentOpen(true)}
        />

        {/* 2-Row Bento Box Workspace */}
        <div className="workspace">
          
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

          {/* Bottom Row: Terminal + Rules */}
          <div className="workspace-bottom">
            {/* Center Column: Multi-Terminal Pane (Mosaic) */}
            <div className="terminal-column" style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
               <MultiTerminalPanel />
            </div>

            {/* Right Column: Blueprint Panel */}
            <div className="panel tasks-column">
              <div className="panel-header">
                <span style={{ color: '#f8f8fb' }}>| BLUEPRINT RULES</span>
              </div>
              <div className="panel-content">
                <RulesPanel />
              </div>
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
      </div>
    </QueryClientProvider>
  );
}

export default App;
