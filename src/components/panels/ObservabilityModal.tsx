/**
 * @file ObservabilityModal.tsx
 * @description Real-time LLM Telemetry, Token Budget & Cost Analytics Modal.
 *
 * Provides a comprehensive dashboard showing total API calls, token consumption,
 * USD cost calculations, prompt cache savings, and recent generation traces.
 *
 * @module components/panels
 */

import { useState, useEffect } from 'react';
import { X, Activity, DollarSign, Zap, Sparkles, Clock, Layers } from 'lucide-react';
import { langfuse } from '../../services/observability/langfuseClient';
import type { LLMGeneration, TelemetrySummary } from '../../types/observability';
import './ObservabilityModal.css';

interface ObservabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ObservabilityModal({ isOpen, onClose }: ObservabilityModalProps) {
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [recentGens, setRecentGens] = useState<LLMGeneration[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSummary(langfuse.getSummary());
      setRecentGens(langfuse.getRecentGenerations(10));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="telemetry-overlay" role="dialog" aria-modal="true" aria-label="Observability Dashboard">
      <div className="telemetry-modal">
        {/* ── Modal Header ─────────────────────────────────── */}
        <div className="telemetry-header">
          <div className="telemetry-header__title">
            <Activity size={16} className="telemetry-icon--accent" />
            <h3>Langfuse Telemetry & Cost Analytics</h3>
            <span className="telemetry-badge">Live Tracing</span>
          </div>
          <button type="button" className="telemetry-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {/* ── Modal Body ───────────────────────────────────── */}
        <div className="telemetry-body">
          {summary && (
            <>
              {/* Top KPI Cards (with micro-trend styling) */}
              <div className="telemetry-kpi-grid">
                {/* Total Cost */}
                <div className="telemetry-kpi-card">
                  <div className="telemetry-kpi-header">
                    <span className="telemetry-kpi-label">Estimated Cost</span>
                    <DollarSign size={14} className="telemetry-kpi-icon telemetry-kpi-icon--green" />
                  </div>
                  <div className="telemetry-kpi-value">${summary.totalCostUSD.toFixed(4)}</div>
                  <div className="telemetry-kpi-sub">Across all model tiers</div>
                </div>

                {/* Tokens Consumed */}
                <div className="telemetry-kpi-card">
                  <div className="telemetry-kpi-header">
                    <span className="telemetry-kpi-label">Total Tokens</span>
                    <Zap size={14} className="telemetry-kpi-icon telemetry-kpi-icon--warn" />
                  </div>
                  <div className="telemetry-kpi-value">{(summary.totalTokens / 1000).toFixed(1)}k</div>
                  <div className="telemetry-kpi-sub">{summary.totalRequests} total generations</div>
                </div>

                {/* Cache Savings */}
                <div className="telemetry-kpi-card">
                  <div className="telemetry-kpi-header">
                    <span className="telemetry-kpi-label">Cache Savings</span>
                    <Sparkles size={14} className="telemetry-kpi-icon telemetry-kpi-icon--blue" />
                  </div>
                  <div className="telemetry-kpi-value">${summary.cacheSavingsUSD.toFixed(4)}</div>
                  <div className="telemetry-kpi-sub">~90% discount on cache read</div>
                </div>

                {/* Avg Latency */}
                <div className="telemetry-kpi-card">
                  <div className="telemetry-kpi-header">
                    <span className="telemetry-kpi-label">Avg Latency</span>
                    <Clock size={14} className="telemetry-kpi-icon" />
                  </div>
                  <div className="telemetry-kpi-value">{summary.averageLatencyMs}ms</div>
                  <div className="telemetry-kpi-sub">P50 response speed</div>
                </div>
              </div>

              {/* Model Tier Consumption Breakdown */}
              <div className="telemetry-section">
                <div className="telemetry-section-title">
                  <Layers size={13} />
                  <span>Model Tier Distribution</span>
                </div>
                <div className="telemetry-tier-bars">
                  <div className="telemetry-tier-item">
                    <div className="telemetry-tier-info">
                      <span>Tier 1 (Architect / Sonnet / 4o)</span>
                      <span>{(summary.tierBreakdown.tier1Tokens / 1000).toFixed(1)}k tokens</span>
                    </div>
                    <div className="telemetry-bar-track">
                      <div
                        className="telemetry-bar-fill telemetry-bar-fill--t1"
                        style={{
                          width: `${(summary.tierBreakdown.tier1Tokens / Math.max(1, summary.totalTokens)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="telemetry-tier-item">
                    <div className="telemetry-tier-info">
                      <span>Tier 2 (Developers / Haiku / Mini)</span>
                      <span>{(summary.tierBreakdown.tier2Tokens / 1000).toFixed(1)}k tokens</span>
                    </div>
                    <div className="telemetry-bar-track">
                      <div
                        className="telemetry-bar-fill telemetry-bar-fill--t2"
                        style={{
                          width: `${(summary.tierBreakdown.tier2Tokens / Math.max(1, summary.totalTokens)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="telemetry-tier-item">
                    <div className="telemetry-tier-info">
                      <span>Tier 3 (QA / Reviewer / Flash)</span>
                      <span>{(summary.tierBreakdown.tier3Tokens / 1000).toFixed(1)}k tokens</span>
                    </div>
                    <div className="telemetry-bar-track">
                      <div
                        className="telemetry-bar-fill telemetry-bar-fill--t3"
                        style={{
                          width: `${(summary.tierBreakdown.tier3Tokens / Math.max(1, summary.totalTokens)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Recent Traces Table */}
          <div className="telemetry-section">
            <div className="telemetry-section-title">
              <Activity size={13} />
              <span>Recent LLM Generation Traces</span>
            </div>
            <div className="telemetry-table-container">
              <table className="telemetry-table">
                <thead>
                  <tr>
                    <th>Trace Name</th>
                    <th>Model</th>
                    <th>Agent</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                    <th>Latency</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGens.map((g) => (
                    <tr key={g.id}>
                      <td className="telemetry-cell--name">{g.name}</td>
                      <td>
                        <span className="telemetry-pill">{g.model}</span>
                      </td>
                      <td>{g.agentName}</td>
                      <td>{g.totalTokens}</td>
                      <td className="telemetry-cell--cost">${g.estimatedCostUSD.toFixed(5)}</td>
                      <td>{g.latencyMs}ms</td>
                      <td>
                        <span className="telemetry-status-tag">{g.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
