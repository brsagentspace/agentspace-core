import React from 'react';
import { Play, Activity, FolderGit2, Settings, Terminal } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

interface TopBarProps {
  onOpenTelemetry: () => void;
  onOpenSettings: () => void;
}

export function TopBar({ onOpenTelemetry, onOpenSettings }: TopBarProps) {
  const activeEngine = useSettingsStore(state => state.activeEngine);
  
  return (
    <header className="topbar">
      
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#f8f8fb', margin: 0, letterSpacing: 0.5 }}>
          AgentSpace
        </h1>
      </div>

      {/* Blueprint Selector (Mock logic for now) */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9090a2', fontSize: 12 }}>
          <FolderGit2 size={16} />
          <span>Blueprint:</span>
        </div>
        <select style={{ background: '#191922', color: '#f8f8fb', border: '1px solid #2c2c3b', borderRadius: 4, padding: '4px 8px', fontSize: 12, outline: 'none' }}>
          <option value="web-nextjs">web-nextjs-fullstack.yaml</option>
          <option value="backend-node">backend-node-microservice.yaml</option>
          <option value="ml-python">ml-python-pipeline.yaml</option>
        </select>

        {/* Start Workflow Button */}
        <button 
          style={{ 
            background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 4, 
            padding: '4px 12px', fontSize: 12, fontWeight: 600, display: 'flex', 
            alignItems: 'center', gap: 6, cursor: 'pointer', marginLeft: 16
          }}
        >
          <Play size={14} /> Start Workflow
        </button>
      </div>

      {/* Active CLI Engine Badge */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#2c2c3b', padding: '4px 10px', borderRadius: 12, fontSize: 11, color: '#f8f8fb' }}>
        <Terminal size={12} style={{ color: '#8b5cf6' }} />
        <span>CLI: <strong>{activeEngine}</strong></span>
      </div>

      {/* Right Icons: Telemetry & Settings */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', color: '#9090a2' }}>
        <Activity size={18} style={{ cursor: 'pointer' }} onClick={onOpenTelemetry} title="Open Telemetry" />
        <Settings size={18} style={{ cursor: 'pointer' }} onClick={onOpenSettings} title="Open Settings" />
      </div>

    </header>
  );
}
