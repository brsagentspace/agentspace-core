import { useAgentSpaceStore } from "../../store";
import "./StatusBar.css";

export function StatusBar() {
  const stats = useAgentSpaceStore((s) => s.stats);
  const agents = useAgentSpaceStore((s) => s.agents);
  const activeAgents = agents.filter((a) => a.status === "working").length;

  const tokenPct = Math.round(
    (stats.tokenBudget.used / stats.tokenBudget.total) * 100
  );

  return (
    <footer className="status-bar">
      {/* Active Agents */}
      <div className="status-item">
        <span className="status-dot status-dot--green" />
        <span className="status-label">Ajanlar</span>
        <span className="status-value">{activeAgents} aktif</span>
      </div>

      <div className="status-divider" />

      {/* CPU */}
      <div className="status-item">
        <span className="status-label">CPU</span>
        <span className="status-value">{stats.cpuUsage.toFixed(1)}%</span>
      </div>

      <div className="status-divider" />

      {/* RAM */}
      <div className="status-item">
        <span className="status-label">RAM</span>
        <span className="status-value">{stats.ramUsageMB} MB</span>
      </div>

      <div className="status-divider" />

      {/* Token Budget */}
      <div className="status-item status-item--token">
        <span className="status-label">Token Budget</span>
        <div className="token-bar">
          <div
            className={`token-bar__fill ${tokenPct > 80 ? "token-bar__fill--warn" : ""}`}
            style={{ width: `${tokenPct}%` }}
          />
        </div>
        <span className="status-value">
          {(stats.tokenBudget.remaining / 1000).toFixed(1)}k kaldı
        </span>
      </div>

      <div className="status-divider" />

      {/* Cache Hit Rate */}
      <div className="status-item">
        <span className="status-label">Cache</span>
        <span className="status-value status-value--green">
          {(stats.tokenBudget.cacheHitRate * 100).toFixed(0)}%
        </span>
      </div>

      {/* Right side */}
      <div className="status-spacer" />
      <div className="status-item">
        <span className="status-label status-label--muted">AgentSpace v0.1.0</span>
      </div>
    </footer>
  );
}
