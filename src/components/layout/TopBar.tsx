/**
 * @file TopBar.tsx
 * @description Application header — chunky, prototype-styled controls.
 *
 * Left: brand, view tabs (icons), project switcher. Middle: workflow,
 * add-agent and rules actions. Right: CLI badge, telemetry, settings.
 *
 * @module components/layout
 */

import type { CSSProperties } from 'react';
import {
  Play, Activity, FolderGit2, Settings, Terminal, UserPlus,
  BookOpenCheck, Home, Building2, BrainCircuit, Blocks,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../store/settingsStore';
import { useProjectStore } from '../../store/projectStore';
import { openProject, goHome } from '../../services/projectController';
import { startWorkflow, useWorkflowStore } from '../../services/workflowSimulator';

export type AppView = 'office' | 'memory';

interface TopBarProps {
  onOpenTelemetry: () => void;
  onOpenSettings: () => void;
  onOpenAddAgent: () => void;
  onToggleRules: () => void;
  view: AppView;
  onViewChange: (view: AppView) => void;
  inProject: boolean;
}

const BTN: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: '#14151d', color: '#e8e8f0',
  border: '1px solid #2c2c3b', borderRadius: 10,
  padding: '9px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

export function TopBar({ onOpenTelemetry, onOpenSettings, onOpenAddAgent, onToggleRules, view, onViewChange, inProject }: TopBarProps) {
  const activeEngine = useSettingsStore(state => state.activeEngine);
  const projects = useProjectStore(s => s.projects);
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const workflowRunning = useWorkflowStore(s => s.running);
  const { t } = useTranslation('agents');
  const { t: tm } = useTranslation('memory');
  const { t: tl } = useTranslation('layout');

  const tabStyle = (active: boolean): CSSProperties => ({
    ...BTN,
    background: active ? '#241f38' : 'transparent',
    color: active ? '#fff' : '#9090a2',
    border: active ? '1px solid #8b5cf6' : '1px solid transparent',
    padding: '8px 14px',
  });

  return (
    <header className="topbar">

      {/* Left cluster: brand + tabs + project */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Blocks size={22} style={{ color: '#a78bfa' }} />
          <h1 style={{ fontSize: 17, fontWeight: 800, color: '#f8f8fb', margin: 0, letterSpacing: 0.3 }}>
            AgentSpace
          </h1>
        </div>

        {inProject && (
          <>
            <div style={{
              display: 'flex', gap: 4, padding: 4,
              background: '#101018', border: '1px solid #23242f', borderRadius: 12,
            }}>
              <button style={tabStyle(view === 'office')} onClick={() => onViewChange('office')}>
                <Building2 size={15} /> {tm('tab_office')}
              </button>
              <button style={tabStyle(view === 'memory')} onClick={() => onViewChange('memory')}>
                <BrainCircuit size={15} /> {tm('tab_memory')}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button style={{ ...BTN, padding: '9px 11px' }} title={tl('top_bar.home_tooltip')} onClick={goHome}>
                <Home size={16} />
              </button>
              <div style={{ ...BTN, cursor: 'default', gap: 10, padding: '5px 8px 5px 14px' }}>
                <FolderGit2 size={15} style={{ color: '#a78bfa' }} />
                <select
                  value={activeProjectId ?? ''}
                  onChange={(e) => openProject(e.target.value)}
                  style={{
                    background: 'transparent', color: '#f8f8fb', border: 'none',
                    fontSize: 13, fontWeight: 600, outline: 'none', maxWidth: 170, cursor: 'pointer',
                  }}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id} style={{ background: '#14151d' }}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Middle cluster: actions */}
      {inProject && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 18 }}>
          <button
            onClick={startWorkflow}
            disabled={workflowRunning}
            style={{
              ...BTN,
              background: workflowRunning ? '#4c3a80' : '#8b5cf6',
              border: '1px solid transparent',
              color: '#fff', padding: '9px 20px',
              cursor: workflowRunning ? 'default' : 'pointer',
            }}
          >
            <Play size={15} />
            {workflowRunning ? tl('top_bar.workflow_running') : tl('top_bar.start_workflow')}
          </button>

          <button style={BTN} onClick={onOpenAddAgent}>
            <UserPlus size={15} style={{ color: '#67e8f9' }} /> {t('add_agent.button')}
          </button>

          <button style={BTN} onClick={onToggleRules}>
            <BookOpenCheck size={15} style={{ color: '#34d399' }} /> {tl('top_bar.rules_button')}
          </button>
        </div>
      )}

      {/* Right cluster */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ ...BTN, cursor: 'default', gap: 8, color: '#c8c8d8' }}>
          <Terminal size={14} style={{ color: '#8b5cf6' }} />
          <span>CLI: <strong style={{ color: '#f8f8fb' }}>{activeEngine}</strong></span>
        </div>
        <span title="Open Telemetry" style={{ display: 'flex' }}>
          <Activity size={19} style={{ cursor: 'pointer', color: '#9090a2' }} onClick={onOpenTelemetry} />
        </span>
        <span title="Open Settings" style={{ display: 'flex' }}>
          <Settings size={19} style={{ cursor: 'pointer', color: '#9090a2' }} onClick={onOpenSettings} />
        </span>
      </div>

    </header>
  );
}
