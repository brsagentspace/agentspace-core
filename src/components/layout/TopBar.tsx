import type { CSSProperties } from 'react';
import { Play, Activity, FolderGit2, Settings, Terminal, UserPlus, BookOpenCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/settingsStore';

export type AppView = 'office' | 'memory';

interface TopBarProps {
  onOpenTelemetry: () => void;
  onOpenSettings: () => void;
  onOpenAddAgent: () => void;
  onToggleRules: () => void;
  view: AppView;
  onViewChange: (view: AppView) => void;
}

export function TopBar({ onOpenTelemetry, onOpenSettings, onOpenAddAgent, onToggleRules, view, onViewChange }: TopBarProps) {
  const activeEngine = useSettingsStore(state => state.activeEngine);
  const { t } = useTranslation('agents');
  const { t: tm } = useTranslation('memory');
  const { t: tl } = useTranslation('layout');

  const tabStyle = (active: boolean): CSSProperties => ({
    background: active ? '#241f38' : 'transparent',
    color: active ? '#fff' : '#9090a2',
    border: active ? '1px solid #8b5cf6' : '1px solid #2c2c3b',
    borderRadius: 4,
    padding: '4px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  });
  
  return (
    <header className="topbar">
      
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#f8f8fb', margin: 0, letterSpacing: 0.5 }}>
          AgentSpace
        </h1>
      </div>

      {/* View Tabs */}
      <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
        <button style={tabStyle(view === 'office')} onClick={() => onViewChange('office')}>
          {tm('tab_office')}
        </button>
        <button style={tabStyle(view === 'memory')} onClick={() => onViewChange('memory')}>
          {tm('tab_memory')}
        </button>
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

        {/* Add Agent Button */}
        <button
          onClick={onOpenAddAgent}
          style={{
            background: '#191922', color: '#f8f8fb', border: '1px solid #2c2c3b', borderRadius: 4,
            padding: '4px 12px', fontSize: 12, fontWeight: 600, display: 'flex',
            alignItems: 'center', gap: 6, cursor: 'pointer'
          }}
        >
          <UserPlus size={14} style={{ color: '#67e8f9' }} /> {t('add_agent.button')}
        </button>

        {/* Blueprint Rules Drawer Toggle */}
        <button
          onClick={onToggleRules}
          style={{
            background: '#191922', color: '#f8f8fb', border: '1px solid #2c2c3b', borderRadius: 4,
            padding: '4px 12px', fontSize: 12, fontWeight: 600, display: 'flex',
            alignItems: 'center', gap: 6, cursor: 'pointer'
          }}
        >
          <BookOpenCheck size={14} style={{ color: '#34d399' }} /> {tl('top_bar.rules_button')}
        </button>
      </div>

      {/* Active CLI Engine Badge */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#2c2c3b', padding: '4px 10px', borderRadius: 12, fontSize: 11, color: '#f8f8fb' }}>
        <Terminal size={12} style={{ color: '#8b5cf6' }} />
        <span>CLI: <strong>{activeEngine}</strong></span>
      </div>

      {/* Right Icons: Telemetry & Settings */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', color: '#9090a2' }}>
        <span title="Open Telemetry" style={{ display: 'flex' }}>
          <Activity size={18} style={{ cursor: 'pointer' }} onClick={onOpenTelemetry} />
        </span>
        <span title="Open Settings" style={{ display: 'flex' }}>
          <Settings size={18} style={{ cursor: 'pointer' }} onClick={onOpenSettings} />
        </span>
      </div>

    </header>
  );
}
