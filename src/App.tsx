import { useState } from 'react';
import { Maximize2, Minimize2, RadioTower } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopBar } from './components/layout/TopBar';
import { OfficeCanvas } from './components/phaser/OfficeCanvas';
import { MultiTerminalPanel } from './components/terminal/MultiTerminalPanel';
import { RulesDrawer } from './components/panels/RulesDrawer';
import { ObservabilityModal } from './components/panels/ObservabilityModal';
import { SettingsModal } from './components/panels/SettingsModal';
import { AddAgentModal } from './components/panels/AddAgentModal';
import { MemoryView } from './components/memory/MemoryView';
import { HomeScreen } from './components/home/HomeScreen';
import { useProjectStore } from './store/projectStore';
import { hydrateActiveProject } from './services/projectController';
import type { AppView } from './components/layout/TopBar';
import './App.css';

const queryClient = new QueryClient();

function App() {
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [view, setView] = useState<AppView>('office');
  const [officeFull, setOfficeFull] = useState(false);
  const activeProjectId = useProjectStore(s => s.activeProjectId);

  // Re-apply the persisted project (team + terminal workspace) BEFORE the
  // first render commits: child effects run before parent effects, so a
  // useEffect here would let terminal panes boot their PTYs from the default
  // sessions and lose the saved Claude session ids they should resume.
  useState(() => { hydrateActiveProject(); });

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
          inProject={activeProjectId !== null}
        />

        {/* Home: project launcher (no active project) */}
        {activeProjectId === null && (
          <div className="workspace" style={{ display: 'block' }}>
            <HomeScreen />
          </div>
        )}

        {/* Memory Map view replaces the whole workspace */}
        {activeProjectId !== null && view === 'memory' && (
          <div className="workspace" style={{ display: 'block' }}>
            <MemoryView />
          </div>
        )}

        {/* 2-Row Bento Box Workspace (mounted only inside a project so
            Phaser never boots into a hidden 0x0 container) */}
        {activeProjectId !== null && (
        <div
          className="workspace"
          style={{
            ...(view === 'memory' ? { display: 'none' } : {}),
            ...(officeFull ? { gridTemplateRows: '1fr' } : {}),
          }}
        >

          {/* Top Row: Office (Landscape Tilemap) */}
          <div className="panel office-column">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', height: '34px', background: 'transparent', borderBottom: '1px solid #2c2c3b' }}>
              <span style={{ color: '#9090a2', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RadioTower size={13} /> HQ — LIVE AGENT SIMULATION
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }}></span>
                  ONLINE
                </span>
                <button
                  onClick={() => {
                    setOfficeFull(f => !f);
                    // Phaser's RESIZE scale mode occasionally misses pure
                    // CSS-grid changes; nudge it after the layout settles.
                    setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
                  }}
                  title={officeFull ? 'Küçült' : 'Tam ekran'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26, background: 'transparent',
                    border: '1px solid #2c2c3b', borderRadius: 6,
                    color: '#9090a2', cursor: 'pointer',
                  }}
                >
                  {officeFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </span>
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <OfficeCanvas />
              </div>
            </div>
          </div>

          {/* Bottom Row: full-width terminal workspace (hidden in office fullscreen) */}
          <div className="workspace-bottom" style={{ gridTemplateColumns: '1fr', ...(officeFull ? { display: 'none' } : {}) }}>
            <div className="terminal-column" style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
               <MultiTerminalPanel />
            </div>
          </div>

        </div>
        )}

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
