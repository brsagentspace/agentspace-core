/**
 * @file StatusBar.tsx
 * @description Bottom application status bar implementing Anti-Vibe-Code SaaS standards.
 *
 * Displays real-time system metrics with Lucide icons, micro-trend visualizers (sparklines),
 * token consumption indicators, and cache hit percentages.
 *
 * @module components/layout
 */

import { useTranslation } from 'react-i18next';
import { Bot, Cpu, HardDrive, Zap, Sparkles } from 'lucide-react';
import { useAgentSpaceStore } from '../../store';
import './StatusBar.css';

/** Application version — sourced from package.json in production. */
const APP_VERSION = '0.1.0';

/**
 * Renders a tiny SVG sparkline path representing real-time trend data.
 */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 36;
  const height = 10;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="status-sparkline" aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="1.2" points={points} />
    </svg>
  );
}

/**
 * Renders the bottom status bar with live system metrics and micro-charts.
 *
 * @returns The status bar footer element.
 */
export function StatusBar() {
  const { t } = useTranslation('layout');

  const stats = useAgentSpaceStore((s) => s.stats);
  const agents = useAgentSpaceStore((s) => s.agents);

  const activeAgentCount = agents.filter((a) => a.status === 'working').length;
  const tokenUsedPercent = Math.round(
    (stats.tokenBudget.used / stats.tokenBudget.total) * 100
  );
  const tokenRemainingK = (stats.tokenBudget.remaining / 1000).toFixed(1);
  const cachePercent = (stats.tokenBudget.cacheHitRate * 100).toFixed(0);

  // Sample trend points for micro-charts
  const cpuTrend = [8, 12, 11, 15, 14, 18, stats.cpuUsage];
  const tokenTrend = [20, 25, 28, 32, 35, 37, tokenUsedPercent];

  return (
    <footer className="status-bar" role="status" aria-label="System status">
      {/* ── Active agents ─────────────────────────────── */}
      <div className="status-item">
        <Bot size={13} className="status-icon status-icon--green" aria-hidden="true" />
        <span className="status-label">{t('status_bar.agents_label')}</span>
        <span className="status-value">
          {t('status_bar.agents_active', { count: activeAgentCount })}
        </span>
      </div>

      <div className="status-divider" aria-hidden="true" />

      {/* ── CPU + Micro-chart ─────────────────────────── */}
      <div className="status-item">
        <Cpu size={13} className="status-icon" aria-hidden="true" />
        <span className="status-label">{t('status_bar.cpu_label')}</span>
        <span className="status-value">{stats.cpuUsage.toFixed(1)}%</span>
        <Sparkline data={cpuTrend} color="#3b82f6" />
      </div>

      <div className="status-divider" aria-hidden="true" />

      {/* ── RAM ───────────────────────────────────────── */}
      <div className="status-item">
        <HardDrive size={13} className="status-icon" aria-hidden="true" />
        <span className="status-label">{t('status_bar.ram_label')}</span>
        <span className="status-value">{stats.ramUsageMB} MB</span>
      </div>

      <div className="status-divider" aria-hidden="true" />

      {/* ── Token budget + Progress & Micro-chart ─────── */}
      <div className="status-item status-item--token">
        <Zap size={13} className="status-icon status-icon--warn" aria-hidden="true" />
        <span className="status-label">{t('status_bar.token_budget_label')}</span>

        <div
          className="token-bar"
          role="progressbar"
          aria-valuenow={tokenUsedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('status_bar.token_budget_label')}
        >
          <div
            className={[
              'token-bar__fill',
              tokenUsedPercent > 80 ? 'token-bar__fill--warn' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ width: `${tokenUsedPercent}%` }}
          />
        </div>

        <span className="status-value">
          {t('status_bar.token_remaining', { amount: tokenRemainingK })}
        </span>
        <Sparkline data={tokenTrend} color="#f59e0b" />
      </div>

      <div className="status-divider" aria-hidden="true" />

      {/* ── Prompt cache hit rate ──────────────────────── */}
      <div className="status-item">
        <Sparkles size={13} className="status-icon status-icon--green" aria-hidden="true" />
        <span className="status-label">{t('status_bar.cache_label')}</span>
        <span className="status-value status-value--green">{cachePercent}%</span>
      </div>

      {/* ── Right-aligned version ─────────────────────── */}
      <div className="status-spacer" />
      <div className="status-item">
        <span className="status-label status-label--muted">
          {t('status_bar.version', { version: APP_VERSION })}
        </span>
      </div>
    </footer>
  );
}
