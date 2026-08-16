/**
 * @file TerminalPanel.tsx
 * @description Multi-tab terminal panel.
 *
 * Phase 1 placeholder. In Phase 3, each tab will mount an xterm.js
 * Terminal instance connected to a Tauri-managed PTY process via
 * node-pty. Tabs map 1:1 to running agent processes.
 *
 * @module components/terminal
 */

import { useTranslation } from 'react-i18next';
import { useAgentSpaceStore } from '../../store';
import './TerminalPanel.css';

/** Color class suffix mapped from an agent's color token. */
const AGENT_COLOR_CLASS: Record<string, string> = {
  blue:   'terminal-tab__dot--blue',
  yellow: 'terminal-tab__dot--yellow',
  red:    'terminal-tab__dot--red',
  green:  'terminal-tab__dot--green',
};

/**
 * Renders the multi-tab terminal panel.
 *
 * Phase 1: Shows static placeholder tabs and a blinking cursor.
 * Phase 3: Will render xterm.js Terminal instances per agent.
 *
 * @returns The terminal panel section element.
 */
export function TerminalPanel() {
  const { t } = useTranslation('layout');
  const agents = useAgentSpaceStore((s) => s.agents);
  const activeTerminalId = useAgentSpaceStore((s) => s.activeTerminalId);
  const setActiveTerminalId = useAgentSpaceStore((s) => s.setActiveTerminalId);

  /**
   * Returns the BEM modifier class for the agent color dot.
   *
   * @param color - Agent color token.
   * @returns CSS class string for the dot element.
   */
  const getDotClass = (color: string): string =>
    AGENT_COLOR_CLASS[color] ?? 'terminal-tab__dot--blue';

  return (
    <section className="terminal-panel" aria-label="Agent terminals">
      {/* ── Tab bar ─────────────────────────────────────── */}
      <div className="terminal-panel__tabs" role="tablist">
        {/* Dynamically rendered agent tabs (empty in Phase 1) */}
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
            <span className={`terminal-tab__dot ${getDotClass(agent.color)}`} aria-hidden="true" />
            {agent.name}
          </button>
        ))}

        {/* Phase 1 static placeholder tabs */}
        {agents.length === 0 && (
          <>
            <button className="terminal-tab terminal-tab--active" role="tab" aria-selected>
              <span className="terminal-tab__dot terminal-tab__dot--blue" aria-hidden="true" />
              agent-001
            </button>
            <button className="terminal-tab" role="tab" aria-selected={false}>
              <span className="terminal-tab__dot terminal-tab__dot--yellow" aria-hidden="true" />
              agent-002
            </button>
          </>
        )}

        {/* Add new terminal tab */}
        <button
          className="terminal-tab terminal-tab--add"
          type="button"
          title={t('terminal_panel.add_tab_tooltip')}
          aria-label={t('terminal_panel.add_tab_tooltip')}
        >
          +
        </button>
      </div>

      {/* ── Terminal body ───────────────────────────────── */}
      <div className="terminal-panel__body" role="tabpanel">
        {/* Phase 1 blinking cursor placeholder */}
        <div className="terminal-panel__placeholder" role="status">
          <span className="terminal-cursor" aria-hidden="true">█</span>
          <span className="terminal-hint">{t('terminal_panel.placeholder_hint')}</span>
        </div>
      </div>
    </section>
  );
}
