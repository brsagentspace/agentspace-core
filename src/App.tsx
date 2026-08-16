import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopBar } from './components/layout/TopBar';
import { OfficeCanvas } from './components/phaser/OfficeCanvas';
import { MultiTerminalPanel } from './components/terminal/MultiTerminalPanel';
import { RulesPanel } from './components/panels/RulesPanel';
import { ObservabilityModal } from './components/panels/ObservabilityModal';
import { SettingsModal } from './components/panels/SettingsModal';
import './App.css';

const queryClient = new QueryClient();

function App() {
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-container">
        {/* Header - Real TopBar */}
        <TopBar 
          onOpenTelemetry={() => setIsTelemetryOpen(true)} 
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* 3-Column Bento Box Workspace */}
        <div className="workspace">
          
          {/* Left Column: Office (Clean Tilemap) */}
          <div className="panel office-column">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>| AGENT WORKSPACE</span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></div>
                ONLINE
              </span>
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <OfficeCanvas />
              </div>
            </div>
          </div>

          {/* Center Column: Multi-Terminal Pane (Mosaic) */}
          <div className="terminal-column" style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
             <MultiTerminalPanel />
          </div>

          {/* Right Column: Original Rules & Blueprint Panel */}
          <div className="panel tasks-column">
            <div className="panel-header">
              <span style={{ color: '#f8f8fb' }}>| BLUEPRINT RULES</span>
            </div>
            <div className="panel-content">
              <RulesPanel />
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
      </div>
    </QueryClientProvider>
  );
}

export default App;
