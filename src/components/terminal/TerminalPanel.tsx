/**
 * @file TerminalPanel.tsx
 * @description Multi-tab and split-pane terminal panel.
 *
 * Renders xterm.js interactive terminal instances for active agents,
 * allows switching between agents, toggling split views, and spawning
 * interactive sandbox terminal tabs.
 *
 * @module components/terminal
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentSpaceStore } from '../../store';
import { TerminalInstance } from './TerminalInstance';
import type { AgentColor } from '../../types';
import './TerminalPanel.css';

/** Color class suffix mapped from an agent's color token. */
const AGENT_COLOR_CLASS: Record<AgentColor, string> = {
  blue: 'terminal-tab__dot--blue',
  yellow: 'terminal-tab__dot--yellow',
  red: 'terminal-tab__dot--red',
  green: 'terminal-tab__dot--green',
};

/**
 * Renders the multi-tab terminal panel.
 *
 * @returns The terminal panel section element.
 */
export function TerminalPanel() {
  const { t } = useTranslation('layout');
  const agents = useAgentSpaceStore((s) => s.agents);
  const activeTerminalId = useAgentSpaceStore((s) => s.activeTerminalId);
  const setActiveTerminalId = useAgentSpaceStore((s) => s.setActiveTerminalId);

  // Split view toggle state
  const [isSplitView, setIsSplitView] = useState(false);

  /**
   * Returns the BEM modifier class for the agent color dot.
   *
   * @param color - Agent color token.
   * @returns CSS class string for the dot element.
   */
  const getDotClass = (color: AgentColor): string =>
    AGENT_COLOR_CLASS[color] ?? 'terminal-tab__dot--blue';

  const currentActiveAgent =
    agents.find((a) => a.id === activeTerminalId) || agents[0];
  const secondaryAgent =
    agents.find((a) => a.id !== activeTerminalId) || agents[1] || agents[0];

  return (
    <section className="terminal-panel" aria-label="Agent terminals">
      {/* ── Tab Bar & Controls ─────────────────────────── */}
      <div className="terminal-panel__header">
        <div className="terminal-panel__tabs" role="tablist">
          {agents.map((agent) => (
            <button
              key={agent.id}
              role="tab"
              aria-selected={activeTerminalId === agent.id}
              className={[
                'terminal-tab',
                activeTerminalId === agent.id ? 'terminal-tab--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setActiveTerminalId(agent.id)}
            >
              <span
                className={`terminal-tab__dot ${getDotClass(agent.color)}`}
                aria-hidden="true"
              />
              <span className="terminal-tab__name">{agent.name}</span>
            </button>
          ))}
        </div>

        {/* Action Controls (Split view toggle) */}
        <div className="terminal-panel__actions">
          <button
            type="button"
            className={[
              'terminal-action-btn',
              isSplitView ? 'terminal-action-btn--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setIsSplitView((prev) => !prev)}
            title="Toggle Split View"
            aria-label="Toggle Split View"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 3v18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Terminal Content View (Single or Split) ─────── */}
      <div
        className={[
          'terminal-panel__body',
          isSplitView ? 'terminal-panel__body--split' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {currentActiveAgent ? (
          <div className="terminal-panel__pane">
            <div className="terminal-panel__pane-header">
              <span className="terminal-panel__pane-title">
                {currentActiveAgent.name} • {currentActiveAgent.role.toUpperCase()}
              </span>
              <span className="terminal-panel__pane-task">
                {currentActiveAgent.currentTask || t('status.loading')}
              </span>
            </div>
            <div className="terminal-panel__pane-body">
              <TerminalInstance
                key={currentActiveAgent.id}
                agentId={currentActiveAgent.id}
                agentName={currentActiveAgent.name}
              />
            </div>
          </div>
        ) : null}

        {isSplitView && secondaryAgent && secondaryAgent.id !== currentActiveAgent?.id ? (
          <div className="terminal-panel__pane terminal-panel__pane--secondary">
            <div className="terminal-panel__pane-header">
              <span className="terminal-panel__pane-title">
                {secondaryAgent.name} • {secondaryAgent.role.toUpperCase()}
              </span>
              <span className="terminal-panel__pane-task">
                {secondaryAgent.currentTask || t('status.loading')}
              </span>
            </div>
            <div className="terminal-panel__pane-body">
              <TerminalInstance
                key={secondaryAgent.id}
                agentId={secondaryAgent.id}
                agentName={secondaryAgent.name}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
