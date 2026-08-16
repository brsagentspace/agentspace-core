import "./TerminalPanel.css";

// Phase 3'te xterm.js entegrasyonu yapılacak.
export function TerminalPanel() {
  return (
    <div className="terminal-panel">
      <div className="terminal-panel__tabs">
        <button className="terminal-tab terminal-tab--active">
          <span className="terminal-tab__dot terminal-tab__dot--blue" />
          agent-001
        </button>
        <button className="terminal-tab">
          <span className="terminal-tab__dot terminal-tab__dot--yellow" />
          agent-002
        </button>
        <button className="terminal-tab terminal-tab--add">+</button>
      </div>
      <div className="terminal-panel__body">
        <div className="terminal-panel__placeholder">
          <span className="terminal-cursor">█</span>
          <span className="terminal-hint">xterm.js — Faz 3'te aktif olacak</span>
        </div>
      </div>
    </div>
  );
}
